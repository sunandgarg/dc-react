import assert from "node:assert/strict";
import test from "node:test";
import {
  articlePrompt,
  articleSiteProfile,
  articleTitleSimilarity,
  articleTopicSimilarity,
  assessGeneratedArticle,
  assertArticleTopicsAvailable,
  compactArticleCoverage,
  findDuplicateArticleTitle,
  findDuplicateArticleTopic,
  handleArticleCover,
  handleBlogStudio,
  normalizeArticleTitle,
  normalizeArticleSiteScope,
  normalizeTopicSuggestions,
  STRICT_ARTICLE_DUPLICATE_THRESHOLD,
} from "../src/blog-ai.mjs";

test("Sarkari studio uses a dedicated government-job editorial profile", () => {
  assert.equal(normalizeArticleSiteScope("sarkari"), "sarkari");
  assert.equal(normalizeArticleSiteScope(""), "dekhocampus");
  assert.equal(normalizeArticleSiteScope(null), "dekhocampus");
  assert.throws(
    () => normalizeArticleSiteScope("unknown"),
    (error) => error?.status === 400 && error?.code === "INVALID_ARTICLE_SITE_SCOPE",
  );
  assert.throws(
    () => normalizeArticleSiteScope(" sarkari "),
    (error) => error?.status === 400 && error?.code === "INVALID_ARTICLE_SITE_SCOPE",
  );
  assert.equal(articleSiteProfile("sarkari").defaultCategory, "Latest Jobs");
  const prompt = articlePrompt("SSC CGL 2026 notification", [], 800, [], "sarkari");
  assert.match(prompt, /Sarkari DekhoCampus/);
  assert.match(prompt, /Latest Jobs, Results, Admit Card, Answer Key, Admissions, Syllabus, Scholarships/);
  assert.match(prompt, /Never imply that Sarkari DekhoCampus is the recruiting authority/);
});

test("custom article AI endpoints reject explicit non-canonical tenant scopes", async () => {
  for (const handler of [handleBlogStudio, handleArticleCover]) {
    await assert.rejects(
      handler(new Request("http://localhost/admin/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ site_scope: " sarkari ", topic: "SSC CGL 2026" }),
      })),
      (error) => error?.status === 400 && error?.code === "INVALID_ARTICLE_SITE_SCOPE",
    );
  }
});

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

test("the final write gate blocks renamed coverage below the suggestion threshold", async () => {
  const existing = [{
    id: "existing-article",
    title: "JEE Main 2026 Counselling Schedule and Process",
    slug: "jee-main-2026-counselling-schedule-and-process",
  }];
  const candidate = { title: "JEE Main 2026 Counselling Dates Complete Student Guide" };
  const score = articleTopicSimilarity(existing[0], candidate);
  assert.ok(score >= STRICT_ARTICLE_DUPLICATE_THRESHOLD && score < 0.82);
  await assert.rejects(
    assertArticleTopicsAvailable([candidate], { client: { articles: { findMany: async () => existing } } }),
    (error) => error?.status === 409 && error?.code === "DUPLICATE_ARTICLE" && /already covers/i.test(error.message),
  );
});

test("the final write gate excludes the article being legitimately edited", async () => {
  const existing = [{
    id: "current-article",
    title: "JEE Main 2026 Counselling Schedule and Process",
    slug: "jee-main-2026-counselling-schedule-and-process",
  }];
  await assert.doesNotReject(assertArticleTopicsAvailable([existing[0]], {
    client: { articles: { findMany: async () => existing } },
    excludeIds: [existing[0].id],
  }));
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
    meta_title: "CAT 2026 Preparation Plan for Working Graduates",
    meta_description: "Build a realistic CAT 2026 study plan around a full-time job, weekly mock analysis, focused revision blocks and measurable improvement priorities.",
    content_html: `<h2>Answer first</h2><p>Working graduates can make CAT 2026 preparation sustainable by protecting fixed practice and review blocks.</p><p>${usefulParagraph}</p><h2>Key facts</h2><ul><li>Practise</li><li>Review</li></ul><h2>Decision guidance</h2><p>Track decisions and revise the plan.</p><h2>Frequently asked questions</h2>${[1, 2, 3, 4].map((number) => `<h3>Question ${number}?</h3><p>Useful answer ${number}.</p>`).join("")}`,
    faqs: [1, 2, 3, 4].map((number) => ({ question: `Question ${number}?`, answer: `Useful answer ${number}.` })),
  }, "CAT 2026 preparation plan for working graduates", 1200);
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
    trend_based: false,
  }]);
  assert.deepEqual(normalizeTopicSuggestions({ opportunities: [{ headline: "IIT application document guide", tags: "admissions" }] }), [{
    headline: "IIT application document guide",
    title: "IIT application document guide",
    angle: "",
    category: "Education",
    tags: [],
    trend_based: false,
  }]);
  assert.deepEqual(normalizeTopicSuggestions({ research: { article_opportunities: { first: { topic: "CUET subject choice guide" } } } }), [{
    topic: "CUET subject choice guide",
    title: "CUET subject choice guide",
    angle: "",
    category: "Education",
    tags: [],
    trend_based: false,
  }]);
});
