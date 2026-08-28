import test from "node:test";
import assert from "node:assert/strict";
import { canContentEditorAccess, isRestrictedEditorPhone } from "../src/editor-access.mjs";
import { blogLimits, geminiQuotaHelpers, normalizeBlogCoverOptions, resolveBlogMediaSource } from "../src/blog-ai.mjs";
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

test("normalizes every saved blog cover control into render dimensions", () => {
  assert.deepEqual(normalizeBlogCoverOptions({
    imageMode: "template",
    templateUrl: "https://dekhocampus.com/template.webp",
    promptStyle: " Editorial ",
    includeLogo: true,
    logoUrl: "https://dekhocampus.com/logo.webp",
    aspectRatio: "4:5",
    resolution: "2K",
  }), {
    mode: "template",
    aspectRatio: "4:5",
    resolution: "2k",
    width: 2048,
    height: 2560,
    templateUrl: "https://dekhocampus.com/template.webp",
    promptStyle: "Editorial",
    includeLogo: true,
    logoUrl: "https://dekhocampus.com/logo.webp",
    logoPosition: "top-center",
  });
});

test("routes a legacy Supabase blog bucket through the configured AWS media base", () => {
  const previous = process.env.MEDIA_BASE_URL;
  process.env.MEDIA_BASE_URL = "https://media.dekhocampus.com";
  try {
    assert.equal(
      resolveBlogMediaSource("https://project.supabase.co/storage/v1/object/public/blog-templates/cover one.png"),
      "https://media.dekhocampus.com/blog-templates/cover%20one.png",
    );
  } finally {
    if (previous === undefined) delete process.env.MEDIA_BASE_URL;
    else process.env.MEDIA_BASE_URL = previous;
  }
});
