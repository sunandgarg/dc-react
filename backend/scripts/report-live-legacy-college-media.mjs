import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";

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

const apiBaseUrl = String(args.get("--api-base-url") || "https://aws-origin.dekhocampus.com").replace(/\/$/, "");
const siteBaseUrl = String(args.get("--site-base-url") || "https://dekhocampus.com").replace(/\/$/, "");
const outputDir = resolve(String(args.get("--output-dir") || "work/live-legacy-college-media"));
const unresolvedJsonl = args.get("--unresolved-jsonl") ? resolve(String(args.get("--unresolved-jsonl"))) : "";
await mkdir(outputDir, { recursive: true });

const mediaFields = [
  "image",
  "logo",
  "banner_ad_image",
  "square_ad_image",
  "approval_logos",
  "carousel_images",
  "gallery_images",
];

function values(value) {
  if (Array.isArray(value)) return value.flatMap(values);
  if (value && typeof value === "object") return Object.values(value).flatMap(values);
  const text = String(value || "").trim();
  return text ? [text] : [];
}

function isVideo(value) {
  return /(?:youtube\.com|youtu\.be|vimeo\.com)|\.(?:mp4|webm|mov)(?:$|\?)/i.test(value);
}

function host(value) {
  try { return new URL(value).hostname.toLowerCase(); } catch { return ""; }
}

function publicUrl(row) {
  const suffix = row.short_id ? `-${row.short_id}` : "";
  return `${siteBaseUrl}/colleges/${row.slug}${suffix}`;
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function fetchColleges() {
  const rows = [];
  const pageSize = 1000;
  const select = ["id", "short_id", "slug", "name", "short_name", "city", "state", ...mediaFields].join(",");
  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({ select, limit: String(pageSize), offset: String(offset), order: "id.asc" });
    let page;
    let lastError;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        const response = await fetch(`${apiBaseUrl}/v1/rest/colleges?${query}`, {
          headers: { accept: "application/json", "user-agent": "DekhoCampus-live-legacy-media-report/1.0" },
          signal: AbortSignal.timeout(60_000),
        });
        if (!response.ok) throw new Error(`College fetch failed (${response.status})`);
        page = await response.json();
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 5) await delay(attempt * 1_500);
      }
    }
    if (!Array.isArray(page)) throw lastError || new Error(`College fetch failed at offset ${offset}`);
    rows.push(...page);
    process.stdout.write(`\rFetched ${rows.length} live colleges`);
    if (page.length < pageSize) break;
  }
  process.stdout.write("\n");
  return rows;
}

async function readJsonLines(path) {
  const rows = [];
  const lines = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of lines) if (line.trim()) rows.push(JSON.parse(line));
  return rows;
}

const colleges = await fetchColleges();
const legacy = [];
const summary = {
  generated_at: new Date().toISOString(),
  live_colleges: colleges.length,
  legacy_colleges: 0,
  v1_webp_colleges: 0,
  direct_external_colleges: 0,
  direct_collegedunia_colleges: 0,
  original_object_colleges: 0,
  v1_webp_references: 0,
  direct_external_references: 0,
  direct_collegedunia_references: 0,
  original_object_references: 0,
};

for (const college of colleges) {
  const refs = mediaFields.flatMap((field) => values(college[field]).map((value) => ({ field, value }))).filter(({ value }) => !isVideo(value));
  const v1 = refs.filter(({ value }) => /legacy-public-assets\/sanitized\/bottom-12-v1\/.*\.webp(?:$|\?)/i.test(value));
  const original = refs.filter(({ value }) => value.includes("/legacy-public-assets/original/") || value.startsWith("legacy-public-assets/original/"));
  const external = refs.filter(({ value }) => {
    const valueHost = host(value);
    return valueHost && valueHost !== "aws-origin.dekhocampus.com" && valueHost !== "dekhocampus.com" && valueHost !== "www.dekhocampus.com";
  });
  const collegedunia = refs.filter(({ value }) => host(value).endsWith("collegedunia.com"));
  if (!v1.length && !original.length && !external.length) continue;

  summary.legacy_colleges += 1;
  if (v1.length) summary.v1_webp_colleges += 1;
  if (external.length) summary.direct_external_colleges += 1;
  if (collegedunia.length) summary.direct_collegedunia_colleges += 1;
  if (original.length) summary.original_object_colleges += 1;
  summary.v1_webp_references += v1.length;
  summary.direct_external_references += external.length;
  summary.direct_collegedunia_references += collegedunia.length;
  summary.original_object_references += original.length;
  legacy.push({
    id: college.id,
    short_id: college.short_id,
    name: college.name,
    short_name: college.short_name,
    slug: college.slug,
    city: college.city,
    state: college.state,
    public_url: publicUrl(college),
    v1_webp_references: v1.length,
    direct_external_references: external.length,
    direct_collegedunia_references: collegedunia.length,
    original_object_references: original.length,
    affected_fields: [...new Set([...v1, ...original, ...external].map(({ field }) => field))],
  });
}

const jsonPath = join(outputDir, "live-legacy-college-media.json");
const csvPath = join(outputDir, "live-legacy-colleges.csv");
await writeFile(jsonPath, `${JSON.stringify({ summary, colleges: legacy }, null, 2)}\n`, "utf8");
const columns = [
  "name", "short_name", "slug", "short_id", "city", "state", "public_url",
  "v1_webp_references", "direct_external_references", "direct_collegedunia_references",
  "original_object_references", "affected_fields",
];
const csv = [columns.join(","), ...legacy.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n");
await writeFile(csvPath, `${csv}\n`, "utf8");

let unresolvedCsvPath = null;
let unresolvedCount = 0;
if (unresolvedJsonl) {
  const unresolvedRows = await readJsonLines(unresolvedJsonl);
  const liveById = new Map(colleges.map((college) => [String(college.id), college]));
  const legacyById = new Map(legacy.map((college) => [String(college.id), college]));
  const unresolved = unresolvedRows.map((row) => {
    const production = row.production || {};
    const live = liveById.get(String(production.id)) || production;
    const currentLegacy = legacyById.get(String(production.id));
    return {
      name: live.name || production.name,
      short_name: live.short_name || "",
      slug: live.slug || production.slug,
      short_id: live.short_id || "",
      city: live.city || production.city || "",
      state: live.state || production.state || "",
      public_url: publicUrl(live),
      cutover_status: "not-updated-unresolved-source-media",
      unmapped_references: Array.isArray(row.unmapped) ? row.unmapped.length : 0,
      current_carousel_references: Array.isArray(row.current?.carousel_images) ? row.current.carousel_images.length : 0,
      live_v1_webp_references: currentLegacy?.v1_webp_references || 0,
      live_external_references: currentLegacy?.direct_external_references || 0,
      affected_fields: currentLegacy?.affected_fields || [],
    };
  });
  unresolvedCount = unresolved.length;
  unresolvedCsvPath = join(outputDir, "colleges-not-updated-by-jpeg-cutover.csv");
  const unresolvedColumns = [
    "name", "short_name", "slug", "short_id", "city", "state", "public_url", "cutover_status",
    "unmapped_references", "current_carousel_references", "live_v1_webp_references",
    "live_external_references", "affected_fields",
  ];
  const unresolvedCsv = [
    unresolvedColumns.join(","),
    ...unresolved.map((row) => unresolvedColumns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n");
  await writeFile(unresolvedCsvPath, `${unresolvedCsv}\n`, "utf8");
}

console.log(JSON.stringify({
  ...summary,
  unresolved_cutover_colleges: unresolvedCount,
  json: jsonPath,
  legacy_csv: csvPath,
  unresolved_csv: unresolvedCsvPath,
}, null, 2));
