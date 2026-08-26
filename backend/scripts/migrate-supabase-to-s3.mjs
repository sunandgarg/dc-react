#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import "../src/database-url.mjs";

const sourceUrl = String(process.env.SUPABASE_STORAGE_URL || "").replace(/\/$/, "");
const sourceSecret = String(process.env.SUPABASE_STORAGE_SERVICE_KEY || "");
const targetBucket = String(process.env.AWS_S3_BUCKET || "");
const region = String(process.env.AWS_REGION || "ap-south-1");
const manifestPath = process.env.STORAGE_MIGRATION_MANIFEST || "work/s3-migration-manifest.json";
const concurrency = Math.min(20, Math.max(1, Number(process.env.STORAGE_MIGRATION_CONCURRENCY || 8)));
const countsOnly = process.argv.includes("--counts-only");
const rewriteDatabase = process.argv.includes("--rewrite-database");

if (!sourceUrl || !sourceSecret || !targetBucket) throw new Error("SUPABASE_STORAGE_URL, SUPABASE_STORAGE_SERVICE_KEY, and AWS_S3_BUCKET are required");

const headers = { apikey: sourceSecret, authorization: `Bearer ${sourceSecret}` };
const s3 = new S3Client({ region });
const prisma = rewriteDatabase ? new PrismaClient() : null;
const report = { startedAt: new Date().toISOString(), sourceUrl, targetBucket, buckets: {}, migrated: 0, skipped: 0, bytes: 0, errors: [] };

async function sourceJson(path, init = {}) {
  const response = await fetch(`${sourceUrl}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

async function listFolder(bucket, prefix = "", seen = new Set()) {
  const normalized = prefix.replace(/^\/+|\/+$/g, "");
  if (seen.has(normalized)) return [];
  seen.add(normalized);
  const entries = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await sourceJson(`/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prefix: normalized, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
    });
    entries.push(...page);
    if (page.length < 1000) break;
  }
  const objects = [];
  for (const entry of entries) {
    const objectPath = normalized ? `${normalized}/${entry.name}` : entry.name;
    if (entry.id || entry.metadata) objects.push({ ...entry, objectPath });
    else objects.push(...await listFolder(bucket, objectPath, seen));
  }
  return objects;
}

async function migrateObject(bucket, object) {
  const key = `${bucket}/${object.objectPath}`;
  const expectedSize = Number(object.metadata?.size || 0);
  try {
    const existing = await s3.send(new HeadObjectCommand({ Bucket: targetBucket, Key: key }));
    if (Number(existing.ContentLength) === expectedSize && existing.Metadata?.source === "supabase") {
      report.skipped += 1;
      report.bytes += expectedSize;
      return;
    }
  } catch (error) {
    if (error?.$metadata?.httpStatusCode !== 404 && error?.name !== "NotFound") throw error;
  }
  const response = await fetch(`${sourceUrl}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${object.objectPath.split("/").map(encodeURIComponent).join("/")}`, { headers });
  if (!response.ok) throw new Error(`${key}: source returned ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (expectedSize && bytes.byteLength !== expectedSize) throw new Error(`${key}: size mismatch ${bytes.byteLength}/${expectedSize}`);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await s3.send(new PutObjectCommand({
    Bucket: targetBucket,
    Key: key,
    Body: bytes,
    ContentType: response.headers.get("content-type") || object.metadata?.mimetype || "application/octet-stream",
    CacheControl: String(response.headers.get("content-type") || "").startsWith("image/") ? "public,max-age=31536000,immutable" : "public,max-age=3600",
    ServerSideEncryption: "AES256",
    Metadata: { source: "supabase", sha256 },
  }));
  report.migrated += 1;
  report.bytes += bytes.byteLength;
}

async function runPool(items, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      try { await worker(item); } catch (error) { report.errors.push({ key: item.key || item.objectPath, message: error instanceof Error ? error.message : String(error) }); }
    }
  }));
}

async function rewriteMediaUrls() {
  const metadata = JSON.parse(await readFile(new URL("../prisma/schema-metadata.json", import.meta.url), "utf8"));
  const needle = `${sourceUrl}/storage/v1/object/public/`;
  let changed = 0;
  for (const [table, definition] of Object.entries(metadata)) {
    if (definition.ignored) continue;
    for (const [column, field] of Object.entries(definition.fields)) {
      if (!["String", "Json"].includes(field.type)) continue;
      const result = await prisma.$executeRawUnsafe(
        `UPDATE \`${table}\` SET \`${column}\` = REPLACE(\`${column}\`, ?, '') WHERE \`${column}\` LIKE ?`,
        needle,
        `%${needle}%`,
      ).catch(() => 0);
      changed += Number(result || 0);
    }
  }
  return changed;
}

try {
  const buckets = await sourceJson("/storage/v1/bucket");
  for (const bucket of buckets) {
    const objects = await listFolder(bucket.id);
    report.buckets[bucket.id] = { objects: objects.length, bytes: objects.reduce((sum, object) => sum + Number(object.metadata?.size || 0), 0) };
    if (!countsOnly) await runPool(objects.map((object) => ({ ...object, key: `${bucket.id}/${object.objectPath}` })), (object) => migrateObject(bucket.id, object));
  }
  if (rewriteDatabase && !report.errors.length) report.databaseRowsRewritten = await rewriteMediaUrls();
} finally {
  if (prisma) await prisma.$disconnect();
}

report.finishedAt = new Date().toISOString();
await writeFile(manifestPath, `${JSON.stringify(report, null, 2)}\n`).catch(() => {});
console.log(JSON.stringify({ buckets: report.buckets, migrated: report.migrated, skipped: report.skipped, bytes: report.bytes, errors: report.errors.length, databaseRowsRewritten: report.databaseRowsRewritten || 0 }));
if (report.errors.length) process.exitCode = 1;
