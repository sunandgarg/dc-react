import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { buildCarouselCutoverManifestRow } from "../src/original-media-migration.mjs";

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
const outputPath = resolve(String(args.get("--output") || "work/original-college-media/carousel-cutover-manifest.jsonl"));
if (!args.get("--original-manifest")) throw new Error("--original-manifest is required");
if (!args.get("--sanitized-manifest")) throw new Error("--sanitized-manifest is required");

async function readJsonLines(path) {
  const rows = [];
  const lines = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of lines) if (line.trim()) rows.push(JSON.parse(line));
  return rows;
}

const [originalRows, sanitizedRows] = await Promise.all([
  readJsonLines(originalPath),
  readJsonLines(sanitizedPath),
]);
const originalById = new Map(originalRows.map((row) => [String(row?.production?.id || ""), row]));
const outputRows = [];
const missingOriginal = [];
for (const sanitizedRow of sanitizedRows) {
  const id = String(sanitizedRow?.production?.id || "");
  const originalRow = originalById.get(id);
  if (!originalRow) {
    missingOriginal.push(id);
    continue;
  }
  const outputRow = buildCarouselCutoverManifestRow(originalRow, sanitizedRow);
  if (outputRow) outputRows.push(outputRow);
}

if (missingOriginal.length) throw new Error(`${missingOriginal.length} sanitized rows have no original manifest row`);
if (outputRows.length !== sanitizedRows.length) {
  throw new Error(`Only ${outputRows.length}/${sanitizedRows.length} sanitized rows produced carousel cutovers`);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${outputRows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
console.log(JSON.stringify({
  original_rows: originalRows.length,
  sanitized_rows: sanitizedRows.length,
  carousel_rows: outputRows.length,
  expected_webp_references: outputRows.reduce((total, row) => total + row.expected.carousel_images.length, 0),
  replacement_jpeg_references: outputRows.reduce((total, row) => total + row.replacement.carousel_images.length, 0),
  output: outputPath,
}, null, 2));
