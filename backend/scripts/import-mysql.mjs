#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const exportDir = process.env.SUPABASE_EXPORT_DIR || "../work/supabase-data";
const metadataPath = process.env.SCHEMA_METADATA_PATH || "prisma/schema-metadata.json";
const batchSize = Math.max(1, Number(process.env.IMPORT_BATCH_SIZE || 25));
const shouldTruncate = process.argv.includes("--truncate");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
const manifest = JSON.parse(await readFile(path.join(exportDir, "manifest.json"), "utf8"));
const prisma = new PrismaClient();
const report = { startedAt: new Date().toISOString(), imported: {}, skipped: {}, errors: {} };

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
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().replace("T", " ").replace("Z", "");
  }
  return value;
}

async function importTable(table, tableMetadata) {
  const rows = JSON.parse(await readFile(path.join(exportDir, `${table}.json`), "utf8"));
  if (tableMetadata.ignored) {
    report.skipped[table] = "view or table without a primary key";
    return;
  }
  if (shouldTruncate) await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quote(table)}`);
  if (!rows.length) {
    report.imported[table] = 0;
    return;
  }

  const columns = Object.keys(tableMetadata.fields).filter((column) => rows.some((row) => Object.hasOwn(row, column)));
  let imported = 0;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const placeholders = batch.map(() => `(${columns.map(() => "?").join(",")})`).join(",");
    const values = batch.flatMap((row) => columns.map((column) => normalizeValue(row[column], tableMetadata.fields[column])));
    const sql = `INSERT INTO ${quote(table)} (${columns.map(quote).join(",")}) VALUES ${placeholders}`;
    await prisma.$executeRawUnsafe(sql, ...values);
    imported += batch.length;
  }
  report.imported[table] = imported;
}

try {
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
  for (const [table, tableMetadata] of Object.entries(metadata)) {
    if (!(table in manifest.exported)) {
      report.skipped[table] = "not present in export manifest";
      continue;
    }
    try {
      await importTable(table, tableMetadata);
    } catch (error) {
      report.errors[table] = error instanceof Error ? error.message : String(error);
    }
  }
} finally {
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1").catch(() => {});
  await prisma.$disconnect();
}

report.finishedAt = new Date().toISOString();
const expected = Object.entries(manifest.exported).filter(([table]) => !metadata[table]?.ignored).reduce((sum, [, count]) => sum + count, 0);
const imported = Object.values(report.imported).reduce((sum, count) => sum + count, 0);
console.log(JSON.stringify({ expected, imported, skipped: Object.keys(report.skipped).length, errors: Object.keys(report.errors).length }));
if (Object.keys(report.errors).length) {
  for (const [table, error] of Object.entries(report.errors)) console.error(`${table}: ${error}`);
  process.exitCode = 1;
}

