import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/db.mjs";
import { normalizeArticleEntityLinks } from "../src/article-entity-links.mjs";
import { applyApprovedReview } from "../src/content-review.mjs";
import { handleRest } from "../src/rest.mjs";

const article = {
  id: "article-for-tags", site_scope: "dekhocampus", slug: "article-for-tags",
  title: "Article for tags", description: "Description", content: "Content",
  status: "Draft", is_active: false, author: "Writer", vertical: "Engineering", category: "Exams",
};
const entity_links = [
  { entity_type: "college", entity_slug: "chandigarh-university-10026" },
  { entity_type: "course", entity_slug: "btech-computer-science" },
  { entity_type: "exam", entity_slug: "jee-main" },
];

test("article entity links validate types, deduplicate, and reject malformed inputs", () => {
  assert.deepEqual(normalizeArticleEntityLinks([...entity_links, entity_links[0]]), entity_links);
  assert.throws(() => normalizeArticleEntityLinks([{ entity_type: "admin", entity_slug: "x" }]), /valid entity type/);
  assert.throws(() => normalizeArticleEntityLinks([{ entity_type: "exam", entity_slug: "" }]), /valid entity type/);
  assert.throws(() => normalizeArticleEntityLinks({ entity_type: "exam", entity_slug: "jee-main" }), /at most 100/);
});

test("writer and content-manager article reviews retain selected entity links", async () => {
  const execute = prisma.$executeRawUnsafe;
  const reviews = [];
  prisma.$executeRawUnsafe = async (sql, ...params) => {
    assert.match(sql, /INSERT INTO `content_change_reviews`/);
    reviews.push(JSON.parse(params[8]));
    return 1;
  };
  try {
    for (const context of [{ publishOnApproval: true }, { forceDraft: true }]) {
      const result = await handleRest("articles", new Request("http://localhost/v1/rest/articles", {
        method: "POST", headers: { prefer: "return=representation" },
        body: JSON.stringify({ ...article, entity_links }),
      }), { ...context, stageReview: true, actorUserId: "writer-or-manager", allowManualArticleTopicDuplicate: true });
      assert.equal(result.status, 202);
      assert.deepEqual(reviews.at(-1).entity_links, entity_links);
    }
  } finally {
    prisma.$executeRawUnsafe = execute;
  }
});

test("approving a new article saves its selected links after inserting the parent", async () => {
  let parentInserted = false;
  const saved = [];
  const tx = {
    $queryRawUnsafe: async () => [],
    $executeRawUnsafe: async (sql, ...params) => {
      if (sql.includes("INSERT INTO `articles`")) parentInserted = true;
      if (sql.includes("INSERT INTO `article_links`")) {
        assert.equal(parentInserted, true);
        saved.push(params.slice(1, 4));
      }
      return 1;
    },
  };
  await applyApprovedReview(tx, {
    entity_type: "articles", entity_id: article.id, operation: "create", before_json: null,
    after_json: { ...article, entity_links }, changed_fields: ["title", "entity_links"],
  });
  assert.deepEqual(saved, entity_links.map((link) => [article.id, link.entity_type, link.entity_slug]));
});

test("directly saving an article writes selected links in the same transaction", async () => {
  const transaction = prisma.$transaction;
  const saved = [];
  prisma.$transaction = async (operation) => operation({
    $queryRawUnsafe: async (sql, scope) => sql.includes("article_write_locks") ? [{ site_scope: scope }] : [],
    $executeRawUnsafe: async (sql, ...params) => {
      if (sql.includes("INSERT INTO `article_links`")) saved.push(params.slice(1, 4));
      return 1;
    },
  });
  try {
    const result = await handleRest("articles", new Request("http://localhost/v1/rest/articles", {
      method: "POST", body: JSON.stringify({ ...article, entity_links }),
    }), { allowManualArticleTopicDuplicate: true });
    assert.equal(result.status, 201);
    assert.deepEqual(saved, entity_links.map((link) => [article.id, link.entity_type, link.entity_slug]));
  } finally {
    prisma.$transaction = transaction;
  }
});

test("editing an article replaces selected tags without deleting unrelated study links", async () => {
  const transaction = prisma.$transaction;
  const writes = [];
  prisma.$transaction = async (operation) => operation({
    $queryRawUnsafe: async (sql, ...params) => {
      if (sql.includes("article_write_locks")) return [{ site_scope: params[0] }];
      if (sql.includes("FROM `articles`")) return [article];
      if (sql.includes("FROM `article_links`")) return [
        { id: "old-tag", entity_type: "college", entity_slug: "old-college" },
      ];
      return [];
    },
    $executeRawUnsafe: async (sql, ...params) => { writes.push([sql, params]); return 1; },
  });
  try {
    const result = await handleRest("articles", new Request(`http://localhost/v1/rest/articles?id=eq.${article.id}`, {
      method: "PATCH", body: JSON.stringify({ entity_links: [entity_links[2]] }),
    }), {});
    assert.equal(result.status, 200);
    assert.ok(writes.some(([sql, params]) => sql.includes("DELETE FROM `article_links`") && params[0] === "old-tag"));
    assert.ok(writes.some(([sql, params]) => sql.includes("INSERT INTO `article_links`") && params[2] === "exam" && params[3] === "jee-main"));
  } finally {
    prisma.$transaction = transaction;
  }
});

test("approving a content-manager edit applies its article tags", async () => {
  const writes = [];
  const tx = {
    $queryRawUnsafe: async (sql) => sql.includes("FROM `article_links`")
      ? [{ id: "old-tag", entity_type: "college", entity_slug: "old-college" }] : [],
    $executeRawUnsafe: async (sql, ...params) => { writes.push([sql, params]); return 1; },
  };
  await applyApprovedReview(tx, {
    entity_type: "articles", entity_id: article.id, operation: "update",
    before_json: article, after_json: { ...article, entity_links: [entity_links[2]] }, changed_fields: ["entity_links"],
  });
  assert.ok(writes.some(([sql]) => sql.includes("DELETE FROM `article_links`")));
  assert.ok(writes.some(([sql, params]) => sql.includes("INSERT INTO `article_links`") && params[2] === "exam"));
});
