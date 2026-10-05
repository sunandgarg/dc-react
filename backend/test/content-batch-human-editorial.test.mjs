import test from "node:test";
import assert from "node:assert/strict";
import { auditHumanEditorialHtml, assertBatchHumanEditorial } from "../../scripts/content-batch-policy.mjs";
import { readFileSync } from "node:fs";

const article = (slug, heading) => ({
  slug,
  conducting_authority: "West Bengal Joint Entrance Examinations Board",
  data_source_urls: ["https://wbjeeb.nic.in/jelet/"],
  evidence_examples: [{ claim: "JELET is the lateral-entry route", source_url: "https://wbjeeb.nic.in/jelet/" }],
  article_html: `<p>JELET is the lateral-entry route for eligible diploma students. The West Bengal Joint Entrance Examinations Board runs it.</p><h2>${heading}</h2><p>Match the qualifying diploma to the chosen branch before choice filling.</p>`,
});

test("allows a natural exam explanation without a compulsory table", () => {
  assert.deepEqual(auditHumanEditorialHtml(article("jelet", "Which branch fits?").article_html, {
    authority: "West Bengal Joint Entrance Examinations Board",
    evidence: article("jelet", "Which branch fits?").evidence_examples,
  }).issues, []);
});

test("rejects prompt labels, flattened tables and repeated generic warnings", () => {
  const result = auditHumanEditorialHtml(`<p>Answer first: read the notice.</p><h2>Answer first</h2><p>Student profile Target courses Risk to check Safer approach</p><p>Check the official notice.</p><p>Verify the official portal.</p><p>Read the official notification.</p>`);
  assert.ok(result.issues.some((issue) => issue.includes("prompt residue")));
  assert.ok(result.issues.some((issue) => issue.includes("flattened")));
  assert.ok(result.issues.some((issue) => issue.includes("repeated")));
});

test("a real table does not excuse flattened copy elsewhere", () => {
  const html = `<table><thead><tr><th>Route</th></tr></thead><tbody><tr><td>Diploma</td></tr></tbody></table><p>Student profile Target courses Risk to check Safer approach</p>`;
  assert.ok(auditHumanEditorialHtml(html).issues.some((issue) => issue.includes("flattened")));
});

test("next exam batches require source-backed specifics and varied outlines", () => {
  const rows = [article("jelet", "Which branch fits?"), article("jeca", "How does the degree rule work?"), article("jemscn", "What happens after the rank?")];
  assert.deepEqual(assertBatchHumanEditorial(rows, "batch-042"), { records: 3, unique_outlines: 3, sourced_examples: 3 });
  assert.throws(() => assertBatchHumanEditorial([...rows, article("jepbn", "Which branch fits?"), article("ipmat", "Which branch fits?")], "batch-042"), /more than two records reuse/);
  const repeatedParagraph = [article("jelet", "One route"), article("jeca", "Another route"), article("jemscn", "A third route"), article("jepbn", "A fourth route")];
  assert.throws(() => assertBatchHumanEditorial(repeatedParagraph, "batch-042"), /same article paragraph/);
  assert.throws(() => assertBatchHumanEditorial([{ ...rows[0], evidence_examples: [{ claim: "Invented cutoff 95%", source_url: "https:\/\/example.com" }] }], "batch-042"), /matching stored source URL/);
});

test("prepared batch 042 stays review-only and passes the human editorial gate", () => {
  const payload = JSON.parse(readFileSync(new URL("../../reports/exam-refresh-batch-042-2026-10-06.json", import.meta.url), "utf8"));
  assert.equal(payload.updates.length, 10);
  assert.match(payload.scope, /review artifact, not a live database update/);
  assert.equal(assertBatchHumanEditorial(payload.updates, payload.batch).sourced_examples, 10);
  assert.ok(payload.updates.every((row) => row.exam_date === "Not announced" && row.data_source_urls.length >= 2));
});
