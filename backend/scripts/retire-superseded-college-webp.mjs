import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import {
  DeleteObjectsCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { prisma } from "../src/db.mjs";
import { collectStoredMediaObjectKeys } from "../src/media-values.mjs";

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
const apply = args.has("--apply");
const bucket = String(args.get("--bucket") || process.env.AWS_S3_BUCKET || "").trim();
const region = String(args.get("--region") || process.env.AWS_REGION || "ap-south-1").trim();
const prefix = "legacy-public-assets/sanitized/bottom-12-v1/";
if (!manifestPath || manifestPath === resolve(".")) throw new Error("--manifest is required");
if (!bucket) throw new Error("--bucket or AWS_S3_BUCKET is required");

// Keep the historical sanitizer's complete field inventory. If any scan fails,
// apply mode stops before deleting a single object.
const TABLES = [
  ["about_founders", ["photo"]],
  ["about_page", ["hero_image", "story_image"]],
  ["about_press", ["logo"]],
  ["about_team", ["photo"]],
  ["ads", ["image_url"]],
  ["approval_bodies", ["logo_url"]],
  ["articles", ["featured_image"]],
  ["authors", ["photo"]],
  ["career_profiles", ["image"]],
  ["college_programs", ["image"]],
  ["college_toppers", ["photo"]],
  ["college_universities", ["logo"]],
  ["colleges", ["image", "logo", "banner_ad_image", "square_ad_image", "approval_logos", "carousel_images", "gallery_images"]],
  ["companies", ["logo"]],
  ["courses", ["image"]],
  ["exams", ["image", "logo"]],
  ["faculty", ["photo"]],
  ["hero_banners", ["image_url"]],
  ["hero_categories", ["image_url"]],
  ["hero_settings", ["image_urls"]],
  ["jobs", ["company_logo"]],
  ["landing_pages", ["logo_url", "og_image"]],
  ["popular_places", ["image_url"]],
  ["profiles", ["avatar_url", "profile_image_url"]],
  ["promoted_programs", ["certificate_image", "degree_image", "hero_image", "image_url", "institute_logo"]],
  ["scholarships", ["image"]],
  ["study_boards", ["image_url"]],
  ["study_resources", ["content_images"]],
  ["study_subjects", ["cover_image"]],
  ["study_toppers", ["photo"]],
  ["trusted_partners", ["logo_url"]],
];

async function readJsonLines(path) {
  const rows = [];
  const lines = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of lines) if (line.trim()) rows.push(JSON.parse(line));
  return rows;
}

async function collectLiveReferences() {
  const active = new Map();
  for (const [table, fields] of TABLES) {
    const model = prisma[table];
    if (!model?.findMany) return { active, error: `${table}: Prisma model is unavailable` };
    const select = { id: true, ...Object.fromEntries(fields.map((field) => [field, true])) };
    let cursor;
    let count = 0;
    for (;;) {
      let page;
      try {
        page = await model.findMany({
          select,
          orderBy: { id: "asc" },
          take: 500,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
      } catch (error) {
        return { active, error: `${table}: ${error?.message || String(error)}` };
      }
      for (const row of page) {
        for (const field of fields) {
          for (const key of collectStoredMediaObjectKeys(row[field], prefix)) {
            const refs = active.get(key) || [];
            if (refs.length < 25) refs.push({ table, id: String(row.id), field });
            active.set(key, refs);
          }
        }
      }
      count += page.length;
      if (page.length < 500) break;
      cursor = page.at(-1)?.id;
    }
    process.stdout.write(`Scanned ${table}: ${count}\n`);
  }
  return { active, error: "" };
}

async function uploadPrivate(client, path, key) {
  const details = await stat(path);
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: createReadStream(path),
    ContentLength: details.size,
    ContentType: "application/json; charset=utf-8",
    CacheControl: "private,no-store",
    ServerSideEncryption: "AES256",
  }));
}

const workDir = await mkdtemp(join(tmpdir(), "dc-retire-webp-"));
const reportPath = join(workDir, "retire-report.json");
try {
  const manifest = await readJsonLines(manifestPath);
  const candidates = new Set();
  for (const row of manifest) {
    for (const value of [row?.expected?.image, ...(Array.isArray(row?.expected?.gallery_images) ? row.expected.gallery_images : [])]) {
      for (const key of collectStoredMediaObjectKeys(value, prefix)) candidates.add(key);
    }
  }
  const candidateKeys = candidates;

  const { active, error: scanError } = await collectLiveReferences();
  const retained = [...candidates].filter((key) => active.has(key));
  const deletable = [...candidates].filter((key) => !active.has(key));
  const client = new S3Client({ region });
  const versions = [];
  let versionKeyMarker;
  let versionIdMarker;
  do {
    const page = await client.send(new ListObjectVersionsCommand({
      Bucket: bucket,
      Prefix: prefix,
      KeyMarker: versionKeyMarker,
      VersionIdMarker: versionIdMarker,
      MaxKeys: 1000,
    }));
    for (const item of page.Versions || []) {
      if (item.Key && candidateKeys.has(item.Key)) {
        versions.push({ key: item.Key, version_id: item.VersionId, is_latest: item.IsLatest, size: item.Size });
      }
    }
    versionKeyMarker = page.NextKeyMarker;
    versionIdMarker = page.NextVersionIdMarker;
    if (!page.IsTruncated) break;
  } while (true);

  const report = {
    mode: apply ? "apply" : "dry-run",
    generated_at: new Date().toISOString(),
    source_manifest: manifestPath,
    prefix,
    candidate_objects: candidates.size,
    live_referenced_objects: retained.length,
    deletable_objects: deletable.length,
    database_scan_error: scanError || null,
    retained: retained.map((key) => ({ key, references: active.get(key) })),
    deleted: [],
    candidate_versions: versions,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (apply) {
    if (scanError) throw new Error(`Reference scan was incomplete; refusing deletion (${scanError})`);
    const timestamp = new Date().toISOString().replaceAll(":", "-");
    const auditKey = `system-backups/retired-college-webp/${timestamp}/retire-report.json`;
    await uploadPrivate(client, reportPath, auditKey);
    for (let offset = 0; offset < deletable.length; offset += 1000) {
      const batch = deletable.slice(offset, offset + 1000);
      await client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Quiet: true, Objects: batch.map((Key) => ({ Key })) },
      }));
      report.deleted.push(...batch.map((key) => ({ key })));
      process.stdout.write(`Retired ${report.deleted.length}/${deletable.length}\n`);
    }
    report.completed_at = new Date().toISOString();
    report.audit_manifest = `s3://${bucket}/${auditKey}`;
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await uploadPrivate(client, reportPath, auditKey);
  }
  console.log(JSON.stringify({
    mode: report.mode,
    candidate_objects: report.candidate_objects,
    live_referenced_objects: report.live_referenced_objects,
    deletable_objects: report.deletable_objects,
    deleted_objects: report.deleted.length,
    database_scan_error: report.database_scan_error,
    audit_manifest: report.audit_manifest || null,
  }, null, 2));
} finally {
  await prisma.$disconnect();
  await rm(workDir, { recursive: true, force: true });
}
