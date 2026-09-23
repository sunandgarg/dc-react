#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportsDir = path.join(root, "reports");
const scriptsDir = path.join(root, "scripts");
const args = new Set(process.argv.slice(2));
const writeReports = args.has("--write");
const strictCurrent = args.has("--strict-current");
const auditDate = "2026-09-23";

const batchPattern = /^exam-refresh-batch-(\d{3})-\d{4}-\d{2}-\d{2}\.json$/;
const reportFiles = fs.readdirSync(reportsDir)
  .map((name) => ({ name, match: name.match(batchPattern) }))
  .filter(({ match }) => match)
  .map(({ name, match }) => ({ name, number: Number(match[1]) }))
  .sort((a, b) => a.number - b.number);
const humanRecheckFiles = fs.readdirSync(reportsDir)
  .filter((name) => /^exam-human-editorial-recheck-\d{3}-\d{4}-\d{2}-\d{2}\.json$/.test(name))
  .sort();

const normalise = (value) => String(value || "").toLowerCase().replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const textOf = (record) => [
  record.article_html,
  record.summary_content,
  record.application_process,
  record.exam_pattern,
  record.preparation_tips,
  record.counselling_content,
  record.result_content,
  record.dates_content,
].filter(Boolean).join("\n");
const duplicateMembership = (records, field) => {
  const groups = new Map();
  for (const record of records) {
    const value = normalise(record[field]);
    if (!value) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(record.slug);
  }
  const repeated = [...groups.values()].filter((slugs) => slugs.length > 1);
  return {
    distinct_values: groups.size,
    records_in_duplicate_groups: repeated.reduce((sum, slugs) => sum + slugs.length, 0),
    largest_group: repeated.reduce((largest, slugs) => Math.max(largest, slugs.length), 0),
  };
};

const expected = reportFiles.length ? Array.from({ length: reportFiles.at(-1).number }, (_, index) => index + 1) : [];
const reportNumbers = new Set(reportFiles.map(({ number }) => number));
const missingBatchNumbers = expected.filter((number) => !reportNumbers.has(number));
const missingArtifacts = [];
const allVersions = [];
for (const { name, number } of reportFiles) {
  const stem = name.replace(/\.json$/, "");
  const markdown = path.join(reportsDir, `${stem}.md`);
  const builder = path.join(scriptsDir, `build-exam-refresh-batch-${String(number).padStart(3, "0")}.mjs`);
  if (!fs.existsSync(markdown)) missingArtifacts.push(path.relative(root, markdown));
  if (!fs.existsSync(builder)) missingArtifacts.push(path.relative(root, builder));
  const payload = JSON.parse(fs.readFileSync(path.join(reportsDir, name), "utf8"));
  for (const update of payload.updates || []) allVersions.push({ ...update, _batch: number, _report: name });
}

const versionsBySlug = new Map();
for (const record of allVersions) {
  const slug = String(record.slug || "").trim();
  if (!slug) continue;
  if (!versionsBySlug.has(slug)) versionsBySlug.set(slug, []);
  versionsBySlug.get(slug).push(record);
}
const latestRecords = [...versionsBySlug.values()].map((versions) => versions.sort((a, b) => a._batch - b._batch).at(-1));
const repeatedSlugs = [...versionsBySlug.entries()]
  .filter(([, versions]) => versions.length > 1)
  .map(([slug, versions]) => ({ slug, batches: versions.map(({ _batch }) => _batch) }));

const humanRecheckVersions = humanRecheckFiles.flatMap((name) => {
  const payload = JSON.parse(fs.readFileSync(path.join(reportsDir, name), "utf8"));
  return (payload.updates || []).map((update) => ({ ...update, _report: name }));
});
const allArtifactVersionsBySlug = new Map();
for (const record of [...allVersions, ...humanRecheckVersions]) {
  const slug = String(record.slug || "").trim();
  if (!slug) continue;
  if (!allArtifactVersionsBySlug.has(slug)) allArtifactVersionsBySlug.set(slug, []);
  allArtifactVersionsBySlug.get(slug).push(record._report);
}
const competingArtifactSlugs = [...allArtifactVersionsBySlug.entries()]
  .filter(([, reports]) => reports.length > 1)
  .map(([slug, reports]) => ({ slug, versions: reports.length, reports }));

const dedupPath = path.join(reportsDir, "exam-deduplication-batch-001-2026-09-21.json");
const dedup = fs.existsSync(dedupPath) ? JSON.parse(fs.readFileSync(dedupPath, "utf8")) : null;

const questionGroups = new Map();
for (const record of latestRecords) {
  for (const faq of record.faqs || []) {
    const question = normalise(faq.question);
    if (!question) continue;
    if (!questionGroups.has(question)) questionGroups.set(question, []);
    questionGroups.get(question).push(record.slug);
  }
}
const repeatedQuestionGroups = [...questionGroups.values()].filter((slugs) => slugs.length > 1);
const rowsWithFaqsInBody = latestRecords.filter((record) => {
  const body = normalise(record.article_html);
  return body && (record.faqs || []).some((faq) => body.includes(normalise(faq.question)));
});
const rowsWithForbiddenPhrase = latestRecords.filter((record) => /roz thoda|same as above|use the official portal and current bulletin before payment/i.test(JSON.stringify(record)));
const rowsWithVariation = latestRecords.filter((record) => record.content_variation);
const rowsWithoutArticleHtml = latestRecords.filter((record) => !String(record.article_html || "").trim());
const rowsWithoutFourFaqs = latestRecords.filter((record) => (record.faqs || []).length !== 4);
const rowsWithoutSourcePair = latestRecords.filter((record) => (record.data_source_urls || []).length < 2);
const rowsWithoutInternalLinks = latestRecords.filter((record) => (record.internal_links || []).length < 3);
const rowsWithMarkdown = latestRecords.filter((record) => /```|(?:^|\n)\s*#{1,6}\s|\|\s*:?-{3,}:?\s*\|/m.test(textOf(record)));

const snapshotPath = path.join(reportsDir, "pre-rollback-2026-07-29", "exams-current.json");
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
const activeSnapshotRows = snapshot.filter((row) => row.is_active !== false);
const coveredSlugs = new Set(latestRecords.map(({ slug }) => slug));
const uncoveredActiveSnapshotSlugs = activeSnapshotRows.map(({ slug }) => slug).filter((slug) => !coveredSlugs.has(slug)).sort();

const currentPolicyRecords = latestRecords.filter((record) => record._batch >= 41);
const currentPolicyFailures = currentPolicyRecords.flatMap((record) => {
  const errors = [];
  if (!record.content_variation) errors.push("missing content_variation");
  if (/roz thoda|same as above|use the official portal and current bulletin before payment/i.test(JSON.stringify(record))) errors.push("forbidden phrase");
  if (!String(record.article_html || "").startsWith("<p>")) errors.push("article does not start with a paragraph");
  if ((record.faqs || []).length !== 4) errors.push("FAQ count is not four");
  if ((record.faqs || []).some((faq) => normalise(record.article_html).includes(normalise(faq.question)))) errors.push("FAQ duplicated in article body");
  if ((record.internal_links || []).length < 3) errors.push("fewer than three internal links");
  if ((record.data_source_urls || []).length < 2) errors.push("fewer than two official sources");
  if (String(record.meta_title || "").length > 60) errors.push("meta title exceeds 60 characters");
  if (String(record.meta_description || "").length > 155) errors.push("meta description exceeds 155 characters");
  if (/```|(?:^|\n)\s*#{1,6}\s|\|\s*:?-{3,}:?\s*\|/m.test(textOf(record))) errors.push("raw Markdown detected");
  return errors.length ? [{ slug: record.slug, batch: record._batch, errors }] : [];
});

const applicationReuse = duplicateMembership(latestRecords, "application_process");
const preparationReuse = duplicateMembership(latestRecords, "preparation_tips");
const audit = {
  audit_date: auditDate,
  status: "not_production_ready",
  canonical_strategy: "docs/exam-content-strategy-2026.md",
  inventory: {
    batch_builders_expected: reportFiles.length,
    json_reports: reportFiles.length,
    markdown_reports_expected: reportFiles.length,
    missing_batch_numbers: missingBatchNumbers,
    missing_artifacts: missingArtifacts,
    update_versions: allVersions.length,
    human_editorial_recheck_files: humanRecheckFiles.length,
    human_editorial_recheck_versions: humanRecheckVersions.length,
    total_artifact_versions: allVersions.length + humanRecheckVersions.length,
    unique_exam_slugs: latestRecords.length,
    repeated_exam_slugs: repeatedSlugs.length,
    repeated_slug_details: repeatedSlugs,
    slugs_with_competing_batch_or_recheck_versions: competingArtifactSlugs.length,
    competing_artifact_details: competingArtifactSlugs,
    deduplication_plan: dedup ? {
      canonical_groups: (dedup.canonical_rows || []).length,
      proposed_soft_deletes: (dedup.deletions || []).length,
      production_write_performed: false,
    } : null,
  },
  snapshot_coverage: {
    snapshot: path.relative(root, snapshotPath),
    snapshot_rows: snapshot.length,
    active_snapshot_rows: activeSnapshotRows.length,
    covered_unique_slugs: latestRecords.length,
    uncovered_active_rows: uncoveredActiveSnapshotSlugs.length,
    uncovered_active_slugs: uncoveredActiveSnapshotSlugs,
    warning: "The snapshot is not the production database. Current live rows must be resolved again before any write.",
  },
  policy_coverage: {
    rows_with_final_content_variation: rowsWithVariation.length,
    rows_with_forbidden_repeated_phrase: rowsWithForbiddenPhrase.length,
    rows_without_article_html: rowsWithoutArticleHtml.length,
    rows_without_four_faqs: rowsWithoutFourFaqs.length,
    rows_with_faqs_repeated_in_body: rowsWithFaqsInBody.length,
    rows_without_two_sources: rowsWithoutSourcePair.length,
    rows_without_three_internal_links: rowsWithoutInternalLinks.length,
    rows_with_raw_markdown: rowsWithMarkdown.length,
    application_reuse: applicationReuse,
    preparation_reuse: preparationReuse,
    faq_questions_total: [...questionGroups.values()].reduce((sum, slugs) => sum + slugs.length, 0),
    faq_questions_distinct: questionGroups.size,
    faq_instances_in_duplicate_groups: repeatedQuestionGroups.reduce((sum, slugs) => sum + slugs.length, 0),
    current_policy_rows: currentPolicyRecords.length,
    current_policy_failures: currentPolicyFailures,
  },
  deployment: {
    production_database_write_exists: false,
    batch_reports_are_imported_by_deployment: false,
    blockers: [
      "No checked-in production importer consumes the exam refresh reports.",
      "Competing versions have no approved precedence manifest.",
      "Most rows do not meet the final uniqueness and separate-FAQ policy.",
      "Artifact-only fields do not map directly to the exams database schema.",
      "The production row set differs from the old snapshot and requires a live preflight.",
    ],
  },
};

const markdown = [
  "# Exam refresh repository audit",
  "",
  `Audit date: ${auditDate}`,
  "",
  "Status: **NOT PRODUCTION READY**",
  "",
  "## What is safely in Git",
  "",
  `- ${audit.inventory.batch_builders_expected} contiguous batch builders and ${audit.inventory.json_reports} JSON plus ${audit.inventory.markdown_reports_expected} Markdown report slots were found.`,
  `- The reports contain ${audit.inventory.update_versions} update versions for ${audit.inventory.unique_exam_slugs} unique slugs.`,
  `- Two human editorial rechecks add ${audit.inventory.human_editorial_recheck_versions} more versions, for ${audit.inventory.total_artifact_versions} total artifact versions.`,
  `- ${audit.inventory.repeated_exam_slugs} slugs repeat across numbered batches; ${audit.inventory.slugs_with_competing_batch_or_recheck_versions} have competing batch or recheck versions.`,
  `- The deduplication plan proposes ${audit.inventory.deduplication_plan?.proposed_soft_deletes || 0} soft deletes across ${audit.inventory.deduplication_plan?.canonical_groups || 0} canonical groups, but it was not applied.`,
  "- The report files are review artifacts. No deployment step imports them into MySQL.",
  "",
  "## Coverage gap",
  "",
  `- Old snapshot rows: ${audit.snapshot_coverage.snapshot_rows}; active in that snapshot: ${audit.snapshot_coverage.active_snapshot_rows}.`,
  `- Unique refreshed slugs: ${audit.snapshot_coverage.covered_unique_slugs}.`,
  `- Active snapshot slugs not covered: ${audit.snapshot_coverage.uncovered_active_rows}.`,
  "- The live production count differs from this snapshot, so IDs and slugs must be resolved again before a write.",
  "",
  "## Final-policy gap",
  "",
  `- Rows with final content-variation metadata: ${audit.policy_coverage.rows_with_final_content_variation}.`,
  `- Rows containing a forbidden repeated phrase: ${audit.policy_coverage.rows_with_forbidden_repeated_phrase}.`,
  `- Rows that repeat FAQ questions inside body HTML: ${audit.policy_coverage.rows_with_faqs_repeated_in_body}.`,
  `- Application copy in duplicate groups: ${audit.policy_coverage.application_reuse.records_in_duplicate_groups}; largest exact group: ${audit.policy_coverage.application_reuse.largest_group}.`,
  `- Preparation copy in duplicate groups: ${audit.policy_coverage.preparation_reuse.records_in_duplicate_groups}; largest exact group: ${audit.policy_coverage.preparation_reuse.largest_group}.`,
  `- Distinct FAQ questions: ${audit.policy_coverage.faq_questions_distinct} of ${audit.policy_coverage.faq_questions_total}.`,
  "",
  "## Required cutover order",
  "",
  "1. Regenerate or individually review the active canonical production exams under the current strategy.",
  "2. Resolve every duplicate and competing artifact version.",
  "3. Preflight the approved manifest against current live slugs and status.",
  "4. Back up exam and FAQ rows, apply in a transaction, and keep a rollback manifest.",
  "5. Verify public pages, FAQs, API and sitemap after the database write.",
  "",
  "Canonical policy: `docs/exam-content-strategy-2026.md`.",
  "",
].join("\n");

if (writeReports) {
  fs.writeFileSync(path.join(reportsDir, `exam-refresh-repository-audit-${auditDate}.json`), `${JSON.stringify(audit, null, 2)}\n`);
  fs.writeFileSync(path.join(reportsDir, `exam-refresh-repository-audit-${auditDate}.md`), markdown);
}

console.log(JSON.stringify({
  status: audit.status,
  batches: reportFiles.length,
  update_versions: allVersions.length,
  total_artifact_versions: allVersions.length + humanRecheckVersions.length,
  unique_exam_slugs: latestRecords.length,
  repeated_exam_slugs: repeatedSlugs.length,
  uncovered_active_snapshot_rows: uncoveredActiveSnapshotSlugs.length,
  rows_with_final_content_variation: rowsWithVariation.length,
  rows_with_forbidden_repeated_phrase: rowsWithForbiddenPhrase.length,
  current_policy_failures: currentPolicyFailures.length,
  wrote_reports: writeReports,
}, null, 2));

if (missingBatchNumbers.length || missingArtifacts.length) process.exitCode = 1;
if (strictCurrent && currentPolicyFailures.length) process.exitCode = 1;
