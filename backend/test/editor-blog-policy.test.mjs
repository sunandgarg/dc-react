import test from "node:test";
import assert from "node:assert/strict";
import { canContentEditorAccess, isRestrictedEditorPhone } from "../src/editor-access.mjs";
import { blogLimits, geminiQuotaHelpers } from "../src/blog-ai.mjs";
import { forceDraftPayload } from "../src/rest.mjs";

test("recognizes only the restricted content editor phone", () => {
  assert.equal(isRestrictedEditorPhone("7428966263"), true);
  assert.equal(isRestrictedEditorPhone("+91 74289 66263"), true);
  assert.equal(isRestrictedEditorPhone("9818308623"), false);
  assert.equal(isRestrictedEditorPhone("8700602524"), false);
});

test("content role covers editorial resources without destructive access", () => {
  assert.equal(canContentEditorAccess("colleges", "create"), true);
  assert.equal(canContentEditorAccess("course_fees", "edit"), true);
  assert.equal(canContentEditorAccess("scholarships", "view"), true);
  assert.equal(canContentEditorAccess("colleges", "delete"), false);
  assert.equal(canContentEditorAccess("leads", "view"), false);
});

test("non-publishing editors are forced into draft state by the server", () => {
  assert.deepEqual(
    forceDraftPayload("articles", { title: "Draft", status: "Published", is_active: true }),
    { title: "Draft", status: "Draft", is_active: false },
  );
  assert.deepEqual(
    forceDraftPayload("exams", { name: "Exam", status: "Applications Open", is_active: true }),
    { name: "Exam", status: "Upcoming", is_active: false },
  );
});

test("enforces conservative auto-blog cadence and volume limits", () => {
  assert.deepEqual(blogLimits, {
    MAX_POSTS_PER_RUN: 10,
    MAX_DAILY_POSTS: 48,
    MIN_INTERVAL_MINUTES: 30,
  });
});

test("normalizes legacy Gemini models and classifies quota errors", () => {
  assert.equal(geminiQuotaHelpers.normalizeGeminiModel("gemini-3.5-flash"), "gemini-3.6-flash");
  assert.equal(geminiQuotaHelpers.normalizeGeminiModel("gemini-3.6-flash"), "gemini-3.6-flash");
  assert.equal(geminiQuotaHelpers.parseRetryDelayMs('{"retryDelay":"0.672s"}'), 672);
  assert.equal(geminiQuotaHelpers.parseRetryDelayMs("Please retry in 672.424027ms."), 673);

  const classified = geminiQuotaHelpers.geminiErrorMessage(429, JSON.stringify({
    error: { message: "Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests" },
  }));
  assert.equal(classified.code, "GEMINI_QUOTA_EXHAUSTED");
  assert.match(classified.message, /Enable billing/);
});
