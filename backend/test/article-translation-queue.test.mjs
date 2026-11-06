import assert from "node:assert/strict";
import test from "node:test";
import { articleTranslationQueueStatus, queueArticleTranslations } from "../src/article-translation-queue.mjs";

const original = { id: "11111111-2222-4333-8444-555555555555", site_scope: "dekhocampus", language_code: "en", status: "Published", is_active: true };
const languages = ["hi", "ta", "te", "kn", "ml", "gu", "mr", "bn", "pa"];

test("publication queues all nine slots atomically without creating placeholder articles", async () => {
  const writes = [];
  const tx = { $executeRawUnsafe: async (...args) => { writes.push(args); return 9; } };
  await queueArticleTranslations(tx, original);
  assert.equal(writes.length, 1);
  assert.match(writes[0][0], /INSERT INTO article_translation_queue/);
  assert.match(writes[0][0], /ON DUPLICATE KEY UPDATE/);
  assert.deepEqual(writes[0].slice(1), languages.flatMap((language) => [original.id, language]));
  await queueArticleTranslations(tx, original, { ...original, status: "Draft" });
  assert.equal(writes.length, 2);
  await assert.rejects(queueArticleTranslations({ $executeRawUnsafe: async () => { throw new Error("queue unavailable"); } }, original), /queue unavailable/);
});

test("drafts, translations, other sites and edits to existing publications do not start another queue", async () => {
  const tx = { $executeRawUnsafe: async () => { assert.fail("Unexpected queue write"); } };
  for (const patch of [{ status: "Draft" }, { is_active: false }, { is_active: 0 }, { language_code: "hi", english_article_id: "root" }, { english_article_id: "root" }, { site_scope: "sarkari" }]) {
    await queueArticleTranslations(tx, { ...original, ...patch });
  }
  await queueArticleTranslations(tx, { ...original, title: "Updated title" }, original);
});

test("queue status reflects existing versions and an unpublished original without modifying either", async () => {
  const rows = [
    { language_code: "hi", article_id: "hi-id", status: "Published", is_active: 1 },
    { language_code: "ta", article_id: "ta-id", status: "Draft", is_active: 0 },
    { language_code: "te", article_id: "te-id", status: "Published", is_active: 0 },
    { language_code: "pa", article_id: null },
  ];
  let parent = original;
  const db = { $queryRawUnsafe: async (sql) => sql.includes("FROM articles WHERE") ? [parent] : rows };
  const read = () => articleTranslationQueueStatus(db, { article_id: original.id, site_scope: "dekhocampus" }, {});
  let result = await read();
  assert.equal(result.engine_status, "not_connected");
  assert.deepEqual(result.slots.map((slot) => slot.status), ["published", "existing_draft", "existing_draft", "waiting_engine"]);
  parent = { ...original, status: "Draft" };
  result = await read();
  assert.equal(result.slots[3].status, "paused_original");
});

test("queue reads validate identity, site and private draft ownership", async () => {
  const body = { article_id: original.id, site_scope: "dekhocampus" };
  const db = { $queryRawUnsafe: async () => [{ ...original, status: "Draft", created_by: "someone-else" }] };
  await assert.rejects(articleTranslationQueueStatus(db, body, { actorUserId: "writer", restrictToOwnDrafts: true }), (error) => error.status === 404);
  await assert.rejects(articleTranslationQueueStatus(db, { ...body, site_scope: "sarkari" }, {}), (error) => error.status === 400);
  await assert.rejects(articleTranslationQueueStatus(db, { ...body, article_id: "' OR 1=1" }, {}), (error) => error.status === 400);
  await assert.rejects(articleTranslationQueueStatus(db, null, {}), (error) => error.status === 400);
  await assert.rejects(articleTranslationQueueStatus({ $queryRawUnsafe: async () => [] }, body, {}), (error) => error.status === 404);
});

test("anonymous API callers cannot read the translation queue", async () => {
  const { handleRequest } = await import("../src/index.mjs");
  const response = await handleRequest(new Request("http://localhost/v1/functions/article-translation-queue", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ article_id: original.id, site_scope: "dekhocampus" }),
  }));
  assert.equal(response.status, 401);
});

test("REST publication and queue writes commit together, and queue failure rolls publication back", async () => {
  const { handleRest } = await import("../src/rest.mjs");
  const { prisma } = await import("../src/db.mjs");
  const transaction = prisma.$transaction;
  const article = { ...original, slug: "translation-queue-test", title: "Application instructions", content: "<p>Official application instructions.</p>" };
  try {
    for (const method of ["POST", "PATCH"]) {
      for (const fail of [false, true]) {
        let committed = false;
        const writes = [];
        prisma.$transaction = async (run) => {
          const tx = {
            $queryRawUnsafe: async (sql, scope) => {
              if (sql.includes("article_write_locks")) return [{ site_scope: scope }];
              return [{ ...article, status: method === "PATCH" ? "Draft" : "Published" }];
            },
            $executeRawUnsafe: async (sql) => {
              writes.push(sql);
              if (fail && sql.includes("INSERT INTO article_translation_queue")) throw new Error("queue unavailable");
              return 1;
            },
          };
          const result = await run(tx);
          committed = true;
          return result;
        };
        // Studio provenance checks use the outer client before acquiring the write lock.
        const query = prisma.$queryRawUnsafe;
        prisma.$queryRawUnsafe = async (sql) => sql.includes("ai_usage_events") ? [] : [{ ...article, status: "Draft" }];
        try {
          const save = handleRest("articles", new Request(`http://localhost/v1/rest/articles?id=eq.${article.id}`, { method, body: JSON.stringify(article) }), { allowManualArticleTopicDuplicate: true });
          if (fail) await assert.rejects(save, /queue unavailable/);
          else assert.equal((await save).status, method === "POST" ? 201 : 200);
          assert.equal(committed, !fail);
          assert.equal(writes.filter((sql) => sql.includes("INSERT INTO article_translation_queue")).length, 1);
        } finally { prisma.$queryRawUnsafe = query; }
      }
    }
  } finally { prisma.$transaction = transaction; }
});
