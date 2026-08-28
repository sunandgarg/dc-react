import test from "node:test";
import assert from "node:assert/strict";
import { canContentEditorAccess, isRestrictedEditorPhone } from "../src/editor-access.mjs";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { blogLimits, createLocalEditorialCover, formatBlogCoverTitle, geminiQuotaHelpers, layoutTemplateCoverTitle, nextGeminiOutputBudget, normalizeBlogCoverOptions, normalizeGeneratedFaqs, parseGeminiJsonPayload, renderBlogCover, resolveBlogMediaSource, templateCoverTitleOverlay } from "../src/blog-ai.mjs";
import { forceDraftPayload } from "../src/rest.mjs";
import { accessTokenIsCurrent } from "../src/auth.mjs";

test("recognizes only the restricted content editor phone", () => {
  assert.equal(isRestrictedEditorPhone("7428966263"), true);
  assert.equal(isRestrictedEditorPhone("+91 74289 66263"), true);
  assert.equal(isRestrictedEditorPhone("9818308623"), false);
  assert.equal(isRestrictedEditorPhone("8700602524"), false);
});

test("rejects access tokens issued before a user's global session cutoff", () => {
  const user = { user_metadata: { full_name: "Admin", _sessions_revoked_after: 1_788_000_000 } };
  assert.equal(accessTokenIsCurrent(user, { iat: 1_787_999_999 }), false);
  assert.equal(accessTokenIsCurrent(user, { iat: 1_788_000_000 }), false);
  assert.equal(accessTokenIsCurrent(user, { iat: 1_788_000_001 }), true);
  assert.equal(accessTokenIsCurrent({ user_metadata: { full_name: "Admin" } }, { iat: 1 }), true);
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

test("detects truncated Gemini JSON and bounds the recovery budget", () => {
  assert.deepEqual(parseGeminiJsonPayload({
    candidates: [{ finishReason: "STOP", content: { parts: [{ text: '```json\n{"topics":[{"title":"NEET counselling"}]}\n```' }] } }],
  }), { topics: [{ title: "NEET counselling" }] });
  assert.throws(() => parseGeminiJsonPayload({
    candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: '{"content_html":"unfinished' }] } }],
  }), (error) => error.code === "GEMINI_RESPONSE_TRUNCATED");
  assert.equal(nextGeminiOutputBudget(1200), 2000);
  assert.equal(nextGeminiOutputBudget(7000), 10500);
  assert.equal(nextGeminiOutputBudget(10000), 12000);
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

test("renders a local branded cover without an external image provider", async () => {
  const bytes = await createLocalEditorialCover("JEE Main counselling choices for students", { width: 1600, height: 900 });
  assert.ok(bytes.length > 5_000);
  assert.equal(bytes.subarray(1, 4).toString(), "PNG");
});

test("prefixes every cover hook with the DekhoCampus brand", () => {
  assert.equal(formatBlogCoverTitle("The counselling mistake most students miss"), "DekhoCampus: The counselling mistake most students miss");
  assert.equal(formatBlogCoverTitle("DekhoCampus: Existing hook"), "DekhoCampus: Existing hook");
});

test("fits template headings into at most four centered lines without adding a panel", () => {
  const title = "The counselling deadline and document checklist every student should verify before choice filling";
  const options = { width: 1600, height: 900 };
  const layout = layoutTemplateCoverTitle(title, options);
  assert.ok(layout.lines.length >= 2 && layout.lines.length <= 4);
  assert.equal(layout.lines.join(" "), formatBlogCoverTitle(title));
  assert.ok(layout.fontSize >= 56);
  const svg = templateCoverTitleOverlay(title, options).toString();
  assert.match(svg, /text-anchor="middle"/);
  assert.doesNotMatch(svg, /<rect/);
});

test("renders the supplied template as a 16:9 WebP while preserving its own artwork", async () => {
  const source = await readFile(new URL("../assets/dekhocampus-blog-cover-template-v1.png", import.meta.url));
  const bytes = await renderBlogCover(source, {
    width: 1600,
    height: 900,
    resolution: "web",
    includeLogo: true,
    logoUrl: "https://example.com/should-not-be-downloaded.png",
  }, "A practical guide to choosing the right college", { sourceMode: "template" });
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 1600);
  assert.equal(metadata.height, 900);
  assert.ok(bytes.length > 20_000);
});

test("normalizes generated FAQs for dedicated article storage", () => {
  assert.deepEqual(normalizeGeneratedFaqs([
    { question: "<b>Who can apply?</b>", answer: "<p>Eligible Indian students.</p>" },
    { question: "", answer: "Ignored" },
  ]), [{ question: "Who can apply?", answer: "Eligible Indian students." }]);
});
