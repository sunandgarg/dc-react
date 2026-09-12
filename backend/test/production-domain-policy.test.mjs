import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDir, "../..");

test("production configuration never allows dekhocampus.in as an application origin", () => {
  const files = [
    ".github/workflows/deploy-aws-lightsail.yml",
    ".github/workflows/deploy-cloudflare-pages.yml",
    "infra/aws/lightsail-production.yaml",
    "backend/.env.example",
  ];

  for (const relativePath of files) {
    const source = fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
    assert.doesNotMatch(source, /https?:\/\/([a-z0-9-]+\.)?dekhocampus\.in(?=[\s,/'\"]|$)/i, relativePath);
  }
});

test("retired .in host redirects paths and query strings to the canonical .com host", async () => {
  const workerPath = path.join(repositoryRoot, "infra/cloudflare/dekhocampus-in-retired/worker.js");
  const worker = (await import(`${workerPath}?test=${Date.now()}`)).default;
  const response = worker.fetch(new Request("https://www.dekhocampus.in/news/example?preview=1"));

  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://dekhocampus.com/news/example?preview=1");
});
