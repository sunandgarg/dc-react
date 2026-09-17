import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma, jsonSafe } from "../src/db.mjs";
import { canonicalIdentity, canonicalSlug, stableJson } from "../src/original-media-migration.mjs";

const apply = process.argv.includes("--apply");
const manifestFlag = process.argv.indexOf("--manifest");
const manifestPath = manifestFlag >= 0 ? resolve(process.argv[manifestFlag + 1] || "") : "";
const bucket = String(process.env.AWS_S3_BUCKET || "").trim();
const region = String(process.env.AWS_REGION || "ap-south-1").trim();
const sanitizedMediaPrefix = "/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v2/";
if (!manifestPath) throw new Error("--manifest is required");
if (apply && !bucket) throw new Error("AWS_S3_BUCKET is required in --apply mode");

async function readJsonLines(path) {
  const rows = [];
  const lines = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of lines) if (line.trim()) rows.push(JSON.parse(line));
  return rows;
}

function sameIdentity(expected, current) {
  return expected.id === current.id
    && canonicalSlug(expected.slug) === canonicalSlug(current.slug)
    && canonicalIdentity(expected.name) === canonicalIdentity(current.name)
    && canonicalIdentity(expected.city) === canonicalIdentity(current.city)
    && canonicalIdentity(expected.state) === canonicalIdentity(current.state);
}

function fieldMatches(field, expected, current) {
  if (field === "gallery_images") return stableJson(expected || []) === stableJson(current || []);
  return String(expected ?? "") === String(current ?? "");
}

function isSanitizedAwsJpeg(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:"
      && url.hostname === "aws-origin.dekhocampus.com"
      && url.pathname.startsWith(sanitizedMediaPrefix)
      && /\.jpe?g$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function validateManifest(rows) {
  if (!rows.length) throw new Error("The college-media manifest is empty");
  const ids = new Set();
  const slugs = new Set();
  for (const [index, row] of rows.entries()) {
    const label = `Manifest row ${index + 1}`;
    const id = String(row?.production?.id || "").trim();
    const slug = canonicalSlug(row?.production?.slug);
    if (!id || id.length > 128 || !slug || !row?.production?.name) {
      throw new Error(`${label} has an invalid production identity`);
    }
    if (ids.has(id)) throw new Error(`${label} duplicates production college ID ${id}`);
    if (slugs.has(slug)) throw new Error(`${label} duplicates production college slug ${slug}`);
    ids.add(id);
    slugs.add(slug);

    const fields = Object.keys(row.replacement || {}).sort();
    if (!fields.length || fields.some((field) => !["gallery_images", "image"].includes(field))) {
      throw new Error(`${label} must replace image, gallery_images, or both`);
    }
    if (fields.includes("gallery_images") && (!Array.isArray(row.expected?.gallery_images) || !Array.isArray(row.replacement.gallery_images))) {
      throw new Error(`${label} has an invalid gallery_images contract`);
    }
    if (fields.includes("image")) {
      const image = String(row.replacement.image || "").trim();
      const expectedImage = String(row.expected?.image || "").trim();
      if ((!image && expectedImage) || (image && !isSanitizedAwsJpeg(image))) {
        throw new Error(`${label} has an invalid replacement hero URL`);
      }
    }
    for (const galleryUrl of row.replacement.gallery_images || []) {
      if (!isSanitizedAwsJpeg(galleryUrl)) throw new Error(`${label} has an invalid replacement gallery URL`);
    }
  }
}

async function uploadPrivateFile(client, path, key, contentType) {
  const details = await stat(path);
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: createReadStream(path),
    ContentLength: details.size,
    ContentType: contentType,
    CacheControl: "private,no-store",
    ServerSideEncryption: "AES256",
  }));
}

const rows = await readJsonLines(manifestPath);
validateManifest(rows);
const startedAt = new Date();
const timestamp = startedAt.toISOString().replaceAll(":", "-");
const backupPrefix = `system-backups/original-college-media/${timestamp}`;
const workDir = await mkdtemp(join(tmpdir(), "dc-original-college-media-"));
const rollbackPath = join(workDir, "rollback.jsonl");
const rollbackGzipPath = `${rollbackPath}.gz`;
const reportPath = join(workDir, "apply-report.json");
const report = {
  mode: apply ? "apply" : "dry-run",
  started_at: startedAt.toISOString(),
  manifest_rows: rows.length,
  valid: 0,
  conflicts: 0,
  missing: 0,
  updated: 0,
  unchanged: 0,
  samples: { conflicts: [], missing: [] },
};

try {
  const ready = [];
  const rollbackRows = [];
  for (const row of rows) {
    const current = await prisma.colleges.findUnique({
      where: { id: row.production.id },
      select: { id: true, slug: true, name: true, city: true, state: true, image: true, gallery_images: true, updated_at: true },
    });
    if (!current) {
      report.missing += 1;
      if (report.samples.missing.length < 50) report.samples.missing.push(row.production);
      continue;
    }
    const changedFields = Object.keys(row.replacement || {});
    const identityMatches = sameIdentity(row.production, current);
    const alreadyApplied = changedFields.every((field) => fieldMatches(field, row.replacement[field], current[field]));
    if (identityMatches && alreadyApplied) {
      report.unchanged += 1;
      continue;
    }
    const expectedMatches = changedFields.every((field) => fieldMatches(field, row.expected?.[field], current[field]));
    if (!identityMatches || !expectedMatches) {
      report.conflicts += 1;
      if (report.samples.conflicts.length < 50) report.samples.conflicts.push({ id: current.id, slug: current.slug, identityMatches, expectedMatches });
      continue;
    }
    report.valid += 1;
    ready.push({ id: current.id, data: Object.fromEntries(changedFields.map((field) => [field, row.replacement[field]])) });
    rollbackRows.push(jsonSafe({
      id: current.id,
      slug: current.slug,
      name: current.name,
      previous: Object.fromEntries(changedFields.map((field) => [field, current[field]])),
      replacement: row.replacement,
      updated_at_before: current.updated_at,
    }));
  }

  await writeFile(rollbackPath, rollbackRows.map((row) => JSON.stringify(row)).join("\n") + (rollbackRows.length ? "\n" : ""), "utf8");
  await pipeline(createReadStream(rollbackPath), createGzip({ level: 9 }), createWriteStream(rollbackGzipPath));
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));

  if (apply) {
    if (report.conflicts || report.missing) throw new Error("Manifest has conflicts or missing colleges; no database rows were changed");
    const s3 = new S3Client({ region });
    await uploadPrivateFile(s3, manifestPath, `${backupPrefix}/apply-manifest.jsonl`, "application/x-ndjson; charset=utf-8");
    await uploadPrivateFile(s3, rollbackGzipPath, `${backupPrefix}/rollback.jsonl.gz`, "application/gzip");
    await uploadPrivateFile(s3, reportPath, `${backupPrefix}/apply-report.json`, "application/json; charset=utf-8");

    for (let offset = 0; offset < ready.length; offset += 25) {
      const batch = ready.slice(offset, offset + 25);
      await prisma.$transaction(batch.map((item) => prisma.colleges.update({
        where: { id: item.id },
        data: { ...item.data, updated_at: new Date() },
      })));
      report.updated += batch.length;
      console.log(`Updated ${report.updated}/${ready.length} colleges`);
    }
    report.completed_at = new Date().toISOString();
    report.backup = `s3://${bucket}/${backupPrefix}/`;
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await uploadPrivateFile(s3, reportPath, `${backupPrefix}/apply-report.json`, "application/json; charset=utf-8");
  }
} finally {
  await prisma.$disconnect();
  await rm(workDir, { recursive: true, force: true });
}
