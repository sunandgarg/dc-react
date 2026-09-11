import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../src/db.mjs";
import { handleRest } from "../src/rest.mjs";

function mockRawQueries(t, implementation) {
  const original = prisma.$queryRawUnsafe;
  prisma.$queryRawUnsafe = implementation;
  t.after(() => { prisma.$queryRawUnsafe = original; });
}

test("REST list reads skip exact counts unless a count is requested", async (t) => {
  const queries = [];
  mockRawQueries(t, async (sql) => {
    queries.push(sql);
    return [
      { id: "founder-1", name: "First founder" },
      { id: "founder-2", name: "Second founder" },
    ];
  });

  const result = await handleRest(
    "about_founders",
    new Request("http://localhost/v1/rest/about_founders?limit=2"),
  );

  assert.equal(queries.length, 1);
  assert.doesNotMatch(queries[0], /COUNT\(\*\)/);
  assert.equal(result.headers["content-range"], "0-1/*");
  assert.equal(result.headers["range-unit"], "items");
  assert.equal(result.body.length, 2);
});

test("REST list reads return an exact total when Prefer requests one", async (t) => {
  const queries = [];
  mockRawQueries(t, async (sql) => {
    queries.push(sql);
    if (/COUNT\(\*\)/.test(sql)) return [{ total: 42n }];
    return [
      { id: "founder-11", name: "Eleventh founder" },
      { id: "founder-12", name: "Twelfth founder" },
    ];
  });

  const result = await handleRest(
    "about_founders",
    new Request("http://localhost/v1/rest/about_founders?offset=10&limit=2", {
      headers: { prefer: "return=representation, count=exact" },
    }),
  );

  assert.equal(queries.length, 2);
  assert.match(queries[0], /^SELECT COUNT\(\*\) AS total FROM `about_founders`/);
  assert.doesNotMatch(queries[1], /COUNT\(\*\)/);
  assert.equal(result.headers["content-range"], "10-11/42");
  assert.equal(result.body.length, 2);
});

test("REST HEAD count reads run only the exact count query", async (t) => {
  const queries = [];
  mockRawQueries(t, async (sql) => {
    queries.push(sql);
    return [{ total: 42n }];
  });

  const result = await handleRest(
    "about_founders",
    new Request("http://localhost/v1/rest/about_founders", {
      method: "HEAD",
      headers: { prefer: "count=exact" },
    }),
  );

  assert.equal(queries.length, 1);
  assert.match(queries[0], /^SELECT COUNT\(\*\) AS total FROM `about_founders`/);
  assert.equal(result.headers["content-range"], "0-0/42");
  assert.deepEqual(result.body, []);
});
