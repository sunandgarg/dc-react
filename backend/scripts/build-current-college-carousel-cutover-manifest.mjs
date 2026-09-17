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
const aliasPath = args.get("--alias-manifest") ? resolve(String(args.get("--alias-manifest"))) : "";
const contentAliasPath = args.get("--content-alias-manifest") ? resolve(String(args.get("--content-alias-manifest"))) : "";
const outputPath = resolve(String(args.get("--output") || "work/original-college-media/current-carousel-cutover-manifest.jsonl"));
const reportPath = resolve(String(args.get("--report") || `${outputPath}.report.json`));
const unmappedOutputPath = args.get("--unmapped-output") ? resolve(String(args.get("--unmapped-output"))) : "";
const allowUnmapped = args.has("--allow-unmapped");
if (!args.get("--original-manifest")) throw new Error("--original-manifest is required");
if (!args.get("--sanitized-manifest")) throw new Error("--sanitized-manifest is required");

async function* readJsonLines(path) {
  const lines = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of lines) if (line.trim()) yield JSON.parse(line);
}

function stagedRowPath(directory, id, label) {
  const digest = createHash("sha256").update(id).digest("hex");
  return join(directory, `${label}-${digest}.json`);
}

await mkdir(dirname(outputPath), { recursive: true });
await mkdir(dirname(reportPath), { recursive: true });
const joinDirectory = await mkdtemp(join(tmpdir(), "dc-college-carousel-join-"));
let output;
let unmappedOutput;
const report = {
  generated_at: new Date().toISOString(),
  source_rows: 0,
  sanitized_rows: 0,
  alias_rows: 0,
  content_alias_rows: 0,
  rows: 0,
  changed: 0,
  already_sanitized: 0,
  empty: 0,
  dropped_unavailable_assets: 0,
  missing_sanitized_rows: 0,
  extra_sanitized_rows: 0,
  missing_alias_rows: 0,
  extra_alias_rows: 0,
  extra_content_alias_rows: 0,
  missing_colleges: 0,
  unmapped_colleges: 0,
  samples: {
    missing_sanitized: [], extra_sanitized: [], missing_alias: [], extra_alias: [],
    extra_content_alias: [], missing: [], unmapped: [],
  },
};

try {
  const sanitizedIds = new Set();
  for await (const sanitizedRow of readJsonLines(sanitizedPath)) {
    const sanitizedId = String(sanitizedRow?.production?.id || "").trim();
    if (!sanitizedId) throw new Error(`Sanitized manifest row ${report.sanitized_rows + 1} has no production ID`);
    if (sanitizedIds.has(sanitizedId)) throw new Error(`Sanitized manifest contains duplicate production ID ${sanitizedId}`);
    sanitizedIds.add(sanitizedId);
    report.sanitized_rows += 1;
    await writeFile(stagedRowPath(joinDirectory, sanitizedId, "sanitized"), JSON.stringify(sanitizedRow), "utf8");
    if (report.sanitized_rows % 500 === 0) {
      process.stdout.write(`\rStaged ${report.sanitized_rows} sanitized rows`);
    }
  }
  process.stdout.write("\n");

  const aliasIds = new Set();
  if (aliasPath) {
    for await (const aliasRow of readJsonLines(aliasPath)) {
      const aliasId = String(aliasRow?.production?.id || "").trim();
      if (!aliasId) throw new Error(`Alias manifest row ${report.alias_rows + 1} has no production ID`);
      if (aliasIds.has(aliasId)) throw new Error(`Alias manifest contains duplicate production ID ${aliasId}`);
      aliasIds.add(aliasId);
      report.alias_rows += 1;
      await writeFile(stagedRowPath(joinDirectory, aliasId, "alias"), JSON.stringify(aliasRow), "utf8");
      if (report.alias_rows % 500 === 0) process.stdout.write(`\rStaged ${report.alias_rows} alias rows`);
    }
    process.stdout.write("\n");
  }

  const contentAliasIds = new Set();
  if (contentAliasPath) {
    for await (const contentAliasRow of readJsonLines(contentAliasPath)) {
      const contentAliasId = String(contentAliasRow?.production?.id || "").trim();
      if (!contentAliasId) throw new Error(`Content alias manifest row ${report.content_alias_rows + 1} has no production ID`);
      if (contentAliasIds.has(contentAliasId)) throw new Error(`Content alias manifest contains duplicate production ID ${contentAliasId}`);
      contentAliasIds.add(contentAliasId);
      report.content_alias_rows += 1;
      await writeFile(stagedRowPath(joinDirectory, contentAliasId, "content-alias"), JSON.stringify(contentAliasRow), "utf8");
    }
  }

  output = createWriteStream(outputPath, { encoding: "utf8" });
  if (unmappedOutputPath) {
    await mkdir(dirname(unmappedOutputPath), { recursive: true });
    unmappedOutput = createWriteStream(unmappedOutputPath, { encoding: "utf8" });
  }
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
    const sanitizedRow = JSON.parse(await readFile(stagedRowPath(joinDirectory, originalId, "sanitized"), "utf8"));
    let aliasRow = null;
    if (aliasPath) {
      if (!aliasIds.has(originalId)) {
        report.missing_alias_rows += 1;
        if (report.samples.missing_alias.length < 25) report.samples.missing_alias.push(originalRow.production);
        continue;
      }
      aliasRow = JSON.parse(await readFile(stagedRowPath(joinDirectory, originalId, "alias"), "utf8"));
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
    const contentAliasRow = contentAliasIds.has(originalId)
      ? JSON.parse(await readFile(stagedRowPath(joinDirectory, originalId, "content-alias"), "utf8"))
      : null;
    const result = buildCurrentCarouselCutoverManifestRow(originalRow, sanitizedRow, current, aliasRow, contentAliasRow);
    if (!result.row) {
      report.unmapped_colleges += 1;
      if (report.samples.unmapped.length < 25) {
        report.samples.unmapped.push({ id: current.id, slug: current.slug, values: result.unmapped.slice(0, 10) });
      }
      if (unmappedOutput && !unmappedOutput.write(`${JSON.stringify({
        production: { id: current.id, slug: current.slug, name: current.name, city: current.city, state: current.state },
        current: { carousel_images: current.carousel_images || [] },
        unmapped: result.unmapped,
      })}\n`)) await once(unmappedOutput, "drain");
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
  for (const aliasId of aliasIds) {
    if (sourceIds.has(aliasId)) continue;
    report.extra_alias_rows += 1;
    if (report.samples.extra_alias.length < 25) report.samples.extra_alias.push(aliasId);
  }
  for (const contentAliasId of contentAliasIds) {
    if (sourceIds.has(contentAliasId)) continue;
    report.extra_content_alias_rows += 1;
    if (report.samples.extra_content_alias.length < 25) report.samples.extra_content_alias.push(contentAliasId);
  }
  output.end();
  await once(output, "finish");
  if (unmappedOutput) {
    unmappedOutput.end();
    await once(unmappedOutput, "finish");
  }
  process.stdout.write("\n");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    ...report,
    output: outputPath,
    report: reportPath,
    unmapped_output: unmappedOutputPath || null,
  }, null, 2));
  if (report.missing_sanitized_rows || report.extra_sanitized_rows || report.missing_alias_rows
    || report.extra_alias_rows || report.extra_content_alias_rows || report.missing_colleges
    || (!allowUnmapped && report.unmapped_colleges)) {
    throw new Error(
      `Current carousel cutover is incomplete: ${report.missing_sanitized_rows} missing sanitized rows, `
      + `${report.extra_sanitized_rows} extra sanitized rows, ${report.missing_alias_rows} missing alias rows, `
      + `${report.extra_alias_rows} extra alias rows, ${report.extra_content_alias_rows} extra content alias rows, `
      + `${report.missing_colleges} missing colleges, `
      + `and ${report.unmapped_colleges} unmapped colleges`,
    );
  }
} finally {
  if (output && !output.closed) output.destroy();
  if (unmappedOutput && !unmappedOutput.closed) unmappedOutput.destroy();
  await rm(joinDirectory, { recursive: true, force: true });
  await prisma.$disconnect();
}
