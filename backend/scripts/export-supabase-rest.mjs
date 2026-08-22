#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = String(process.env.SUPABASE_REST_URL || "").replace(/\/$/, "");
const secret = process.env.SUPABASE_SECRET;
const openApiPath = process.env.SUPABASE_OPENAPI_PATH || "work/supabase-openapi.json";
const outputDir = process.env.SUPABASE_EXPORT_DIR || "work/supabase-data";
const mode = process.argv.includes("--counts-only") ? "counts" : "export";
const concurrency = Math.max(1, Number(process.env.EXPORT_CONCURRENCY || 6));
const pageSize = Math.min(1000, Math.max(1, Number(process.env.EXPORT_PAGE_SIZE || 1000)));

if (!baseUrl || !secret) throw new Error("SUPABASE_REST_URL and SUPABASE_SECRET are required");

const spec = JSON.parse(await readFile(openApiPath, "utf8"));
const tables = Object.keys(spec.paths || {})
  .filter((name) => name.startsWith("/") && !name.startsWith("/rpc/"))
  .map((name) => name.slice(1))
  .filter((name) => spec.definitions?.[name])
  .sort();

const headers = {
  apikey: secret,
  Authorization: `Bearer ${secret}`,
  Prefer: "count=exact",
};

async function countTable(table) {
  const response = await fetch(`${baseUrl}/${encodeURIComponent(table)}?select=*`, {
    headers: { ...headers, Range: "0-0", "Range-Unit": "items" },
  });
  const contentRange = response.headers.get("content-range") || "";
  if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
  const count = Number(contentRange.split("/")[1] || 0);
  return Number.isFinite(count) ? count : 0;
}

async function exportTable(table, expectedCount) {
  const rows = [];
  for (let offset = 0; offset < expectedCount; offset += pageSize) {
    const response = await fetch(`${baseUrl}/${encodeURIComponent(table)}?select=*`, {
      headers: { ...headers, Range: `${offset}-${offset + pageSize - 1}`, "Range-Unit": "items" },
    });
    if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
    rows.push(...await response.json());
  }
  await writeFile(path.join(outputDir, `${table}.json`), `${JSON.stringify(rows)}\n`);
  return rows.length;
}

async function pool(items, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { ok: true, value: await worker(items[index]) };
      } catch (error) {
        results[index] = { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  }));
  return results;
}

await mkdir(outputDir, { recursive: true });
const countResults = await pool(tables, countTable);
const counts = Object.fromEntries(tables.map((table, index) => [table, countResults[index].ok ? countResults[index].value : null]));
const errors = Object.fromEntries(tables.flatMap((table, index) => countResults[index].ok ? [] : [[table, countResults[index].error]]));
await writeFile(path.join(outputDir, "counts.json"), `${JSON.stringify(counts, null, 2)}\n`);

const manifest = { generatedAt: new Date().toISOString(), project: new URL(baseUrl).hostname.split(".")[0], mode, counts, exported: {}, errors };

if (mode === "export") {
  const exportable = tables.filter((table) => Number.isInteger(counts[table]) && counts[table] >= 0);
  const exportResults = await pool(exportable, (table) => exportTable(table, counts[table]));
  exportable.forEach((table, index) => {
    if (exportResults[index].ok) manifest.exported[table] = exportResults[index].value;
    else manifest.errors[table] = exportResults[index].error;
  });
}

await writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
const totalRows = Object.values(counts).filter(Number.isFinite).reduce((sum, count) => sum + count, 0);
console.log(JSON.stringify({ tables: tables.length, totalRows, errors: Object.keys(manifest.errors).length, mode }));
if (Object.keys(manifest.errors).length) process.exitCode = 1;

