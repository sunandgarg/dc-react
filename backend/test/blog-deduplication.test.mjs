import assert from "node:assert/strict";
import test from "node:test";
import {
  articleTitleSimilarity,
  articleTopicSimilarity,
  assessGeneratedArticle,
  compactArticleCoverage,
  findDuplicateArticleTitle,
  findDuplicateArticleTopic,
  normalizeArticleTitle,
  normalizeTopicSuggestions,
} from "../src/blog-ai.mjs";

test("normalizes article titles without collapsing meaningful numbers", () => {
  assert.equal(normalizeArticleTitle("JEE Main 2026: Dates & Registration"), "jee main 2026 dates and registration");
});

test("detects near-duplicate DekhoCampus coverage", () => {
  const existing = [{ title: "JEE Main 2026 Registration Dates and Application Process", slug: "jee-main-2026-registration-dates" }];
  assert.ok(articleTitleSimilarity(existing[0].title, "JEE Main 2026 Application and Registration Dates") >= 0.82);
  assert.equal(findDuplicateArticleTitle({ title: "JEE Main 2026 Application and Registration Dates" }, existing), existing[0]);
});

test("allows genuinely different articles", () => {
  const existing = [{ title: "JEE Main 2026 Registration Dates", slug: "jee-main-2026-registration-dates" }];
  assert.equal(findDuplicateArticleTitle({ title: "NEET Biology Revision Strategy for 2026" }, existing), null);
});

test("blocks cosmetic headline changes for the same entity, year and intent", () => {
  const existing = [{
    title: "UPSC NDA 2 Admit Card 2026 Release Date and Download Steps",
    slug: "upsc-nda-2-admit-card-2026",
    description: "Release and download instructions for the NDA 2 hall ticket.",
    tags: ["NDA", "admit card"],
  }];
  const candidate = {
    title: "How to Download NDA II Hall Ticket 2026 and Check Exam-Day Rules",
    angle: "The hall-ticket download workflow and exam-day checks",
    search_intent: "admit card download",
    primary_entity: "UPSC NDA 2",
  };
  assert.ok(articleTopicSimilarity(existing[0], candidate) >= 0.82);
  assert.equal(findDuplicateArticleTopic(candidate, existing), existing[0]);
});

test("allows the same exam to answer a materially different intent", () => {
  const existing = [{ title: "JEE Main 2026 Registration Dates and Application Process" }];
  const candidate = { title: "JEE Main 2026 Physics Syllabus and Chapter Weightage" };
  assert.ok(articleTopicSimilarity(existing[0], candidate) < 0.82);
  assert.equal(findDuplicateArticleTopic(candidate, existing), null);
});

test("keeps separate sessions and annual editions distinct", () => {
  assert.ok(articleTopicSimilarity("CAT 2025 Slot 1 Paper Analysis", "CAT 2025 Slot 2 Paper Analysis") < 0.82);
  assert.ok(articleTopicSimilarity("NEET UG 2025 Counselling Dates", "NEET UG 2026 Counselling Dates") < 0.82);
});

test("compresses prior coverage into an inexpensive subject and intent fingerprint", () => {
  const fingerprint = compactArticleCoverage({ title: "Bihar NEET UG Merit List 2026 Release Date" });
  assert.match(fingerprint, /bihar/);
  assert.match(fingerprint, /neet/);
  assert.match(fingerprint, /ug/);
  assert.match(fingerprint, /merit-list/);
  assert.match(fingerprint, /2026/);
});

test("editorial quality gate accepts useful structured copy and rejects thin source-led copy", () => {
  const usefulParagraph = Array.from({ length: 580 }, (_, index) => (
    index % 13 === 0 ? "CAT preparation decision practice review" : `specific${index} guidance`
  )).join(" ");
  const good = assessGeneratedArticle({
    title: "CAT 2026 Preparation Plan for Working Graduates",
    description: "A practical CAT 2026 plan that helps working graduates divide practice, review errors and protect mock-test time each week.",
    content_html: `<h2>Set a workable baseline</h2><p>${usefulParagraph}</p><h2>Divide the weekly workload</h2><ul><li>Practise</li><li>Review</li></ul><h2>Measure correction quality</h2><p>Track decisions and revise the plan.</p><h2>Frequently asked questions</h2>`,
    faqs: [1, 2, 3, 4].map((number) => ({ question: `Question ${number}?`, answer: `Useful answer ${number}.` })),
  }, "CAT 2026 preparation plan for working graduates", 700);
  assert.equal(good.passed, true, good.issues.join("; "));

  const bad = assessGeneratedArticle({
    title: "CAT update",
    description: "Thin copy",
    content_html: '<h2>Update</h2><p>Read https://example.com for details.</p>',
    faqs: [],
  }, "CAT 2026 preparation", 1200);
  assert.equal(bad.passed, false);
  assert.ok(bad.issues.some((issue) => issue.includes("source URL")));
});

test("normalizes Gemini topic strings and alternate object keys", () => {
  assert.deepEqual(normalizeTopicSuggestions({ topics: ["NEET UG counselling checklist"] }), [{
    title: "NEET UG counselling checklist",
    angle: "",
    category: "Education",
    tags: [],
  }]);
  assert.deepEqual(normalizeTopicSuggestions({ opportunities: [{ headline: "IIT application document guide", tags: "admissions" }] }), [{
    headline: "IIT application document guide",
    title: "IIT application document guide",
    angle: "",
    category: "Education",
    tags: [],
  }]);
  assert.deepEqual(normalizeTopicSuggestions({ research: { article_opportunities: { first: { topic: "CUET subject choice guide" } } } }), [{
    topic: "CUET subject choice guide",
    title: "CUET subject choice guide",
    angle: "",
    category: "Education",
    tags: [],
  }]);
});
