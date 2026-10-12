import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { createClient } from "redis";
import { createPublicContentCache } from "../src/public-content-cache.mjs";

const publicContext = { publicAccess: true };
const request = (query = "", headers = {}, method = "GET") => new Request(
  `http://localhost/v1/rest/articles?is_active=eq.true&status=eq.Published&site_scope=eq.dekhocampus${query}`, { headers, method });
const result = (title = "Published article") => ({ status: 200, body: [{ title }], headers: { "content-range": "0-0/1", "range-unit": "items" } });

function fixture(options = {}) {
  const values = new Map();
  let time = 0;
  let connections = 0;
  const redis = {
    isOpen: false, isReady: false, fail: false,
    on() {},
    async connect() { connections++; this.isOpen = this.isReady = true; },
    async get(key) {
      if (this.fail) throw new Error("Redis test failure");
      const entry = values.get(key);
      if (entry?.expires <= time) { values.delete(key); return null; }
      return entry?.value ?? null;
    },
    async set(key, value, opts = {}) {
      if (this.fail) throw new Error("Redis test failure");
      if (opts.NX && values.has(key)) return null;
      values.set(key, { value, expires: opts.EX ? time + opts.EX * 1000 : Infinity });
      return "OK";
    },
    destroy() { this.isOpen = this.isReady = false; },
  };
  const cache = createPublicContentCache({ url: "redis://localhost", clientFactory: () => redis, ...options });
  return { cache, redis, values, advance(ms) { time += ms; }, connections: () => connections };
}

test("public hits avoid the database and preserve representation/range headers", async () => {
  const { cache, values } = fixture();
  let reads = 0;
  const load = async () => { reads++; return result(); };
  assert.deepEqual(await cache.read("articles", request(), publicContext, load), result());
  assert.deepEqual(await cache.read("articles", request(), publicContext, load), result());
  assert.equal(reads, 1);
  assert.equal(values.size, 2);
  cache.close();
});

test("all four active public entity tables can be cached", async () => {
  const { cache } = fixture();
  let reads = 0;
  for (const table of ["articles", "colleges", "courses", "exams"]) {
    const req = new Request(request().url.replace("/articles?", `/${table}?`));
    const load = async () => { reads++; return result(); };
    await cache.read(table, req, publicContext, load);
    await cache.read(table, req, publicContext, load);
  }
  assert.equal(reads, 4);
  cache.close();
});

test("disabled Redis and private, authenticated, inactive or unscoped reads bypass caching", async () => {
  const { cache, connections } = fixture();
  let reads = 0;
  const load = async () => { reads++; return result(); };
  const cases = [
    ["leads", request(), publicContext], ["articles", request(), {}],
    ["articles", request("", { authorization: "Bearer editor-token" }), publicContext],
    ["articles", request("", { cookie: "session=private" }), publicContext],
    ["articles", request("", { "cache-control": "no-cache" }), publicContext],
    ["articles", request("", {}, "HEAD"), publicContext],
    ["articles", request("", {}, "POST"), publicContext],
    ["articles", new Request("http://localhost/v1/rest/articles?is_active=eq.true&status=eq.Draft"), publicContext],
    ["exams", new Request("http://localhost/v1/rest/exams?is_active=eq.false"), publicContext],
  ];
  for (const args of cases) await cache.read(...args, load);
  await createPublicContentCache().read("articles", request(), publicContext, load);
  assert.equal(reads, cases.length + 1);
  assert.equal(connections(), 0);
  cache.close();
});

test("site, query, pagination and representation headers have distinct keys", async () => {
  const { cache } = fixture();
  let reads = 0;
  const load = async () => { reads++; return result(); };
  const variants = [request(), request("&limit=3"), request("&offset=3"),
    request("", { accept: "application/vnd.pgrst.object+json" }),
    request("", { prefer: "count=exact" }), request("", { range: "0-1" }),
    new Request(request().url.replace("eq.dekhocampus", "eq.sarkari"))];
  for (const req of variants) {
    await cache.read("articles", req, publicContext, load);
    await cache.read("articles", req, publicContext, load);
  }
  assert.equal(reads, variants.length);
  cache.close();
});

test("origins share public data without sharing CORS, cookies or request IDs", async () => {
  const { cache } = fixture();
  const original = { ...result(), headers: { ...result().headers, "access-control-allow-origin": "https://first.example", "set-cookie": "session=do-not-cache", "x-request-id": "first" } };
  await cache.read("articles", request("", { origin: "https://first.example" }), publicContext, async () => original);
  const hit = await cache.read("articles", request("", { origin: "https://second.example" }), publicContext, async () => assert.fail("Expected a hit"));
  assert.deepEqual(hit.headers, result().headers);
  cache.close();
});

test("TTL expires entries and committed writes rotate all public generations", async () => {
  const { cache, advance } = fixture({ ttlSeconds: 1 });
  let reads = 0;
  const load = async () => result(`version-${++reads}`);
  await cache.read("articles", request(), publicContext, load);
  advance(1001);
  assert.equal((await cache.read("articles", request(), publicContext, load)).body[0].title, "version-2");
  await cache.invalidate("articles");
  assert.equal((await cache.read("articles", request(), publicContext, load)).body[0].title, "version-3");
  await cache.invalidate("user_events");
  await cache.read("articles", request(), publicContext, load);
  assert.equal(reads, 3);
  await cache.invalidate("course_fees");
  await cache.read("articles", request(), publicContext, load);
  assert.equal(reads, 4);
  cache.close();
});

test("an in-flight old read cannot repopulate the generation after an edit", async () => {
  const { cache } = fixture();
  let complete;
  let started;
  const began = new Promise((resolve) => { started = resolve; });
  const old = cache.read("articles", request(), publicContext, () => { started(); return new Promise((resolve) => { complete = resolve; }); });
  await began;
  await cache.invalidate("articles");
  complete(result("before edit"));
  await old;
  assert.equal((await cache.read("articles", request(), publicContext, async () => result("after edit"))).body[0].title, "after edit");
  cache.close();
});

test("an evicted generation does not expose older data", async () => {
  const { cache, values } = fixture();
  await cache.read("articles", request(), publicContext, async () => result("old"));
  values.delete("dc:public:v1:revision");
  assert.equal((await cache.read("articles", request(), publicContext, async () => result("new"))).body[0].title, "new");
  cache.close();
});

test("simultaneous misses share one load; failures are not cached", async () => {
  const { cache } = fixture();
  let reads = 0;
  const load = async () => { reads++; await new Promise((resolve) => setTimeout(resolve, 10)); return result(); };
  await Promise.all(Array.from({ length: 20 }, () => cache.read("articles", request(), publicContext, load)));
  assert.equal(reads, 1);
  await cache.invalidate();
  await assert.rejects(cache.read("articles", request(), publicContext, async () => { throw new Error("Database failure"); }), /Database failure/);
  for (let i = 0; i < 2; i++) await cache.read("articles", request(), publicContext, async () => { reads++; return { status: 503, body: { code: "UNAVAILABLE" } }; });
  assert.equal(reads, 3);
  cache.close();
});

test("large responses bypass storage and Redis failures preserve reads and writes", async () => {
  const { cache, redis, values } = fixture();
  const huge = result("x".repeat(300_000));
  assert.deepEqual(await cache.read("articles", request(), publicContext, async () => huge), huge);
  assert.equal(values.size, 1);
  redis.fail = true;
  await cache.invalidate("articles");
  assert.deepEqual(await cache.read("articles", request(), publicContext, async () => result()), result());
  assert.equal(redis.isOpen, false);
  cache.close();
});

test("corrupt entries fall back to the database rather than breaking public reads", async () => {
  const { cache, values } = fixture();
  await cache.read("articles", request(), publicContext, async () => result("cached"));
  const key = [...values.keys()].find((value) => !value.endsWith(":revision"));
  values.get(key).value = "not-json";
  assert.deepEqual(await cache.read("articles", request(), publicContext, async () => result("fresh")), result("fresh"));
  cache.close();
});

test("a stalled Redis handshake falls back within a bounded interval", async () => {
  const sockets = new Set();
  const server = createServer((socket) => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const cache = createPublicContentCache({ url: `redis://127.0.0.1:${server.address().port}` });
  try {
    const start = Date.now();
    assert.deepEqual(await cache.read("articles", request(), publicContext, async () => result()), result());
    assert.ok(Date.now() - start < 1500, "Cache outage must not hang the API");
  } finally {
    cache.close();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("authorization precedes cache lookup and publishing callers invalidate after commits", async () => {
  const source = (name) => readFile(new URL(`../src/${name}.mjs`, import.meta.url), "utf8");
  const api = await source("index");
  const rest = await source("rest");
  assert.match(api, /const authorization = await authorizeRest\(table, request\);[\s\S]*?publicContentCache\.read\(table, authorization\.request, authorization/);
  assert.match(rest, /result\.status >= 200 && result\.status < 300 && result\.status !== 202\) await publicContentCache\.invalidate\(table\)/);
  assert.match(rest, /featured_rank[\s\S]*?publicContentCache\.invalidate\(body\._table\)/);
  const blog = await source("blog-ai");
  assert.equal((blog.match(/await publicContentCache\.invalidate\("articles"\)/g) || []).length, 2);
  assert.match(await source("content-review"), /status === "approved"\) await publicContentCache\.invalidate\(\)/);
  assert.match(await source("data-cleaner"), /UPDATE [\s\S]*?await publicContentCache\.invalidate\(table\)/);
});

test("real Redis hits, TTL, cross-client invalidation and recovery", { skip: !process.env.REDIS_TEST_URL }, async () => {
  const url = process.env.REDIS_TEST_URL;
  const prefix = `dc:redis-test:${randomUUID()}`;
  let connectionA;
  const cacheA = createPublicContentCache({ url, prefix, ttlSeconds: 1, clientFactory: (options) => (connectionA = createClient(options)) });
  const cacheB = createPublicContentCache({ url, prefix, ttlSeconds: 1 });
  let reads = 0;
  const load = async () => result(`version-${++reads}`);
  try {
    await cacheA.read("articles", request(), publicContext, load);
    await cacheB.read("articles", request(), publicContext, load);
    const warmReads = reads;
    await cacheA.read("articles", request(), publicContext, load);
    assert.equal(reads, warmReads);
    await cacheB.invalidate("articles");
    await cacheA.read("articles", request(), publicContext, load);
    assert.equal(reads, warmReads + 1);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await cacheA.read("articles", request(), publicContext, load);
    assert.equal(reads, warmReads + 2);
    connectionA.destroy();
    await cacheA.read("articles", request(), publicContext, load);
    assert.equal(reads, warmReads + 3, "A new connection invalidates pre-outage entries");
  } finally {
    cacheA.close(); cacheB.close();
    const cleanup = createClient({ url, socket: { reconnectStrategy: false, connectTimeout: 1000 } });
    cleanup.on("error", () => {});
    try {
      await cleanup.connect();
      for await (const keys of cleanup.scanIterator({ MATCH: `${prefix}:*`, COUNT: 100 })) if (keys.length) await cleanup.del(keys);
    } finally { if (cleanup.isOpen) cleanup.destroy(); }
  }
});
