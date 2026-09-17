import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { prisma } from "../src/db.mjs";
import { buildCurrentCarouselCutoverManifestRow, stableJson } from "../src/original-media-migration.mjs";
import { toStoredMediaKeys } from "../src/media-values.mjs";

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

const originalPath = resolve(String(args.get("--original-manifest") || ""));
const sanitizedPath = resolve(String(args.get("--sanitized-manifest") || ""));
const outputPath = resolve(String(args.get("--output") || "work/original-college-media/current-carousel-cutover-manifest.jsonl"));
const reportPath = resolve(String(args.get("--report") || `${outputPath}.report.json`));
if (!args.get("--original-manifest")) throw new Error("--original-manifest is required");
if (!args.get("--sanitized-manifest")) throw new Error("--sanitized-manifest is required");

async function* readJsonLines(path) {
  const lines = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of lines) if (line.trim()) yield JSON.parse(line);
}

function stagedRowPath(directory, id) {
  const digest = createHash("sha256").update(id).digest("hex");
  return join(directory, `${digest}.json`);
}

await mkdir(dirname(outputPath), { recursive: true });
await mkdir(dirname(reportPath), { recursive: true });
const joinDirectory = await mkdtemp(join(tmpdir(), "dc-college-carousel-join-"));
let output;
const report = {
  generated_at: new Date().toISOString(),
  source_rows: 0,
  sanitized_rows: 0,
  rows: 0,
  changed: 0,
  already_sanitized: 0,
  empty: 0,
  dropped_unavailable_assets: 0,
  missing_sanitized_rows: 0,
  extra_sanitized_rows: 0,
  missing_colleges: 0,
  unmapped_colleges: 0,
  samples: { missing_sanitized: [], extra_sanitized: [], missing: [], unmapped: [] },
};

try {
  const sanitizedIds = new Set();
  for await (const sanitizedRow of readJsonLines(sanitizedPath)) {
    const sanitizedId = String(sanitizedRow?.production?.id || "").trim();
    if (!sanitizedId) throw new Error(`Sanitized manifest row ${report.sanitized_rows + 1} has no production ID`);
    if (sanitizedIds.has(sanitizedId)) throw new Error(`Sanitized manifest contains duplicate production ID ${sanitizedId}`);
    sanitizedIds.add(sanitizedId);
    report.sanitized_rows += 1;
    await writeFile(stagedRowPath(joinDirectory, sanitizedId), JSON.stringify(sanitizedRow), "utf8");
    if (report.sanitized_rows % 500 === 0) {
      process.stdout.write(`\rStaged ${report.sanitized_rows} sanitized rows`);
    }
  }
  process.stdout.write("\n");

  output = createWriteStream(outputPath, { encoding: "utf8" });
  const sourceIds = new Set();
  for await (const originalRow of readJsonLines(originalPath)) {
    report.source_rows += 1;
    const originalId = String(originalRow?.production?.id || "").trim();
    if (!originalId) throw new Error(`Original manifest row ${report.source_rows} has no production ID`);
    if (sourceIds.has(originalId)) throw new Error(`Original manifest contains duplicate production ID ${originalId}`);
    sourceIds.add(originalId);
    if (!sanitizedIds.has(originalId)) {
      report.missing_sanitized_rows += 1;
      if (report.samples.missing_sanitized.length < 25) report.samples.missing_sanitized.push(originalRow.production);
      continue;
    }
    const sanitizedRow = JSON.parse(await readFile(stagedRowPath(joinDirectory, originalId), "utf8"));
    const current = await prisma.colleges.findUnique({
      where: { id: originalId },
      select: { id: true, slug: true, name: true, city: true, state: true, carousel_images: true },
    });
    if (!current) {
      report.missing_colleges += 1;
      if (report.samples.missing.length < 25) report.samples.missing.push(originalRow.production);
      continue;
    }
    const result = buildCurrentCarouselCutoverManifestRow(originalRow, sanitizedRow, current);
    if (!result.row) {
      report.unmapped_colleges += 1;
      if (report.samples.unmapped.length < 25) {
        report.samples.unmapped.push({ id: current.id, slug: current.slug, values: result.unmapped.slice(0, 10) });
      }
      continue;
    }
    report.rows += 1;
    report.dropped_unavailable_assets += result.dropped;
    const before = toStoredMediaKeys(result.row.expected.carousel_images || []);
    const after = toStoredMediaKeys(result.row.replacement.carousel_images || []);
    if (!before.length) report.empty += 1;
    else if (stableJson(before) === stableJson(after)) report.already_sanitized += 1;
    else report.changed += 1;
    if (!output.write(`${JSON.stringify(result.row)}\n`)) await once(output, "drain");
    if (report.rows % 500 === 0) process.stdout.write(`\rPrepared ${report.rows} current carousel rows`);
  }

  for (const sanitizedId of sanitizedIds) {
    if (sourceIds.has(sanitizedId)) continue;
    report.extra_sanitized_rows += 1;
    if (report.samples.extra_sanitized.length < 25) report.samples.extra_sanitized.push(sanitizedId);
  }
  output.end();
  await once(output, "finish");
  process.stdout.write("\n");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ...report, output: outputPath, report: reportPath }, null, 2));
  if (report.missing_sanitized_rows || report.extra_sanitized_rows || report.missing_colleges || report.unmapped_colleges) {
    throw new Error(
      `Current carousel cutover is incomplete: ${report.missing_sanitized_rows} missing sanitized rows, `
      + `${report.extra_sanitized_rows} extra sanitized rows, ${report.missing_colleges} missing colleges, `
      + `and ${report.unmapped_colleges} unmapped colleges`,
    );
  }
} finally {
  if (output && !output.closed) output.destroy();
  await rm(joinDirectory, { recursive: true, force: true });
  await prisma.$disconnect();
}
