#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import sharp from "sharp";
import {
  APPROVED_EXAM_THEME_LOGOS,
  EXAM_FILTER_VERSION,
  EXAM_LOGO_THEME_PREFIX,
  classifyExamFilters,
  isThemedExamLogo,
  loadCanonicalExamCatalog,
  renderExamThemeLogo,
  validateExamFilters,
} from "../src/exam-catalog.mjs";
import { uploadStorageObject } from "../src/storage.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const apply = process.argv.includes("--apply");
const buildLogos = process.argv.includes("--logos");
const assertComplete = process.argv.includes("--assert-complete");
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const prisma = new PrismaClient();
const startedAt = new Date();
const runId = startedAt.toISOString().replaceAll(":", "-").replaceAll(".", "-");
const themePrefix = EXAM_LOGO_THEME_PREFIX;

const model = Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === "exams");
if (!model) throw new Error("Prisma exams model metadata is unavailable");
const writableFields = new Map(model.fields.filter((field) => field.kind === "scalar").map((field) => [field.name, field]));

function defaultValue(field) {
  if (field.isRequired === false) return null;
  if (field.type === "String") return "";
  if (field.type === "Boolean") return false;
  if (["Int", "BigInt", "Float", "Decimal"].includes(field.type)) return 0;
  if (field.type === "DateTime") return new Date();
  if (field.type === "Json") return [];
  return undefined;
}

function normalizeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function createPayload(source, shortId) {
  const payload = {};
  for (const [name, field] of writableFields) {
    if (["id", "short_id", "created_at", "updated_at"].includes(name)) continue;
    let value = source[name];
    if (name === "author_id") value = null;
    if (field.type === "DateTime") value = normalizeDate(value);
    if (field.type === "Json" && typeof value === "string") {
      try { value = JSON.parse(value); } catch { value = []; }
    }
    if (value === undefined || (value === null && field.isRequired)) value = defaultValue(field);
    payload[name] = value;
  }
  return {
    ...payload,
    id: randomUUID(),
    short_id: shortId,
    is_active: true,
    ...(APPROVED_EXAM_THEME_LOGOS[source.slug] ? { logo: APPROVED_EXAM_THEME_LOGOS[source.slug] } : {}),
    ...classifyExamFilters(source),
  };
}

async function downloadLogo(url) {
  if (!/^https?:\/\//i.test(String(url || ""))) return { buffer: null, reason: "missing_or_non_http_source" };
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { "user-agent": "DekhoCampus-Exam-Logo-Migration/1.0" } });
    if (!response.ok) return { buffer: null, reason: `source_http_${response.status}` };
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) return { buffer: null, reason: "empty_source" };
    return { buffer, reason: null };
  } catch (error) {
    return { buffer: null, reason: `source_fetch_failed:${error.message}` };
  }
}

async function uploadReport(report) {
  const body = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
  const result = await uploadStorageObject("migration-manifests", `exam-catalog/${runId}/report.json`, body, "application/json", {
    upsert: true,
    cacheControl: "private,no-store",
  });
  return result.key;
}

async function main() {
  const { catalog, deletedSlugs, refreshReports } = await loadCanonicalExamCatalog(repositoryRoot);
  const retiredLegacySlugs = [...new Set([...deletedSlugs, "ceed-legacy-5c6ea222", "aiims-pg"])];
  if (catalog.length < 400) throw new Error(`Canonical catalog safety gate failed: expected 400+ exams, found ${catalog.length}`);
  const invalidFilters = catalog.flatMap((exam) => {
    const errors = validateExamFilters(classifyExamFilters(exam));
    return errors.length ? [{ slug: exam.slug, errors }] : [];
  });
  if (invalidFilters.length) throw new Error(`Filter classification failed for ${invalidFilters.length} exams`);

  const current = await prisma.exams.findMany();
  const currentBySlug = new Map(current.map((row) => [row.slug, row]));
  const canonicalBySlug = new Map(catalog.map((row) => [row.slug, row]));
  const canonicalSlugs = new Set(catalog.map((row) => row.slug));
  const missing = catalog.filter((row) => !currentBySlug.has(row.slug));
  const restore = catalog.filter((row) => currentBySlug.has(row.slug) && currentBySlug.get(row.slug).is_active === false);
  const duplicateRows = current.filter((row) => retiredLegacySlugs.includes(row.slug) && row.is_active);
  const report = {
    ok: false,
    mode: apply ? "apply" : "dry-run",
    started_at: startedAt.toISOString(),
    canonical_count: catalog.length,
    source_refresh_reports: refreshReports.length,
    before: {
      total_rows: current.length,
      active_rows: current.filter((row) => row.is_active).length,
      canonical_present: catalog.length - missing.length,
      canonical_missing: missing.length,
      canonical_inactive: restore.length,
      approved_duplicates_active: duplicateRows.length,
    },
    planned: {
      insert_slugs: missing.map((row) => row.slug),
      restore_slugs: restore.map((row) => row.slug),
      deactivate_duplicate_slugs: duplicateRows.map((row) => row.slug),
      filter_rows: catalog.length,
      logo_rows: buildLogos ? catalog.length : 0,
    },
    applied: { inserted: 0, restored: 0, duplicates_deactivated: 0, filters_updated: 0, logos_generated: 0, logos_retained: 0 },
    logo_fallbacks: [],
    errors: [],
  };

  console.log(JSON.stringify({ phase: "plan", ...report.before, canonical_count: catalog.length }, null, 2));
  if (!apply) {
    report.ok = true;
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const backup = Buffer.from(`${JSON.stringify({ created_at: startedAt.toISOString(), rows: current }, null, 2)}\n`);
  const backupResult = await uploadStorageObject("system-backups", `exam-catalog/${runId}/exams-before.json`, backup, "application/json", {
    upsert: false,
    cacheControl: "private,no-store",
  });
  report.backup_key = backupResult.key;

  let nextShortId = Math.max(0, ...current.map((row) => Number(row.short_id) || 0)) + 1;
  for (const exam of missing) {
    await prisma.exams.create({ data: createPayload(exam, nextShortId++) });
    report.applied.inserted += 1;
    if (report.applied.inserted % 25 === 0) console.log(JSON.stringify({ phase: "insert", completed: report.applied.inserted, total: missing.length }));
  }

  for (const exam of catalog) {
    const filters = classifyExamFilters(exam);
    const result = await prisma.exams.updateMany({
      where: { slug: exam.slug },
      data: {
        ...filters,
        is_active: true,
        ...(APPROVED_EXAM_THEME_LOGOS[exam.slug] ? { logo: APPROVED_EXAM_THEME_LOGOS[exam.slug] } : {}),
      },
    });
    report.applied.filters_updated += result.count;
    if (currentBySlug.get(exam.slug)?.is_active === false) report.applied.restored += result.count;
  }
  if (duplicateRows.length) {
    const result = await prisma.exams.updateMany({ where: { slug: { in: duplicateRows.map((row) => row.slug) } }, data: { is_active: false } });
    report.applied.duplicates_deactivated = result.count;
  }

  if (buildLogos) {
    const rows = await prisma.exams.findMany({ where: { is_active: true, slug: { in: [...canonicalSlugs] } }, orderBy: { name: "asc" } });
    for (const [index, row] of rows.entries()) {
      if (isThemedExamLogo(row.logo)) {
        report.applied.logos_retained += 1;
        continue;
      }
      const source = await downloadLogo(canonicalBySlug.get(row.slug)?.logo);
      if (source.reason) report.logo_fallbacks.push({ slug: row.slug, reason: source.reason });
      try {
        const image = await renderExamThemeLogo(row, source.buffer);
        const metadata = await sharp(image).metadata();
        if (metadata.format !== "webp" || metadata.width !== 1080 || metadata.height !== 950) {
          throw new Error(`unexpected output ${metadata.format} ${metadata.width}x${metadata.height}`);
        }
        const uploaded = await uploadStorageObject("admin-uploads", `${themePrefix}/${row.slug}.webp`, image, "image/webp", { upsert: true });
        await prisma.exams.update({ where: { id: row.id }, data: { logo: uploaded.publicUrl } });
        report.applied.logos_generated += 1;
      } catch (error) {
        report.errors.push({ phase: "logo", slug: row.slug, error: error.message });
      }
      if ((index + 1) % 25 === 0) console.log(JSON.stringify({ phase: "logos", completed: index + 1, total: rows.length, errors: report.errors.length }));
    }
  }

  const finalRows = await prisma.exams.findMany({ where: { is_active: true } });
  const canonicalFinal = finalRows.filter((row) => canonicalSlugs.has(row.slug));
  const incompleteFilters = canonicalFinal.filter((row) => row.exam_filter_version !== EXAM_FILTER_VERSION
    || !row.listing_category
    || !Array.isArray(row.exam_streams) || row.exam_streams.length === 0
    || !Array.isArray(row.course_groups) || row.course_groups.length === 0
    || !Array.isArray(row.education_levels) || row.education_levels.length === 0);
  const incompleteLogos = buildLogos ? canonicalFinal.filter((row) => !isThemedExamLogo(row.logo)) : [];
  report.after = {
    active_rows: finalRows.length,
    canonical_active: canonicalFinal.length,
    missing_canonical: catalog.length - canonicalFinal.length,
    incomplete_filters: incompleteFilters.map((row) => row.slug),
    incomplete_logos: incompleteLogos.map((row) => row.slug),
  };
  report.ok = finalRows.length >= 400
    && canonicalFinal.length === catalog.length
    && incompleteFilters.length === 0
    && (!buildLogos || incompleteLogos.length === 0)
    && report.errors.length === 0;
  report.finished_at = new Date().toISOString();
  report.report_key = await uploadReport(report);
  console.log(JSON.stringify(report, null, 2));
  if (assertComplete && !report.ok) throw new Error(`Exam catalog migration was incomplete; see ${report.report_key}`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
