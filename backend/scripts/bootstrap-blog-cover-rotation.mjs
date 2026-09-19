#!/usr/bin/env node

import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  BLOG_COVER_ROTATION_VERSION,
  BLOG_COVER_TEMPLATE_COUNT,
  blogCoverRotationObjectPath,
  blogCoverRotationStateKey,
  blogCoverRotationTemplateKey,
  createLocalEditorialCover,
  createReusableBlogCoverTemplate,
  downloadBlogCoverSource,
  resolveBlogMediaSource,
} from "../src/blog-ai.mjs";
import { prisma } from "../src/db.mjs";
import { uploadStorageObject } from "../src/storage.mjs";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const assertClean = args.has("--assert-clean");
const siteScope = "dekhocampus";
const dimensions = { width: 1600, height: 900 };
const candidateLimit = 300;
const generatedAt = new Date().toISOString();

async function analyzeTemplate(bytes) {
  const metadata = await sharp(bytes).metadata();
  const stats = await sharp(bytes).stats();
  const center = await sharp(bytes)
    .extract({ left: 790, top: 440, width: 20, height: 20 })
    .removeAlpha()
    .raw()
    .toBuffer();
  const centerMinimum = Math.min(...center);
  if (metadata.format !== "webp" || metadata.width !== dimensions.width || metadata.height !== dimensions.height) {
    throw new Error(`Template metadata is ${metadata.format} ${metadata.width}x${metadata.height}`);
  }
  if (centerMinimum < 225) throw new Error(`Template did not fully clear the previous headline panel (${centerMinimum})`);
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    bytes: bytes.length,
    entropy: Number((stats.entropy || 0).toFixed(3)),
    center_minimum: centerMinimum,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function validatePublishedTemplate(templateKey) {
  const url = `${resolveBlogMediaSource(templateKey)}?library=${encodeURIComponent(generatedAt)}`;
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
      if (!response.ok) throw new Error(`public read returned ${response.status}`);
      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      if (!contentType.startsWith("image/webp")) throw new Error(`public read returned ${contentType || "an unknown content type"}`);
      return analyzeTemplate(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function buildTemplates() {
  const candidates = await prisma.articles.findMany({
    where: {
      site_scope: siteScope,
      status: "Published",
      is_active: true,
      featured_image: { not: "" },
    },
    select: { id: true, title: true, slug: true, featured_image: true, created_at: true },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: candidateLimit,
  });
  const templates = [];
  const failures = [];
  const seenSources = new Set();

  for (const article of candidates) {
    if (templates.length >= BLOG_COVER_TEMPLATE_COUNT) break;
    const source = String(article.featured_image || "").trim();
    if (!source || seenSources.has(source)) continue;
    seenSources.add(source);
    try {
      const sourceBytes = await downloadBlogCoverSource(source, `Article cover ${article.slug}`);
      const sourceMetadata = await sharp(sourceBytes, { limitInputPixels: 50_000_000 }).metadata();
      if ((sourceMetadata.width || 0) < 600 || (sourceMetadata.height || 0) < 300) {
        throw new Error(`source is too small (${sourceMetadata.width || 0}x${sourceMetadata.height || 0})`);
      }
      const bytes = await createReusableBlogCoverTemplate(sourceBytes, dimensions);
      const analysis = await analyzeTemplate(bytes);
      templates.push({
        index: templates.length + 1,
        bytes,
        source_type: "recent-published-article",
        source_article_id: article.id,
        source_article_slug: article.slug,
        source_article_title: article.title,
        source_image: source,
        source_created_at: article.created_at.toISOString(),
        source_dimensions: `${sourceMetadata.width}x${sourceMetadata.height}`,
        analysis,
      });
    } catch (error) {
      failures.push({
        article_id: article.id,
        slug: article.slug,
        source,
        message: String(error?.message || error).slice(0, 300),
      });
    }
  }

  while (templates.length < BLOG_COVER_TEMPLATE_COUNT) {
    const index = templates.length + 1;
    const local = await createLocalEditorialCover(`DekhoCampus reusable cover ${index}`, {
      ...dimensions,
      templateIndex: index,
    });
    const bytes = await createReusableBlogCoverTemplate(local, dimensions);
    templates.push({
      index,
      bytes,
      source_type: "bundled-zero-cost-fallback",
      source_article_id: null,
      source_article_slug: null,
      source_article_title: null,
      source_image: null,
      source_created_at: null,
      source_dimensions: `${dimensions.width}x${dimensions.height}`,
      analysis: await analyzeTemplate(bytes),
    });
  }

  return { candidates, templates, failures };
}

async function main() {
  const { candidates, templates, failures } = await buildTemplates();
  const recentCount = templates.filter((template) => template.source_type === "recent-published-article").length;
  const fallbackCount = templates.length - recentCount;
  const report = {
    ok: templates.length === BLOG_COVER_TEMPLATE_COUNT,
    mode: apply ? "apply" : "dry-run",
    site_scope: siteScope,
    library_version: BLOG_COVER_ROTATION_VERSION,
    candidate_articles_scanned: candidates.length,
    templates_prepared: templates.length,
    recent_article_designs: recentCount,
    bundled_fallback_designs: fallbackCount,
    rejected_source_images: failures.length,
    openai_image_calls: 0,
    image_generation_api_cost_usd: 0,
    templates: templates.map(({ bytes, ...template }) => ({
      ...template,
      template_key: blogCoverRotationTemplateKey(template.index),
    })),
    source_failures: failures.slice(0, 50),
  };

  console.log(JSON.stringify({ phase: "analysis", ...report }, null, 2));
  if (!report.ok || !apply) return report;

  const published = [];
  for (const template of templates) {
    const upload = await uploadStorageObject(
      "admin-uploads",
      blogCoverRotationObjectPath(template.index),
      template.bytes,
      "image/webp",
      { upsert: true, cacheControl: "public,max-age=31536000,immutable" },
    );
    const validation = await validatePublishedTemplate(upload.key);
    published.push({ index: template.index, key: upload.key, public_url: upload.publicUrl, validation });
    if (template.index % 10 === 0 || template.index === BLOG_COVER_TEMPLATE_COUNT) {
      console.log(JSON.stringify({ phase: "upload-progress", completed: template.index, total: BLOG_COVER_TEMPLATE_COUNT }));
    }
  }

  const manifest = {
    version: BLOG_COVER_ROTATION_VERSION,
    generated_at: generatedAt,
    site_scope: siteScope,
    strategy: "strict-round-robin",
    template_count: BLOG_COVER_TEMPLATE_COUNT,
    openai_image_calls: 0,
    templates: report.templates,
  };
  const manifestUpload = await uploadStorageObject(
    "admin-uploads",
    `blog-templates/${BLOG_COVER_ROTATION_VERSION}/manifest.json`,
    Buffer.from(JSON.stringify(manifest, null, 2)),
    "application/json",
    { upsert: true, cacheControl: "public,max-age=300,must-revalidate" },
  );

  const settingsUpdated = await prisma.$transaction(async (tx) => {
    const updated = await tx.blog_auto_agent_settings.updateMany({
      where: { id: "default" },
      data: { image_mode: "rotation", updated_at: new Date() },
    });
    if (updated.count !== 1) throw new Error("Auto Blog Agent default settings are missing");
    await tx.app_settings.upsert({
      where: { key: `blog-cover-library:${BLOG_COVER_ROTATION_VERSION}` },
      update: { value: JSON.stringify({ ...manifest, templates: report.templates.map((item) => ({ index: item.index, template_key: item.template_key, analysis: item.analysis })) }), updated_at: new Date() },
      create: { key: `blog-cover-library:${BLOG_COVER_ROTATION_VERSION}`, value: JSON.stringify({ ...manifest, templates: report.templates.map((item) => ({ index: item.index, template_key: item.template_key, analysis: item.analysis })) }) },
    });
    const cursorKey = blogCoverRotationStateKey(siteScope);
    const existingCursor = await tx.app_settings.findUnique({ where: { key: cursorKey } });
    if (!existingCursor) {
      await tx.app_settings.create({
        data: {
          key: cursorKey,
          value: JSON.stringify({ version: BLOG_COVER_ROTATION_VERSION, last_index: 0, allocations: 0, updated_at: generatedAt }),
        },
      });
    }
    return updated.count;
  });

  const activeSettings = await prisma.blog_auto_agent_settings.findUnique({ where: { id: "default" }, select: { image_mode: true } });
  const complete = {
    ...report,
    mode: "apply",
    published_templates: published.length,
    manifest_key: manifestUpload.key,
    settings_updated: settingsUpdated,
    active_image_mode: activeSettings?.image_mode || null,
    public_validation_failures: published.filter((item) => item.validation.format !== "webp").length,
  };
  complete.ok = complete.published_templates === BLOG_COVER_TEMPLATE_COUNT
    && complete.active_image_mode === "rotation"
    && complete.public_validation_failures === 0;
  console.log(JSON.stringify({ phase: "complete", ...complete }, null, 2));
  if (assertClean && !complete.ok) process.exitCode = 1;
  return complete;
}

try {
  const result = await main();
  if (assertClean && !result.ok) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
