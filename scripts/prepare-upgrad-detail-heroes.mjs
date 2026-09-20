#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const repoRoot = process.cwd();
const syncRoot = path.resolve(repoRoot, "../upgrad-sync");
const sourceManifestPath = path.join(syncRoot, "prepared-media-manifest.json");
const outputDirectory = path.join(syncRoot, "detail-hero-media");
const outputManifestPath = path.join(syncRoot, "detail-hero-media-manifest.json");
const concurrency = 5;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fetchBytes(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "DekhoCampus UpGrad media sync/2026" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}

async function prepareHero(item) {
  const fetched = await fetchBytes(item.source_url);
  const input = sharp(fetched.bytes, { failOn: "warning", limitInputPixels: 50_000_000 }).rotate();
  const inputMetadata = await input.metadata();
  const { data: output, info } = await input
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .webp({ quality: 90, smartSubsample: true, effort: 6 })
    .toBuffer({ resolveWithObject: true });

  const digest = sha256(output);
  const filename = `detail-hero-${digest.slice(0, 16)}.webp`;
  const outputPath = path.join(outputDirectory, filename);
  await writeFile(outputPath, output);

  return {
    source_url: item.source_url,
    source_content_type: fetched.contentType,
    source_bytes: fetched.bytes.length,
    source_width: Number(inputMetadata.width || 0),
    source_height: Number(inputMetadata.height || 0),
    output_path: outputPath,
    output_filename: filename,
    output_bytes: output.length,
    output_width: info.width,
    output_height: info.height,
    sha256: digest,
    programme_slugs: [...item.programme_slugs].sort(),
  };
}

const programmeManifest = JSON.parse(await readFile(sourceManifestPath, "utf8"));
if (!Array.isArray(programmeManifest)) throw new Error("Prepared programme media manifest must be an array");

const sourceItems = new Map();
for (const programme of programmeManifest) {
  const sourceUrl = String(programme?.assets?.hero?.source_url || "").trim();
  if (!sourceUrl) continue;
  const current = sourceItems.get(sourceUrl) || { source_url: sourceUrl, programme_slugs: new Set() };
  current.programme_slugs.add(programme.slug);
  sourceItems.set(sourceUrl, current);
}

await mkdir(outputDirectory, { recursive: true });
const pending = [...sourceItems.values()].sort((left, right) => left.source_url.localeCompare(right.source_url));
const results = [];
const failures = [];

async function worker() {
  while (pending.length > 0) {
    const item = pending.shift();
    try {
      const prepared = await prepareHero(item);
      results.push(prepared);
      console.log(`Prepared ${prepared.output_filename} (${prepared.output_width}x${prepared.output_height})`);
    } catch (error) {
      failures.push({ source_url: item.source_url, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, () => worker()));
results.sort((left, right) => left.sha256.localeCompare(right.sha256));
await writeFile(outputManifestPath, `${JSON.stringify({
  schema_version: 1,
  generated_at: new Date().toISOString(),
  source_manifest: sourceManifestPath,
  assets: results,
  failures,
}, null, 2)}\n`);

if (failures.length > 0) {
  throw new Error(`${failures.length} UpGrad detail heroes failed; see ${outputManifestPath}`);
}

console.log(`Prepared ${results.length} original-ratio UpGrad detail heroes in ${outputDirectory}`);
