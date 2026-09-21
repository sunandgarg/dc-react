#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
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

const apply = args.has("--apply");
const concurrency = Math.max(1, Math.min(8, Number(args.get("--concurrency") || 4)));
const planPath = path.resolve(String(args.get("--plan") || "../upgrad-sync/upgrad-media-upload-plan.json"));
const resultPath = path.resolve(String(args.get("--result") || "../upgrad-sync/upgrad-media-upload-results.json"));
const accessToken = String(process.env.DC_ADMIN_ACCESS_TOKEN || "").trim();
const plan = JSON.parse(await readFile(planPath, "utf8"));

if (!Array.isArray(plan.assets) || !plan.assets.length) throw new Error("Upload plan has no assets");
if (apply && !accessToken) {
  throw new Error("DC_ADMIN_ACCESS_TOKEN is required with --apply; do not put the token in a command-line argument");
}

function digest(body) {
  return createHash("sha256").update(body).digest("hex");
}

async function inspectPublicAsset(asset) {
  const response = await fetch(asset.public_url, { redirect: "follow" });
  if (response.status === 404) return { exists: false };
  if (!response.ok) throw new Error(`Could not inspect ${asset.public_url}: HTTP ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  const sha256 = digest(body);
  if (sha256 !== asset.sha256) {
    throw new Error(`Existing object checksum mismatch at ${asset.public_url}: expected ${asset.sha256}, got ${sha256}`);
  }
  return { exists: true, bytes: body.length, sha256 };
}

async function upload(asset) {
  const localBody = await readFile(asset.local_file);
  const localSha256 = digest(localBody);
  if (localSha256 !== asset.sha256) {
    throw new Error(`Local checksum mismatch for ${asset.local_file}: expected ${asset.sha256}, got ${localSha256}`);
  }

  const existing = await inspectPublicAsset(asset);
  if (existing.exists) return { status: "already-present", ...existing };
  if (!apply) return { status: "would-upload", bytes: localBody.length, sha256: localSha256 };

  const response = await fetch(asset.storage_api.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": asset.content_type,
      "cache-control": asset.cache_control,
      "x-upsert": "false",
    },
    body: localBody,
  });
  const responseText = await response.text();
  if (!response.ok && response.status !== 409) {
    throw new Error(`Upload failed for ${asset.object_key}: HTTP ${response.status} ${responseText.slice(0, 500)}`);
  }

  const verified = await inspectPublicAsset(asset);
  if (!verified.exists) throw new Error(`Upload returned success but ${asset.public_url} is unavailable`);
  return { status: response.status === 409 ? "already-present" : "uploaded", ...verified };
}

const previous = await readFile(resultPath, "utf8").then(JSON.parse).catch(() => ({ assets: [] }));
const resultBySha256 = new Map((previous.assets || []).map((row) => [row.sha256, row]));
let cursor = 0;
let writeChain = Promise.resolve();

async function checkpoint() {
  const assets = plan.assets.map((asset) => resultBySha256.get(asset.sha256)).filter(Boolean);
  const payload = {
    schema_version: 1,
    plan: planPath,
    apply,
    updated_at: new Date().toISOString(),
    summary: {
      planned: plan.assets.length,
      completed: assets.filter((row) => ["uploaded", "already-present", "would-upload"].includes(row.status)).length,
      uploaded: assets.filter((row) => row.status === "uploaded").length,
      already_present: assets.filter((row) => row.status === "already-present").length,
      would_upload: assets.filter((row) => row.status === "would-upload").length,
      failed: assets.filter((row) => row.status === "failed").length,
    },
    assets,
  };
  writeChain = writeChain.then(() => writeFile(resultPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8"));
  await writeChain;
}

await Promise.all(Array.from({ length: concurrency }, async () => {
  while (cursor < plan.assets.length) {
    const index = cursor;
    cursor += 1;
    const asset = plan.assets[index];
    try {
      const result = await upload(asset);
      resultBySha256.set(asset.sha256, {
        order: asset.order,
        kind: asset.kind,
        sha256: asset.sha256,
        object_key: asset.object_key,
        public_url: asset.public_url,
        ...result,
      });
      process.stdout.write(`[${index + 1}/${plan.assets.length}] ${result.status} ${asset.kind} ${asset.sha256.slice(0, 16)}\n`);
    } catch (error) {
      resultBySha256.set(asset.sha256, {
        order: asset.order,
        kind: asset.kind,
        sha256: asset.sha256,
        object_key: asset.object_key,
        public_url: asset.public_url,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
      process.stderr.write(`[${index + 1}/${plan.assets.length}] failed ${asset.kind} ${asset.sha256.slice(0, 16)}: ${error.message}\n`);
    }
    await checkpoint();
  }
}));

await checkpoint();
const failed = [...resultBySha256.values()].filter((row) => row.status === "failed");
console.log(JSON.stringify({ apply, result: resultPath, planned: plan.assets.length, failed: failed.length }, null, 2));
if (failed.length) process.exitCode = 1;
