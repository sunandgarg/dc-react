import { createReadStream } from "node:fs";
import { appendFile, mkdir, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import {
  bottomCropPlan,
  buildSanitizedCollegeManifestRow,
  publicMediaUrl,
  sanitizedOriginalMediaKey,
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

const manifestPath = resolve(String(args.get("--manifest") || ""));
const stateDir = resolve(String(args.get("--state-dir") || "work/original-college-media"));
const bucket = String(args.get("--bucket") || process.env.AWS_S3_BUCKET || "").trim();
const region = String(args.get("--region") || process.env.AWS_REGION || "ap-south-1").trim();
const profile = String(args.get("--profile") || process.env.AWS_PROFILE || "").trim();
const mediaBaseUrl = String(args.get("--media-base-url") || process.env.MEDIA_BASE_URL || "https://aws-origin.dekhocampus.com/storage/v1/object/public").trim();
const cropBottomPercent = Math.max(1, Math.min(30, Number(args.get("--crop-bottom-percent") || 12)));
const quality = Math.max(75, Math.min(96, Number(args.get("--quality") || 90)));
const concurrency = Math.max(1, Math.min(24, Number(args.get("--concurrency") || 8)));
const limit = Math.max(0, Number(args.get("--limit") || 0));
const sampleSize = Math.max(0, Number(args.get("--sample-size") || 0));
const onlySlug = String(args.get("--only-slug") || "").trim();
const previewDir = args.get("--preview-dir") ? resolve(String(args.get("--preview-dir"))) : "";
const previewLimit = Math.max(0, Number(args.get("--preview-limit") || 12));
const apply = args.has("--apply");
const trustCheckpoint = args.has("--trust-checkpoint");
const dropUnavailableGallery = args.has("--drop-unavailable-gallery");
const version = `bottom-${cropBottomPercent}-v2`;
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;

if (!manifestPath || manifestPath === resolve(".")) throw new Error("--manifest is required");
if (!bucket) throw new Error("--bucket or AWS_S3_BUCKET is required");
if (profile) process.env.AWS_PROFILE = profile;

const checkpointPath = join(stateDir, `${version}-assets.jsonl`);
const outputManifestPath = join(stateDir, `${version}-apply-manifest.jsonl`);
const reportPath = join(stateDir, `${version}-report.json`);
await mkdir(stateDir, { recursive: true });
if (previewDir) await mkdir(previewDir, { recursive: true });
let checkpointWrite = Promise.resolve();

function appendCheckpoint(row) {
  checkpointWrite = checkpointWrite.then(() => appendFile(checkpointPath, `${JSON.stringify(row)}\n`, "utf8"));
  return checkpointWrite;
}

async function readJsonLines(path) {
  const rows = [];
  const lines = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of lines) if (line.trim()) rows.push(JSON.parse(line));
  return rows;
}

async function loadCheckpoint() {
  const rows = new Map();
  try {
    for (const row of await readJsonLines(checkpointPath)) rows.set(row.source_key, row);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return rows;
}

async function mapLimit(items, maxWorkers, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function runner() {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(maxWorkers, items.length) }, runner));
  return results;
}

async function bodyBuffer(body) {
  const bytes = Buffer.from(await body.transformToByteArray());
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error(`Invalid source image size: ${bytes.length}`);
  return bytes;
}

function decodeBmp24(input) {
  if (input.length < 54 || input.readUInt16LE(0) !== 0x4d42) return null;
  const pixelOffset = input.readUInt32LE(10);
  const dibSize = input.readUInt32LE(14);
  const width = input.readInt32LE(18);
  const signedHeight = input.readInt32LE(22);
  const planes = input.readUInt16LE(26);
  const bitsPerPixel = input.readUInt16LE(28);
  const compression = input.readUInt32LE(30);
  if (dibSize < 40 || width < 1 || !signedHeight || planes !== 1 || bitsPerPixel !== 24 || compression !== 0) {
    throw new Error("Unsupported BMP variant");
  }
  const height = Math.abs(signedHeight);
  const rowStride = Math.ceil((width * 3) / 4) * 4;
  if (pixelOffset < 54 || pixelOffset + rowStride * height > input.length) {
    throw new Error("Invalid BMP pixel data");
  }

  const rgb = Buffer.allocUnsafe(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    const sourceY = signedHeight > 0 ? height - 1 - y : y;
    const sourceRow = pixelOffset + sourceY * rowStride;
    const outputRow = y * width * 3;
    for (let x = 0; x < width; x += 1) {
      const source = sourceRow + x * 3;
      const output = outputRow + x * 3;
      rgb[output] = input[source + 2];
      rgb[output + 1] = input[source + 1];
      rgb[output + 2] = input[source];
    }
  }
  return { data: rgb, width, height, channels: 3 };
}

const rows = await readJsonLines(manifestPath);
const matchingRows = onlySlug ? rows.filter((row) => String(row?.production?.slug || "") === onlySlug) : rows;
if (onlySlug && matchingRows.length !== 1) throw new Error(`--only-slug matched ${matchingRows.length} rows; expected exactly one`);
const sampledRows = sampleSize && sampleSize < matchingRows.length
  ? Array.from({ length: sampleSize }, (_, index) => matchingRows[Math.floor(index * matchingRows.length / sampleSize)])
  : matchingRows;
const selectedRows = limit ? sampledRows.slice(0, limit) : sampledRows;
const assets = new Map();
for (const row of selectedRows) {
  const candidates = [row?.assets?.hero, ...(Array.isArray(row?.assets?.gallery) ? row.assets.gallery : [])];
  for (const asset of candidates) {
    if (!asset?.key || !asset?.public_url || !["hero", "gallery"].includes(asset.kind)) continue;
    assets.set(asset.key, asset);
  }
}

const checkpoint = await loadCheckpoint();
const client = new S3Client({ region });
let resolved = 0;
let uploaded = 0;
let reused = 0;
let failed = 0;
const failures = [];

async function sanitizeAsset(asset, index) {
  const saved = checkpoint.get(asset.key);
  if (saved) {
    if (trustCheckpoint) {
      reused += 1;
      resolved += 1;
      if (resolved % 100 === 0 || resolved === assets.size) process.stdout.write(`\rSanitized ${resolved}/${assets.size}`);
      return saved;
    }
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: saved.destination_key }));
      reused += 1;
      return saved;
    } catch (error) {
      if (error?.$metadata?.httpStatusCode !== 404 && error?.name !== "NotFound" && error?.name !== "NoSuchKey") throw error;
    }
  }

  try {
    const source = await client.send(new GetObjectCommand({ Bucket: bucket, Key: asset.key }));
    const input = await bodyBuffer(source.Body);
    // Sharp reports input dimensions before queued EXIF rotation. Normalize the
    // orientation first so portrait assets cannot produce an invalid crop box.
    // The legacy export also contains a few truncated JPEGs that browsers can
    // render, so use tolerant decoding while still validating the final JPEG.
    const bmp = decodeBmp24(input);
    const orientedInput = bmp
      ? await sharp(bmp.data, { raw: { width: bmp.width, height: bmp.height, channels: bmp.channels } }).png().toBuffer()
      : await sharp(input, { failOn: "none", limitInputPixels: 100_000_000 }).rotate().toBuffer();
    const pipeline = sharp(orientedInput, { failOn: "none", limitInputPixels: 100_000_000 });
    const metadata = await pipeline.metadata();
    const crop = bottomCropPlan(metadata.width, metadata.height, cropBottomPercent);
    const output = await pipeline
      .clone()
      .extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:4:4" })
      .toBuffer();
    const outputMetadata = await sharp(output).metadata();
    if (outputMetadata.width !== crop.width || outputMetadata.height !== crop.height || outputMetadata.format !== "jpeg") {
      throw new Error(`Output validation failed for ${asset.key}`);
    }

    if (previewDir && index < previewLimit) {
      const prefix = String(index + 1).padStart(3, "0");
      const originalPreview = await sharp(orientedInput, { failOn: "none", limitInputPixels: 100_000_000 })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();
      await Promise.all([
        writeFile(join(previewDir, `${prefix}-${asset.kind}-original.jpg`), originalPreview),
        writeFile(join(previewDir, `${prefix}-${asset.kind}-cropped.jpg`), output),
      ]);
    }

    const digest = sha256(output);
    const destinationKey = sanitizedOriginalMediaKey(asset.kind, digest, "jpg", version);
    let exists = false;
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: destinationKey }));
      exists = true;
    } catch (error) {
      if (error?.$metadata?.httpStatusCode !== 404 && error?.name !== "NotFound" && error?.name !== "NoSuchKey") throw error;
    }

    if (apply && !exists) {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: destinationKey,
        Body: output,
        ContentLength: output.length,
        ContentType: "image/jpeg",
        CacheControl: "public,max-age=31536000,immutable",
        ServerSideEncryption: "AES256",
        Metadata: {
          "source-object-sha256": sha256(asset.key),
          "crop-bottom-percent": String(cropBottomPercent),
          "sanitizer-version": version,
        },
      }));
      uploaded += 1;
    } else if (exists) {
      reused += 1;
    }

    const result = {
      source_key: asset.key,
      source_url: asset.public_url,
      source_provenance_url: asset.source_url || "",
      kind: asset.kind,
      destination_key: destinationKey,
      destination_url: publicMediaUrl(mediaBaseUrl, destinationKey),
      source_width: metadata.width,
      source_height: metadata.height,
      output_width: outputMetadata.width,
      output_height: outputMetadata.height,
      cropped_pixels: crop.croppedPixels,
      crop_bottom_percent: cropBottomPercent,
      source_bytes: input.length,
      output_bytes: output.length,
      output_sha256: digest,
      version,
      uploaded: apply,
      sanitized_at: new Date().toISOString(),
    };
    if (apply) {
      await appendCheckpoint(result);
      checkpoint.set(asset.key, result);
    }
    return result;
  } catch (error) {
    failed += 1;
    failures.push({ key: asset.key, message: error?.message || String(error) });
    return null;
  } finally {
    resolved += 1;
    if (resolved % 100 === 0 || resolved === assets.size) process.stdout.write(`\rSanitized ${resolved}/${assets.size}`);
  }
}

const results = await mapLimit([...assets.values()], concurrency, sanitizeAsset);
process.stdout.write("\n");
const replacementByPublicUrl = new Map(
  results.filter(Boolean).map((item) => [item.source_url, item.destination_url]),
);

const outputRows = [];
const unresolvedColleges = [];
const droppedGalleryAssets = [];
for (const row of selectedRows) {
  const built = buildSanitizedCollegeManifestRow(row, replacementByPublicUrl, version, { dropUnavailableGallery });
  if (built.row) {
    outputRows.push(built.row);
    if (built.droppedGallery.length) {
      droppedGalleryAssets.push({
        id: row?.production?.id,
        slug: row?.production?.slug,
        name: row?.production?.name,
        dropped: built.droppedGallery,
      });
    }
  }
  else unresolvedColleges.push({
    id: row?.production?.id,
    slug: row?.production?.slug,
    name: row?.production?.name,
    unresolved: built.unresolved,
  });
}

await writeFile(outputManifestPath, outputRows.map((row) => JSON.stringify(row)).join("\n") + (outputRows.length ? "\n" : ""), "utf8");
const report = {
  mode: apply ? "upload" : "dry-run",
  generated_at: new Date().toISOString(),
  source_manifest: basename(manifestPath),
  sanitizer_version: version,
  crop_bottom_percent: cropBottomPercent,
  jpeg_quality: quality,
  source_colleges: selectedRows.length,
  source_assets: assets.size,
  resolved_assets: results.filter(Boolean).length,
  uploaded_assets: uploaded,
  reused_assets: reused,
  failed_assets: failed,
  colleges_ready: outputRows.length,
  colleges_unresolved: unresolvedColleges.length,
  dropped_unavailable_gallery_assets: droppedGalleryAssets.reduce((total, item) => total + item.dropped.length, 0),
  colleges_with_dropped_gallery_assets: droppedGalleryAssets.length,
  output_manifest: outputManifestPath,
  checkpoint: checkpointPath,
  samples: {
    failures: failures.slice(0, 100),
    unresolved_colleges: unresolvedColleges.slice(0, 100),
    dropped_gallery_assets: droppedGalleryAssets.slice(0, 100),
  },
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));

if (apply) {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const prefix = `migration-manifests/original-college-media-sanitized/${timestamp}`;
  for (const [path, key, contentType] of [
    [outputManifestPath, `${prefix}/apply-manifest.jsonl`, "application/x-ndjson; charset=utf-8"],
    [reportPath, `${prefix}/report.json`, "application/json; charset=utf-8"],
  ]) {
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
  console.log(`Audit artifacts: s3://${bucket}/${prefix}/`);
}
