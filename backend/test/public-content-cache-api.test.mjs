import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "redis";

test("real Redis integrates with authorized API reads and REST edit invalidation", { skip: !process.env.REDIS_TEST_URL }, async () => {
  const previousUrl = process.env.REDIS_URL;
  const previousPrefix = process.env.REDIS_CACHE_PREFIX;
  const prefix = `dc:api-cache-test:${randomUUID()}`;
  process.env.REDIS_URL = process.env.REDIS_TEST_URL;
  process.env.REDIS_CACHE_PREFIX = prefix;
  const { handleRequest } = await import("../src/index.mjs");
  const { handleRest } = await import("../src/rest.mjs");
  const { prisma } = await import("../src/db.mjs");
  const { publicContentCache } = await import("../src/public-content-cache.mjs");
  const originalQuery = prisma.$queryRawUnsafe;
  const originalExecute = prisma.$executeRawUnsafe;
  let row = { id: "redis-test-exam", slug: "redis-test-exam", name: "Before edit", is_active: true };
  let reads = 0;
  let writes = 0;
  prisma.$queryRawUnsafe = async (sql) => {
    assert.match(sql, /FROM `exams`/);
    reads++;
    return [{ ...row }];
  };
  prisma.$executeRawUnsafe = async (sql, name) => {
    assert.match(sql, /^UPDATE `exams` SET `name` = \?/);
    row = { ...row, name };
    writes++;
    return 1;
  };
  const url = "http://localhost/v1/rest/exams?is_active=eq.true&slug=eq.redis-test-exam";
  try {
    const first = await handleRequest(new Request(url, { headers: { origin: "https://dekhocampus.com", "x-request-id": "cache-first" } }));
    assert.equal(first.status, 200);
    assert.equal((await first.json())[0].name, "Before edit");
    const hit = await handleRequest(new Request(url, { headers: { origin: "https://www.dekhocampus.com", "x-request-id": "cache-hit" } }));
    assert.equal(hit.status, 200);
    assert.equal((await hit.json())[0].name, "Before edit");
    assert.equal(reads, 1);
    assert.equal(hit.headers.get("access-control-allow-origin"), "https://www.dekhocampus.com");
    assert.equal(hit.headers.get("x-request-id"), "cache-hit");
    assert.equal(hit.headers.get("content-range"), "0-0/*");

    const edit = new Request("http://localhost/v1/rest/exams?id=eq.redis-test-exam", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "After edit" }),
    });
    const denied = await handleRequest(edit.clone());
    assert.equal(denied.status, 401);
    assert.equal(writes, 0);
    // Simulate the REST layer after the unchanged API authorization gate has passed.
    assert.equal((await handleRest("exams", edit)).status, 200);
    assert.equal(writes, 1);
    const fresh = await handleRequest(new Request(url));
    assert.equal(fresh.status, 200);
    assert.equal((await fresh.json())[0].name, "After edit");
    assert.equal(reads, 2);
  } finally {
    prisma.$queryRawUnsafe = originalQuery;
    prisma.$executeRawUnsafe = originalExecute;
    publicContentCache.close();
    if (previousUrl === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = previousUrl;
    if (previousPrefix === undefined) delete process.env.REDIS_CACHE_PREFIX; else process.env.REDIS_CACHE_PREFIX = previousPrefix;
    const cleanup = createClient({ url: process.env.REDIS_TEST_URL, socket: { reconnectStrategy: false, connectTimeout: 1000 } });
    cleanup.on("error", () => {});
    try {
      await cleanup.connect();
      for await (const keys of cleanup.scanIterator({ MATCH: `${prefix}:*`, COUNT: 100 })) if (keys.length) await cleanup.del(keys);
    } finally { if (cleanup.isOpen) cleanup.destroy(); }
  }
});
