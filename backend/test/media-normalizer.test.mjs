import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeExternalStorageValue } from "../src/media-normalizer.mjs";

const [normalizationScript, deploymentWorkflow] = await Promise.all([
  readFile(new URL("../scripts/normalize-external-media.mjs", import.meta.url), "utf8"),
  readFile(new URL("../../.github/workflows/deploy-aws-lightsail.yml", import.meta.url), "utf8"),
]);

test("normalizes existing external storage URLs to provider-neutral keys", async () => {
  const result = await normalizeExternalStorageValue(
    "https://old-media.example/storage/v1/object/public/admin-uploads/college/logo.webp",
    { mediaBaseUrl: "https://dekhocampus.com/storage/v1/object/public", objectExists: async () => true },
  );
  assert.equal(result.value, "admin-uploads/college/logo.webp");
  assert.deepEqual(result.stats, { references: 1, normalized: 1, missing: 0 });
});

test("clears external storage URLs that are absent from S3", async () => {
  const result = await normalizeExternalStorageValue(
    { image: "https://old-media.example/storage/v1/object/public/admin-uploads/career/missing.webp" },
    { mediaBaseUrl: "https://dekhocampus.com/storage/v1/object/public", objectExists: async () => false },
  );
  assert.equal(result.value.image, "");
  assert.deepEqual(result.stats, { references: 1, normalized: 0, missing: 1 });
});

test("rewrites embedded media URLs without changing ordinary external links", async () => {
  const result = await normalizeExternalStorageValue(
    '<p><img src="https://old-media.example/storage/v1/object/public/admin-uploads/a.webp"><a href="https://college.example">College</a></p>',
    { mediaBaseUrl: "https://dekhocampus.com/storage/v1/object/public", objectExists: async () => true },
  );
  assert.match(result.value, /https:\/\/dekhocampus\.com\/storage\/v1\/object\/public\/admin-uploads\/a\.webp/);
  assert.match(result.value, /https:\/\/college\.example/);
});

test("routine deployments cannot launch the full-database media migration", () => {
  const runtimeStep = deploymentWorkflow.slice(
    deploymentWorkflow.indexOf("- name: Configure AWS runtime"),
    deploymentWorkflow.indexOf("- name: Generate tenant-scoped sitemap"),
  );
  assert.doesNotMatch(runtimeStep, /npm --prefix backend run db:normalize:media/);
  assert.match(normalizationScript, /process\.argv\.includes\("--confirmed-one-time"\)/);
});
