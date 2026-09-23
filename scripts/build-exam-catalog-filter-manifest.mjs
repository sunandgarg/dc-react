#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  APPROVED_EXAM_THEME_LOGOS,
  classifyExamFilters,
  isThemedExamLogo,
  loadCanonicalExamCatalog,
} from "../backend/src/exam-catalog.mjs";

const root = process.cwd();
const outputJson = path.join(root, "reports/exam-catalog-filter-logo-manifest-2026-09-23.json");
const outputCsv = path.join(root, "reports/exam-catalog-filter-logo-manifest-2026-09-23.csv");
const livePath = process.env.LIVE_EXAMS_JSON || "";
const live = livePath ? JSON.parse(await readFile(livePath, "utf8")) : [];
const liveBySlug = new Map(live.map((row) => [row.slug, row]));
const { catalog, deletedSlugs, refreshReports } = await loadCanonicalExamCatalog(root);
const canonicalSlugs = new Set(catalog.map((row) => row.slug));

const records = catalog.map((exam) => {
  const liveRow = liveBySlug.get(exam.slug);
  const chosenLogo = APPROVED_EXAM_THEME_LOGOS[exam.slug] || liveRow?.logo || exam.logo || "";
  return {
    slug: exam.slug,
    name: exam.name,
    production_state: liveRow ? (liveRow.is_active === false ? "inactive" : "active") : "missing",
    ...classifyExamFilters(exam),
    current_logo: chosenLogo,
    logo_action: isThemedExamLogo(chosenLogo) ? "retain_approved_theme" : "generate_1080x950_webp",
  };
});

const extraProductionSlugs = live.filter((row) => !canonicalSlugs.has(row.slug)).map((row) => row.slug);
const summary = {
  generated_at: new Date().toISOString(),
  canonical_count: records.length,
  production_snapshot_count: live.length || null,
  production_missing_count: live.length ? records.filter((row) => row.production_state === "missing").length : null,
  production_extra_count: live.length ? extraProductionSlugs.length : null,
  approved_duplicate_slugs: deletedSlugs,
  extra_production_slugs: extraProductionSlugs,
  refresh_reports_applied: refreshReports.length,
  logo_retain_count: records.filter((row) => row.logo_action === "retain_approved_theme").length,
  logo_generate_count: records.filter((row) => row.logo_action === "generate_1080x950_webp").length,
  filter_rows_with_empty_values: records.filter((row) => !row.listing_category || !row.exam_streams.length || !row.course_groups.length || !row.education_levels.length).length,
};

await writeFile(outputJson, `${JSON.stringify({ summary, records }, null, 2)}\n`);
const columns = ["slug", "name", "production_state", "listing_category", "exam_streams", "course_groups", "education_levels", "exam_filter_version", "logo_action", "current_logo"];
const csv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
await writeFile(outputCsv, [columns.join(","), ...records.map((row) => columns.map((column) => csv(Array.isArray(row[column]) ? row[column].join(" | ") : row[column])).join(","))].join("\n") + "\n");
console.log(JSON.stringify(summary, null, 2));
