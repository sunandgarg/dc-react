#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import "../src/database-url.mjs";

const sourceUrl = String(process.env.SUPABASE_STORAGE_URL || "").replace(/\/$/, "");
const sourceSecret = String(process.env.SUPABASE_STORAGE_SERVICE_KEY || "");
const metadataPath = process.env.SCHEMA_METADATA_PATH || "prisma/schema-metadata.json";
const pageSize = Math.min(1000, Math.max(1, Number(process.env.IMPORT_PAGE_SIZE || 500)));
const batchSize = Math.min(100, Math.max(1, Number(process.env.IMPORT_BATCH_SIZE || 50)));
const shouldTruncate = !process.argv.includes("--append");

if (!sourceUrl || !sourceSecret) throw new Error("SUPABASE_STORAGE_URL and SUPABASE_STORAGE_SERVICE_KEY are required");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
const prisma = new PrismaClient();
const headers = {
  apikey: sourceSecret,
  authorization: `Bearer ${sourceSecret}`,
  prefer: "count=exact",
};
const report = { startedAt: new Date().toISOString(), source: "supabase", imported: {}, sourceCounts: {}, errors: {} };

// Supabase contains two historical exam rows with the `ceed` slug. MySQL
// correctly enforces the application's unique slug contract, so retain the
// canonical public route and preserve the conflicting row under an ID-based
// legacy route instead of dropping source data.
const duplicateExamSlugs = new Map();

const quote = (identifier) => `\`${String(identifier).replaceAll("`", "``")}\``;

function normalizeValue(value, field) {
  if (value === null || value === undefined) return null;
  if (field.type === "Json") return JSON.stringify(value);
  if (field.type === "Boolean") return value ? 1 : 0;
  if (field.type === "BigInt") return String(value);
  if (field.type === "DateTime") {
    if (field.format === "date") return String(value).slice(0, 10);
    if (String(field.format || "").startsWith("time") && !String(field.format || "").startsWith("timestamp")) {
      return String(value).replace(/Z$/, "").slice(0, 12);
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().replace("T", " ").replace("Z", "");
  }
  return value;
}

function sanitizeRow(table, row) {
  let sanitized = row;
  if (table === "otp_providers") sanitized = { ...sanitized, api_key: "", api_secret: "" };
  if (table === "exams" && sanitized.slug) {
    // MySQL's default production collation is case-insensitive while the
    // Supabase source can contain case/whitespace variants of the same slug.
    const slugKey = String(sanitized.slug).trim().toLowerCase();
    const existingId = duplicateExamSlugs.get(slugKey);
    if (existingId && existingId !== sanitized.id) {
      sanitized = { ...sanitized, slug: `${slugKey}-legacy-${sanitized.id.slice(0, 8)}` };
    } else if (!existingId) {
      duplicateExamSlugs.set(slugKey, sanitized.id);
    }
  }
  return sanitized;
}

async function fetchPage(table, offset) {
  const response = await fetch(`${sourceUrl}/rest/v1/${encodeURIComponent(table)}?select=*`, {
    headers: { ...headers, Range: `${offset}-${offset + pageSize - 1}`, "Range-Unit": "items" },
  });
  if (!response.ok) throw new Error(`${table}: Supabase returned ${response.status}`);
  return {
    rows: await response.json(),
    count: Number((response.headers.get("content-range") || "").split("/")[1] || 0),
  };
}

async function insertBatch(table, tableMetadata, rows) {
  if (!rows.length) return;
  const columns = Object.keys(tableMetadata.fields).filter((column) => rows.some((row) => Object.hasOwn(row, column)));
  const placeholders = rows.map(() => `(${columns.map(() => "?").join(",")})`).join(",");
  const values = rows.flatMap((row) => {
    const sanitized = sanitizeRow(table, row);
    return columns.map((column) => normalizeValue(sanitized[column], tableMetadata.fields[column]));
  });
  await prisma.$executeRawUnsafe(
    `INSERT INTO ${quote(table)} (${columns.map(quote).join(",")}) VALUES ${placeholders}`,
    ...values,
  );
}

async function importTable(table, tableMetadata) {
  if (tableMetadata.ignored) return;
  if (shouldTruncate) await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quote(table)}`);
  let expected = null;
  let imported = 0;
  for (let offset = 0; ; offset += pageSize) {
    const { rows, count } = await fetchPage(table, offset);
    if (expected === null) expected = count;
    for (let cursor = 0; cursor < rows.length; cursor += batchSize) {
      const batch = rows.slice(cursor, cursor + batchSize);
      await insertBatch(table, tableMetadata, batch);
      imported += batch.length;
    }
    if (rows.length < pageSize) break;
  }
  report.sourceCounts[table] = expected || 0;
  report.imported[table] = imported;
}

try {
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
  for (const [table, tableMetadata] of Object.entries(metadata)) {
    try {
      await importTable(table, tableMetadata);
    } catch (error) {
      report.errors[table] = error instanceof Error ? error.message : String(error);
      break;
    }
  }
} finally {
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1").catch(() => {});
  await prisma.$disconnect();
}

report.finishedAt = new Date().toISOString();
const expected = Object.values(report.sourceCounts).reduce((sum, count) => sum + count, 0);
const imported = Object.values(report.imported).reduce((sum, count) => sum + count, 0);
console.log(JSON.stringify({ expected, imported, tables: Object.keys(report.imported).length, errors: Object.keys(report.errors).length }));
if (Object.keys(report.errors).length) {
  for (const [table, error] of Object.entries(report.errors)) console.error(`${table}: ${error}`);
  process.exitCode = 1;
}
