import assert from "node:assert/strict";
import test from "node:test";
import { articleTitleSimilarity, findDuplicateArticleTitle, normalizeArticleTitle } from "../src/blog-ai.mjs";

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
