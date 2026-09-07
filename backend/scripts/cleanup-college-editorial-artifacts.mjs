import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma, jsonSafe } from "../src/db.mjs";
import {
  COLLEGE_PUBLIC_CONTENT_FIELDS,
  findCollegeEditorialArtifacts,
  hasCollegeEditorialArtifacts,
  sanitizeCollegePublicContent,
} from "../src/college-content-sanitizer.mjs";

const APPLY = process.argv.includes("--apply");
const PAGE_SIZE = 50;
const bucket = String(process.env.AWS_S3_BUCKET || "").trim();
const region = String(process.env.AWS_REGION || "ap-south-1").trim();
const startedAt = new Date();
const timestamp = startedAt.toISOString().replaceAll(":", "-");
const backupPrefix = `system-backups/college-editorial-cleanup/${timestamp}`;
const select = Object.fromEntries([
  "id",
  "slug",
  "short_id",
  "name",
  "location",
  "city",
  "state",
  "type",
  "category",
  "updated_at",
  ...COLLEGE_PUBLIC_CONTENT_FIELDS,
].map((field) => [field, true]));

function csv(value) {
  const output = String(value ?? "");
  return /[",\n\r]/.test(output) ? `"${output.replaceAll('"', '""')}"` : output;
}

async function writeChunk(stream, value) {
  if (!stream.write(value)) await new Promise((resolve) => stream.once("drain", resolve));
}

async function forEachCollege(visitor) {
  let cursor;
  for (;;) {
    const rows = await prisma.colleges.findMany({
      select,
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;
    await visitor(rows);
    cursor = rows.at(-1).id;
    if (rows.length < PAGE_SIZE) break;
  }
}

async function uploadFile(client, path, key, contentType) {
  const details = await stat(path);
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: createReadStream(path),
    ContentLength: details.size,
    ContentType: contentType,
    ServerSideEncryption: "AES256",
  }));
}

const report = {
  mode: APPLY ? "apply" : "dry-run",
  startedAt: startedAt.toISOString(),
  scanned: 0,
  affected: 0,
  updated: 0,
  remaining: 0,
  fields: {},
  artifacts: {},
  samples: [],
};

const workDir = await mkdtemp(join(tmpdir(), "dc-college-editorial-cleanup-"));
const recordsPath = join(workDir, "college-records.jsonl.gz");
const inventoryPath = join(workDir, "college-inventory.csv.gz");
const manifestPath = join(workDir, "manifest.json");
const recordsInput = new PassThrough();
const inventoryInput = new PassThrough();
const recordsPipeline = pipeline(recordsInput, createGzip({ level: 9 }), createWriteStream(recordsPath));
const inventoryPipeline = pipeline(inventoryInput, createGzip({ level: 9 }), createWriteStream(inventoryPath));

try {
  await writeChunk(recordsInput, `${JSON.stringify({
    kind: "manifest",
    createdAt: startedAt.toISOString(),
    purpose: "Pre-change backup for removal of public editorial process copy from college records",
    publicFields: COLLEGE_PUBLIC_CONTENT_FIELDS,
  })}\n`);
  await writeChunk(inventoryInput, "id,short_id,slug,name,matched_fields,matched_artifacts\n");

  await forEachCollege(async (rows) => {
    report.scanned += rows.length;
    for (const row of rows) {
      const detected = findCollegeEditorialArtifacts(row);
      if (!Object.keys(detected).length) continue;
      report.affected += 1;
      for (const [field, labels] of Object.entries(detected)) {
        report.fields[field] = (report.fields[field] || 0) + 1;
        for (const label of labels) report.artifacts[label] = (report.artifacts[label] || 0) + 1;
      }
      if (report.samples.length < 25) {
        report.samples.push({ id: row.id, short_id: String(row.short_id), slug: row.slug, name: row.name });
      }
      await writeChunk(recordsInput, `${JSON.stringify(jsonSafe({ kind: "college", detected, row }))}\n`);
      await writeChunk(inventoryInput, `${[
        row.id,
        row.short_id,
        row.slug,
        row.name,
        Object.keys(detected).join("|"),
        [...new Set(Object.values(detected).flat())].join("|"),
      ].map(csv).join(",")}\n`);
    }
  });

  recordsInput.end();
  inventoryInput.end();
  await Promise.all([recordsPipeline, inventoryPipeline]);

  await writeFile(manifestPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!APPLY || report.affected === 0) process.exitCode = 0;
  else {
    if (!bucket) throw new Error("AWS_S3_BUCKET is required in --apply mode; no database rows were changed");
    const s3 = new S3Client({ region });
    await uploadFile(s3, recordsPath, `${backupPrefix}/college-records.jsonl.gz`, "application/gzip");
    await uploadFile(s3, inventoryPath, `${backupPrefix}/college-inventory.csv.gz`, "application/gzip");
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: `${backupPrefix}/manifest.json`,
      Body: await readFile(manifestPath),
      ContentType: "application/json; charset=utf-8",
      ServerSideEncryption: "AES256",
    }));
    console.log(`Private pre-change backup: s3://${bucket}/${backupPrefix}/`);

    await forEachCollege(async (rows) => {
      const updates = [];
      for (const current of rows) {
        if (!hasCollegeEditorialArtifacts(current)) continue;
        const sanitized = sanitizeCollegePublicContent(current);
        if (!sanitized.changedFields.length) continue;
        const data = Object.fromEntries(sanitized.changedFields.map((field) => [field, sanitized.row[field]]));
        data.updated_at = new Date();
        updates.push(prisma.colleges.update({ where: { id: current.id }, data }));
      }
      if (updates.length) {
        await prisma.$transaction(updates);
        report.updated += updates.length;
        console.log(`Cleaned ${report.updated}/${report.affected} affected colleges`);
      }
    });

    await forEachCollege(async (rows) => {
      report.remaining += rows.filter(hasCollegeEditorialArtifacts).length;
    });
    report.completedAt = new Date().toISOString();
    report.backup = `s3://${bucket}/${backupPrefix}/`;
    await writeFile(manifestPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: `${backupPrefix}/manifest.json`,
      Body: await readFile(manifestPath),
      ContentType: "application/json; charset=utf-8",
      ServerSideEncryption: "AES256",
    }));
    if (report.updated !== report.affected || report.remaining !== 0) {
      throw new Error(`Cleanup incomplete: affected=${report.affected}, updated=${report.updated}, remaining=${report.remaining}`);
    }
    console.log(JSON.stringify(report, null, 2));
  }
} finally {
  recordsInput.destroy();
  inventoryInput.destroy();
  await prisma.$disconnect();
  await rm(workDir, { recursive: true, force: true });
}
