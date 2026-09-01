import test from "node:test";
import assert from "node:assert/strict";
import { canContentEditorAccess, isRestrictedEditorPhone } from "../src/editor-access.mjs";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { blogLimits, blogTextProvider, createLocalEditorialCover, formatBlogCoverTitle, geminiQuotaHelpers, layoutTemplateCoverTitle, nextGeminiOutputBudget, normalizeBlogCoverOptions, normalizeBlogTextModel, normalizeGeneratedFaqs, parseGeminiJsonPayload, parseOpenAiJsonPayload, renderBlogCover, resolveBlogMediaSource, stripPublishedSourceReferences, templateCoverTitleOverlay, templateCoverTitleRasterOverlay } from "../src/blog-ai.mjs";
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

test("restricted editor sessions and article edits preserve browser independence", async () => {
  const authSource = await readFile(new URL("../src/auth.mjs", import.meta.url), "utf8");
  const editorSource = await readFile(new URL("../src/editor-access.mjs", import.meta.url), "utf8");
  const clientSource = await readFile(new URL("../../src/integrations/backend/client.ts", import.meta.url), "utf8");

  assert.match(authSource, /data: \{ expires_at: new Date\(Date\.now\(\) \+ REFRESH_TTL_SECONDS \* 1000\) \}/);
  assert.doesNotMatch(authSource, /claimed\.count === 1 \? issueSession/);
  assert.match(authSource, /where: \{ token_hash: digest\(refreshToken\), revoked_at: null \}/);
  assert.match(clientSource, /let refreshPromise: Promise<BackendSession \| null> \| null = null/);
  assert.match(clientSource, /body: JSON\.stringify\(\{ refresh_token: session\.refresh_token \}\)/);
  assert.match(editorSource, /resource: "articles", can_view: true, can_create: true, can_edit: true/);
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

test("selects the lowest-cost OpenAI blog model and parses structured output", () => {
  assert.equal(normalizeBlogTextModel(""), "gpt-5-nano");
  assert.equal(normalizeBlogTextModel("gpt-5-nano"), "gpt-5-nano");
  assert.equal(blogTextProvider("gpt-5-nano"), "openai");
  assert.equal(blogTextProvider("gemini-3.6-flash"), "gemini");
  assert.deepEqual(parseOpenAiJsonPayload({ choices: [{ message: { content: '{"title":"Natural draft"}' } }] }), { title: "Natural draft" });
});

test("removes visible source references from publishable article HTML", () => {
  const cleaned = stripPublishedSourceReferences('<p>Apply after checking the deadline [Source 1].</p><p>Read the <a href="https://example.com/report">official notice</a>.</p><h2>References</h2><p>https://example.com</p>');
  assert.equal(cleaned, "<p>Apply after checking the deadline.</p><p>Read the official notice.</p>");
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
  assert.equal(layout.fontSize, 64);
  assert.equal(layout.lineHeight, 80);
  const svg = templateCoverTitleOverlay(title, options).toString();
  assert.match(svg, /text-anchor="middle"/);
  assert.doesNotMatch(svg, /<rect/);
});

test("balances abbreviated article titles without orphan lines", () => {
  const layout = layoutTemplateCoverTitle("ICAR AIEEA PG 2026 Seat Matrix and Choice Locking Strategy", { width: 1600, height: 900 });
  assert.ok(layout.lines.every((line) => line.split(/\s+/).length > 1));
  assert.equal(layout.lines.join(" "), "DekhoCampus: ICAR AIEEA PG 2026 Seat Matrix and Choice Locking Strategy");
  assert.equal(layout.fontSize, 64);
});

test("uses identical typography for short and long template titles", () => {
  const options = { width: 1600, height: 900 };
  const short = layoutTemplateCoverTitle("NEET counselling update", options);
  const long = layoutTemplateCoverTitle("The counselling deadline and document checklist every student should verify before choice filling", options);
  assert.deepEqual(
    { fontSize: short.fontSize, lineHeight: short.lineHeight },
    { fontSize: long.fontSize, lineHeight: long.lineHeight },
  );
});

test("rasterizes template headings with the bundled production font", async () => {
  const options = { width: 1600, height: 900 };
  const overlay = await templateCoverTitleRasterOverlay("A clear counselling deadline students should remember", options);
  const metadata = await sharp(overlay.input).metadata();
  const stats = await sharp(overlay.input).stats();
  assert.equal(metadata.format, "png");
  assert.ok(metadata.width > 500 && metadata.height > 50);
  assert.ok(stats.channels[3].max > 0, "Expected the title overlay to contain visible alpha pixels");
});

test("renders the supplied template as a 16:9 WebP while preserving its own artwork", async () => {
  const source = await readFile(new URL("../assets/dekhocampus-blog-cover-template-v1.png", import.meta.url));
  const bytes = await renderBlogCover(source, {
    width: 1600,
    height: 900,
    resolution: "web",
    includeLogo: true,
    logoUrl: "https://example.com/should-not-be-downloaded.png",
  }, "A practical guide to choosing the right college", "template");
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 1600);
  assert.equal(metadata.height, 900);
  assert.ok(bytes.length > 20_000);
});

test("uses the bundled branded template fallback without the legacy dark panel", async () => {
  const options = { width: 1600, height: 900, resolution: "web", includeLogo: false, logoUrl: "" };
  const source = await createLocalEditorialCover("Fallback", options);
  const bytes = await renderBlogCover(source, options, "The counselling deadline students should verify", "bundled-template");
  const bottomCenter = await sharp(bytes).extract({ left: 800, top: 820, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  assert.ok([...bottomCenter].every((channel) => channel > 220), `Expected a light template background, received ${[...bottomCenter]}`);
});

test("normalizes generated FAQs for dedicated article storage", () => {
  assert.deepEqual(normalizeGeneratedFaqs([
    { question: "<b>Who can apply?</b>", answer: "<p>Eligible Indian students.</p>" },
    { question: "", answer: "Ignored" },
  ]), [{ question: "Who can apply?", answer: "Eligible Indian students." }]);
});
