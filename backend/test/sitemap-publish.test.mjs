import assert from "node:assert/strict";
import test from "node:test";
import { publishSitemap, readPublishedSitemap } from "../src/sitemap-publish.mjs";

const request = (body = {}) => new Request("https://api.example/v1/functions/publish-sitemap", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

function populatedDb(coreCount = 1) {
  return {
    async $queryRawUnsafe(sql) {
      if (sql.includes("COUNT(*)")) return [{ count: BigInt(coreCount) }];
      const table = sql.match(/FROM `([^`]+)`/)?.[1];
      const base = { slug: `${table}-sample`, short_id: 101, updated_at: new Date("2026-08-27T00:00:00Z") };
      if (table === "articles") return [{ ...base, tags: ["Admissions"] }];
      if (table === "study_subjects") return [{ ...base, id: "subject-1", class_num: 12, board_slug: "cbse" }];
      if (table === "study_chapters") return [{ ...base, subject_id: "subject-1" }];
      if (table === "college_universities") return [{ ...base, program_slug: "btech" }];
      if (table === "college_semesters") return [{ semester_num: 1, program_slug: "btech", university_slug: "sample-university", updated_at: base.updated_at }];
      if (table === "college_subjects") return [{ ...base, semester_num: 1, program_slug: "btech", university_slug: "sample-university" }];
      return [base];
    },
  };
}

function memoryRepository() {
  const objects = new Map([
    ["system-sitemaps/public/sitemap.xml", { body: '<?xml version="1.0"?><urlset><url><loc>https://dekhocampus.com/</loc><priority>1.0</priority></url></urlset>' }],
  ]);
  return {
    objects,
    async get(key) { return objects.get(key) || null; },
    async put(key, body, contentType) { objects.set(key, { body, contentType }); },
  };
}

test("sitemap publishing rejects incomplete core catalog data", async () => {
  await assert.rejects(
    publishSitemap(request(), { prismaClient: populatedDb(0), repository: memoryRepository() }),
    (error) => error.code === "SITEMAP_SOURCE_INCOMPLETE" && error.status === 409,
  );
});

test("sitemap publishing replaces the root index with AWS-backed immutable chunks", async () => {
  const repository = memoryRepository();
  const result = await publishSitemap(request({ target: "https://dekhocampus.com" }), {
    prismaClient: populatedDb(),
    repository,
  });
  assert.equal(result.status, "published");
  assert.ok(result.url_count > 20);
  assert.equal(result.sitemap_url, "https://dekhocampus.com/sitemap.xml");
  const index = repository.objects.get("system-sitemaps/public/sitemap.xml").body;
  assert.match(index, new RegExp(`/sitemap-files/${result.generation}/sitemap-1\\.xml`));
  assert.ok(repository.objects.has(`system-sitemaps/generations/${result.generation}/sitemap-1.xml`));
});

test("published sitemap files are served with XML cache headers", async () => {
  const repository = memoryRepository();
  const response = await readPublishedSitemap(new Request("https://example.com/sitemap.xml"), { repository });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /xml/);
  assert.match(await response.text(), /<urlset>/);
});
