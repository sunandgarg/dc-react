#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { Prisma, PrismaClient } from "@prisma/client";
import sharp from "sharp";
import {
  EXAM_FILTER_VERSION,
  classifyExamFilters,
  loadCanonicalExamCatalog,
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
const officialLogoPrefix = "exam-logos-official-v1";

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
    ...classifyExamFilters(source),
  };
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
  const identities = JSON.parse(await readFile(path.join(repositoryRoot, "shared/exam-identities.json"), "utf8"));
  for (const exam of catalog) {
    const identity = identities[exam.slug];
    if (!identity?.short_name || !identity?.full_name) throw new Error(`Missing reviewed exam identity: ${exam.slug}`);
    if (identity.logo && !identity.source_url) throw new Error(`Missing logo provenance: ${exam.slug}`);
  }
  // Fail before any database write when the caller requested complete logo coverage.
  const unresolvedSources = catalog.filter((exam) => !identities[exam.slug].logo).map((exam) => exam.slug);
  if (buildLogos && assertComplete && unresolvedSources.length) {
    throw new Error(`Official logos remain unresolved (${unresolvedSources.length}): ${unresolvedSources.join(", ")}. See reports/exam-official-logo-audit.json; no rows changed.`);
  }
  const retiredLegacySlugs = [...new Set([...deletedSlugs, "ceed-legacy-5c6ea222", "aiims-pg"])];
  if (catalog.length < 400) throw new Error(`Canonical catalog safety gate failed: expected 400+ exams, found ${catalog.length}`);
  const invalidFilters = catalog.flatMap((exam) => {
    const errors = validateExamFilters(classifyExamFilters(exam));
    return errors.length ? [{ slug: exam.slug, errors }] : [];
  });
  if (invalidFilters.length) throw new Error(`Filter classification failed for ${invalidFilters.length} exams`);

  const current = await prisma.exams.findMany();
  const currentBySlug = new Map(current.map((row) => [row.slug, row]));
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
    applied: { inserted: 0, restored: 0, duplicates_deactivated: 0, filters_updated: 0, logos_updated: 0, logos_retained: 0 },
    unresolved_logos: [],
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
        short_name: identities[exam.slug].short_name,
        full_name: identities[exam.slug].full_name,
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
    const uploadedAssets = new Map();
    const rows = await prisma.exams.findMany({ where: { is_active: true, slug: { in: [...canonicalSlugs] } }, orderBy: { name: "asc" } });
    for (const [index, row] of rows.entries()) {
      const identity = identities[row.slug];
      try {
        if (!identity.logo) {
          report.unresolved_logos.push({ slug: row.slug, reason: "official_source_unresolved" });
          if (/\/exam-logos-v[123]\//.test(row.logo || "")) {
            await prisma.exams.update({ where: { id: row.id }, data: { logo: "" } });
          }
          continue;
        }
        let logo = identity.logo;
        if (/^\/exam-logos\/official-v1\/[a-f0-9]{24}\.webp$/.test(logo)) {
          if (!uploadedAssets.has(logo)) {
            const image = await readFile(path.join(repositoryRoot, "public", logo));
            const metadata = await sharp(image).metadata();
            if (metadata.format !== "webp" || !metadata.width || !metadata.height || Math.max(metadata.width, metadata.height) > 700) {
              throw new Error(`Invalid reviewed logo: ${logo}`);
            }
            const uploaded = await uploadStorageObject("admin-uploads", `${officialLogoPrefix}/${path.basename(logo)}`, image, "image/webp", { upsert: true });
            uploadedAssets.set(logo, uploaded.publicUrl);
          }
          logo = uploadedAssets.get(logo);
        } else if (!/^https:\/\/aws-origin\.dekhocampus\.com\/storage\/v1\/object\/public\/legacy-public-assets\//.test(logo)) {
          throw new Error(`Logo is outside the reviewed asset inventory: ${row.slug}`);
        }
        if (row.logo === logo) report.applied.logos_retained += 1;
        else {
          await prisma.exams.update({ where: { id: row.id }, data: { logo } });
          report.applied.logos_updated += 1;
        }
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
  const incompleteLogos = buildLogos ? canonicalFinal.filter((row) => !identities[row.slug]?.logo || !row.logo || /\/exam-logos-v[123]\//.test(row.logo)) : [];
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
