import fs from "node:fs";
import path from "node:path";
import { assertBatchVariation, BATCH_CONTENT_VARIATION_POLICY } from "./content-batch-policy.mjs";

const root = process.cwd();
const inputs = [
  ["exam-refresh-batch-041", "reports/exam-refresh-batch-041-2026-09-22.json"],
  ["course-refresh-batch-001", "reports/course-refresh-batch-001-2026-09-22.json"],
];
const lines = [
  "CONTENT VARIATION QUALITY CHECK",
  "Checked: 2026-09-22",
  "",
  "This report confirms batch-level variation before content is sent to production.",
  "The validator rejects missing or duplicated opening hooks, application explanations, preparation advice and FAQ questions.",
  `Forbidden repeated phrases: ${BATCH_CONTENT_VARIATION_POLICY.forbidden_phrases.join(", ")}`,
  "",
];
for (const [label, relative] of inputs) {
  const payload = JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
  const records = payload.updates || [];
  const result = assertBatchVariation(records, label);
  lines.push(`${label}: PASS`);
  lines.push(`records=${result.records}; unique_openings=${result.unique_openings}; unique_applications=${result.unique_applications}; unique_preparations=${result.unique_preparations}; unique_faq_questions=${result.unique_faq_questions}`);
  for (const record of records) {
    const variation = record.content_variation;
    lines.push(`- ${record.slug}`);
    lines.push(`  opening: ${variation.opening}`);
    lines.push(`  application: ${variation.application}`);
    lines.push(`  preparation: ${variation.preparation}`);
    lines.push(`  first_faq: ${variation.faq_questions[0]}`);
    const article = record.article_html || [record.about_content, record.admission_process, record.scope_content].filter(Boolean).join("\n");
    lines.push("  generated_content_html:");
    lines.push(article || "  [no generated content field]");
  }
  lines.push("");
}
lines.push("RESULT: PASS - no duplicate batch phrasing and no Roz thoda slogan detected.", "");
const output = path.join(root, "reports/content-variation-test-2026-09-22.txt");
fs.writeFileSync(output, lines.join("\n"));
console.log(`Wrote ${output}`);
