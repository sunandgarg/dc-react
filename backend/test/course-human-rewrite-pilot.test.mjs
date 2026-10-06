import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { auditHumanEditorialHtml } from "../../scripts/content-batch-policy.mjs";

const proposal = JSON.parse(readFileSync(new URL("../../reports/course-human-rewrite-pilot-001-2026-10-06.json", import.meta.url), "utf8"));
const original = JSON.parse(readFileSync(new URL("../../reports/pre-rollback-2026-07-29/courses-current.json", import.meta.url), "utf8"))
  .find((course) => course.slug === "btech-computer-science");

test("course pilot remains a single review-only rewrite of the existing course", () => {
  assert.match(proposal.scope, /not a live database update/i);
  assert.equal(proposal.update.id, original.id);
  assert.equal(proposal.update.slug, original.slug);
  assert.equal(proposal.update.data_source_urls.length, 3);
  assert.ok(proposal.source_notes.every((note) => proposal.update.data_source_urls.includes(note.url)));
});

test("course pilot has human-readable, source-backed copy without invented outcomes", () => {
  const content = Object.entries(proposal.update)
    .filter(([key]) => key.endsWith("_content"))
    .map(([, value]) => value)
    .join("\n");
  assert.deepEqual(auditHumanEditorialHtml(content, {
    evidence: [{ claim: "Data Structures (CSL201)", source_url: proposal.source_notes[0].url }],
  }).issues, []);
  assert.match(content, /href="https:\/\/www\.cse\.iitd\.ac\.in/);
  assert.match(content, /href="https:\/\/josaa\.nic\.in/);
  assert.doesNotMatch(content, /Answer first:|Student profile\s+Target courses|internal slug|Supabase|LLM interpretation/i);
  assert.doesNotMatch(content, /\b(?:₹\s?\d+|\d+(?:\.\d+)?\s?LPA|top\s+\d+[-–]\d+%\s+ranks)\b/i);
  assert.equal(proposal.update.recruiters_content, "");
});
