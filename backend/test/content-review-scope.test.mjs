import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { applyApprovedReview, handleContentReviews, resolveArticleReviewSiteScope } from "../src/content-review.mjs";

function articleReview(overrides = {}) {
  return {
    entity_type: "articles",
    entity_id: null,
    entity_slug: "shared-government-update",
    operation: "update",
    before_json: JSON.stringify({
      slug: "shared-government-update",
      site_scope: "sarkari",
      title: "Original Sarkari article title",
    }),
    after_json: JSON.stringify({
      slug: "shared-government-update",
      site_scope: "sarkari",
      title: "Updated Sarkari article title",
    }),
    changed_fields: JSON.stringify(["title"]),
    ...overrides,
  };
}

test("article review approval derives one validated immutable tenant scope", () => {
  assert.equal(resolveArticleReviewSiteScope(articleReview()), "sarkari");
  assert.equal(resolveArticleReviewSiteScope(articleReview({
    after_json: JSON.stringify({ slug: "shared-government-update", title: "Updated title" }),
  })), "sarkari");

  assert.throws(
    () => resolveArticleReviewSiteScope(articleReview({
      after_json: JSON.stringify({ slug: "shared-government-update", site_scope: "dekhocampus" }),
    })),
    (error) => error?.code === "ARTICLE_SITE_SCOPE_IMMUTABLE",
  );
  assert.throws(
    () => resolveArticleReviewSiteScope(articleReview({
      before_json: null,
      after_json: JSON.stringify({ slug: "shared-government-update", site_scope: "unknown" }),
    })),
    (error) => error?.code === "INVALID_ARTICLE_SITE_SCOPE",
  );
  assert.throws(
    () => resolveArticleReviewSiteScope(articleReview({
      before_json: null,
      after_json: JSON.stringify({ slug: "shared-government-update" }),
    })),
    (error) => error?.code === "INVALID_ARTICLE_SITE_SCOPE",
  );
});

test("slug-fallback approval updates only the matching article tenant", async () => {
  const rows = [
    { id: "dc-article", slug: "shared-government-update", site_scope: "dekhocampus", title: "DekhoCampus title" },
    { id: "sarkari-article", slug: "shared-government-update", site_scope: "sarkari", title: "Original Sarkari article title" },
  ];
  const writes = [];
  const tx = {
    $executeRawUnsafe: async (sql, ...params) => {
      writes.push({ sql, params });
      const slug = params.at(-2);
      const siteScope = params.at(-1);
      const matching = rows.filter((row) => row.slug === slug && row.site_scope === siteScope);
      matching.forEach((row) => { row.title = params[0]; });
      return matching.length;
    },
  };

  await applyApprovedReview(tx, articleReview({
    changed_fields: JSON.stringify(["title", "site_scope"]),
  }));

  assert.match(writes[0].sql, /WHERE `slug` = \? AND `site_scope` = \?/);
  assert.doesNotMatch(writes[0].sql.split(" WHERE ")[0], /`site_scope` = \?/);
  assert.equal(rows[0].title, "DekhoCampus title");
  assert.equal(rows[1].title, "Updated Sarkari article title");
});

test("final locked review dedup receives the resolved article scope", async () => {
  const source = await readFile(new URL("../src/content-review.mjs", import.meta.url), "utf8");
  assert.match(source, /assertArticleTopicsAvailable\(\[\{ \.\.\.after, site_scope: siteScope \}\], \{[\s\S]*?siteScope,/);
  assert.match(source, /SELECT `id` FROM `articles` WHERE `site_scope` = \? AND `slug` = \? LIMIT 1/);
});

test("reviewed creates never replace an existing target id", async () => {
  const writes = [];
  const tx = {
    $queryRawUnsafe: async (sql, targetId) => {
      assert.match(sql, /WHERE `id` = \? LIMIT 1 FOR UPDATE/);
      assert.equal(targetId, "existing-article");
      return [{ 1: 1 }];
    },
    $executeRawUnsafe: async (...args) => { writes.push(args); return 1; },
  };
  const review = articleReview({
    entity_id: "existing-article",
    entity_slug: "new-article",
    operation: "create",
    before_json: null,
    after_json: JSON.stringify({
      id: "existing-article",
      slug: "new-article",
      site_scope: "sarkari",
      title: "New Sarkari article",
    }),
    changed_fields: JSON.stringify(["id", "slug", "site_scope", "title"]),
  });

  await assert.rejects(
    applyApprovedReview(tx, review),
    (error) => error?.status === 409 && error?.code === "REVIEW_CREATE_TARGET_EXISTS",
  );
  assert.equal(writes.length, 0);
});

test("zero affected rows is accepted for a scoped no-op update when the target still exists", async () => {
  const reads = [];
  const tx = {
    $executeRawUnsafe: async () => 0,
    $queryRawUnsafe: async (sql, ...params) => {
      reads.push({ sql, params });
      return [{ 1: 1 }];
    },
  };

  await assert.doesNotReject(applyApprovedReview(tx, articleReview()));
  assert.match(reads[0].sql, /WHERE `slug` = \? AND `site_scope` = \? LIMIT 1 FOR UPDATE/);
  assert.deepEqual(reads[0].params, ["shared-government-update", "sarkari"]);
});

test("zero affected rows returns 404 only when the scoped update target is absent", async () => {
  const tx = {
    $executeRawUnsafe: async () => 0,
    $queryRawUnsafe: async () => [],
  };
  await assert.rejects(
    applyApprovedReview(tx, articleReview()),
    (error) => error?.status === 404 && error?.code === "REVIEW_TARGET_NOT_FOUND",
  );
});

test("review decisions fail closed when status is missing or malformed", async () => {
  for (const body of [{ id: "review-1" }, { id: "review-1", status: "approve" }]) {
    const request = new Request("http://localhost/v1/functions/content-reviews", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    await assert.rejects(
      handleContentReviews(request, "reviewer-1"),
      (error) => error?.status === 400 && error?.code === "INVALID_REVIEW_STATUS",
    );
  }
});
