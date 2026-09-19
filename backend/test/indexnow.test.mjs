import assert from "node:assert/strict";
import test from "node:test";
import { indexNowConfig, submitIndexNowUrls } from "../src/indexnow.mjs";

test("IndexNow submits only canonical DekhoCampus URLs and removes duplicates", async () => {
  let payload;
  const result = await submitIndexNowUrls([
    "/news/jee-main-registration",
    "https://dekhocampus.com/news/jee-main-registration#dates",
    "https://example.com/copied-page",
  ], {
    fetchImpl: async (_url, init) => {
      payload = JSON.parse(init.body);
      return new Response(null, { status: 202 });
    },
  });

  assert.equal(result.submitted, 1);
  assert.deepEqual(payload.urlList, ["https://dekhocampus.com/news/jee-main-registration"]);
  assert.equal(payload.key, indexNowConfig.key);
  assert.equal(payload.keyLocation, `https://dekhocampus.com/${indexNowConfig.key}.txt`);
});

test("IndexNow surfaces rejected batches", async () => {
  await assert.rejects(
    submitIndexNowUrls(["/news/rejected"], { fetchImpl: async () => new Response("invalid", { status: 400 }) }),
    /IndexNow rejected the batch \(400\): invalid/,
  );
});
