#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (!key.startsWith("--")) continue;
  const next = process.argv[index + 1];
  if (!next || next.startsWith("--")) args.set(key, true);
  else {
    args.set(key, next);
    index += 1;
  }
}

const repoRoot = process.cwd();
const inputPath = path.resolve(String(args.get("--source") || path.join(repoRoot, "../upgrad-sync/prepared-media-manifest.json")));
const outputPath = path.resolve(String(args.get("--output") || path.join(repoRoot, "../upgrad-sync/upgrad-media-upload-plan.json")));
const bucket = String(args.get("--bucket") || "admin-uploads").replace(/^\/+|\/+$/g, "");
const prefix = String(args.get("--prefix") || "promoted-programs/upgrad-2026/content")
  .replace(/^\/+|\/+$/g, "");
const mediaBaseUrl = String(args.get("--media-base-url") || "https://aws-origin.dekhocampus.com/storage/v1/object/public")
  .replace(/\/+$/g, "");

const kindOrder = new Map([["hero", 0], ["logo", 1], ["certificate", 2]]);
const databaseFields = {
  hero: ["hero_image", "image_url"],
  logo: ["institute_logo"],
  certificate: ["certificate_image"],
};

function publicUrl(objectPath) {
  const encoded = `${bucket}/${objectPath}`.split("/").map(encodeURIComponent).join("/");
  return `${mediaBaseUrl}/${encoded}`;
}

function uploadUrl(objectPath) {
  const encoded = `${bucket}/${objectPath}`.split("/").map(encodeURIComponent).join("/");
  return `https://aws-origin.dekhocampus.com/storage/v1/object/${encoded}`;
}

async function sha256(filePath) {
  const body = await readFile(filePath);
  return createHash("sha256").update(body).digest("hex");
}

const manifest = JSON.parse(await readFile(inputPath, "utf8"));
if (!Array.isArray(manifest)) throw new Error("Prepared-media manifest must be an array");

const associations = [];
for (const programme of manifest) {
  for (const [kind, asset] of Object.entries(programme.assets || {})) {
    if (!databaseFields[kind]) throw new Error(`Unsupported asset kind ${kind} for ${programme.slug}`);
    if (!asset?.output_path || !asset?.sha256) throw new Error(`Incomplete ${kind} asset for ${programme.slug}`);

    const filePath = path.resolve(asset.output_path);
    const fileStat = await stat(filePath);
    const actualSha256 = await sha256(filePath);
    if (actualSha256 !== asset.sha256) {
      throw new Error(`Checksum mismatch for ${filePath}: expected ${asset.sha256}, got ${actualSha256}`);
    }
    if (Number(asset.output_bytes) !== fileStat.size) {
      throw new Error(`Byte-size mismatch for ${filePath}: expected ${asset.output_bytes}, got ${fileStat.size}`);
    }

    associations.push({
      programme_id: programme.id,
      slug: programme.slug,
      kind,
      fields: databaseFields[kind],
      source_url: asset.source_url || "",
      local_file: filePath,
      bytes: fileStat.size,
      width: Number(asset.output_width || 0),
      height: Number(asset.output_height || 0),
      sha256: actualSha256,
      legacy_planned_key: String(asset.s3_key || ""),
    });
  }
}

const bySha256 = new Map();
for (const association of associations) {
  const current = bySha256.get(association.sha256) || [];
  current.push(association);
  bySha256.set(association.sha256, current);
}

const assets = [...bySha256.entries()].map(([digest, rows]) => {
  const kinds = [...new Set(rows.map((row) => row.kind))];
  if (kinds.length !== 1) throw new Error(`Checksum ${digest} is used by multiple media kinds: ${kinds.join(", ")}`);
  const kind = kinds[0];
  const representative = [...rows].sort((left, right) => left.local_file.localeCompare(right.local_file))[0];
  const objectPath = `${prefix}/${kind}/${digest.slice(0, 2)}/${digest}.webp`;
  return {
    order: 0,
    kind,
    sha256: digest,
    bytes: representative.bytes,
    width: representative.width,
    height: representative.height,
    content_type: "image/webp",
    cache_control: "public,max-age=31536000,immutable",
    local_file: representative.local_file,
    bucket,
    object_path: objectPath,
    object_key: `${bucket}/${objectPath}`,
    public_url: publicUrl(objectPath),
    storage_api: {
      method: "POST",
      url: uploadUrl(objectPath),
      required_headers: {
        authorization: "Bearer <active DekhoCampus admin/editor access token>",
        "content-type": "image/webp",
        "cache-control": "public,max-age=31536000,immutable",
        "x-upsert": "false",
      },
    },
    source_urls: [...new Set(rows.map((row) => row.source_url).filter(Boolean))].sort(),
    programme_associations: rows
      .map(({ programme_id, slug, kind: rowKind, fields, source_url, legacy_planned_key }) => ({
        programme_id,
        slug,
        kind: rowKind,
        fields,
        source_url,
        legacy_planned_key,
      }))
      .sort((left, right) => left.slug.localeCompare(right.slug)),
  };
}).sort((left, right) => {
  const byKind = (kindOrder.get(left.kind) ?? 99) - (kindOrder.get(right.kind) ?? 99);
  return byKind || left.sha256.localeCompare(right.sha256);
}).map((asset, index) => ({ ...asset, order: index + 1 }));

const assetBySha256 = new Map(assets.map((asset) => [asset.sha256, asset]));
const programmes = manifest.map((programme) => {
  const patch = {};
  const media = {};
  for (const [kind, originalAsset] of Object.entries(programme.assets || {})) {
    const asset = assetBySha256.get(originalAsset.sha256);
    if (!asset) throw new Error(`No planned object for ${programme.slug} ${kind}`);
    media[kind] = {
      sha256: asset.sha256,
      source_url: originalAsset.source_url || "",
      public_url: asset.public_url,
      object_key: asset.object_key,
    };
    for (const field of databaseFields[kind]) patch[field] = asset.public_url;
  }
  return {
    programme_id: programme.id,
    slug: programme.slug,
    media,
    database_patch: patch,
  };
}).sort((left, right) => left.slug.localeCompare(right.slug));

const associationBytes = associations.reduce((total, row) => total + row.bytes, 0);
const uniqueBytes = assets.reduce((total, row) => total + row.bytes, 0);
const plan = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  source_manifest: inputPath,
  storage: {
    provider: "s3-via-dekhocampus-storage-api",
    bucket,
    prefix,
    media_base_url: mediaBaseUrl,
    overwrite_existing: false,
  },
  summary: {
    programmes: programmes.length,
    asset_associations: associations.length,
    unique_uploads: assets.length,
    duplicate_associations_removed: associations.length - assets.length,
    association_bytes: associationBytes,
    unique_upload_bytes: uniqueBytes,
    bytes_saved_by_deduplication: associationBytes - uniqueBytes,
    percent_saved_by_deduplication: Number((((associationBytes - uniqueBytes) / associationBytes) * 100).toFixed(2)),
    by_kind: Object.fromEntries([...kindOrder.keys()].map((kind) => [kind, {
      associations: associations.filter((row) => row.kind === kind).length,
      unique_uploads: assets.filter((row) => row.kind === kind).length,
    }])),
  },
  assets,
  programmes,
};

await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: outputPath, ...plan.summary }, null, 2));
