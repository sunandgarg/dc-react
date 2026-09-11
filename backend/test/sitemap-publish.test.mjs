import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
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
      if (coreCount === 0 && ["colleges", "courses", "exams", "articles"].includes(table)) return [];
      const base = { slug: `${table}-sample`, short_id: 101, updated_at: new Date("2026-08-27T00:00:00Z"), image: "https://cdn.dekhocampus.com/catalog/sample.webp" };
      if (table === "colleges") return [1, 2, 3].map((number) => ({ ...base, slug: number === 1 ? base.slug : `${base.slug}-${number}`, short_id: 100 + number, state: "Delhi NCR", city: "New Delhi", type: "Private", category: "Management", logo: "https://old-origin.example/storage/v1/object/public/admin-uploads/logos/sample.webp", carousel_images: [{ url: "https://www.youtube.com/embed/not-an-image", caption: "Campus tour" }], gallery_images: [] }));
      if (table === "course_fees") return [1, 2, 3].map((number) => ({ college_slug: number === 1 ? "colleges-sample" : `colleges-sample-${number}`, course_group: "MBA" }));
      if (table === "articles") return [{ ...base, tags: ["Admissions", "https://aws-origin.dekhocampus.com/storage/v1/object/public/study-material"], featured_image: "https://cdn.dekhocampus.com/news/sample.webp" }];
      if (table === "study_subjects") return [{ ...base, id: "subject-1", class_num: 12, board_slug: "cbse" }];
      if (table === "study_chapters") return [{ ...base, subject_id: "subject-1" }];
      if (table === "college_universities") return [{ ...base, program_slug: "btech" }];
      if (table === "college_semesters") return [{ semester_num: 1, program_slug: "btech", university_slug: "sample-university", updated_at: base.updated_at }];
      if (table === "college_subjects") return [{ ...base, semester_num: 1, program_slug: "btech", university_slug: "sample-university" }];
      return [base];
    },
  };
}

function trackedDb() {
  const delegate = populatedDb();
  let active = 0;
  let peak = 0;
  return {
    client: {
      async $queryRawUnsafe(...args) {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        try {
          return await delegate.$queryRawUnsafe(...args);
        } finally {
          active -= 1;
        }
      },
    },
    peak: () => peak,
  };
}

function memoryRepository() {
  const objects = new Map([
    ["system-sitemaps/public/sitemap.xml", { body: '<?xml version="1.0"?><urlset><url><loc>https://dekhocampus.com/</loc><priority>1.0</priority></url><url><loc>https://dekhocampus.com/colleges?group=Unverified&amp;state=Nowhere</loc></url></urlset>' }],
    ["system-sitemaps/generations/old-generation/sitemap-1.xml", { body: "old", lastModified: new Date("2026-01-01T00:00:00Z") }],
  ]);
  const reads = [];
  const writes = [];
  return {
    objects,
    reads,
    writes,
    async get(key) { reads.push(key); return objects.get(key) || null; },
    async put(key, body, contentType) { writes.push(key); objects.set(key, { body, contentType, lastModified: new Date("2026-08-28T00:00:00Z") }); },
    async list(prefix) { return [...objects.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, lastModified: value.lastModified })); },
    async delete(keys) { keys.forEach((key) => objects.delete(key)); },
  };
}

test("sitemap publishing rejects incomplete core catalog data", async () => {
  await assert.rejects(
    publishSitemap(request(), { prismaClient: populatedDb(0), repository: memoryRepository() }),
    (error) => error.code === "SITEMAP_SOURCE_INCOMPLETE" && error.status === 409,
  );
});

test("DekhoCampus sitemap SQL excludes Sarkari articles", async () => {
  const source = await readFile(new URL("../src/sitemap-publish.mjs", import.meta.url), "utf8");
  assert.equal((source.match(/`site_scope` = 'dekhocampus'/g) || []).length, 1);
});

test("sitemap publishing leaves one Prisma connection free", async () => {
  const database = trackedDb();
  const result = await publishSitemap(request(), { prismaClient: database.client, repository: memoryRepository() });
  assert.equal(result.status, "published");
  assert.equal(database.peak(), 2);
  assert.deepEqual(result.source_counts, { colleges: 3, courses: 1, exams: 1, articles: 1 });
});

test("workflow publishing reads its immutable build seed instead of the large live generation", async () => {
  const repository = memoryRepository();
  const buildSeedSha = "a".repeat(40);
  const seedPrefix = `system-sitemaps/build-seeds/${buildSeedSha}`;
  repository.objects.set(`${seedPrefix}/sitemap.xml`, {
    body: '<?xml version="1.0"?><sitemapindex><sitemap><loc>https://dekhocampus.com/sitemap-1.xml</loc></sitemap></sitemapindex>',
  });
  repository.objects.set(`${seedPrefix}/sitemap-1.xml`, {
    body: '<?xml version="1.0"?><urlset><url><loc>https://dekhocampus.com/</loc></url><url><loc>https://dekhocampus.com/tools/build-owned-route</loc></url></urlset>',
  });

  const result = await publishSitemap(request({ build_seed_sha: buildSeedSha }), {
    prismaClient: populatedDb(),
    repository,
  });

  assert.equal(result.status, "published");
  assert.deepEqual(repository.reads.slice(0, 2), [`${seedPrefix}/sitemap.xml`, `${seedPrefix}/sitemap-1.xml`]);
  assert.equal(repository.reads.includes("system-sitemaps/public/sitemap.xml"), false);
  const chunk = repository.objects.get(`system-sitemaps/generations/${result.generation}/sitemap-1.xml`)?.body || "";
  assert.match(chunk, /\/tools\/build-owned-route/);
});

test("an incomplete immutable build seed leaves the live sitemap pointer unchanged", async () => {
  const repository = memoryRepository();
  const buildSeedSha = "b".repeat(40);
  const seedPrefix = `system-sitemaps/build-seeds/${buildSeedSha}`;
  const originalRoot = repository.objects.get("system-sitemaps/public/sitemap.xml").body;
  repository.objects.set(`${seedPrefix}/sitemap.xml`, {
    body: '<?xml version="1.0"?><sitemapindex><sitemap><loc>https://dekhocampus.com/sitemap-1.xml</loc></sitemap></sitemapindex>',
  });

  await assert.rejects(
    publishSitemap(request({ build_seed_sha: buildSeedSha }), { prismaClient: populatedDb(), repository }),
    (error) => error.code === "SITEMAP_SEED_INCOMPLETE" && error.status === 503,
  );
  assert.equal(repository.objects.get("system-sitemaps/public/sitemap.xml").body, originalRoot);
  assert.deepEqual(repository.writes, []);
});

test("build seed identifiers cannot escape the immutable sitemap prefix", async () => {
  const repository = memoryRepository();
  await assert.rejects(
    publishSitemap(request({ build_seed_sha: "../../public" }), { prismaClient: populatedDb(), repository }),
    (error) => error.code === "INVALID_SITEMAP_SEED" && error.status === 400,
  );
  assert.deepEqual(repository.writes, []);
});

test("sitemap publishing replaces the root index with AWS-backed immutable chunks", async () => {
  const repository = memoryRepository();
  const result = await publishSitemap(request({ target: "https://dekhocampus.com" }), {
    prismaClient: populatedDb(),
    repository,
    now: new Date("2026-08-28T00:00:00Z").getTime(),
  });
  assert.equal(result.status, "published");
  assert.ok(result.url_count > 20);
  assert.equal(result.sitemap_url, "https://dekhocampus.com/sitemap.xml");
  const index = repository.objects.get("system-sitemaps/public/sitemap.xml").body;
  assert.match(index, new RegExp(`/sitemap-files/${result.generation}/sitemap-1\\.xml`));
  const chunk = repository.objects.get(`system-sitemaps/generations/${result.generation}/sitemap-1.xml`)?.body || "";
  assert.match(chunk, /\/colleges\/colleges-sample-101<\/loc>/);
  assert.match(chunk, /\/courses\/courses-sample-101<\/loc>/);
  assert.match(chunk, /\/exams\/exams-sample-101<\/loc>/);
  assert.match(chunk, /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/);
  assert.match(chunk, /<image:loc>https:\/\/cdn\.dekhocampus\.com\/news\/sample\.webp<\/image:loc>/);
  assert.match(chunk, /<image:loc>https:\/\/dekhocampus\.com\/storage\/v1\/object\/public\/admin-uploads\/logos\/sample\.webp<\/image:loc>/);
  assert.doesNotMatch(chunk, /youtube\.com|Campus tour/);
  assert.doesNotMatch(chunk, /news\/tag\/https|aws-origin\.dekhocampus\.com/);
  assert.match(chunk, /\/colleges\?group=MBA&amp;state=Delhi\+NCR<\/loc>/);
  assert.doesNotMatch(chunk, /group=Unverified|state=Nowhere/);
  assert.match(chunk, /\/colleges\/colleges-sample-101\/overview/);
  assert.match(chunk, /\/colleges\/colleges-sample-101\/courses/);
  assert.match(chunk, /\/courses\/courses-sample-101\/eligibility/);
  assert.match(chunk, /\/exams\/exams-sample-101\/answer-key/);
  assert.match(chunk, /\/exams\/exams-sample-101\/sample-paper/);
  assert.equal(result.removed_objects, 1);
  assert.ok(result.image_count > 0);
  assert.ok(result.filter_url_count > 0);
  assert.equal(repository.writes.at(-1), "system-sitemaps/public/sitemap.xml");
  assert.ok(repository.writes.indexOf("system-sitemaps/public/manifest.json") < repository.writes.indexOf("system-sitemaps/public/sitemap.xml"));
  assert.equal(repository.objects.has("system-sitemaps/generations/old-generation/sitemap-1.xml"), false);
});

test("published sitemap files are served with XML cache headers", async () => {
  const repository = memoryRepository();
  const response = await readPublishedSitemap(new Request("https://example.com/sitemap.xml"), { repository });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /xml/);
  assert.match(await response.text(), /<urlset>/);
});

test("missing submitted generation chunks fall back to the current matching chunk", async () => {
  const repository = memoryRepository();
  const currentGeneration = "11111111-1111-4111-8111-111111111111";
  repository.objects.set("system-sitemaps/public/sitemap.xml", {
    body: `<?xml version="1.0"?><sitemapindex><sitemap><loc>https://dekhocampus.com/sitemap-files/${currentGeneration}/sitemap-1.xml</loc></sitemap></sitemapindex>`,
  });
  repository.objects.set(`system-sitemaps/generations/${currentGeneration}/sitemap-1.xml`, {
    body: '<?xml version="1.0"?><urlset><url><loc>https://dekhocampus.com/</loc></url></urlset>',
  });
  const response = await readPublishedSitemap(new Request("https://dekhocampus.com/sitemap-files/22222222-2222-4222-8222-222222222222/sitemap-1.xml"), { repository });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<urlset>/);
});
