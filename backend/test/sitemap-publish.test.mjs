import assert from "node:assert/strict";
import test from "node:test";
import { publishSitemap } from "../src/sitemap-publish.mjs";

const request = (body = {}) => new Request("https://api.example/v1/functions/publish-sitemap", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const populatedDb = {
  $queryRawUnsafe: async () => [{ count: 1n }],
};

test("sitemap publishing fails closed when the deploy hook is absent", async () => {
  await assert.rejects(
    publishSitemap(request(), { hookUrl: "", prismaClient: populatedDb }),
    (error) => error.code === "SITEMAP_PUBLISH_NOT_CONFIGURED" && error.status === 503,
  );
});

test("sitemap publishing rejects incomplete core catalog data", async () => {
  await assert.rejects(
    publishSitemap(request(), {
      hookUrl: "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/example",
      prismaClient: { $queryRawUnsafe: async () => [{ count: 0 }] },
    }),
    (error) => error.code === "SITEMAP_SOURCE_INCOMPLETE" && error.status === 409,
  );
});

test("sitemap publishing queues one Cloudflare Pages deployment", async () => {
  const calls = [];
  const result = await publishSitemap(request({ target: "https://dekhocampus.com" }), {
    hookUrl: "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/example",
    prismaClient: populatedDb,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response("{}", { status: 200 });
    },
  });
  assert.equal(result.status, "queued");
  assert.equal(result.target, "https://dekhocampus.com");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, "POST");
});
