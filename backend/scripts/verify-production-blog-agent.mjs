#!/usr/bin/env node

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createBlogCover, runBlogAgent } from "../src/blog-ai.mjs";
import { prisma } from "../src/db.mjs";
import { toStoredMediaKeys } from "../src/media-values.mjs";
import { deleteStorageObjectKeys } from "../src/storage.mjs";

const testSlug = `codex-blog-agent-smoke-${Date.now()}`;
let coverUrl = "";
let runId = "";
let createdArticleIds = [];
let originalSettings = null;

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

try {
  originalSettings = await diagnostics();
  const disabledControl = await prisma.ai_runtime_controls.findFirst({
    where: { feature: { in: ["global", "blog-agent", "blog-studio", "blog-cover"] }, is_enabled: false },
  });
  assert.equal(disabledControl, null, `AI control ${disabledControl?.feature} is disabled`);

  await prisma.blog_auto_agent_settings.update({
    where: { id: "default" },
    data: {
      enabled: true,
      posts_per_run: 1,
      daily_post_cap: 48,
      human_review_required: true,
      publish_status: "Draft",
      image_mode: "none",
    },
  });

  const result = await runBlogAgent({ trigger_type: "production-smoke" });
  assert.equal(result.success, true, result.message || "Blog-agent smoke run was not successful");
  runId = String(result.run_id || "");
  createdArticleIds = result.created_article_ids || [];
  assert.equal(createdArticleIds.length, 1, "Blog agent did not create exactly one smoke-test draft");
  const article = await prisma.articles.findUnique({ where: { id: createdArticleIds[0] } });
  assert.ok(article, "Generated smoke-test article was not saved in AWS MySQL");
  assert.equal(article.status, "Draft");
  assert.match(article.content, /<\w+/i, "Generated article has no HTML content");

  const coverMode = originalSettings.image_mode === "template" && originalSettings.image_template_url ? "template" : "generated";
  coverUrl = await createBlogCover(testSlug, "Indian higher education admissions and student success", {
    imageMode: coverMode,
    templateUrl: originalSettings.image_template_url,
    promptStyle: originalSettings.image_prompt_style || "Clean credible education editorial photography, natural colors",
    includeLogo: originalSettings.include_logo,
    logoUrl: originalSettings.logo_url,
    aspectRatio: originalSettings.image_aspect_ratio,
    resolution: originalSettings.output_resolution,
  });
  assert.match(coverUrl, /^https:\/\//);
  const coverResponse = await fetch(coverUrl, { signal: AbortSignal.timeout(30_000) });
  assert.equal(coverResponse.ok, true, `Generated AWS cover is not publicly readable (${coverResponse.status})`);
  assert.match(String(coverResponse.headers.get("content-type")), /^image\/webp/);
  assert.ok((await coverResponse.arrayBuffer()).byteLength > 10_000, "Generated cover is unexpectedly small");

  console.log(JSON.stringify({
    ok: true,
    gemini_agent: "created one AWS MySQL draft",
    cover: `${coverMode}, rendered as WebP, uploaded to AWS S3, and fetched publicly`,
    logo_applied: Boolean(originalSettings.include_logo && originalSettings.logo_url),
    cleanup: "pending",
  }, null, 2));
} finally {
  if (createdArticleIds.length) {
    await prisma.article_links.deleteMany({ where: { article_id: { in: createdArticleIds } } }).catch(() => {});
    await prisma.articles.deleteMany({ where: { id: { in: createdArticleIds } } }).catch(() => {});
  }
  if (runId) await prisma.blog_auto_agent_runs.deleteMany({ where: { id: runId } }).catch(() => {});
  if (coverUrl) {
    const key = String(toStoredMediaKeys(coverUrl) || "");
    if (key && !key.includes("://")) await deleteStorageObjectKeys([key]).catch(() => {});
  }
  if (originalSettings) {
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
    }).catch(() => {});
  }
  await prisma.blog_auto_agent_runs.deleteMany({ where: { trigger_type: "production-smoke", started_at: { gte: new Date(Date.now() - 60 * 60_000) } } }).catch(() => {});
  console.log(JSON.stringify({ cleanup: "complete", test_slug: testSlug }));
  await prisma.$disconnect();
}
