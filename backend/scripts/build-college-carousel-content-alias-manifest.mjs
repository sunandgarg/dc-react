import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { once } from "node:events";
import sharp from "sharp";

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

const unresolvedPath = resolve(String(args.get("--unmapped") || ""));
const sanitizedPath = resolve(String(args.get("--sanitized-manifest") || ""));
const outputPath = resolve(String(args.get("--output") || "work/original-college-media/content-alias-manifest.jsonl"));
const reportPath = resolve(String(args.get("--report") || `${outputPath}.report.json`));
const bucket = String(args.get("--bucket") || process.env.STORAGE_S3_BUCKET || "").trim();
const region = String(args.get("--region") || process.env.AWS_REGION || "ap-south-1").trim();
const maxDistance = Number(args.get("--max-distance") || 14);
const minGap = Number(args.get("--min-gap") || 8);
const minRatio = Number(args.get("--min-ratio") || 2);
if (!args.get("--unmapped")) throw new Error("--unmapped is required");
if (!args.get("--sanitized-manifest")) throw new Error("--sanitized-manifest is required");
if (!bucket) throw new Error("--bucket or STORAGE_S3_BUCKET is required");
if (![maxDistance, minGap, minRatio].every(Number.isFinite)) throw new Error("Matching thresholds must be numbers");

async function* readJsonLines(path) {
  const lines = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of lines) if (line.trim()) yield JSON.parse(line);
}

async function bodyBuffer(body) {
  if (typeof body?.transformToByteArray === "function") return Buffer.from(await body.transformToByteArray());
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function mediaKey(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    const match = decodeURIComponent(url.pathname).match(/^\/storage\/v1\/object\/public\/(.+)$/);
    return match ? match[1].replace(/^\/+/, "") : "";
  } catch {
    return text.startsWith("legacy-public-assets/") ? text : "";
  }
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function contentDigest(value) {
  const match = String(value || "").match(/\/([a-f0-9]{64})\.[a-z0-9]+(?:\?.*)?$/i);
  return match ? match[1].toLowerCase() : "";
}

const s3 = new S3Client({ region });
async function readReference(value) {
  const key = mediaKey(value);
  if (key) {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return bodyBuffer(object.Body);
  }
  const url = new URL(String(value));
  if (!/^https?:$/.test(url.protocol)) throw new Error(`Unsupported media reference: ${value}`);
  const response = await fetch(url, {
    headers: { "user-agent": "DekhoCampus licensed-media-migration/1.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function normalizedFingerprint(input) {
  const result = await sharp(input, { failOn: "none", limitInputPixels: 100_000_000 })
    .rotate()
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .resize(64, 64, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (result.info.channels !== 3) throw new Error(`Expected a three-channel fingerprint, received ${result.info.channels}`);
  return result.data;
}

async function topCrop(input, retainPercent = 88) {
  const oriented = await sharp(input, { failOn: "none", limitInputPixels: 100_000_000 }).rotate().toBuffer();
  const metadata = await sharp(oriented, { failOn: "none", limitInputPixels: 100_000_000 }).metadata();
  if (!metadata.width || !metadata.height || metadata.height < 2) return null;
  const height = Math.max(1, Math.min(metadata.height, Math.round(metadata.height * (retainPercent / 100))));
  return sharp(oriented, { failOn: "none", limitInputPixels: 100_000_000 })
    .extract({ left: 0, top: 0, width: metadata.width, height })
    .toBuffer();
}

function meanAbsoluteError(left, right) {
  if (left.length !== right.length) throw new Error("Fingerprint sizes differ");
  let total = 0;
  for (let index = 0; index < left.length; index += 1) total += Math.abs(left[index] - right[index]);
  return total / left.length;
}

const fingerprintCache = new Map();
function fingerprints(value, includeTopCrop) {
  const cacheKey = `${includeTopCrop ? "variants" : "full"}:${value}`;
  if (!fingerprintCache.has(cacheKey)) {
    fingerprintCache.set(cacheKey, (async () => {
      const bytes = await readReference(value);
      const result = [{ variant: "full", data: await normalizedFingerprint(bytes) }];
      if (includeTopCrop) {
        const cropped = await topCrop(bytes);
        if (cropped) result.push({ variant: "top-88", data: await normalizedFingerprint(cropped) });
      }
      return result;
    })());
  }
  return fingerprintCache.get(cacheKey);
}

const unresolvedRows = [];
const unresolvedIds = new Set();
for await (const row of readJsonLines(unresolvedPath)) {
  const id = String(row?.production?.id || "").trim();
  if (!id) throw new Error("Unmapped row has no production ID");
  if (unresolvedIds.has(id)) throw new Error(`Unmapped input contains duplicate production ID ${id}`);
  unresolvedIds.add(id);
  unresolvedRows.push(row);
}

const sanitizedById = new Map();
for await (const row of readJsonLines(sanitizedPath)) {
  const id = String(row?.production?.id || "").trim();
  if (unresolvedIds.has(id)) sanitizedById.set(id, row);
}

await mkdir(dirname(outputPath), { recursive: true });
await mkdir(dirname(reportPath), { recursive: true });
const output = createWriteStream(outputPath, { encoding: "utf8" });
const report = {
  generated_at: new Date().toISOString(),
  source_unmapped_rows: unresolvedRows.length,
  source_unmapped_references: 0,
  accepted_references: 0,
  rejected_references: 0,
  failed_references: 0,
  thresholds: { max_distance: maxDistance, min_gap: minGap, min_ratio: minRatio },
  rows: [],
};

for (let rowIndex = 0; rowIndex < unresolvedRows.length; rowIndex += 1) {
  const unresolvedRow = unresolvedRows[rowIndex];
  const id = String(unresolvedRow.production.id);
  const sanitizedRow = sanitizedById.get(id);
  if (!sanitizedRow) throw new Error(`Sanitized manifest has no row for ${id}`);
  const targets = unique([
    sanitizedRow?.replacement?.image,
    ...(Array.isArray(sanitizedRow?.replacement?.gallery_images) ? sanitizedRow.replacement.gallery_images : []),
  ]);
  if (!targets.length) throw new Error(`Sanitized manifest has no target images for ${id}`);
  const targetFingerprints = await Promise.all(targets.map(async (target) => ({
    target,
    data: (await fingerprints(target, false))[0].data,
  })));
  const aliases = [];
  const rejected = [];
  const failures = [];
  const unresolved = unique(Array.isArray(unresolvedRow.unmapped) ? unresolvedRow.unmapped : []);
  report.source_unmapped_references += unresolved.length;

  for (const source of unresolved) {
    try {
      const sourceFingerprints = await fingerprints(source, true);
      const matches = targetFingerprints.map(({ target, data }) => {
        const comparisons = sourceFingerprints.map((item) => ({
          variant: item.variant,
          distance: meanAbsoluteError(item.data, data),
        })).sort((left, right) => left.distance - right.distance);
        return { target, ...comparisons[0] };
      }).sort((left, right) => left.distance - right.distance);
      const best = matches[0];
      const secondDistance = matches[1]?.distance ?? Number.POSITIVE_INFINITY;
      const gap = secondDistance - best.distance;
      const ratio = best.distance > 0 ? secondDistance / best.distance : Number.POSITIVE_INFINITY;
      const tiedMatches = matches.filter((match) => Math.abs(match.distance - best.distance) < 0.0001);
      const tiedDigest = contentDigest(best.target);
      const equivalentTie = tiedMatches.length > 1
        && Boolean(tiedDigest)
        && tiedMatches.every((match) => contentDigest(match.target) === tiedDigest);
      const evidence = {
        from: source,
        to: best.target,
        distance: Number(best.distance.toFixed(4)),
        second_distance: Number.isFinite(secondDistance) ? Number(secondDistance.toFixed(4)) : null,
        gap: Number.isFinite(gap) ? Number(gap.toFixed(4)) : null,
        ratio: Number.isFinite(ratio) ? Number(ratio.toFixed(4)) : null,
        variant: best.variant,
      };
      if (best.distance <= maxDistance && (equivalentTie || gap >= minGap || ratio >= minRatio)) aliases.push(evidence);
      else rejected.push({ ...evidence, reason: best.distance > maxDistance ? "distance" : "ambiguous" });
    } catch (error) {
      failures.push({ from: source, error: error instanceof Error ? error.message : String(error) });
    }
  }

  report.accepted_references += aliases.length;
  report.rejected_references += rejected.length;
  report.failed_references += failures.length;
  const outputRow = { production: unresolvedRow.production, content_aliases: aliases };
  if (!output.write(`${JSON.stringify(outputRow)}\n`)) await once(output, "drain");
  report.rows.push({
    production: unresolvedRow.production,
    candidates: targets.length,
    accepted: aliases,
    rejected,
    failures,
  });
  process.stdout.write(`\rMatched ${rowIndex + 1}/${unresolvedRows.length} colleges (${report.accepted_references} accepted, ${report.rejected_references} rejected, ${report.failed_references} failed)`);
}

output.end();
await once(output, "finish");
process.stdout.write("\n");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  rows: report.source_unmapped_rows,
  references: report.source_unmapped_references,
  accepted: report.accepted_references,
  rejected: report.rejected_references,
  failed: report.failed_references,
  output: outputPath,
  report: reportPath,
}, null, 2));
