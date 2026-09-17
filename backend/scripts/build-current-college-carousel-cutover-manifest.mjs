import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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

await mkdir(dirname(outputPath), { recursive: true });
await mkdir(dirname(reportPath), { recursive: true });
const output = createWriteStream(outputPath, { encoding: "utf8" });
const originalRows = readJsonLines(originalPath)[Symbol.asyncIterator]();
const sanitizedRows = readJsonLines(sanitizedPath)[Symbol.asyncIterator]();
const report = {
  generated_at: new Date().toISOString(),
  rows: 0,
  changed: 0,
  already_sanitized: 0,
  empty: 0,
  dropped_unavailable_assets: 0,
  missing_colleges: 0,
  unmapped_colleges: 0,
  samples: { missing: [], unmapped: [] },
};

try {
  for (;;) {
    const [originalResult, sanitizedResult] = await Promise.all([originalRows.next(), sanitizedRows.next()]);
    if (originalResult.done || sanitizedResult.done) {
      if (originalResult.done !== sanitizedResult.done) throw new Error("Original and sanitized manifests have different row counts");
      break;
    }
    const originalRow = originalResult.value;
    const sanitizedRow = sanitizedResult.value;
    const originalId = String(originalRow?.production?.id || "");
    const sanitizedId = String(sanitizedRow?.production?.id || "");
    if (!originalId || originalId !== sanitizedId) {
      throw new Error(`Manifest order mismatch at row ${report.rows + 1}: ${originalId || "missing"} != ${sanitizedId || "missing"}`);
    }
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
  output.end();
  await once(output, "finish");
  process.stdout.write("\n");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ...report, output: outputPath, report: reportPath }, null, 2));
  if (report.missing_colleges || report.unmapped_colleges) {
    throw new Error(`Current carousel cutover is incomplete: ${report.missing_colleges} missing and ${report.unmapped_colleges} unmapped colleges`);
  }
} finally {
  if (!output.closed) output.destroy();
  await prisma.$disconnect();
}
