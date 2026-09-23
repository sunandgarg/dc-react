import test from "node:test";
import assert from "node:assert/strict";
import { CONTENT_HEAD_RESOURCES, canContentEditorAccess, canContentHeadAccess, isContentHeadPhone } from "../src/editor-access.mjs";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { BLOG_COVER_TEMPLATE_COUNT, BLOG_COVER_TITLE_MAX_CHARACTERS, DEKHOCAMPUS_HUMAN_EDITORIAL_POLICY, DEFAULT_BLOG_ANALYSIS_MODEL, DEFAULT_BLOG_WRITING_MODEL, DEFAULT_EDITORIAL_TONE, articlePrompt, articleRevisionPrompt, articleWordToleranceRange, blogCoverRotationObjectPath, blogCoverRotationTemplateKey, blogLimits, blogTextProvider, createLocalEditorialCover, createReusableBlogCoverTemplate, editorialFrameOverlay, editorialFrameTextRasterOverlays, formatBlogCoverTitle, geminiQuotaHelpers, independentArticleReviewThreshold, inferContextLogoName, isCompactArticleWordTarget, layoutTemplateCoverTitle, nextBlogCoverRotationIndex, nextGeminiOutputBudget, nextJitteredBlogRunAt, nextOpenAiOutputBudget, normalizeArticleReviewResult, normalizeBlogAgentSettings, normalizeBlogCoverOptions, normalizeBlogTextModel, normalizeGeneratedArticlePayload, normalizeGeneratedFaqs, parseGeminiJsonPayload, parseOpenAiJsonPayload, renderBlogCover, resolveArticleWordTarget, resolveBlogMediaSource, resolveContextualBlogLogo, resolveOpenAiArticleOutputBudget, selectBlogCoverTemplate, stripDedicatedFaqBlock, stripPublishedSourceReferences, templateCoverTitleOverlay, templateCoverTitleRasterOverlay, toOpenAiJsonSchema } from "../src/blog-ai.mjs";
import { forceDraftPayload } from "../src/rest.mjs";
import { accessTokenIsCurrent, authSecurityInternals, verifyLeadOtpProof } from "../src/auth.mjs";

test("recognizes only the managed Content Head phone", () => {
  assert.equal(isContentHeadPhone("8810323087"), true);
  assert.equal(isContentHeadPhone("+91 88103 23087"), true);
  assert.equal(isContentHeadPhone("7428966263"), false);
  assert.equal(isContentHeadPhone("8700602524"), false);
});

test("rejects access tokens issued before a user's global session cutoff", () => {
  const user = { user_metadata: { full_name: "Admin", _sessions_revoked_after: 1_788_000_000 } };
  assert.equal(accessTokenIsCurrent(user, { iat: 1_787_999_999 }), false);
  assert.equal(accessTokenIsCurrent(user, { iat: 1_788_000_000 }), false);
  assert.equal(accessTokenIsCurrent(user, { iat: 1_788_000_001 }), true);
  assert.equal(accessTokenIsCurrent({ user_metadata: { full_name: "Admin" } }, { iat: 1 }), true);
});

test("lead OTP proofs are signed, short-lived, and bound to one phone", () => {
  const previous = process.env.AUTH_JWT_SECRET;
  process.env.AUTH_JWT_SECRET = "test-only-auth-secret-that-is-at-least-32-characters";
  try {
    const token = authSecurityInternals.issueLeadOtpProof("+919876543210");
    assert.equal(verifyLeadOtpProof(token, "+919876543210"), true);
    assert.equal(verifyLeadOtpProof(token, "+919876543211"), false);
    assert.equal(verifyLeadOtpProof(`${token}tampered`, "+919876543210"), false);
  } finally {
    if (previous === undefined) delete process.env.AUTH_JWT_SECRET;
    else process.env.AUTH_JWT_SECRET = previous;
  }
});

test("content role covers editorial resources without destructive access", () => {
  assert.equal(canContentEditorAccess("colleges", "create"), true);
  assert.equal(canContentEditorAccess("course_fees", "edit"), true);
  assert.equal(canContentEditorAccess("scholarships", "view"), true);
  assert.equal(canContentEditorAccess("colleges", "delete"), false);
  assert.equal(canContentEditorAccess("leads", "view"), false);
});

test("Content Head can publish only the four requested modules", () => {
  assert.deepEqual([...CONTENT_HEAD_RESOURCES].sort(), ["articles", "colleges", "courses", "exams"]);
  assert.equal(canContentHeadAccess("articles", "create"), true);
  assert.equal(canContentHeadAccess("colleges", "edit"), true);
  assert.equal(canContentHeadAccess("courses", "view"), true);
  assert.equal(canContentHeadAccess("exams", "create"), true);
  assert.equal(canContentHeadAccess("articles", "delete"), false);
  assert.equal(canContentHeadAccess("course_fees", "edit"), false);
  assert.equal(canContentHeadAccess("leads", "view"), false);
});

test("Content Head sessions and article edits preserve browser independence", async () => {
  const authSource = await readFile(new URL("../src/auth.mjs", import.meta.url), "utf8");
  const editorSource = await readFile(new URL("../src/editor-access.mjs", import.meta.url), "utf8");
  const clientSource = await readFile(new URL("../../src/integrations/backend/client.ts", import.meta.url), "utf8");

  assert.match(authSource, /data: \{ expires_at: new Date\(Date\.now\(\) \+ REFRESH_TTL_SECONDS \* 1000\) \}/);
  assert.doesNotMatch(authSource, /claimed\.count === 1 \? issueSession/);
  assert.match(authSource, /where: \{ token_hash: digest\(refreshToken\), revoked_at: null \}/);
  assert.match(clientSource, /let refreshPromise: Promise<BackendSession \| null> \| null = null/);
  assert.match(clientSource, /body: JSON\.stringify\(\{ refresh_token: session\.refresh_token \}\)/);
  assert.match(editorSource, /can_delete: false, can_publish: true/);
  assert.doesNotMatch(editorSource, /7428966263/);
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

test("administrator AI article paths publish immediately", async () => {
  const blogSource = await readFile(new URL("../src/blog-ai.mjs", import.meta.url), "utf8");
  const studioSource = await readFile(new URL("../../src/components/admin/BlogStudioDialog.tsx", import.meta.url), "utf8");
  const articlesPageSource = await readFile(new URL("../../src/pages/AdminArticles.tsx", import.meta.url), "utf8");
  assert.match(blogSource, /const status = shouldReview \? "Draft" : "Published"/);
  assert.match(blogSource, /const requestedStatus = body\.status === "Draft" \? "Draft" : "Published"/);
  assert.match(blogSource, /USE_EDITORIAL_BLOG_STUDIO/);
  assert.match(blogSource, /const siteScope = normalizeArticleSiteScope\(body\.site_scope\)/);
  assert.match(blogSource, /site_scope: siteScope/);
  assert.match(blogSource, /siteScope === "sarkari" \? "sarkari_articles" : "articles"/);
  assert.match(studioSource, /action: "publish"/);
  assert.match(studioSource, /status: "Published"/);
  assert.match(studioSource, /site_scope: siteScope/);
  assert.doesNotMatch(studioSource, /\.from\("articles"\)\.upsert/);
  assert.doesNotMatch(articlesPageSource, /AIGenerateDialog/);
});

test("production AI smoke verifies draft FAQs without publishing them", async () => {
  const smokeSource = await readFile(new URL("../scripts/verify-production-blog-agent.mjs", import.meta.url), "utf8");
  assert.match(smokeSource, /where: \{ page: "articles", item_slug: article\.slug \}/);
  assert.match(smokeSource, /createdFaqs\.every\(\(faq\) => faq\.is_active === false\)/);
  assert.match(smokeSource, /const coverMode = "template"/);
  assert.doesNotMatch(smokeSource, /item_slug: article\.slug, is_active: true/);
  assert.doesNotMatch(smokeSource, /Production is not configured to use the saved blog cover template/);
});

test("enforces conservative auto-blog cadence and volume limits", () => {
  assert.deepEqual(blogLimits, {
    MAX_POSTS_PER_RUN: 3,
    MAX_DAILY_POSTS: 48,
    MIN_INTERVAL_MINUTES: 60,
  });
});

test("production cadence is 48 gated posts per day with an explicit E-E-A-T contract", async () => {
  const productionSetup = await readFile(new URL("../scripts/configure-production-site-integrations.mjs", import.meta.url), "utf8");
  assert.match(productionSetup, /BLOG_EEAT_48_MIGRATION_KEY/);
  assert.match(productionSetup, /BLOG_GPT_5_6_SOL_EDITORIAL_MIGRATION_KEY/);
  assert.match(productionSetup, /BLOG_DEKHOCAMPUS_HUMAN_EDITORIAL_MIGRATION_KEY/);
  assert.match(productionSetup, /Direct, practical, opinionated and conversational Indian admissions guidance/);
  assert.match(productionSetup, /text_model: "gpt-5\.6-sol"/);
  assert.match(productionSetup, /interval_minutes: 60/);
  assert.match(productionSetup, /posts_per_run: 2/);
  assert.match(productionSetup, /daily_post_cap: 48/);
  assert.match(productionSetup, /BLOG_ALL_COMPETITORS_ACTIVE_MIGRATION_KEY/);
  assert.match(productionSetup, /source_type: "competitor", is_active: false/);
  assert.match(productionSetup, /ADSENSE_REQUESTED_PLACEMENTS_MIGRATION_KEY/);
  assert.match(productionSetup, /placement: "header", position: "top", minHeight: 50, priority: 100, adFormat: "horizontal"/);
  assert.match(productionSetup, /placement: "article", position: "top", minHeight: 50/);
  assert.match(productionSetup, /placement: "article", position: "middle", minHeight: 50/);
  assert.match(productionSetup, /placement: "article", position: "sidebar", minHeight: 250/);
  assert.match(productionSetup, /auto_ads_enabled: false/);
  assert.doesNotMatch(productionSetup, /adsenseUnitsDisabled/);

  const prompt = articlePrompt(
    { title: "NEET UG counselling choice filling", primary_entity: "NEET UG" },
    [{ source_type: "official", signal: "The responsible authority published the counselling schedule." }],
    900,
    [],
    {},
  );
  assert.match(prompt, /E-E-A-T execution/);
  assert.match(prompt, /Experience:/);
  assert.match(prompt, /Expertise:/);
  assert.match(prompt, /Authoritativeness:/);
  assert.match(prompt, /Trust:/);
  assert.match(prompt, /never pretend the author personally experienced them/);
  assert.match(prompt, /natural Indian English/i);
  assert.match(prompt, /Do not put an H1 inside content_html/);
  assert.match(prompt, /Privately score natural sentence variation/);
  assert.match(prompt, /Do not leak research URLs, citations, footnotes/);
  assert.match(prompt, /veteran niche education journalist and senior SEO content strategist/i);
  assert.match(prompt, /first 2-3 sentences/i);
  assert.match(prompt, /Never begin the article with prompt residue/i);
  assert.match(prompt, /plain-text stack/i);
  assert.match(prompt, /topic-native outline/i);
  assert.match(prompt, /Consolidate repeated cautions/i);
  assert.match(prompt, /named authority/i);
  assert.match(prompt, /exactly 1-2 H2 headings/i);
  assert.match(prompt, /3-5 times across the article body/i);
  assert.match(prompt, /comparison or summary table/i);
  assert.match(prompt, /meta_title of no more than 60 characters/i);
  assert.match(prompt, /meta_description of no more than 155 characters/i);
  assert.match(prompt, /testament, tapestry, paramount/i);
  assert.match(prompt, /strict JSON with clean semantic HTML in content_html, not Markdown/i);
  assert.match(prompt, /corporate-academic filler/i);
  assert.match(prompt, /metaphor traps/i);
  assert.match(prompt, /hybrid AEO\/GEO structure/i);
  assert.match(prompt, /40-60 word direct answer/i);
  assert.match(prompt, /semantic <h2>/i);
  assert.match(prompt, /never invent a survey, benchmark, quote or statistic/i);
  assert.match(prompt, /Do not make every section the same size/i);
  assert.match(prompt, /do not introduce spelling mistakes or claim the copy is undetectable/i);
});

test("DekhoCampus human editorial policy is present without breaking the HTML contract", () => {
  assert.equal(typeof DEFAULT_EDITORIAL_TONE, "string");
  assert.match(DEFAULT_EDITORIAL_TONE, /Direct, practical, opinionated/i);
  assert.match(DEKHOCAMPUS_HUMAN_EDITORIAL_POLICY.persona, /street-smart/i);
  assert.match(DEKHOCAMPUS_HUMAN_EDITORIAL_POLICY.audience, /Indian students/i);
  assert.ok(DEKHOCAMPUS_HUMAN_EDITORIAL_POLICY.banned.includes("holistic development"));
  assert.ok(DEKHOCAMPUS_HUMAN_EDITORIAL_POLICY.banned.includes("game-changer"));
  assert.ok(DEKHOCAMPUS_HUMAN_EDITORIAL_POLICY.banned.includes("transformative"));
  assert.ok(DEKHOCAMPUS_HUMAN_EDITORIAL_POLICY.banned.includes("empower"));
  assert.ok(DEKHOCAMPUS_HUMAN_EDITORIAL_POLICY.banned.includes("ecosystem"));
  assert.ok(DEKHOCAMPUS_HUMAN_EDITORIAL_POLICY.banned.includes("it is worth noting that"));
  assert.match(DEKHOCAMPUS_HUMAN_EDITORIAL_POLICY.vocabulary, /concrete verbs/i);
  assert.match(DEKHOCAMPUS_HUMAN_EDITORIAL_POLICY.syntax, /contractions/i);
  assert.match(DEKHOCAMPUS_HUMAN_EDITORIAL_POLICY.semantic_structure, /semantic HTML/i);
  assert.match(DEKHOCAMPUS_HUMAN_EDITORIAL_POLICY.information_gain, /Never invent/i);
  assert.match(DEKHOCAMPUS_HUMAN_EDITORIAL_POLICY.anti_symmetry, /same size/i);
  const normalized = normalizeBlogAgentSettings({});
  assert.equal(normalized.tone, DEFAULT_EDITORIAL_TONE);
  const prompt = articlePrompt("CUET UG 2027 subject selection", [], 900, [], {});
  assert.match(prompt, /DekhoCampus human editorial mode/i);
  assert.match(prompt, /No raw Markdown syntax/i);
  assert.match(prompt, /semantic HTML/i);
  assert.match(prompt, /holistic development/i);
  assert.match(prompt, /street-smart college admissions expert/i);
});

test("AI Blog Studio can select every saved competitor source", async () => {
  const panel = await readFile(new URL("../../src/components/admin/BlogAutoAgentPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /Select all competitors/);
  assert.match(panel, /source\.source_type === "competitor" \? \{ \.\.\.source, is_active: true \}/);
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

test("selects the configured OpenAI blog models and parses structured output", () => {
  assert.equal(DEFAULT_BLOG_ANALYSIS_MODEL, "gpt-6-luna");
  assert.equal(DEFAULT_BLOG_WRITING_MODEL, "gpt-6-sol");
  assert.equal(normalizeBlogTextModel(""), "gpt-6-sol");
  assert.equal(normalizeBlogTextModel("gpt-5.5"), "gpt-5.5");
  assert.equal(normalizeBlogTextModel("gpt-5.4"), "gpt-5.4-mini");
  assert.equal(normalizeBlogTextModel("gpt-5.4-mini"), "gpt-5.4-mini");
  assert.equal(normalizeBlogTextModel("gpt-6-sol"), "gpt-6-sol");
  assert.equal(normalizeBlogTextModel("gpt-6-luna"), "gpt-6-luna");
  assert.equal(normalizeBlogTextModel("gpt-5.6-sol"), "gpt-6-sol");
  assert.equal(normalizeBlogTextModel("gpt-5.6-luna"), "gpt-6-sol");
  assert.equal(normalizeBlogTextModel("gpt-5-nano"), "gpt-5-nano");
  assert.equal(blogTextProvider("gpt-5-nano"), "openai");
  assert.equal(blogTextProvider("gemini-3.6-flash"), "gemini");
  assert.deepEqual(parseOpenAiJsonPayload({ choices: [{ message: { content: '{"title":"Natural draft"}' } }] }), { title: "Natural draft" });
});

test("routes blog analysis to Luna while keeping article generation on the writing model", async () => {
  const source = await readFile(new URL("../src/blog-ai.mjs", import.meta.url), "utf8");
  const noveltySource = source.slice(source.indexOf("async function filterSemanticallyNovelTopics"), source.indexOf("async function assertAiEnabled"));
  const reviewSource = source.slice(source.indexOf("async function reviewGeneratedDraft"), source.indexOf("function articleRevisionPromptBase"));
  const draftSource = source.slice(source.indexOf("async function generateDraft"), source.indexOf("export async function handleBlogAiSettings"));
  assert.match(noveltySource, /model: DEFAULT_BLOG_ANALYSIS_MODEL/);
  assert.match(reviewSource, /model: DEFAULT_BLOG_ANALYSIS_MODEL/);
  assert.match(draftSource, /let model = requestedModel \|\| editorial\.text_model/);
  assert.match(source, /propose \$\{suggestionCount\}[\s\S]*?model: DEFAULT_BLOG_ANALYSIS_MODEL/);
});

test("converts provider-neutral schemas into strict OpenAI structured output", () => {
  assert.deepEqual(toOpenAiJsonSchema({
    type: "OBJECT",
    properties: {
      title: { type: "STRING" },
      faqs: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: { question: { type: "STRING" }, answer: { type: "STRING" } },
          required: ["question"],
        },
      },
    },
    required: ["title"],
  }), {
    type: "object",
    properties: {
      title: { type: "string" },
      faqs: {
        type: "array",
        items: {
          type: "object",
          properties: { question: { type: "string" }, answer: { type: "string" } },
          additionalProperties: false,
          required: ["question", "answer"],
        },
      },
    },
    additionalProperties: false,
    required: ["title", "faqs"],
  });
});

test("detects incomplete OpenAI responses and expands recovery budgets safely", () => {
  assert.throws(() => parseOpenAiJsonPayload({ choices: [{ finish_reason: "length", message: { content: '{"title":"unfinished' } }] }), (error) => error.code === "OPENAI_RESPONSE_TRUNCATED");
  assert.throws(() => parseOpenAiJsonPayload({ choices: [{ finish_reason: "stop", message: { content: "" } }] }), (error) => error.code === "OPENAI_EMPTY_RESPONSE");
  assert.equal(nextOpenAiOutputBudget(5_000), 7_500);
  assert.equal(nextOpenAiOutputBudget(9_000), 13_500);
  assert.equal(nextOpenAiOutputBudget(12_000), 18_000);
  assert.equal(nextOpenAiOutputBudget(32_000), 48_000);
  assert.equal(nextOpenAiOutputBudget(48_000), 48_000);
  assert.equal(resolveOpenAiArticleOutputBudget(900), 12_000);
  assert.equal(resolveOpenAiArticleOutputBudget(1_200), 13_600);
  assert.equal(resolveOpenAiArticleOutputBudget(1_500), 16_000);
  assert.equal(resolveOpenAiArticleOutputBudget(2_200), 21_600);
});

test("production article generation retries compact reviews and renders the validated draft slug", async () => {
  const source = await readFile(new URL("../src/blog-ai.mjs", import.meta.url), "utf8");
  const reviewSource = source.slice(source.indexOf("async function reviewGeneratedDraft"), source.indexOf("export function articleRevisionPrompt"));
  const finalizationSource = source.slice(source.indexOf("async function generateDraft"), source.indexOf("export async function handleBlogAiSettings"));

  assert.match(reviewSource, /reasoningEffort: "low"/);
  assert.match(reviewSource, /maxOutputTokens: 2_500/);
  assert.match(reviewSource, /maxTruncationRetries: 2/);
  assert.match(reviewSource, /people-first trust review/);
  assert.match(reviewSource, /all four E-E-A-T dimensions/);
  assert.match(finalizationSource, /maxTruncationRetries: 3/);
  assert.match(finalizationSource, /createBlogCover\(draft\.slug, draft\.title/);
  assert.doesNotMatch(finalizationSource, /createBlogCover\(slug, draft\.title/);
});

test("auto blog discovery uses a compact response with enough structured-output headroom", async () => {
  const source = await readFile(new URL("../src/blog-ai.mjs", import.meta.url), "utf8");
  const discoverySource = source.slice(source.indexOf("for (let round = 1"), source.indexOf("if (!topics.length)"));

  assert.match(discoverySource, /reasoningEffort: "none"/);
  assert.match(discoverySource, /maxOutputTokens: 4_000/);
  assert.match(discoverySource, /maxTruncationRetries: 3/);
  assert.match(discoverySource, /no more than 35 words/);
});

test("normalizes wrapped article payloads and always explains reviewer rejection", () => {
  assert.deepEqual(normalizeGeneratedArticlePayload({ article: {
    title: "Student decision guide",
    summary: "A useful summary",
    content: "<h2>Answer first</h2><p>Start here.</p>",
    seo_title: "Student decision guide for 2026",
    seo_description: "A useful search description",
    questions: [{ question: "What changed?", answer: "The date changed." }],
  } }), {
    title: "Student decision guide",
    summary: "A useful summary",
    content: "<h2>Answer first</h2><p>Start here.</p>",
    seo_title: "Student decision guide for 2026",
    seo_description: "A useful search description",
    questions: [{ question: "What changed?", answer: "The date changed." }],
    description: "A useful summary",
    content_html: "<h2>Answer first</h2><p>Start here.</p>",
    meta_title: "Student decision guide for 2026",
    meta_description: "A useful search description",
    meta_keywords: "",
    tags: [],
    faqs: [{ question: "What changed?", answer: "The date changed." }],
  });
  const review = normalizeArticleReviewResult({ score: 84, publishable: false, issues: [] }, 90);
  assert.equal(review.publishable, false);
  assert.deepEqual(review.issues, ["independent editorial score 84/100 is below the required 85/100"]);

  const strictDeterministicTarget = normalizeArticleReviewResult({ score: 92, publishable: true, issues: [] }, 98);
  assert.equal(strictDeterministicTarget.publishable, true);
  assert.equal(strictDeterministicTarget.required_score, 85);
  assert.deepEqual(strictDeterministicTarget.issues, []);
  assert.equal(independentArticleReviewThreshold(90), 85);
  assert.equal(independentArticleReviewThreshold(80), 80);

  const completeNestedArticle = normalizeGeneratedArticlePayload({
    title: "Envelope title only",
    article: {
      title: "Complete student decision guide",
      description: "A complete summary for students making this decision.",
      content_html: "<h2>Answer first</h2><p>This is the complete article body.</p>",
      meta_title: "Complete student decision guide for 2026",
      faqs: [{ question: "What changed?", answer: "The published process changed." }],
    },
  });
  assert.equal(completeNestedArticle.title, "Complete student decision guide");
  assert.match(completeNestedArticle.content_html, /complete article body/);
});

test("builds a complete targeted revision prompt from editorial feedback", () => {
  const prompt = articleRevisionPrompt(
    { title: "Bihar BEd CET allotment update", content_html: "<p>Check your result.</p>", faqs: [] },
    { title: "Bihar BEd CET allotment update", primary_entity: "Bihar BEd CET" },
    [{ source_type: "public_signal", signal: "The counselling portal published an allotment update." }],
    ["State where candidates should check the allotment result."],
    { editorial_quality_target: 90 },
  );
  assert.match(prompt, /Return the complete replacement/);
  assert.match(prompt, /State where candidates should check the allotment result/);
  assert.match(prompt, /remove unsupported certainty/);
  assert.match(prompt, /Make the revision people-first/);
  assert.match(prompt, /never invent personal experience/i);
  assert.match(prompt, /all four E-E-A-T dimensions/);
  assert.match(prompt, /Do not mirror their questions or answers in content_html/);
});

test("normalizes editorial controls and adapts depth to student intent", () => {
  const normalized = normalizeBlogAgentSettings({
    interval_minutes: 5,
    posts_per_run: 99,
    daily_post_cap: 72,
    word_limit: 0,
    content_goals: ["SEO", "AIO", "LLMO"],
    minimum_sources: 1,
    editorial_quality_target: 100,
  });
  assert.equal(normalized.interval_minutes, 60);
  assert.equal(normalized.posts_per_run, 3);
  assert.equal(normalized.daily_post_cap, 48);
  assert.equal(normalized.word_limit, 0);
  assert.deepEqual(normalized.content_goals, ["SEO", "AEO", "GEO", "LLMO", "E-E-A-T"]);
  assert.deepEqual(normalized.required_sections, ["Answer first"]);
  assert.equal(normalized.minimum_sources, 2);
  assert.equal(normalized.editorial_quality_target, 98);
  assert.equal(normalized.image_mode, "rotation");
  assert.equal(resolveArticleWordTarget({ title: "NEET result and scorecard release" }, 0), 900);
  assert.equal(resolveArticleWordTarget({ title: "JEE counselling and choice filling strategy" }, 0), 1500);
  assert.equal(resolveArticleWordTarget({ title: "BTech admission eligibility" }, 0), 1200);
  assert.equal(resolveArticleWordTarget({ title: "CUET subject choice" }, 450), 450);
  assert.equal(normalizeBlogAgentSettings({ word_limit: 300 }).word_limit, 350);
  assert.equal(resolveArticleWordTarget({ title: "CUET subject choice" }, 350), 350);
  assert.equal(resolveArticleWordTarget({ title: "CUET subject choice" }, 400), 400);
  assert.deepEqual(articleWordToleranceRange(400), { target: 400, minimum: 350, maximum: 450 });
  assert.deepEqual(articleWordToleranceRange(500), { target: 500, minimum: 440, maximum: 560 });
  assert.equal(articleWordToleranceRange(900), null);
  assert.equal(isCompactArticleWordTarget(350), true);
  assert.equal(isCompactArticleWordTarget(400), true);
  assert.equal(isCompactArticleWordTarget(900), false);
});

test("varies scheduled blog minutes without changing the configured interval", () => {
  const today = new Date("2026-09-22T06:10:00.000Z");
  const tomorrow = new Date("2026-09-23T06:10:00.000Z");
  const nextToday = nextJitteredBlogRunAt(today, 60);
  const nextTomorrow = nextJitteredBlogRunAt(tomorrow, 60);
  assert.equal(nextToday.getTime() > today.getTime() + 60 * 60_000, true);
  assert.equal(nextToday.getTime() <= today.getTime() + 60 * 60_000 + 60 * 60_000, true);
  assert.notEqual(nextToday.toISOString().slice(14, 16), nextTomorrow.toISOString().slice(14, 16));
});

test("removes visible source references from publishable article HTML", () => {
  const cleaned = stripPublishedSourceReferences('<p>Apply after checking the deadline [Source 1].</p><p>Read the <a href="https://example.com/report">official notice</a>.</p><h2>References</h2><p>https://example.com</p>');
  assert.equal(cleaned, "<p>Apply after checking the deadline.</p><p>Read the official notice.</p>");

  const guarded = stripPublishedSourceReferences('<p>According to the authority, candidates should act now.</p><p>Shiksha reported another date.</p><p>Read <a href="https://dekhocampus.com/exams/cat">our CAT page</a> and <a href="https://example.com">another site</a>.</p>');
  assert.equal(guarded, '<p>the authority, candidates should act now.</p><p>Read <a href="/exams/cat">our CAT page</a> and another site.</p>');
});

test("keeps generated FAQ records out of article body copy", () => {
  const cleaned = stripDedicatedFaqBlock('<h2>Decision guidance</h2><p>Make the choice carefully.</p><h2>Frequently asked questions</h2><h3>Who can apply?</h3><p>Eligible students can apply.</p>');
  assert.equal(cleaned, '<h2>Decision guidance</h2><p>Make the choice carefully.</p>');
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

test("keeps reusable frame masters free of font-dependent SVG text", () => {
  const svg = editorialFrameOverlay({ width: 1600, height: 900 }).toString();
  assert.match(svg, /<rect x="648" y="315" width="304" height="47"/);
  assert.doesNotMatch(svg, /<text/);
});

test("rasterizes frame labels with the bundled production font", async () => {
  const overlays = await editorialFrameTextRasterOverlays({ width: 1600, height: 900 });
  assert.equal(overlays.length, 2);
  assert.ok(overlays[0].left > 600 && overlays[0].left < 800);
  assert.ok(overlays[0].top > 300 && overlays[0].top < 360);
  assert.ok(overlays[1].left > 200 && overlays[1].left < 700);
  assert.ok(overlays[1].top > 680 && overlays[1].top < 750);
  for (const overlay of overlays) {
    const metadata = await sharp(overlay.input).metadata();
    const stats = await sharp(overlay.input).stats();
    assert.equal(metadata.format, "png");
    assert.ok(stats.channels[3].max > 0, "Expected frame text to contain visible alpha pixels");
  }
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

test("ships 50 stable zero-credit editorial background templates", () => {
  assert.equal(BLOG_COVER_TEMPLATE_COUNT, 50);
  const first = selectBlogCoverTemplate("NEET counselling choices");
  assert.equal(selectBlogCoverTemplate("NEET counselling choices"), first);
  assert.ok(first >= 1 && first <= BLOG_COVER_TEMPLATE_COUNT);
  assert.ok(new Set(Array.from({ length: 100 }, (_, index) => selectBlogCoverTemplate(`topic-${index}`))).size >= 20);
});

test("allocates strict round-robin cover keys and wraps after design 50", () => {
  assert.equal(nextBlogCoverRotationIndex(0), 1);
  assert.equal(nextBlogCoverRotationIndex(49), 50);
  assert.equal(nextBlogCoverRotationIndex(50), 1);
  assert.equal(blogCoverRotationObjectPath(7), "blog-templates/round-robin-v2/cover-07.webp");
  assert.equal(blogCoverRotationTemplateKey(50), "admin-uploads/blog-templates/round-robin-v2/cover-50.webp");
  assert.throws(() => blogCoverRotationTemplateKey(51), RangeError);
});

test("sanitizes a previous cover into a reusable blank editorial master", async () => {
  const source = await readFile(new URL("../assets/dekhocampus-blog-cover-template-v1.png", import.meta.url));
  const bytes = await createReusableBlogCoverTemplate(source, { width: 1600, height: 900 });
  const metadata = await sharp(bytes).metadata();
  const center = await sharp(bytes).extract({ left: 790, top: 440, width: 20, height: 20 }).removeAlpha().raw().toBuffer();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 1600);
  assert.equal(metadata.height, 900);
  assert.ok(Math.min(...center) > 225);
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

test("keeps the cover free of contextual badges and applies one canonical brand logo", async () => {
  const source = await readFile(new URL("../assets/dekhocampus-blog-cover-template-v1.png", import.meta.url));
  const diagnostics = {};
  const bytes = await renderBlogCover(source, {
    width: 1600, height: 900, resolution: "web", aspectRatio: "16:9",
    includeLogo: false, logoUrl: "", contextLogoUrl: "", contextLogoName: "UPSC",
  }, "NDA application dates students should know", "template", diagnostics);
  assert.equal((await sharp(bytes).metadata()).format, "webp");
  assert.equal(diagnostics.logoPreservedFromTemplate, false);
  assert.equal(diagnostics.logoApplied, true);
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
