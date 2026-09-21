#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const syncRoot = path.resolve(repoRoot, "../upgrad-sync");
const beforePath = path.join(syncRoot, "programs-before.json");
const auditPath = path.join(syncRoot, "upgrad-audit.json");
const uploadsPath = path.join(syncRoot, "cover-upload-mappings-v2.json");
const updatePath = path.join(syncRoot, "programs-live-update.json");
const rollbackPath = path.join(syncRoot, "programs-live-rollback.json");
const summaryPath = path.join(syncRoot, "programs-live-update-summary.json");

const before = JSON.parse(await fs.readFile(beforePath, "utf8"));
const audit = JSON.parse(await fs.readFile(auditPath, "utf8"));
const uploads = JSON.parse(await fs.readFile(uploadsPath, "utf8"));

const auditById = new Map(audit.map((row) => [row.id, row]));
const uploadById = new Map(uploads.map((row) => [row.id, row]));
const omitManagedTimestamps = ({ created_at, updated_at, ...row }) => row;
const counters = { programmes: 0, hero_images: 0, prices: 0, emis: 0, intake_dates: 0, schedules: 0 };
const changes = [];

const updates = before.map((original) => {
  const source = auditById.get(original.id);
  const upload = uploadById.get(original.id);
  if (!source?.ok) throw new Error(`Missing successful source audit for ${original.slug}`);
  if (!upload?.url) throw new Error(`Missing uploaded cover for ${original.slug}`);

  const next = omitManagedTimestamps({ ...original });
  const rowChanges = [];

  if (next.hero_image !== upload.url) {
    rowChanges.push({ field: "hero_image", before: next.hero_image, after: upload.url });
    next.hero_image = upload.url;
    counters.hero_images += 1;
  }
  if (Number(source.source_price) > 0 && Number(next.original_price) !== Number(source.source_price)) {
    rowChanges.push({ field: "original_price", before: next.original_price, after: source.source_price });
    next.original_price = Number(source.source_price);
    next.fee_breakdown = [{ label: "Current listed programme fee", amount: Number(source.source_price) }];
    counters.prices += 1;
  }
  if (Number(source.source_emi) > 0 && Number(next.emi_starts_at) !== Number(source.source_emi)) {
    rowChanges.push({ field: "emi_starts_at", before: next.emi_starts_at, after: source.source_emi });
    next.emi_starts_at = Number(source.source_emi);
    counters.emis += 1;
  }
  if (source.source_start_date && next.batch_start_date !== source.source_start_date) {
    rowChanges.push({ field: "batch_start_date", before: next.batch_start_date, after: source.source_start_date });
    next.batch_start_date = source.source_start_date;
    counters.intake_dates += 1;
  }
  if (source.source_mode && next.schedule !== source.source_mode) {
    rowChanges.push({ field: "schedule", before: next.schedule, after: source.source_mode });
    next.schedule = source.source_mode;
    counters.schedules += 1;
  }

  counters.programmes += 1;
  changes.push({ id: original.id, slug: original.slug, changes: rowChanges });
  return next;
});

const rollback = before.map(omitManagedTimestamps);
await fs.writeFile(updatePath, `${JSON.stringify(updates, null, 2)}\n`);
await fs.writeFile(rollbackPath, `${JSON.stringify(rollback, null, 2)}\n`);
await fs.writeFile(summaryPath, `${JSON.stringify({ counters, changes }, null, 2)}\n`);

console.log(JSON.stringify({ counters, updatePath, rollbackPath, summaryPath }, null, 2));
