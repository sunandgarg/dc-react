#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const secret = process.env.SUPABASE_SECRET;
const outputDir = process.env.SUPABASE_STORAGE_EXPORT_DIR || "work/supabase-storage";
const countsOnly = process.argv.includes("--counts-only");
if (!baseUrl || !secret) throw new Error("SUPABASE_URL and SUPABASE_SECRET are required");

const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
const buckets = JSON.parse(await readFile("work/supabase-storage-buckets.json", "utf8"));

async function listFolder(bucket, prefix = "", seen = new Set()) {
  const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, "");
  if (seen.has(normalizedPrefix) || normalizedPrefix.split("/").length > 100) return [];
  seen.add(normalizedPrefix);
  const entries = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${baseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: normalizedPrefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
    });
    if (!response.ok) throw new Error(`${bucket}/${prefix}: ${response.status} ${await response.text()}`);
    const page = await response.json();
    entries.push(...page);
    if (page.length < 1000) break;
  }
  let objects = [];
  for (const entry of entries) {
    const objectPath = normalizedPrefix ? `${normalizedPrefix}/${entry.name}` : entry.name;
    if (entry.id || entry.metadata) objects.push({ ...entry, objectPath });
    else if (objectPath !== normalizedPrefix) objects = objects.concat(await listFolder(bucket, objectPath, seen));
  }
  return objects;
}

async function pool(items, concurrency, worker) {
  let cursor = 0;
  const errors = [];
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      try { await worker(item); } catch (error) { errors.push({ objectPath: item.objectPath, error: error instanceof Error ? error.message : String(error) }); }
    }
  }));
  return errors;
}

await mkdir(outputDir, { recursive: true });
const manifest = { generatedAt: new Date().toISOString(), buckets: {}, errors: {} };
for (const bucket of buckets) {
  const objects = await listFolder(bucket.id);
  const bytes = objects.reduce((sum, object) => sum + Number(object.metadata?.size || 0), 0);
  manifest.buckets[bucket.id] = { public: bucket.public, objects: objects.length, bytes, items: objects };
  if (!countsOnly) {
    const bucketDir = path.join(outputDir, bucket.id);
    const errors = await pool(objects, 6, async (object) => {
      const response = await fetch(`${baseUrl}/storage/v1/object/authenticated/${encodeURIComponent(bucket.id)}/${object.objectPath.split("/").map(encodeURIComponent).join("/")}`, { headers });
      if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
      const destination = path.join(bucketDir, object.objectPath);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, Buffer.from(await response.arrayBuffer()));
    });
    if (errors.length) manifest.errors[bucket.id] = errors;
  }
}
await writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
const summary = Object.fromEntries(Object.entries(manifest.buckets).map(([bucket, value]) => [bucket, { objects: value.objects, bytes: value.bytes }]));
console.log(JSON.stringify({ summary, errors: Object.values(manifest.errors).reduce((sum, errors) => sum + errors.length, 0), mode: countsOnly ? "counts" : "export" }));
if (Object.keys(manifest.errors).length) process.exitCode = 1;
