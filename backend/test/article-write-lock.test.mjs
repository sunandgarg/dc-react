import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  acquireArticleWriteLocks,
  normalizeArticleWriteLockScopes,
} from "../src/blog-ai.mjs";

test("article row locks use a stable tenant order and never use advisory locks", async () => {
  assert.deepEqual(
    normalizeArticleWriteLockScopes(["sarkari", "dekhocampus", "sarkari"]),
    ["dekhocampus", "sarkari"],
  );
  assert.throws(
    () => normalizeArticleWriteLockScopes(["sarkari", " other "]),
    (error) => error?.code === "INVALID_ARTICLE_SITE_SCOPE",
  );

  const calls = [];
  const tx = {
    $queryRawUnsafe: async (sql, siteScope) => {
      calls.push({ sql, siteScope });
      return [{ site_scope: siteScope }];
    },
  };
  await acquireArticleWriteLocks(tx, ["sarkari", "dekhocampus"]);

  assert.deepEqual(calls.map((call) => call.siteScope), ["dekhocampus", "sarkari"]);
  assert.ok(calls.every((call) => /WHERE `site_scope` = \? FOR UPDATE/.test(call.sql)));
  const source = await readFile(new URL("../src/blog-ai.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /GET_LOCK|RELEASE_LOCK/i);
  const studioWriter = source.slice(
    source.indexOf("async function publishBlogStudioDraft"),
    source.indexOf("export async function handleBlogStudio"),
  );
  const autoWriter = source.slice(
    source.indexOf("async function saveGeneratedArticle"),
    source.indexOf("class RunControlError"),
  );
  assert.match(studioWriter, /withArticleWriteLock\([\s\S]*?\}, siteScope\);/);
  assert.match(autoWriter, /withArticleWriteLock\([\s\S]*?\}, siteScope\);/);
});

test("article row lock fails closed when a canonical lock row is missing", async () => {
  await assert.rejects(
    acquireArticleWriteLocks({ $queryRawUnsafe: async () => [] }, "sarkari"),
    (error) => error?.status === 503
      && error?.code === "ARTICLE_WRITE_LOCK_NOT_READY"
      && error?.missing_site_scopes?.[0] === "sarkari",
  );
});

test("MySQL parity migration creates and seeds the tenant lock table idempotently", async () => {
  const source = await readFile(new URL("../scripts/apply-mysql-parity.mjs", import.meta.url), "utf8");
  assert.match(source, /CREATE TABLE IF NOT EXISTS [^\n]*article_write_locks/);
  assert.match(source, /PRIMARY KEY [^\n]*site_scope/);
  assert.match(source, /ENGINE=InnoDB/);
  assert.match(source, /INSERT IGNORE INTO `article_write_locks` \(`site_scope`\) VALUES \('dekhocampus'\), \('sarkari'\)/);
  assert.match(source, /await ensureArticleWriteLockSchema\(report\)/);
});
