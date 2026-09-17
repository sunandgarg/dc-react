import { createReadStream } from "node:fs";
import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  buildGalleryReplacement,
  buildProductionIndexes,
  canonicalSlug,
  detectRasterImage,
  findStrictProductionMatch,
  originalMediaKey,
  publicMediaUrl,
  sha256,
} from "../src/original-media-migration.mjs";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (!key.startsWith("--")) continue;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) args.set(key, true);
  else {
    args.set(key, value);
    index += 1;
  }
}

const sourcePath = resolve(String(args.get("--source") || ""));
const stateDir = resolve(String(args.get("--state-dir") || "work/original-college-media"));
const overridesPath = args.get("--overrides") ? resolve(String(args.get("--overrides"))) : "";
const bucket = String(args.get("--bucket") || process.env.AWS_S3_BUCKET || "").trim();
const region = String(args.get("--region") || process.env.AWS_REGION || "ap-south-1").trim();
const mediaBaseUrl = String(args.get("--media-base-url") || process.env.MEDIA_BASE_URL || "https://aws-origin.dekhocampus.com/storage/v1/object/public").trim();
const apiBaseUrl = String(args.get("--api-base-url") || "https://aws-origin.dekhocampus.com").replace(/\/$/, "");
const concurrency = Math.max(1, Math.min(32, Number(args.get("--concurrency") || 10)));
const limit = Math.max(0, Number(args.get("--limit") || 0));
const dryRun = args.has("--dry-run");
const forceRefreshSnapshot = args.has("--refresh-snapshot");
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;

if (!sourcePath || sourcePath === resolve(".")) throw new Error("--source JSONL manifest is required");
if (!dryRun && !bucket) throw new Error("--bucket or AWS_S3_BUCKET is required");

const snapshotPath = join(stateDir, "production-colleges.json");
const checkpointPath = join(stateDir, "uploaded-assets.jsonl");
const applyManifestPath = join(stateDir, "apply-manifest.jsonl");
const failuresPath = join(stateDir, "failures.jsonl");
const reportPath = join(stateDir, "upload-report.json");
await mkdir(stateDir, { recursive: true });

const appendQueues = new Map();
function appendJsonLine(path, value) {
  const previous = appendQueues.get(path) || Promise.resolve();
  const next = previous.then(() => appendFile(path, `${JSON.stringify(value)}\n`, "utf8"));
  appendQueues.set(path, next.catch(() => {}));
  return next;
}

async function readJsonLines(path) {
  const rows = [];
  const input = createReadStream(path, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim()) rows.push(JSON.parse(line));
  }
  return rows;
}

async function readReviewedOverrides() {
  if (!overridesPath) return {};
  const parsed = JSON.parse(await readFile(overridesPath, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--overrides must contain a JSON object keyed by legacy college id");
  }
  return parsed;
}

async function fetchProductionSnapshot() {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({
      select: "id,slug,name,city,state,image,gallery_images,updated_at",
      limit: String(pageSize),
      offset: String(offset),
      order: "id.asc",
    });
    const response = await fetch(`${apiBaseUrl}/v1/rest/colleges?${query}`, {
      headers: { accept: "application/json", "user-agent": "DekhoCampus-original-media-migration/1.0" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`Production college snapshot failed (${response.status})`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error("Production college snapshot returned a non-array response");
    rows.push(...page);
    process.stdout.write(`\rProduction snapshot: ${rows.length} colleges`);
    if (page.length < pageSize) break;
  }
  process.stdout.write("\n");
  await writeFile(snapshotPath, `${JSON.stringify(rows)}\n`, "utf8");
  return rows;
}

async function productionRows() {
  if (!forceRefreshSnapshot) {
    try {
      const details = await stat(snapshotPath);
      if (Date.now() - details.mtimeMs < 6 * 60 * 60 * 1000) return JSON.parse(await readFile(snapshotPath, "utf8"));
    } catch {}
  }
  return fetchProductionSnapshot();
}

async function loadCheckpoint() {
  const uploaded = new Map();
  try {
    for (const row of await readJsonLines(checkpointPath)) uploaded.set(`${row.kind}|${row.source_url}`, row);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return uploaded;
}

async function withRetry(operation, label, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 500 * 2 ** (attempt - 1)));
    }
  }
  throw new Error(`${label}: ${lastError?.message || lastError}`);
}

async function downloadImage(sourceUrl) {
  try {
    return await withRetry(async () => {
      const response = await fetch(sourceUrl, {
        redirect: "follow",
        headers: { accept: "*/*", "user-agent": "Mozilla/5.0 (compatible; DekhoCampusMediaMigration/1.0)" },
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`source returned HTTP ${response.status}`);
      const declaredLength = Number(response.headers.get("content-length") || 0);
      if (declaredLength > MAX_IMAGE_BYTES) throw new Error(`source exceeds ${MAX_IMAGE_BYTES} bytes`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error(`invalid image size ${buffer.length}`);
      return { buffer, declaredType: response.headers.get("content-type") || "", recoveredFrom: null };
    }, `download ${sourceUrl}`);
  } catch (sourceError) {
    if (dryRun || !s3) throw sourceError;
    const mirrorPrefix = `legacy-public-assets/static/${sha256(sourceUrl)}-`;
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: mirrorPrefix, MaxKeys: 2 }));
    const matches = listed.Contents || [];
    if (matches.length !== 1 || !matches[0].Key) throw sourceError;
    const mirrored = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: matches[0].Key }));
    const buffer = Buffer.from(await mirrored.Body.transformToByteArray());
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw sourceError;
    return {
      buffer,
      declaredType: mirrored.ContentType || "",
      recoveredFrom: `s3://${bucket}/${matches[0].Key}`,
    };
  }
}

const s3 = dryRun ? null : new S3Client({ region });
const checkpoint = await loadCheckpoint();
let uploadedCount = 0;
let reusedCount = 0;

async function migrateAsset(kind, sourceUrl, context) {
  const checkpointKey = `${kind}|${sourceUrl}`;
  const saved = checkpoint.get(checkpointKey);
  if (saved) {
    reusedCount += 1;
    return saved;
  }
  if (dryRun) return { kind, source_url: sourceUrl, public_url: sourceUrl, dry_run: true };

  const { buffer, declaredType, recoveredFrom } = await downloadImage(sourceUrl);
  const detected = detectRasterImage(buffer, declaredType, sourceUrl);
  const digest = sha256(buffer);
  const key = originalMediaKey(kind, digest, detected.extension);
  let exists = false;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    exists = true;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode !== 404 && error?.name !== "NotFound") throw error;
  }
  if (!exists) {
    await withRetry(() => s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentLength: buffer.length,
      ContentType: detected.contentType,
      CacheControl: "public,max-age=31536000,immutable",
      ServerSideEncryption: "AES256",
      Metadata: {
        "source-url-sha256": sha256(sourceUrl),
        "legacy-college-id": String(context.legacy_id || "").slice(0, 512),
        "legacy-gallery-id": String(context.legacy_gallery_id || "").slice(0, 512),
      },
    })), `upload ${key}`);
  }
  const row = {
    kind,
    source_url: sourceUrl,
    key,
    public_url: publicMediaUrl(mediaBaseUrl, key),
    sha256: digest,
    bytes: buffer.length,
    content_type: detected.contentType,
    reused_s3_object: exists,
    recovered_from: recoveredFrom,
    migrated_at: new Date().toISOString(),
  };
  await appendJsonLine(checkpointPath, row);
  checkpoint.set(checkpointKey, row);
  uploadedCount += 1;
  if ((uploadedCount + reusedCount) % 100 === 0) process.stdout.write(`\rAssets resolved: ${uploadedCount + reusedCount}`);
  return row;
}

async function runConcurrent(items, worker, maxWorkers) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runner() {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(maxWorkers, items.length) }, runner));
  return results;
}

const [sources, production, reviewedOverrides] = await Promise.all([
  readJsonLines(sourcePath),
  productionRows(),
  readReviewedOverrides(),
]);
const indexes = buildProductionIndexes(production);
const productionById = new Map(production.map((row) => [String(row.id), row]));
const selectedSources = limit ? sources.slice(0, limit) : sources;
const report = {
  mode: dryRun ? "dry-run" : "upload",
  started_at: new Date().toISOString(),
  source_manifest: basename(sourcePath),
  source_colleges: selectedSources.length,
  production_colleges: production.length,
  mapping_candidates: 0,
  safely_mapped: 0,
  reviewed_overrides_proposed: 0,
  reviewed_overrides_used: 0,
  mapping_rejected: 0,
  duplicate_source_records: 0,
  source_colleges_archived: 0,
  source_colleges_partial: 0,
  source_colleges_failed: 0,
  unmapped_source_colleges_archived: 0,
  colleges_ready: 0,
  colleges_partial: 0,
  colleges_failed: 0,
  uploaded_assets: 0,
  checkpoint_assets_reused: 0,
  failed_assets: 0,
  current_asset_fallbacks: 0,
  gallery_replacements_skipped: 0,
  mapping_reasons: {},
  samples: { rejected: [], failed: [] },
};

await writeFile(applyManifestPath, "", "utf8");
await writeFile(failuresPath, "", "utf8");
const mapped = [];
const mappingCandidates = new Map();

function mappingPriority(item) {
  const slugMatches = canonicalSlug(item.source.slug) === canonicalSlug(item.production.slug);
  if (item.match_method === "slug+name+city+state") return 400;
  if (item.match_method === "reviewed-override" && slugMatches) return 350;
  if (item.match_method === "name+city+state") return 300;
  return 200;
}

function compareMappingCandidates(left, right) {
  const priority = mappingPriority(right) - mappingPriority(left);
  if (priority) return priority;
  const galleryCount = (right.source.gallery?.length || 0) - (left.source.gallery?.length || 0);
  if (galleryCount) return galleryCount;
  const hero = Number(Boolean(right.source.hero_source_url)) - Number(Boolean(left.source.hero_source_url));
  if (hero) return hero;
  return String(left.source.legacy_id).localeCompare(String(right.source.legacy_id), undefined, { numeric: true });
}

for (const source of selectedSources) {
  let match = findStrictProductionMatch(source, indexes);
  const reviewed = reviewedOverrides[String(source.legacy_id)];
  if (!match.row && reviewed) {
    const candidate = productionById.get(String(reviewed.production_id || ""));
    const legacySlugMatches = canonicalSlug(reviewed.legacy_slug) === canonicalSlug(source.slug);
    const productionSlugMatches = candidate
      && canonicalSlug(reviewed.production_slug) === canonicalSlug(candidate.slug);
    if (candidate && legacySlugMatches && productionSlugMatches && String(reviewed.reason || "").trim()) {
      match = { row: candidate, method: "reviewed-override" };
      report.reviewed_overrides_proposed += 1;
    } else {
      match = { row: null, reason: "invalid-reviewed-override" };
    }
  }
  if (!match.row) {
    report.mapping_rejected += 1;
    report.mapping_reasons[match.reason] = (report.mapping_reasons[match.reason] || 0) + 1;
    if (report.samples.rejected.length < 50) report.samples.rejected.push({ legacy_id: source.legacy_id, slug: source.slug, name: source.name, reason: match.reason });
    continue;
  }
  report.mapping_candidates += 1;
  const productionId = String(match.row.id);
  mappingCandidates.set(productionId, [
    ...(mappingCandidates.get(productionId) || []),
    { source, production: match.row, match_method: match.method },
  ]);
}

for (const candidates of mappingCandidates.values()) {
  candidates.sort(compareMappingCandidates);
  const [winner, ...duplicates] = candidates;
  mapped.push(winner);
  report.safely_mapped += 1;
  if (winner.match_method === "reviewed-override") report.reviewed_overrides_used += 1;
  for (const duplicate of duplicates) {
    report.mapping_rejected += 1;
    report.duplicate_source_records += 1;
    report.mapping_reasons["duplicate-production-target"] = (report.mapping_reasons["duplicate-production-target"] || 0) + 1;
    if (report.samples.rejected.length < 50) {
      report.samples.rejected.push({
        legacy_id: duplicate.source.legacy_id,
        slug: duplicate.source.slug,
        name: duplicate.source.name,
        reason: "duplicate-production-target",
        selected_legacy_id: winner.source.legacy_id,
        production_id: winner.production.id,
      });
    }
  }
}

const mappingByLegacyId = new Map(mapped.map((item) => [String(item.source.legacy_id), item]));

await runConcurrent(selectedSources, async (source) => {
  const selectedMapping = mappingByLegacyId.get(String(source.legacy_id));
  const failures = [];
  async function resolveAsset(kind, sourceUrl, context, galleryIndex = null) {
    try {
      return await migrateAsset(kind, sourceUrl, context);
    } catch (error) {
      report.failed_assets += 1;
      const failure = {
        legacy_id: source.legacy_id,
        slug: source.slug,
        name: source.name,
        mapped_for_apply: Boolean(selectedMapping),
        kind,
        source_url: sourceUrl,
        legacy_gallery_id: context.legacy_gallery_id || null,
        gallery_index: galleryIndex,
        error: error?.message || String(error),
      };
      failures.push(failure);
      await appendJsonLine(failuresPath, failure);
      if (report.samples.failed.length < 50) report.samples.failed.push(failure);
      return null;
    }
  }

  const hero = source.hero_source_url
    ? await resolveAsset("hero", source.hero_source_url, source)
    : null;
  const gallery = [];
  for (const [index, item] of (source.gallery || []).entries()) {
    gallery.push(await resolveAsset(
      "gallery",
      item.source_url,
      { ...source, legacy_gallery_id: item.legacy_gallery_id },
      index,
    ));
  }

  const successfulAssets = Number(Boolean(hero)) + gallery.filter(Boolean).length;
  if (!failures.length) report.source_colleges_archived += 1;
  else if (successfulAssets) report.source_colleges_partial += 1;
  else report.source_colleges_failed += 1;

  if (!selectedMapping) {
    if (successfulAssets) report.unmapped_source_colleges_archived += 1;
    return;
  }

  const { production: current, match_method } = selectedMapping;
  const replacement = {};
  const expected = {};
  if (hero) {
    replacement.image = hero.public_url;
    expected.image = current.image;
  } else if (source.hero_source_url) {
    report.current_asset_fallbacks += 1;
  }

  if (gallery.length) {
    const mergedGallery = buildGalleryReplacement(gallery, current.gallery_images);
    if (mergedGallery.urls) {
      replacement.gallery_images = mergedGallery.urls;
      expected.gallery_images = Array.isArray(current.gallery_images) ? current.gallery_images : [];
      report.current_asset_fallbacks += mergedGallery.fallbackCount;
    } else {
      report.gallery_replacements_skipped += 1;
    }
  }

  if (!Object.keys(replacement).length) {
    if (failures.length) report.colleges_failed += 1;
    return;
  }

  const row = {
    production: { id: current.id, slug: current.slug, name: current.name, city: current.city, state: current.state },
    legacy: { id: source.legacy_id, slug: source.slug, name: source.name, city: source.city, state: source.state },
    match_method,
    expected,
    replacement,
    assets: { hero, gallery },
    partial: failures.length > 0,
    failed_assets: failures,
  };
  await appendJsonLine(applyManifestPath, row);
  report.colleges_ready += 1;
  if (failures.length) report.colleges_partial += 1;
}, concurrency);

report.uploaded_assets = uploadedCount;
report.checkpoint_assets_reused = reusedCount;
report.completed_at = new Date().toISOString();
report.apply_manifest = applyManifestPath;
report.failures = failuresPath;
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await Promise.all(appendQueues.values());
if (!dryRun) {
  const auditPrefix = `migration-manifests/original-college-media/${new Date().toISOString().replaceAll(":", "-")}`;
  for (const [path, name, type] of [
    [applyManifestPath, "apply-manifest.jsonl", "application/x-ndjson; charset=utf-8"],
    [failuresPath, "failures.jsonl", "application/x-ndjson; charset=utf-8"],
    [reportPath, "upload-report.json", "application/json; charset=utf-8"],
  ]) {
    const details = await stat(path);
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: `${auditPrefix}/${name}`,
      Body: createReadStream(path),
      ContentLength: details.size,
      ContentType: type,
      CacheControl: "private,no-store",
      ServerSideEncryption: "AES256",
    }));
  }
  report.audit_prefix = `s3://${bucket}/${auditPrefix}/`;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const details = await stat(reportPath);
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: `${auditPrefix}/upload-report.json`,
    Body: createReadStream(reportPath),
    ContentLength: details.size,
    ContentType: "application/json; charset=utf-8",
    CacheControl: "private,no-store",
    ServerSideEncryption: "AES256",
  }));
}
process.stdout.write("\n");
console.log(JSON.stringify(report, null, 2));
if (!dryRun && (report.failed_assets || report.mapping_reasons["invalid-reviewed-override"])) process.exitCode = 2;
