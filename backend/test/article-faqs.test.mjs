import assert from "node:assert/strict";
import test from "node:test";
import { normalizeArticleFaqs, saveArticleFaqs } from "../src/article-faqs.mjs";
import { handleRest, prepareStagedArticleUpsertReviews, sanitizePublicWritePayload } from "../src/rest.mjs";
import { applyApprovedReview } from "../src/content-review.mjs";
import { canContentWriterAccess } from "../src/editor-access.mjs";
import { stampWriterByline } from "../src/writer-profile.mjs";
import { prisma } from "../src/db.mjs";

const savedId = "11111111-2222-4333-8444-555555555555";
const article = { id: "article-1", slug: "faq-test", site_scope: "dekhocampus", title: "FAQ test", status: "Draft" };
const faq = { question: "When can I apply?", answer: "Check the official admission notice." };
function mockFaqs(initial = []) {
  const rows = structuredClone(initial);
  const writes = [];
  const matches = (row, where) => Object.entries(where).every(([key, value]) =>
    typeof value === "object" ? value.in.includes(row[key]) : row[key] === value);
  return { rows, writes, model: {
    findMany: async ({ where }) => rows.filter((row) => matches(row, where)),
    findFirst: async ({ where }) => rows.find((row) => matches(row, where)) || null,
    create: async ({ data }) => { writes.push(["create", data]); rows.push(data); return data; },
    updateMany: async ({ where, data }) => { writes.push(["update", where]); rows.filter((row) => matches(row, where)).forEach((row) => Object.assign(row, data)); },
    deleteMany: async ({ where }) => { writes.push(["delete", where]); for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], where)) rows.splice(i, 1); },
  } };
}

test("FAQ payloads are validated and association/order are server-owned", () => {
  assert.deepEqual(normalizeArticleFaqs([{ ...faq, question: " Q ", page: "exams", item_slug: "other", display_order: 99 }]),
    [{ question: "Q", answer: faq.answer, display_order: 0, is_active: true }]);
  for (const invalid of [null, {}, [null], [{ ...faq, answer: " " }], [{ ...faq, question: "q".repeat(2001) }], Array(51).fill(faq),
    [{ ...faq, id: "bad" }], [{ ...faq, is_active: "yes" }], [{ ...faq, id: savedId }, { ...faq, id: savedId }]]) {
    assert.throws(() => normalizeArticleFaqs(invalid), (error) => error.code === "INVALID_ARTICLE_FAQS");
  }
  assert.equal(sanitizePublicWritePayload("articles", { title: "Test", faqs: [faq] }).faqs[0].display_order, 0);
});

test("FAQs save against the parent article, isolated by site scope", async () => {
  const store = mockFaqs();
  await saveArticleFaqs({ faqs: store.model }, { ...article, faqs: [faq] });
  await saveArticleFaqs({ faqs: store.model }, { ...article, site_scope: "sarkari", faqs: [faq] });
  assert.deepEqual(store.rows.map(({ page, item_slug }) => ({ page, item_slug })), [
    { page: "articles", item_slug: article.slug }, { page: "sarkari_articles", item_slug: article.slug },
  ]);
  assert.notEqual(store.rows[0].id, store.rows[1].id);
});

test("saved FAQ IDs cannot edit another article's FAQs", async () => {
  const store = mockFaqs([{ ...faq, id: savedId, page: "articles", item_slug: "other" }]);
  await assert.rejects(saveArticleFaqs({ faqs: store.model }, { ...article, faqs: [{ ...faq, id: savedId }] }), /does not belong/);
  assert.equal(store.writes.length, 0);
});

test("manager omissions do not delete saved FAQs, but admin removal is scoped", async () => {
  const store = mockFaqs([
    { ...faq, id: savedId, page: "articles", item_slug: article.slug },
    { ...faq, id: "another", page: "sarkari_articles", item_slug: article.slug },
  ]);
  await saveArticleFaqs({ faqs: store.model }, { ...article, faqs: [] });
  assert.equal(store.rows.length, 2);
  await saveArticleFaqs({ faqs: store.model }, { ...article, faqs: [] }, { allowDelete: true });
  assert.deepEqual(store.rows.map(({ id }) => id), ["another"]);
});

test("article slug changes move its existing FAQs without losing them", async () => {
  const store = mockFaqs([{ ...faq, id: savedId, page: "articles", item_slug: article.slug }]);
  await saveArticleFaqs({ faqs: store.model }, { ...article, slug: "renamed" }, { previousSlug: article.slug });
  assert.equal(store.rows[0].item_slug, "renamed");
});

test("unchanged articles without FAQ payloads leave FAQs alone", async () => {
  await saveArticleFaqs({}, article);
});

test("staged upserts retain FAQs along with article changes", () => {
  const result = prepareStagedArticleUpsertReviews([{ ...article, faqs: [faq] }], [article], [[article]], ["id"]);
  assert.deepEqual(result.updatesAfter[0].faqs, [faq]);
});

test("writer byline stamps retain the FAQ bundle without granting global FAQ rights", () => {
  const stamped = stampWriterByline("articles", { ...article, description: "A useful description", content: "A detailed article body about admissions.", faqs: [faq] }, { id: "neha-author", name: "Neha" }, "neha-user");
  assert.deepEqual(stamped.faqs, [faq]);
  assert.equal(stamped.author_id, "neha-author");
  assert.equal(canContentWriterAccess("faqs", "create"), false);
  assert.equal(canContentWriterAccess("articles", "edit"), false);
});

test("writer and manager submissions retain FAQs in approval, with no orphan writes", async () => {
  const execute = prisma.$executeRawUnsafe;
  const reviews = [];
  prisma.$executeRawUnsafe = async (sql, ...params) => { assert.match(sql, /INSERT INTO `content_change_reviews`/); reviews.push(JSON.parse(params[8])); return 1; };
  try {
    for (const context of [{ publishOnApproval: true }, { forceDraft: true }]) {
      const result = await handleRest("articles", new Request("http://localhost/v1/rest/articles", {
        method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify({ ...article, faqs: [faq] }),
      }), { ...context, stageReview: true, actorUserId: "writer-or-manager", allowManualArticleTopicDuplicate: true });
      assert.equal(result.status, 202);
      assert.equal(result.headers["x-dc-review-status"], "pending");
      assert.equal(reviews.at(-1).faqs[0].question, faq.question);
    }
  } finally { prisma.$executeRawUnsafe = execute; }
});

test("approved new articles insert the parent before its bundled FAQs", async () => {
  const store = mockFaqs();
  let parentInserted = false;
  const tx = { faqs: { ...store.model, create: async (args) => { assert.equal(parentInserted, true); return store.model.create(args); } },
    $queryRawUnsafe: async () => [], $executeRawUnsafe: async (sql) => { assert.match(sql, /INSERT INTO `articles`/); parentInserted = true; return 1; } };
  await applyApprovedReview(tx, { entity_type: "articles", entity_id: article.id, operation: "create", before_json: null,
    after_json: { ...article, faqs: [faq] }, changed_fields: ["title", "faqs"] });
  assert.equal(store.rows.length, 1);
});

test("FAQ-only approvals verify the scoped parent and apply FAQs", async () => {
  const store = mockFaqs();
  const reads = [];
  const review = { entity_type: "articles", entity_id: article.id, entity_slug: article.slug, operation: "update", before_json: article,
    after_json: { ...article, faqs: [faq] }, changed_fields: ["faqs"] };
  const tx = { faqs: store.model,
    $executeRawUnsafe: async (sql) => { assert.match(sql, /SET `updated_at` = \? WHERE/); return 0; },
    $queryRawUnsafe: async (sql, ...args) => { reads.push([sql, args]); return [{ 1: 1 }]; } };
  await applyApprovedReview(tx, review);
  assert.match(reads[0][0], /WHERE `id` = \? AND `site_scope` = \?/);
  assert.deepEqual(reads[0][1], [article.id, "dekhocampus"]);
  assert.equal(store.rows.length, 1);
  await assert.rejects(applyApprovedReview({ ...tx, $queryRawUnsafe: async () => [] }, review), (error) => error.code === "REVIEW_TARGET_NOT_FOUND");
  assert.equal(store.rows.length, 1);
});

test("direct article and FAQ writes share one transaction and failures roll back", async () => {
  const transaction = prisma.$transaction;
  for (const fail of [false, true]) {
    const store = mockFaqs();
    let committed = false;
    let rolledBack = false;
    prisma.$transaction = async (operation) => {
      const tx = { faqs: { ...store.model, create: async (args) => { if (fail) throw new Error("FAQ write failed"); return store.model.create(args); } },
        $executeRawUnsafe: async () => 1,
        $queryRawUnsafe: async (sql, scope) => sql.includes("article_write_locks") ? [{ site_scope: scope }] : [article] };
      try { const result = await operation(tx); committed = true; return result; }
      catch (error) { rolledBack = true; throw error; }
    };
    try {
      const request = new Request("http://localhost/v1/rest/articles", { method: "POST", body: JSON.stringify({ ...article, faqs: [faq] }) });
      const save = handleRest("articles", request, { allowManualArticleTopicDuplicate: true });
      if (fail) await assert.rejects(save, /FAQ write failed/);
      else { assert.equal((await save).status, 201); assert.equal(store.rows.length, 1); }
      assert.equal(committed, !fail);
      assert.equal(rolledBack, fail);
    } finally { prisma.$transaction = transaction; }
  }
});
