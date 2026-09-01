#!/usr/bin/env node

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { blogLimits, createBlogCover, DEFAULT_BLOG_COVER_TEMPLATE_KEY, handleBlogStudio, runBlogAgent } from "../src/blog-ai.mjs";
import { prisma } from "../src/db.mjs";
import { toStoredMediaKeys } from "../src/media-values.mjs";
import { deleteStorageObjectKeys } from "../src/storage.mjs";

const testSlug = `codex-blog-agent-smoke-${Date.now()}`;
let coverUrl = "";
let generatedArticleCoverUrl = "";
let runId = "";
let createdArticleIds = [];
let createdArticleSlugs = [];
let createdFaqCount = 0;
let originalSettings = null;
const coverDiagnostics = {};

async function cleanupRecentOrphanArticleFaqs() {
  const cutoff = new Date(Date.now() - 6 * 60 * 60_000);
  const recentFaqs = await prisma.faqs.findMany({
    where: { page: "articles", created_at: { gte: cutoff }, item_slug: { not: null } },
    select: { id: true, item_slug: true },
  });
  const slugs = [...new Set(recentFaqs.map((faq) => faq.item_slug).filter(Boolean))];
  if (!slugs.length) return 0;

  const articles = await prisma.articles.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true },
  });
  const articleSlugs = new Set(articles.map((article) => article.slug));
  const orphanIds = recentFaqs
    .filter((faq) => faq.item_slug && !articleSlugs.has(faq.item_slug))
    .map((faq) => faq.id);
  if (!orphanIds.length) return 0;

  const deleted = await prisma.faqs.deleteMany({ where: { id: { in: orphanIds } } });
  assert.equal(deleted.count, orphanIds.length, "Recent orphan article FAQ cleanup was incomplete");
  return deleted.count;
}

async function diagnostics() {
  const [settings, controls, recentRuns, providers] = await Promise.all([
    prisma.blog_auto_agent_settings.findUnique({ where: { id: "default" } }),
    prisma.ai_runtime_controls.findMany({ where: { feature: { in: ["global", "blog-agent", "blog-studio", "blog-cover"] } }, select: { feature: true, provider: true, model: true, is_enabled: true, stop_reason: true } }),
    prisma.blog_auto_agent_runs.findMany({ orderBy: { started_at: "desc" }, take: 5, select: { id: true, status: true, trigger_type: true, started_at: true, finished_at: true, current_step: true, message: true } }),
    prisma.ai_providers.findMany({ where: { provider_name: { in: ["gemini", "openai"] } }, select: { provider_name: true, default_model: true, is_active: true } }),
  ]);
  console.log(JSON.stringify({
    diagnostic: {
      settings: settings ? {
        enabled: settings.enabled,
        interval_minutes: settings.interval_minutes,
        posts_per_run: settings.posts_per_run,
        daily_post_cap: settings.daily_post_cap,
        image_mode: settings.image_mode,
        include_logo: settings.include_logo,
        has_template: Boolean(settings.image_template_url),
        has_logo: Boolean(settings.logo_url),
      } : null,
      controls,
      providers,
      recent_runs: recentRuns,
    },
  }, null, 2));
  assert.ok(settings, "Auto Blog Agent settings are missing");
  return settings;
}

async function waitForScheduledRun() {
  for (let attempt = 0; attempt < 96; attempt += 1) {
    const active = await prisma.blog_auto_agent_runs.findFirst({ where: { status: "running" }, select: { id: true, trigger_type: true, started_at: true } });
    if (!active) return;
    if (attempt === 0) console.log(JSON.stringify({ waiting_for_existing_run: active }));
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error("An existing blog-agent run did not finish within eight minutes");
}

try {
  const repairedOrphanFaqs = await cleanupRecentOrphanArticleFaqs();
  if (repairedOrphanFaqs) console.log(JSON.stringify({ repaired_orphan_article_faqs: repairedOrphanFaqs }));
  originalSettings = await diagnostics();
  const disabledControl = await prisma.ai_runtime_controls.findFirst({
    where: { feature: { in: ["global", "blog-agent", "blog-studio", "blog-cover"] }, is_enabled: false },
  });
  assert.equal(disabledControl, null, `AI control ${disabledControl?.feature} is disabled`);
  await waitForScheduledRun();
  originalSettings = await prisma.blog_auto_agent_settings.findUnique({ where: { id: "default" } });

  await prisma.blog_auto_agent_settings.update({
    where: { id: "default" },
    data: {
      enabled: true,
      posts_per_run: 1,
      daily_post_cap: blogLimits.MAX_DAILY_POSTS,
      human_review_required: true,
      publish_status: "Draft",
      image_mode: "template",
      image_template_url: originalSettings.image_template_url,
    },
  });

  const result = await runBlogAgent({ trigger_type: "production-smoke" });
  let article;
  let verificationMode = "agent-draft";
  if (result.skipped && result.message === "Daily post cap reached") {
    verificationMode = "studio-draft-daily-cap-fallback";
    const studio = await handleBlogStudio({ json: async () => ({
      topic: `Indian student admission planning guide ${testSlug}`,
      word_limit: 900,
      image: { mode: "template", template_url: originalSettings.image_template_url },
    }) });
    assert.match(studio.model_used, /^openai:gpt-5-nano$/, "Blog Studio did not use OpenAI GPT-5 nano");
    article = studio.draft;
  } else {
    assert.equal(result.success, true, result.message || "Blog-agent smoke run was not successful");
    runId = String(result.run_id || "");
    createdArticleIds = result.created_article_ids || [];
    assert.equal(createdArticleIds.length, 1, "Blog agent did not create exactly one smoke-test draft");
    article = await prisma.articles.findUnique({ where: { id: createdArticleIds[0] } });
    assert.ok(article, "Generated smoke-test article was not saved in AWS MySQL");
    assert.equal(article.status, "Draft");
    createdArticleSlugs = [article.slug];
    createdFaqCount = await prisma.faqs.count({ where: { page: "articles", item_slug: article.slug, is_active: true } });
    assert.ok(createdFaqCount >= 4, `Generated article stored only ${createdFaqCount} dedicated FAQs`);
  }
  const articleContent = String(article.content || article.content_html || "");
  assert.match(articleContent, /<\w+/i, "Generated article has no HTML content");
  assert.match(articleContent, /frequently asked|<h[2-4][^>]*>\s*faqs?/i, "Generated article has no visible FAQ section");
  assert.doesNotMatch(articleContent, /<h[2-4][^>]*>\s*(sources?|references?|citations?)\b/i, "Generated article exposes a source section");
  assert.doesNotMatch(articleContent, /\[(?:source|citation)\s*\d+\]/i, "Generated article exposes citation markers");
  assert.doesNotMatch(articleContent, /href=["']https?:\/\//i, "Generated article exposes external source links");
  generatedArticleCoverUrl = String(article.featured_image || "");
  assert.match(generatedArticleCoverUrl, /^https:\/\//, "Scheduled agent did not save a public cover URL");
  const generatedCoverResponse = await fetch(generatedArticleCoverUrl, { signal: AbortSignal.timeout(30_000) });
  assert.equal(generatedCoverResponse.ok, true, `Scheduled agent cover is not publicly readable (${generatedCoverResponse.status})`);
  const generatedCoverBytes = Buffer.from(await generatedCoverResponse.arrayBuffer());
  const generatedMetadata = await sharp(generatedCoverBytes).metadata();
  const generatedBottomCenter = await sharp(generatedCoverBytes)
    .extract({ left: Math.floor(generatedMetadata.width / 2), top: Math.floor(generatedMetadata.height * 0.91), width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer();
  assert.ok([...generatedBottomCenter].every((channel) => channel > 220), "Scheduled agent cover contains the retired dark-panel composition");

  const coverMode = originalSettings.image_mode === "template" && originalSettings.image_template_url ? "template" : "generated";
  assert.equal(coverMode, "template", "Production is not configured to use the saved blog cover template");
  assert.equal(originalSettings.image_template_url, DEFAULT_BLOG_COVER_TEMPLATE_KEY, "Production points to an unexpected blog cover template");
  coverUrl = await createBlogCover(testSlug, "Indian higher education admissions and student success", {
    imageMode: coverMode,
    templateUrl: originalSettings.image_template_url,
    promptStyle: originalSettings.image_prompt_style || "Clean credible education editorial photography, natural colors",
    includeLogo: originalSettings.include_logo,
    logoUrl: originalSettings.logo_url,
    aspectRatio: originalSettings.image_aspect_ratio,
    resolution: originalSettings.output_resolution,
    diagnostics: coverDiagnostics,
  });
  assert.match(coverUrl, /^https:\/\//);
  const coverResponse = await fetch(coverUrl, { signal: AbortSignal.timeout(30_000) });
  assert.equal(coverResponse.ok, true, `Generated AWS cover is not publicly readable (${coverResponse.status})`);
  assert.match(String(coverResponse.headers.get("content-type")), /^image\/webp/);
  assert.ok((await coverResponse.arrayBuffer()).byteLength > 10_000, "Generated cover is unexpectedly small");
  assert.equal(coverDiagnostics.sourceMode, "template", coverDiagnostics.templateError || "Production cover did not use the saved template");
  assert.equal(coverDiagnostics.logoPreservedFromTemplate, true, "The template's embedded logo was not preserved");
  assert.equal(coverDiagnostics.logoApplied, undefined, "A second logo was unexpectedly applied over the saved template");

  console.log(JSON.stringify({
    ok: true,
    openai_blog: `${verificationMode} verified with GPT-5 nano`,
    article_faqs: verificationMode === "agent-draft" ? `${createdFaqCount} visible and dedicated FAQ records verified` : "visible FAQ section verified",
    source_policy: "no source sections, citation markers, or external source links",
    cover: `${coverDiagnostics.sourceMode || coverMode}, rendered as WebP, uploaded to AWS S3, and fetched publicly`,
    scheduled_cover: "branded template with light lower canvas verified",
    template_fallback_reason: coverDiagnostics.templateError || null,
    generated_fallback_reason: coverDiagnostics.generatedError || null,
    logo_applied: Boolean(coverDiagnostics.logoApplied),
    template_logo_preserved: Boolean(coverDiagnostics.logoPreservedFromTemplate),
    logo_fallback_reason: coverDiagnostics.logoError || null,
    cleanup: "pending",
  }, null, 2));
} finally {
  const cleanupErrors = [];
  let deletedFaqCount = 0;
  if (createdArticleSlugs.length) {
    try {
      const deleted = await prisma.faqs.deleteMany({ where: { page: "articles", item_slug: { in: createdArticleSlugs } } });
      deletedFaqCount = deleted.count;
      const remaining = await prisma.faqs.count({ where: { page: "articles", item_slug: { in: createdArticleSlugs } } });
      assert.equal(remaining, 0, "Generated article FAQs remain after cleanup");
      assert.ok(deletedFaqCount >= createdFaqCount, `Deleted only ${deletedFaqCount} of ${createdFaqCount} generated FAQs`);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (createdArticleIds.length) {
    try {
      await prisma.article_links.deleteMany({ where: { article_id: { in: createdArticleIds } } });
      await prisma.articles.deleteMany({ where: { id: { in: createdArticleIds } } });
      const remaining = await prisma.articles.count({ where: { id: { in: createdArticleIds } } });
      assert.equal(remaining, 0, "Generated smoke-test article remains after cleanup");
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (runId) {
    try {
      await prisma.blog_auto_agent_runs.deleteMany({ where: { id: runId } });
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  const coverKeys = [...new Set([coverUrl, generatedArticleCoverUrl]
    .map((url) => String(toStoredMediaKeys(url) || ""))
    .filter((key) => key && !key.includes("://")))];
  if (coverKeys.length) {
    try {
      await deleteStorageObjectKeys(coverKeys);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (originalSettings) {
    try {
      await prisma.blog_auto_agent_settings.update({
        where: { id: "default" },
        data: {
          enabled: originalSettings.enabled,
          interval_minutes: originalSettings.interval_minutes,
          posts_per_run: originalSettings.posts_per_run,
          daily_post_cap: originalSettings.daily_post_cap,
          publish_status: originalSettings.publish_status,
          human_review_required: originalSettings.human_review_required,
          image_mode: originalSettings.image_mode,
          last_run_at: originalSettings.last_run_at,
          next_run_at: originalSettings.next_run_at,
        },
      });
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  try {
    await prisma.blog_auto_agent_runs.deleteMany({ where: { trigger_type: "production-smoke", started_at: { gte: new Date(Date.now() - 60 * 60_000) } } });
  } catch (error) {
    cleanupErrors.push(error);
  }
  console.log(JSON.stringify({
    cleanup: cleanupErrors.length ? "failed" : "complete",
    test_slug: testSlug,
    generated_faqs_deleted: deletedFaqCount,
    errors: cleanupErrors.map((error) => error instanceof Error ? error.message : String(error)),
  }));
  await prisma.$disconnect();
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "Production blog-agent smoke cleanup failed");
}
