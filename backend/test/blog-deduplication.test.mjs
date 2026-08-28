import assert from "node:assert/strict";
import test from "node:test";
import { articleTitleSimilarity, findDuplicateArticleTitle, normalizeArticleTitle, normalizeTopicSuggestions } from "../src/blog-ai.mjs";

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
