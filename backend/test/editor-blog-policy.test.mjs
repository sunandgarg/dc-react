import test from "node:test";
import assert from "node:assert/strict";
import { canContentEditorAccess, isRestrictedEditorPhone } from "../src/editor-access.mjs";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { BLOG_COVER_TEMPLATE_COUNT, BLOG_COVER_TITLE_MAX_CHARACTERS, blogLimits, blogTextProvider, createLocalEditorialCover, editorialFrameOverlay, formatBlogCoverTitle, geminiQuotaHelpers, inferContextLogoName, layoutTemplateCoverTitle, nextGeminiOutputBudget, normalizeBlogCoverOptions, normalizeBlogTextModel, normalizeGeneratedFaqs, parseGeminiJsonPayload, parseOpenAiJsonPayload, renderBlogCover, resolveBlogMediaSource, resolveContextualBlogLogo, selectBlogCoverTemplate, stripPublishedSourceReferences, templateCoverTitleOverlay, templateCoverTitleRasterOverlay } from "../src/blog-ai.mjs";
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
    MAX_DAILY_POSTS: 72,
    MIN_INTERVAL_MINUTES: 20,
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
    referenceImageUrl: "https://dekhocampus.com/reference.webp",
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
    referenceImageUrl: "https://dekhocampus.com/reference.webp",
    promptStyle: "Editorial",
    includeLogo: true,
    logoUrl: "https://dekhocampus.com/logo.webp",
    contextLogoUrl: "",
    contextLogoName: "",
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

test("keeps the education-news label centered inside its badge", () => {
  const svg = editorialFrameOverlay({ width: 1600, height: 900 }).toString();
  assert.match(svg, /<rect x="648" y="315" width="304" height="47"/);
  assert.match(svg, /<text x="800" y="339" text-anchor="middle" dominant-baseline="middle"/);
  assert.match(svg, /font-size="22"[^>]*letter-spacing="1\.5"[^>]*>EDUCATION NEWS<\/text>/);
});

test("keeps full short headings and ellipsizes only oversized cover text", () => {
  assert.equal(formatBlogCoverTitle("The counselling mistake most students miss"), "The counselling mistake most students miss");
  assert.equal(formatBlogCoverTitle("DekhoCampus: Existing title"), "DekhoCampus: Existing title");
  const title = "A very long heading that must remain complete across every line of the image even when the original title contains an ellipsis… before its final words";
  const formatted = formatBlogCoverTitle(title);
  assert.equal(formatted, "A very long heading that must remain complete across every line of the image even...");
  assert.ok(formatted.length <= BLOG_COVER_TITLE_MAX_CHARACTERS);
  assert.match(formatted, /\.\.\.$/);
});

test("fits template headings into at most three readable lines without adding a panel", () => {
  const title = "The counselling deadline and document checklist every student should verify before choice filling";
  const options = { width: 1600, height: 900 };
  const layout = layoutTemplateCoverTitle(title, options);
  assert.ok(layout.lines.length >= 2 && layout.lines.length <= 3);
  assert.equal(layout.lines.join(" "), formatBlogCoverTitle(title));
  assert.ok(layout.fontSize >= 42 && layout.fontSize <= 58);
  assert.equal(layout.lineHeight, Math.round(layout.fontSize * 1.15));
  assert.equal(layout.centerY, 513);
  const svg = templateCoverTitleOverlay(title, options).toString();
  assert.match(svg, /text-anchor="middle"/);
  assert.doesNotMatch(svg, /<rect/);
});

test("uses the verified scheduled entity logo without an AI lookup", async () => {
  assert.deepEqual(await resolveContextualBlogLogo("Amity University admissions", {
    schedule: { entity_type: "college" },
    entity: { name: "Amity University, Noida", short_name: "Amity", logo: "admin-uploads/college/amity.webp", image: "" },
  }), { url: "admin-uploads/college/amity.webp", name: "Amity University, Noida" });
});

test("balances abbreviated article titles without orphan lines", () => {
  const layout = layoutTemplateCoverTitle("ICAR AIEEA PG 2026 Seat Matrix and Choice Locking Strategy", { width: 1600, height: 900 });
  assert.ok(layout.lines.every((line) => line.split(/\s+/).length > 1));
  assert.equal(layout.lines.join(" "), "ICAR AIEEA PG 2026 Seat Matrix and Choice Locking Strategy");
  assert.ok(layout.fontSize >= 50 && layout.fontSize <= 58);
});

test("scales long titles down after applying the readable heading budget", () => {
  const options = { width: 1600, height: 900 };
  const short = layoutTemplateCoverTitle("NEET counselling update", options);
  const title = "A pragmatic year-long plan for engineering and technology admissions in India: timelines, counselling workflows, and contingency steps";
  const long = layoutTemplateCoverTitle(title, options);
  assert.ok(long.fontSize < short.fontSize);
  assert.equal(long.lines.join(" "), formatBlogCoverTitle(title));
  assert.ok(long.lines.length <= 3);
  assert.ok(long.lines.join(" ").length <= BLOG_COVER_TITLE_MAX_CHARACTERS);
});

test("ships 24 stable zero-credit editorial background templates", () => {
  assert.equal(BLOG_COVER_TEMPLATE_COUNT, 24);
  const first = selectBlogCoverTemplate("NEET counselling choices");
  assert.equal(selectBlogCoverTemplate("NEET counselling choices"), first);
  assert.ok(first >= 1 && first <= BLOG_COVER_TEMPLATE_COUNT);
  assert.ok(new Set(Array.from({ length: 100 }, (_, index) => selectBlogCoverTemplate(`topic-${index}`))).size >= 20);
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

test("derives a stable subject mark when an official logo is unavailable", () => {
  assert.equal(inferContextLogoName("UPSC NDA 2 admit card released"), "UPSC");
  assert.equal(inferContextLogoName("Tamil Nadu Public School reopening calendar"), "Tamil Nadu Public School");
});

test("keeps the cover free of contextual badges and duplicate logos", async () => {
  const source = await readFile(new URL("../assets/dekhocampus-blog-cover-template-v1.png", import.meta.url));
  const diagnostics = {};
  const bytes = await renderBlogCover(source, {
    width: 1600, height: 900, resolution: "web", aspectRatio: "16:9",
    includeLogo: false, logoUrl: "", contextLogoUrl: "", contextLogoName: "UPSC",
  }, "NDA application dates students should know", "template", diagnostics);
  assert.equal((await sharp(bytes).metadata()).format, "webp");
  assert.equal(diagnostics.logoApplied, false);
  assert.equal(diagnostics.logoKind, "brand-only");
});

test("uses the bundled editorial fallback without the legacy dark panel", async () => {
  const options = { width: 1600, height: 900, resolution: "web", includeLogo: false, logoUrl: "" };
  const source = await createLocalEditorialCover("Fallback", options);
  const bytes = await renderBlogCover(source, options, "The counselling deadline students should verify", "bundled-template");
  const emptyPanelArea = await sharp(bytes).extract({ left: 300, top: 450, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  assert.ok([...emptyPanelArea].every((channel) => channel > 220), `Expected a light locked panel, received ${[...emptyPanelArea]}`);
});

test("normalizes generated FAQs for dedicated article storage", () => {
  assert.deepEqual(normalizeGeneratedFaqs([
    { question: "<b>Who can apply?</b>", answer: "<p>Eligible Indian students.</p>" },
    { question: "", answer: "Ignored" },
  ]), [{ question: "Who can apply?", answer: "Eligible Indian students." }]);
});
