#!/usr/bin/env node

import sharp from "sharp";
import { articleCoverAudit } from "../src/article-cover-maintenance.mjs";
import { createBlogCover, DEFAULT_BLOG_COVER_TEMPLATE_KEY } from "../src/blog-ai.mjs";
import { prisma } from "../src/db.mjs";

const args = new Set(process.argv.slice(2));
const optionValue = (name, fallback = "") => {
  const prefix = `${name}=`;
  const inline = [...args].find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
};
const apply = args.has("--apply");
const assertClean = args.has("--assert-clean");
const concurrency = Math.min(4, Math.max(1, Number.parseInt(optionValue("--concurrency", "2"), 10) || 2));
const requestedLimit = Number.parseInt(optionValue("--limit", "0"), 10) || 0;
const siteScope = optionValue("--site-scope", "dekhocampus").trim();

if (siteScope !== "dekhocampus") throw new Error("This maintenance task is restricted to the dekhocampus article tenant");

async function publishedArticles() {
  return prisma.articles.findMany({
    where: { site_scope: siteScope, status: "Published", is_active: true },
    select: { id: true, title: true, slug: true, featured_image: true, created_at: true },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
  });
}

async function validateCover(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Generated cover is not publicly readable (${response.status})`);
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("image/")) throw new Error(`Generated cover returned ${contentType || "an unknown content type"}`);
  const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  if (metadata.format !== "webp" || metadata.width !== 1600 || metadata.height !== 900) {
    throw new Error(`Generated cover has unexpected media metadata: ${metadata.format} ${metadata.width}x${metadata.height}`);
  }
}

const allRows = await publishedArticles();
const audit = articleCoverAudit(allRows);
const queue = requestedLimit > 0 ? audit.candidates.slice(0, requestedLimit) : audit.candidates;
const report = {
  ok: true,
  mode: apply ? "apply" : "dry-run",
  site_scope: siteScope,
  published_articles: allRows.length,
  repair_candidates: audit.candidates.length,
  selected_for_run: queue.length,
  reason_counts: audit.reasonCounts,
  image_host_counts: audit.hostCounts,
  concurrency,
  updated: 0,
  skipped_after_race: 0,
  validated_samples: 0,
  failures: [],
  sample_candidates: queue.slice(0, 20).map(({ id, slug, title, repair_reason }) => ({ id, slug, title, repair_reason })),
};

console.log(JSON.stringify({ phase: "audit", ...report }, null, 2));

if (apply && queue.length) {
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < queue.length) {
      const index = cursor;
      cursor += 1;
      const article = queue[index];
      try {
        const diagnostics = {};
        const featuredImage = await createBlogCover(article.slug || article.id, article.title, {
          imageMode: "template",
          templateUrl: DEFAULT_BLOG_COVER_TEMPLATE_KEY,
          includeLogo: false,
          aspectRatio: "16:9",
          resolution: "web",
          diagnostics,
          siteScope,
        });
        if (report.validated_samples < 5) {
          await validateCover(featuredImage);
          report.validated_samples += 1;
        }
        const update = await prisma.articles.updateMany({
          where: { id: article.id, site_scope: siteScope, featured_image: article.featured_image },
          data: { featured_image: featuredImage, updated_at: new Date() },
        });
        if (update.count === 1) report.updated += 1;
        else report.skipped_after_race += 1;
      } catch (error) {
        report.failures.push({
          id: article.id,
          slug: article.slug,
          message: String(error?.message || error).slice(0, 500),
        });
      }
      const completed = report.updated + report.skipped_after_race + report.failures.length;
      if (completed % 25 === 0 || completed === queue.length) {
        console.log(JSON.stringify({ phase: "progress", completed, total: queue.length, updated: report.updated, failed: report.failures.length }));
      }
    }
  });
  await Promise.all(workers);
}

const remainingAudit = articleCoverAudit(await publishedArticles());
report.remaining_candidates = remainingAudit.candidates.length;
report.ok = report.failures.length === 0 && (!apply || !assertClean || report.remaining_candidates === 0);
console.log(JSON.stringify({ phase: "complete", ...report }, null, 2));

await prisma.$disconnect();
if (!report.ok) process.exitCode = 1;
