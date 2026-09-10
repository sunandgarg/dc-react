#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const archivePath = resolve(String(process.argv[2] || process.env.CAT_KIT_ARCHIVE || ""));
const bucket = String(process.env.AWS_S3_BUCKET || "").trim();
const region = String(process.env.AWS_REGION || "ap-south-1").trim();
const objectKey = "user-documents/cat-kits/CAT-2026-Preparation-Kit.zip";
const minimumBytes = 100 * 1024 * 1024;
const runFile = promisify(execFile);

assert.ok(process.argv[2] || process.env.CAT_KIT_ARCHIVE, "Pass the CAT collection ZIP path as the first argument or CAT_KIT_ARCHIVE");
assert.ok(bucket, "AWS_S3_BUCKET is required");

const archive = await stat(archivePath);
assert.ok(archive.isFile(), `${archivePath} is not a file`);
assert.ok(archive.size >= minimumBytes, `CAT collection is unexpectedly small (${archive.size} bytes)`);

const handle = await open(archivePath, "r");
const signature = Buffer.alloc(4);
await handle.read(signature, 0, signature.length, 0);
await handle.close();
assert.equal(signature.toString("hex"), "504b0304", "CAT collection is not a valid ZIP archive");
const { stdout: zipListing } = await runFile("unzip", ["-Z1", archivePath], { maxBuffer: 1024 * 1024 });
const entries = zipListing.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
assert.equal(entries.length, 16, `CAT collection must contain exactly 16 resources; found ${entries.length}`);
assert.ok(entries.every((entry) => /^DekhoCampus_CAT_[A-Za-z0-9_]+\.pdf$/.test(entry)), "CAT collection contains an unexpected file or unsafe path");

const digest = createHash("sha256");
for await (const chunk of createReadStream(archivePath)) digest.update(chunk);
const sha256 = digest.digest("hex");
const client = new S3Client({ region });

await client.send(new PutObjectCommand({
  Bucket: bucket,
  Key: objectKey,
  Body: createReadStream(archivePath),
  ContentLength: archive.size,
  ContentType: "application/zip",
  ContentDisposition: 'attachment; filename="DekhoCampus-CAT-2026-Collection.zip"',
  CacheControl: "private,no-store",
  ServerSideEncryption: "AES256",
  Metadata: {
    campaign: "cat-2026",
    resource_count: String(entries.length),
    sha256,
  },
}));

const uploaded = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
assert.equal(Number(uploaded.ContentLength), archive.size, "Uploaded CAT collection size does not match the source archive");
assert.equal(uploaded.Metadata?.sha256, sha256, "Uploaded CAT collection checksum metadata does not match");

console.log(JSON.stringify({
  ok: true,
  bucket,
  key: objectKey,
  bytes: archive.size,
  sha256,
  resource_count: entries.length,
  encrypted: uploaded.ServerSideEncryption === "AES256",
}, null, 2));
