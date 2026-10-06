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
