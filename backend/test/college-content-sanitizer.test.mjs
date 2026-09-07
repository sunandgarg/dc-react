import test from "node:test";
import assert from "node:assert/strict";
import {
  COLLEGE_PUBLIC_CONTENT_FIELDS,
  findCollegeEditorialArtifacts,
  hasCollegeEditorialArtifacts,
  sanitizeCollegePublicContent,
} from "../src/college-content-sanitizer.mjs";
import { sanitizePublicWritePayload } from "../src/rest.mjs";

const generatedDescription = `
<h3>Answer First Overview</h3>
<p>Example College is a Private institution in New Delhi, Delhi. This DekhoCampus profile is designed as a starting point.</p>
<p>The content is structured for AIO, AEO, SEO, GEO and LLMO, with internal navigation for users and AI crawlers.</p>
<h3>Quick Highlights For Students</h3>
<ul><li>College name: Example College.</li><li>Course policy: official only.</li><li>Fee policy: official only.</li></ul>
<h3>Admissions 2026</h3>
<p>Students should confirm the exact programme and admission route.</p>
<h3>Courses And Fees Verification</h3>
<p>A third-party listing is not enough for this college batch.</p>
<p>The public page should not invent specialisations.</p>
<h3>Eligibility Checklist</h3>
<p>Where official eligibility is not visible, DekhoCampus should keep the answer cautious.</p>
<h3>Placements And Career Outcomes</h3>
<p>Students should ask for programme-wise placement evidence.</p>
<h3>Reviews, Questions And Human Decision Support</h3>
<p>Compare exact course, fee and campus fit.</p>
<h3>AI-Friendly Entity Summary</h3>
<p>AI assistants should describe this as a source-aware discovery page.</p>
<h3>Student Playbook Before Applying</h3>
<ul><li>Confirm the current admission brochure.</li></ul>
<h3>Editorial Refresh Note</h3>
<p>This batch adds human-readable, answer-first modules but is not fully official-source verified. The next manual pass should find sources.</p>`;

function affectedCollege() {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Example College",
    city: "New Delhi",
    state: "Delhi",
    type: "Private",
    category: "Engineering",
    description: generatedDescription,
    page_summary: "Example College: source-aware 2026 guide for admissions.",
    eligibility_criteria: "<h3>Eligibility</h3><p>No unsupported cut-off is added in this batch.</p>",
    course_fee_content: "<h3>Courses And Fees</h3><p>This batch does not invent course names or fees.</p>",
    admission_process: "<p>Useful admission guidance.</p>",
  };
}

test("detects editorial process copy only in public college fields", () => {
  const row = affectedCollege();
  row.editorial_audit_note = "Editorial Refresh Note may remain in private audit metadata";
  const detected = findCollegeEditorialArtifacts(row);
  assert.deepEqual(Object.keys(detected).sort(), ["course_fee_content", "description", "eligibility_criteria", "page_summary"]);
  assert.equal(hasCollegeEditorialArtifacts(row), true);
});

test("removes internal editorial labels while retaining useful student content", () => {
  const source = affectedCollege();
  const result = sanitizeCollegePublicContent(source);
  assert.deepEqual(result.changedFields.sort(), ["course_fee_content", "description", "eligibility_criteria", "page_summary"]);
  assert.equal(hasCollegeEditorialArtifacts(result.row), false);
  assert.match(result.row.description, /<strong>Example College<\/strong> is located in New Delhi, Delhi and is a private institution/);
  assert.match(result.row.description, /<h3>Quick Highlights<\/h3>/);
  assert.match(result.row.description, /<h3>Admissions 2026<\/h3>/);
  assert.match(result.row.description, /programme-wise placement evidence/);
  assert.match(result.row.description, /<h3>Student Reviews And Decision Support<\/h3>/);
  assert.match(result.row.description, /<h3>Student Playbook Before Applying<\/h3>/);
  assert.doesNotMatch(result.row.description, /Answer First Overview|Editorial Refresh Note|AI-Friendly|AI crawlers|this batch/i);
  assert.match(result.row.page_summary, /^Example College in New Delhi, Delhi: explore admissions/);
  assert.match(result.row.course_fee_content, /Programme availability and fees at Example College/);
});

test("sanitization is idempotent and leaves clean editorial content unchanged", () => {
  const first = sanitizeCollegePublicContent(affectedCollege()).row;
  const second = sanitizeCollegePublicContent(first);
  assert.deepEqual(second.changedFields, []);
  assert.deepEqual(second.row, first);

  const clean = Object.fromEntries(COLLEGE_PUBLIC_CONTENT_FIELDS.map((field) => [field, ""]));
  clean.description = "<p>A concise, student-facing college overview.</p>";
  assert.deepEqual(sanitizeCollegePublicContent(clean).row, clean);
});

test("escapes college metadata inserted into replacement HTML", () => {
  const source = affectedCollege();
  source.name = 'A&B <College> "Delhi"';
  const result = sanitizeCollegePublicContent(source).row;
  assert.match(result.description, /A&amp;B &lt;College&gt; &quot;Delhi&quot;/);
  assert.doesNotMatch(result.description, /<College>/);
});

test("the REST write boundary blocks reintroduction on college writes only", () => {
  const college = sanitizePublicWritePayload("colleges", affectedCollege());
  assert.equal(hasCollegeEditorialArtifacts(college), false);
  const article = { description: "<h3>Editorial Refresh Note</h3>" };
  assert.equal(sanitizePublicWritePayload("articles", article), article);
});
