import assert from "node:assert/strict";
import test from "node:test";
import { ensureEntitySearchIndex, searchFilterSource } from "../src/entity-search-index.mjs";

test("builds a compact name projection with insert/update/delete synchronization and an explicit ready marker", async () => {
  const writes = [];
  const db = {
    $executeRawUnsafe: async (...args) => { writes.push(args); },
    $queryRawUnsafe: async () => [],
  };
  await ensureEntitySearchIndex(db, async sql => writes.push([sql]));
  assert.equal(writes.filter(([s]) => s.startsWith("CREATE TRIGGER")).length, 12);
  assert.equal(writes.filter(([s]) => s.includes("SELECT 'colleges',id")).length, 1);
  assert.equal(writes.filter(([s]) => s.includes("VALUES ('_ready',?)")).length, 4);
  assert.ok(writes.some(([s]) => s.includes("AFTER UPDATE") && s.includes("ON DUPLICATE KEY UPDATE")));
  assert.ok(writes.some(([s]) => s.includes("AFTER DELETE") && s.includes("OLD.id")));
  assert.ok(writes.every(([s]) => !s.includes("NEW.content")));
  const ready = [];
  await ensureEntitySearchIndex({ $executeRawUnsafe: async s=>ready.push(s), $queryRawUnsafe: async ()=>[{}] }, async () => assert.fail("Existing triggers must not be rebuilt"));
  assert.equal(ready.length, 1); // Only the harmless CREATE TABLE IF NOT EXISTS runs again.
});

test("optimizes only allowlisted search fields and never interpolates request text", () => {
  assert.match(searchFilterSource("colleges", "name"), /entity_table='colleges'/);
  assert.equal(searchFilterSource("profiles", "name"), null);
  assert.equal(searchFilterSource("colleges", "name) OR 1=1"), null);
});

test("REST keeps scope, filters, ordering and parameters when using the compact names", async () => {
  const { handleRest } = await import("../src/rest.mjs");
  const { prisma } = await import("../src/db.mjs");
  const original = prisma.$queryRawUnsafe;
  const queries = [];
  prisma.$queryRawUnsafe = async (sql,...params) => { queries.push({sql,params}); return []; };
  try {
    await handleRest("articles",new Request("https://example.com/v1/rest/articles?select=id,title,site_scope&site_scope=eq.dekhocampus&title=ilike.%25admission%25&order=title,id&limit=20"), {actorUserId:"admin"});
    assert.match(queries.at(-1).sql,/FROM \(SELECT \* FROM entity_search_names WHERE entity_table='articles'\)/);
    assert.deepEqual(queries.at(-1).params,["dekhocampus","%admission%"]);
    assert.match(queries.at(-1).sql,/ORDER BY `title` ASC,`id` ASC LIMIT 20/);
    await handleRest("colleges",new Request("https://example.com/v1/rest/colleges?select=id,name&is_active=eq.true&name=ilike.%25Delhi%25"), {publicAccess:true});
    assert.match(queries.at(-1).sql,/FROM `colleges` WHERE `is_active` = \? AND id IN \(SELECT id FROM entity_search_names/);
    assert.deepEqual(queries.at(-1).params,[1,"%Delhi%"]);
    await handleRest("colleges",new Request("https://example.com/v1/rest/colleges?select=id,name&name=not.ilike.%25Delhi%25"), {publicAccess:true});
    assert.match(queries.at(-1).sql,/NOT \(LOWER\(`name`\) LIKE LOWER\(\?\)\)/);
  } finally { prisma.$queryRawUnsafe=original; }
});
