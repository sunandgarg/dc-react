import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyDefaults,
  assertAllowedArticleConflictColumns,
  assertArticleBatchTopicsAvailable,
  assertArticleSiteScopeUnchanged,
  assertSiteScopedRowOwnership,
  decodeRow,
  findExistingUpsertRows,
  handleRest,
  insertRow,
  nextShortIdValue,
  normalizeForDatabase,
  omitDerivedFields,
  prepareStagedArticleUpsertReviews,
  resolveConflictColumns,
  upsertUpdateColumns,
} from "../src/rest.mjs";

test("returns MySQL decimal fields as JSON numbers", () => {
  const row = decodeRow("colleges", { rating: { toNumber: () => 4.75 } });
  assert.equal(row.rating, 4.75);
});

test("canonicalizes imported storage URLs at the API boundary", () => {
  const previous = process.env.MEDIA_BASE_URL;
  process.env.MEDIA_BASE_URL = "https://dekhocampus.com/storage/v1/object/public";
  try {
    const row = decodeRow("career_profiles", {
      image: "https://old-media.example/storage/v1/object/public/admin-uploads/careers/photo.webp",
    });
    assert.equal(row.image, "https://dekhocampus.com/storage/v1/object/public/admin-uploads/careers/photo.webp");
  } finally {
    if (previous === undefined) delete process.env.MEDIA_BASE_URL;
    else process.env.MEDIA_BASE_URL = previous;
  }
});

test("applies empty arrays for required PostgreSQL array fields", () => {
  const college = applyDefaults("colleges", { name: "QA College", slug: "qa-college" });

  assert.deepEqual(college.categories, []);
  assert.deepEqual(college.tags, []);
  assert.deepEqual(college.related_courses, []);
});

test("defaults required jsonb objects but leaves nullable fields alone", () => {
  const college = applyDefaults("colleges", { name: "QA College", slug: "qa-college" });

  assert.deepEqual(college.data_source_urls, {});
  assert.equal(college.parent_university_slug, undefined);
});

test("allocates short ids in the imported resource ranges", () => {
  assert.equal(nextShortIdValue("colleges", null), 10001);
  assert.equal(nextShortIdValue("courses", 24567n), 24568);
  assert.equal(nextShortIdValue("exams", 30500), 30501);
  assert.equal(nextShortIdValue("scholarships", 100), undefined);
});

test("uses primary keys for upserts without an explicit conflict target", () => {
  assert.deepEqual(resolveConflictColumns("blog_auto_agent_settings"), ["id"]);
});

test("preserves an explicit upsert conflict target", () => {
  assert.deepEqual(resolveConflictColumns("blog_research_sources", "url"), ["url"]);
});

test("upserts update only caller-supplied mutable fields", () => {
  const callerInput = { id: "row-id", url: "https://example.com", name: "New name" };
  const materializedInsert = applyDefaults("blog_research_sources", callerInput);
  assert.ok(Object.keys(materializedInsert).length > Object.keys(callerInput).length, "insert defaults should still be materialized");
  const updates = upsertUpdateColumns("blog_research_sources", callerInput, ["url"]);
  assert.deepEqual(updates, ["name"]);
  assert.ok(!updates.includes("id"));
  assert.ok(!updates.includes("url"));
  assert.ok(!updates.includes("created_at"));
});

test("blocks a scoped upsert from moving an existing ID into another workspace", () => {
  assert.throws(
    () => assertSiteScopedRowOwnership("articles", { id: "article-1", site_scope: "sarkari" }, { site_scope: "dekhocampus" }),
    (error) => error?.code === "SITE_SCOPE_CONFLICT" && error?.status === 409,
  );
  assert.doesNotThrow(() => assertSiteScopedRowOwnership("articles", { id: "article-1", site_scope: "sarkari" }, { site_scope: "sarkari" }));
  assert.doesNotThrow(() => assertSiteScopedRowOwnership("authors", { id: "author-1" }, { site_scope: "dekhocampus" }));
});

test("article topic checks preserve every candidate's scope in mixed batches", async () => {
  const queriedScopes = [];
  const existingByScope = {
    dekhocampus: [{ id: "dc-existing", title: "JEE Main 2026 Registration Dates and Application Process" }],
    sarkari: [{ id: "sarkari-existing", title: "SSC CGL 2026 Notification and Application Dates" }],
  };
  const client = {
    articles: {
      findMany: async ({ where }) => {
        queriedScopes.push(where.site_scope);
        return existingByScope[where.site_scope] || [];
      },
    },
  };

  await assert.rejects(
    assertArticleBatchTopicsAvailable([
      { site_scope: "dekhocampus", title: "NEET UG 2026 Biology Revision Plan" },
      { site_scope: "sarkari", title: "SSC CGL 2026 Application Notification and Dates" },
    ], { client }),
    (error) => error?.code === "DUPLICATE_ARTICLE" && error?.site_scope === "sarkari",
  );
  assert.deepEqual(queriedScopes, ["dekhocampus", "sarkari"]);
});

test("article topic checks allow matching coverage in the other tenant only", async () => {
  const client = {
    articles: {
      findMany: async ({ where }) => where.site_scope === "dekhocampus"
        ? [{ id: "dc-existing", title: "SSC CGL 2026 Notification and Application Dates" }]
        : [],
    },
  };
  await assert.doesNotReject(assertArticleBatchTopicsAvailable([
    { site_scope: "sarkari", title: "SSC CGL 2026 Application Notification and Dates" },
  ], { client }));
});

test("exact article upsert targets supply only their own ID to the strict gate", async () => {
  const existing = {
    id: "persisted-article-id",
    site_scope: "sarkari",
    slug: "ssc-cgl-2026-notification",
    title: "SSC CGL 2026 Notification and Application Dates",
  };
  const rawClient = {
    $queryRawUnsafe: async (sql, ...params) => {
      if (sql.includes("`site_scope` = ?") && sql.includes("`slug` = ?")
        && params[0] === "sarkari" && params[1] === existing.slug) return [existing];
      return [];
    },
  };
  const candidate = { ...existing, id: "incoming-import-id" };
  const [matches] = await findExistingUpsertRows(
    "articles",
    [candidate],
    ["site_scope", "slug"],
    rawClient,
    { lock: true },
  );
  assert.deepEqual(matches.map((row) => row.id), [existing.id]);

  const coverageClient = { articles: { findMany: async () => [existing] } };
  await assert.doesNotReject(assertArticleBatchTopicsAvailable([candidate], {
    client: coverageClient,
    excludeIdsByCandidate: [[existing.id]],
  }));
  await assert.rejects(
    assertArticleBatchTopicsAvailable([candidate], { client: coverageClient }),
    (error) => error?.code === "DUPLICATE_ARTICLE",
  );
});

test("article upserts accept only exact safe conflict targets", () => {
  assert.doesNotThrow(() => assertAllowedArticleConflictColumns("articles", ["id"]));
  assert.doesNotThrow(() => assertAllowedArticleConflictColumns("articles", ["site_scope", "slug"]));
  assert.throws(
    () => assertAllowedArticleConflictColumns("articles", ["slug"]),
    (error) => error?.code === "INVALID_ARTICLE_CONFLICT_TARGET" && error?.status === 400,
  );
  assert.throws(
    () => assertAllowedArticleConflictColumns("articles", ["slug", "site_scope"]),
    (error) => error?.code === "INVALID_ARTICLE_CONFLICT_TARGET",
  );
  assert.throws(
    () => assertAllowedArticleConflictColumns("articles", ["id"], "bogus"),
    (error) => error?.code === "INVALID_ARTICLE_CONFLICT_TARGET",
  );
  assert.throws(
    () => assertAllowedArticleConflictColumns("articles", ["site_scope", "slug"], "site_scope,slug,bogus"),
    (error) => error?.code === "INVALID_ARTICLE_CONFLICT_TARGET",
  );
  assert.doesNotThrow(() => assertAllowedArticleConflictColumns("leads", ["email"]));
});

test("REST rejects malformed raw article conflict targets before touching the database", async () => {
  const request = new Request("http://localhost/rest/v1/articles?on_conflict=site_scope,slug,bogus", {
    method: "POST",
    headers: { "content-type": "application/json", prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ site_scope: "sarkari", slug: "ssc-cgl-2026", title: "SSC CGL 2026" }),
  });
  await assert.rejects(
    handleRest("articles", request),
    (error) => error?.code === "INVALID_ARTICLE_CONFLICT_TARGET" && error?.status === 400,
  );
});

test("REST caps article write batches before acquiring database locks", async () => {
  const request = new Request("http://localhost/rest/v1/articles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(Array.from({ length: 51 }, (_, index) => ({
      site_scope: "sarkari",
      slug: `batch-article-${index}`,
      title: `Batch article ${index}`,
    }))),
  });
  await assert.rejects(
    handleRest("articles", request),
    (error) => error?.code === "ARTICLE_BATCH_TOO_LARGE" && error?.status === 413,
  );
});

test("exact scoped conflict lookup accepts same-tenant rows and ignores another tenant's same slug", async () => {
  const existing = { id: "dc-article", site_scope: "dekhocampus", slug: "shared-slug" };
  const client = {
    $queryRawUnsafe: async (sql, ...params) => {
      if (sql.includes("`site_scope` = ?") && sql.includes("`slug` = ?") && params[0] === "dekhocampus") return [existing];
      return [];
    },
  };
  const [sameTenant] = await findExistingUpsertRows(
    "articles",
    [{ id: existing.id, site_scope: "dekhocampus", slug: existing.slug }],
    ["site_scope", "slug"],
    client,
  );
  assert.equal(sameTenant[0].id, existing.id);
  const [otherTenant] = await findExistingUpsertRows(
    "articles",
    [{ id: "incoming", site_scope: "sarkari", slug: existing.slug }],
    ["site_scope", "slug"],
    client,
  );
  assert.deepEqual(otherTenant, []);
});

test("article upsert returns the persisted ID and updates only explicit fields", async () => {
  const stored = {
    id: "persisted-article-id",
    site_scope: "sarkari",
    slug: "ssc-cgl-2026-notification",
    title: "Old title",
    created_at: "2026-01-01T00:00:00.000Z",
  };
  const writes = [];
  const client = {
    $queryRawUnsafe: async (sql, ...params) => {
      if (sql.includes("`site_scope` = ?") && sql.includes("`slug` = ?")
        && params[0] === stored.site_scope && params[1] === stored.slug) return [{ ...stored }];
      return [];
    },
    $executeRawUnsafe: async (sql) => {
      writes.push(sql);
      stored.title = "Updated title";
      return 2;
    },
  };
  const result = await insertRow("articles", {
    site_scope: stored.site_scope,
    slug: stored.slug,
    title: "Updated title",
  }, true, ["site_scope", "slug"], client);

  assert.equal(result.id, stored.id);
  assert.equal(result.title, "Updated title");
  assert.equal(writes.length, 1);
  assert.match(writes[0], /^UPDATE `articles` SET `title` = \?/);
  assert.doesNotMatch(writes[0], /ON DUPLICATE KEY UPDATE/);
});

test("no-op article upsert returns the existing persisted row without a fake update", async () => {
  const stored = { id: "persisted-article-id", site_scope: "sarkari", slug: "ssc-cgl-2026-notification", title: "Existing title" };
  let writes = 0;
  const client = {
    $queryRawUnsafe: async (sql, ...params) => (
      sql.includes("`site_scope` = ?") && sql.includes("`slug` = ?")
      && params[0] === stored.site_scope && params[1] === stored.slug ? [{ ...stored }] : []
    ),
    $executeRawUnsafe: async () => { writes += 1; },
  };
  const result = await insertRow("articles", {
    site_scope: stored.site_scope,
    slug: stored.slug,
  }, true, ["site_scope", "slug"], client);
  assert.equal(result.id, stored.id);
  assert.equal(result.title, stored.title);
  assert.equal(writes, 0);
});

test("article id-target upsert rejects an existing composite slug before writing", async () => {
  const existingBySlug = { id: "slug-owner", site_scope: "sarkari", slug: "ssc-cgl-2026", title: "Existing" };
  let writes = 0;
  const client = {
    $queryRawUnsafe: async (sql, ...params) => {
      if (sql.includes("`site_scope` = ?") && sql.includes("`slug` = ?")
        && params[0] === "sarkari" && params[1] === existingBySlug.slug) return [existingBySlug];
      return [];
    },
    $executeRawUnsafe: async () => { writes += 1; },
  };
  await assert.rejects(
    insertRow("articles", {
      id: "new-id",
      site_scope: "sarkari",
      slug: existingBySlug.slug,
      title: "New title",
    }, true, ["id"], client),
    (error) => error?.code === "ARTICLE_NON_TARGET_UNIQUE_CONFLICT" && error?.status === 409,
  );
  assert.equal(writes, 0);
});

test("article upsert rejects when its id and scoped slug belong to different rows", async () => {
  const byId = { id: "article-a", site_scope: "sarkari", slug: "slug-a", title: "Article A" };
  const bySlug = { id: "article-b", site_scope: "sarkari", slug: "slug-b", title: "Article B" };
  let writes = 0;
  const client = {
    $queryRawUnsafe: async (sql, ...params) => {
      if (sql.includes("WHERE `id` = ?") && params[0] === byId.id) return [byId];
      if (sql.includes("`site_scope` = ?") && sql.includes("`slug` = ?")
        && params[0] === "sarkari" && params[1] === bySlug.slug) return [bySlug];
      return [];
    },
    $executeRawUnsafe: async () => { writes += 1; },
  };
  await assert.rejects(
    insertRow("articles", {
      id: byId.id,
      site_scope: "sarkari",
      slug: bySlug.slug,
      title: "Ambiguous update",
    }, true, ["site_scope", "slug"], client),
    (error) => error?.code === "UPSERT_TARGET_CONFLICT" && error?.status === 409,
  );
  assert.equal(writes, 0);
});

test("non-article tables retain generic merge-upsert behavior", async () => {
  const stored = { id: "source-id", url: "https://example.com/feed", name: "Updated source" };
  const writes = [];
  const client = {
    $queryRawUnsafe: async (sql, ...params) => (
      sql.includes("WHERE `url` = ?") && params[0] === stored.url ? [{ ...stored }] : []
    ),
    $executeRawUnsafe: async (sql) => { writes.push(sql); return 2; },
  };
  const result = await insertRow("blog_research_sources", {
    url: stored.url,
    name: stored.name,
  }, true, ["url"], client);
  assert.equal(result.id, stored.id);
  assert.equal(writes.length, 1);
  assert.match(writes[0], /ON DUPLICATE KEY UPDATE `name` = VALUES\(`name`\)/);
});

test("article PATCH scope validation permits a no-op and rejects workspace moves", () => {
  const existing = [{ id: "article-1", site_scope: "dekhocampus" }];
  assert.doesNotThrow(() => assertArticleSiteScopeUnchanged({ site_scope: "dekhocampus" }, existing));
  assert.doesNotThrow(() => assertArticleSiteScopeUnchanged({ title: "Retitled" }, existing));
  assert.throws(
    () => assertArticleSiteScopeUnchanged({ site_scope: "sarkari" }, existing),
    (error) => error?.code === "ARTICLE_SITE_SCOPE_IMMUTABLE" && error?.status === 409,
  );
});

test("staged article upserts produce real update reviews without phantom defaults", () => {
  const existing = {
    id: "persisted-article-id",
    site_scope: "sarkari",
    slug: "ssc-cgl-2026-notification",
    title: "Old title",
    content: "Keep this existing content",
    views: 91,
    created_at: "2026-01-01T00:00:00.000Z",
  };
  const explicit = {
    site_scope: "sarkari",
    slug: existing.slug,
    title: "Updated title",
  };
  const materialized = applyDefaults("articles", explicit);
  assert.notEqual(materialized.id, existing.id);
  const reviews = prepareStagedArticleUpsertReviews(
    [explicit],
    [materialized],
    [[existing]],
    ["site_scope", "slug"],
  );

  assert.deepEqual(reviews.creates, []);
  assert.deepEqual(reviews.updatesBefore, [existing]);
  assert.equal(reviews.updatesAfter[0].id, existing.id);
  assert.equal(reviews.updatesAfter[0].title, explicit.title);
  assert.equal(reviews.updatesAfter[0].content, existing.content);
  assert.equal(reviews.updatesAfter[0].views, existing.views);
  assert.deepEqual(reviews.excludeIdsByCandidate, [[existing.id]]);
  assert.equal(reviews.responseRows[0].id, existing.id);
});

test("staged article upserts retain true creates separately in mixed batches", () => {
  const existing = { id: "existing-id", site_scope: "dekhocampus", slug: "existing", title: "Existing" };
  const explicit = [
    { site_scope: "dekhocampus", slug: "existing", title: "Retitled" },
    { site_scope: "sarkari", slug: "new-job", title: "New job" },
  ];
  const staged = explicit.map((row) => applyDefaults("articles", row));
  const reviews = prepareStagedArticleUpsertReviews(
    explicit,
    staged,
    [[existing], []],
    ["site_scope", "slug"],
  );
  assert.equal(reviews.updatesAfter.length, 1);
  assert.equal(reviews.updatesAfter[0].id, existing.id);
  assert.equal(reviews.creates.length, 1);
  assert.equal(reviews.creates[0].site_scope, "sarkari");
  assert.deepEqual(reviews.responseRows.map((row) => row.id), [existing.id, staged[1].id]);
});

test("stores blank optional dates as null for MySQL", () => {
  assert.equal(normalizeForDatabase("", { type: "DateTime", nullable: true, format: "date" }), null);
  assert.equal(normalizeForDatabase("2026-08-27", { type: "DateTime", nullable: true, format: "date" }), "2026-08-27");
});

test("materializes SQL current-date defaults before raw inserts", () => {
  const university = applyDefaults("universities", { name: "QA University" });
  assert.match(university.daily_count_reset_at, /^\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(university.daily_count_reset_at, "CURRENT_DATE");
});

test("does not accept manually supplied college course counts", () => {
  assert.deepEqual(
    omitDerivedFields("colleges", { slug: "qa-college", courses_count: 999 }),
    { slug: "qa-college" },
  );
  assert.deepEqual(
    omitDerivedFields("courses", { slug: "mba", courses_count: 999 }),
    { slug: "mba", courses_count: 999 },
  );
});

test("article slug retirement verifies the exact ordered unique replacement", async () => {
  const source = await readFile(new URL("../scripts/apply-mysql-parity.mjs", import.meta.url), "utf8");
  assert.match(source, /NON_UNIQUE AS nonUnique/);
  assert.match(source, /replacementRows\.length === 2/);
  assert.match(source, /replacementRows\.every\(\(row\) => Number\(row\.nonUnique\) === 0 && row\.subPart === null\)/);
  assert.match(source, /replacementColumns\[0\] === "site_scope"/);
  assert.match(source, /replacementColumns\[1\] === "slug"/);
});
