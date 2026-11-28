import { test } from "node:test";
import assert from "node:assert/strict";
import { serveEntityPage } from "../src/entity-page.mjs";

const shell = '<!doctype html><html><head><title>Home</title><link rel="canonical" href="https://dekhocampus.com/"></head><body><div id="root"></div><script src="/assets/index-test.js"></script></body></html>';
const row = (slug) => ({ slug, short_id: 12345, is_active: true, name: "Sample Institution", description: "A specific public entity page with admissions and course information.", updated_at: new Date("2026-11-28T00:00:00Z") });
const fetchImpl = async () => new Response(shell, { headers: { "content-type": "text/html" } });

for (const type of ["colleges", "courses", "exams"]) {
  test(`${type} detail serves page-specific initial HTML and one canonical`, async () => {
    const entity = { ...row(`sample-${type}`), short_id: type === "colleges" ? 12345n : 12345 };
    const prismaClient = { [type]: { findFirst: async ({ where }) => {
      assert.equal(String(where.short_id), "12345");
      assert.equal(where.is_active, true);
      return entity;
    } } };
    const path = `/${type}/${entity.slug}-12345${type === "exams" ? "/syllabus" : ""}`;
    const response = await serveEntityPage(new Request(`https://dekhocampus.com${path}`), { prismaClient, fetchImpl });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /<h1>Sample Institution/);
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
    assert.match(html, new RegExp(`rel="canonical" href="https://dekhocampus.com${path}"`));
    assert.doesNotMatch(html, /rel="canonical" href="https:\/\/dekhocampus.com\/"/);
    assert.match(html, /dc-initial-page-data/);
  });
}

test("college tab consolidates to the full entity page", async () => {
  const response = await serveEntityPage(new Request("https://dekhocampus.com/colleges/sample-colleges-12345/gallery"), {
    prismaClient: { colleges: { findFirst: async () => row("sample-colleges") } }, fetchImpl,
  });
  assert.match(await response.text(), /rel="canonical" href="https:\/\/dekhocampus.com\/colleges\/sample-colleges-12345"/);
});

test("missing and renamed records do not return homepage HTML", async () => {
  const prismaClient = { colleges: { findFirst: async () => null } };
  const missing = await serveEntityPage(new Request("https://dekhocampus.com/colleges/missing-12345"), { prismaClient, fetchImpl });
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("x-robots-tag"), "noindex");
  const oldSlug = await serveEntityPage(new Request("https://dekhocampus.com/colleges/old-name-12345"), {
    prismaClient: { colleges: { findFirst: async () => row("new-name") } }, fetchImpl,
  });
  assert.equal(oldSlug.status, 308);
  assert.equal(oldSlug.headers.get("location"), "https://dekhocampus.com/colleges/new-name-12345");
});

test("named catalog landing pages keep their Pages response", async () => {
  const response = await serveEntityPage(new Request("https://dekhocampus.com/colleges/top-engineering-colleges-in-india"), {
    prismaClient: {}, fetchImpl: async (url) => {
      assert.equal(new URL(url).pathname, "/colleges/top-engineering-colleges-in-india");
      return new Response("Catalog", { status: 200 });
    },
  });
  assert.equal(await response.text(), "Catalog");
});
