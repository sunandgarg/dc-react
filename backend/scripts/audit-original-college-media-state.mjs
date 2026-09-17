import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { stableJson } from "../src/original-media-migration.mjs";

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

const manifestPath = resolve(String(args.get("--manifest") || ""));
const stateDir = resolve(String(args.get("--state-dir") || "work/original-college-media"));
const apiBaseUrl = String(args.get("--api-base-url") || "https://aws-origin.dekhocampus.com").replace(/\/$/, "");
const requireFullyApplied = args.has("--require-fully-applied");
if (!manifestPath || manifestPath === resolve(".")) throw new Error("--manifest is required");
await mkdir(stateDir, { recursive: true });

async function readJsonLines(path) {
  const rows = [];
  const lines = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of lines) if (line.trim()) rows.push(JSON.parse(line));
  return rows;
}

async function fetchColleges() {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({
      select: "id,slug,name,city,state,image,logo,gallery_images,updated_at",
      limit: String(pageSize),
      offset: String(offset),
      order: "id.asc",
    });
    let page;
    let lastError;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        const response = await fetch(`${apiBaseUrl}/v1/rest/colleges?${query}`, {
          headers: { accept: "application/json", "user-agent": "DekhoCampus-media-audit/1.0" },
          signal: AbortSignal.timeout(60_000),
        });
        if (!response.ok) throw new Error(`College audit fetch failed (${response.status})`);
        page = await response.json();
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 5) await delay(attempt * 1_500);
      }
    }
    if (!page) throw lastError || new Error(`College audit fetch failed at offset ${offset}`);
    if (!Array.isArray(page)) throw new Error("College audit returned a non-array response");
    rows.push(...page);
    process.stdout.write(`\rFetched ${rows.length} live colleges`);
    if (page.length < pageSize) break;
  }
  process.stdout.write("\n");
  return rows;
}

function sameValue(field, left, right) {
  if (field === "gallery_images") return stableJson(left || []) === stableJson(right || []);
  return String(left || "") === String(right || "");
}

function mediaUrls(row) {
  return [String(row.image || "").trim(), ...(Array.isArray(row.gallery_images) ? row.gallery_images.map(String) : [])].filter(Boolean);
}

function targetMediaUrls(row, manifestRow) {
  const urls = [];
  if (Object.hasOwn(manifestRow?.replacement || {}, "image")) urls.push(String(row.image || "").trim());
  if (Object.hasOwn(manifestRow?.replacement || {}, "gallery_images") && Array.isArray(row.gallery_images)) {
    urls.push(...row.gallery_images.map(String));
  }
  return urls.filter(Boolean);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function sourceHost(value) {
  try { return new URL(String(value)).hostname.toLowerCase(); } catch { return ""; }
}

const [manifest, live] = await Promise.all([readJsonLines(manifestPath), fetchColleges()]);
const manifestById = new Map(manifest.map((row) => [String(row.production.id), row]));
const provenanceByPublicUrl = new Map();
for (const row of manifest) {
  const assets = [row?.assets?.hero, ...(Array.isArray(row?.assets?.gallery) ? row.assets.gallery : [])];
  for (const asset of assets) {
    if (asset?.public_url) provenanceByPublicUrl.set(String(asset.public_url), String(asset.source_url || ""));
  }
}

const summary = {
  live_colleges: live.length,
  manifest_colleges: manifest.length,
  fully_applied: 0,
  still_on_pre_restore_webp: 0,
  partially_or_differently_updated: 0,
  no_manifest: 0,
  active_original_objects: 0,
  active_bottom_12_v1_webp_objects: 0,
  active_bottom_12_v2_jpeg_objects: 0,
  active_direct_external_urls: 0,
  active_direct_collegedunia_urls: 0,
  target_direct_external_urls: 0,
  target_direct_collegedunia_urls: 0,
  active_collegedunia_provenance_objects: 0,
};
const unresolved = [];
const activeUrls = new Set();
const activeThirdPartyUrls = new Set();

for (const college of live) {
  const row = manifestById.get(String(college.id));
  const urls = mediaUrls(college);
  const migratedFieldUrls = row ? targetMediaUrls(college, row) : [];
  for (const url of urls) {
    activeUrls.add(url);
    const liveHost = sourceHost(url);
    if (liveHost && liveHost !== "aws-origin.dekhocampus.com") summary.active_direct_external_urls += 1;
    if (liveHost.endsWith("collegedunia.com")) summary.active_direct_collegedunia_urls += 1;
    if (url.includes("/legacy-public-assets/original/")) summary.active_original_objects += 1;
    if (url.includes("/legacy-public-assets/sanitized/bottom-12-v1/") && /\.webp(?:$|\?)/i.test(url)) summary.active_bottom_12_v1_webp_objects += 1;
    if (url.includes("/legacy-public-assets/sanitized/bottom-12-v2/") && /\.jpe?g(?:$|\?)/i.test(url)) summary.active_bottom_12_v2_jpeg_objects += 1;
    const source = provenanceByPublicUrl.get(url);
    if (sourceHost(source).endsWith("collegedunia.com")) activeThirdPartyUrls.add(url);
  }
  for (const url of migratedFieldUrls) {
    const liveHost = sourceHost(url);
    if (liveHost && liveHost !== "aws-origin.dekhocampus.com") summary.target_direct_external_urls += 1;
    if (liveHost.endsWith("collegedunia.com")) summary.target_direct_collegedunia_urls += 1;
  }

  if (!row) {
    summary.no_manifest += 1;
    unresolved.push({ ...college, reason: "no-migration-manifest" });
    continue;
  }
  const fields = Object.keys(row.replacement || {});
  const fullyApplied = fields.every((field) => sameValue(field, college[field], row.replacement[field]));
  const stillOld = fields.every((field) => sameValue(field, college[field], row.expected?.[field]));
  if (fullyApplied) summary.fully_applied += 1;
  else if (stillOld) {
    summary.still_on_pre_restore_webp += 1;
    unresolved.push({ ...college, reason: "still-on-pre-restore-media" });
  } else {
    summary.partially_or_differently_updated += 1;
    unresolved.push({ ...college, reason: "partial-or-newer-conflicting-update" });
  }
}
summary.active_collegedunia_provenance_objects = activeThirdPartyUrls.size;

const report = {
  generated_at: new Date().toISOString(),
  api_base_url: apiBaseUrl,
  manifest: basename(manifestPath),
  summary,
  unique_active_media_urls: activeUrls.size,
  unresolved_colleges: unresolved.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    city: row.city,
    state: row.state,
    reason: row.reason,
    image: row.image,
    gallery_count: Array.isArray(row.gallery_images) ? row.gallery_images.length : 0,
  })),
};
const reportPath = join(stateDir, "current-media-audit.json");
const csvPath = join(stateDir, "colleges-not-fully-updated.csv");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
const columns = ["id", "slug", "name", "city", "state", "reason", "image", "gallery_count"];
const csv = [columns.join(","), ...report.unresolved_colleges.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n");
await writeFile(csvPath, `${csv}\n`, "utf8");
console.log(JSON.stringify({ ...summary, report: reportPath, unresolved_csv: csvPath }, null, 2));

if (requireFullyApplied) {
  const failures = [];
  if (summary.fully_applied !== manifest.length) failures.push(`${summary.fully_applied}/${manifest.length} target colleges are fully applied`);
  if (summary.still_on_pre_restore_webp) failures.push(`${summary.still_on_pre_restore_webp} target colleges still use pre-restore media`);
  if (summary.partially_or_differently_updated) failures.push(`${summary.partially_or_differently_updated} target colleges have conflicting media`);
  if (summary.target_direct_external_urls) failures.push(`${summary.target_direct_external_urls} target media URLs remain external`);
  if (summary.target_direct_collegedunia_urls) failures.push(`${summary.target_direct_collegedunia_urls} target media URLs still use Collegedunia directly`);
  if (failures.length) throw new Error(`Post-apply college-media audit failed: ${failures.join("; ")}`);
}
