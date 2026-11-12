import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public listing index migration is idempotent and preserves mixed sort direction", async () => {
  const source = await readFile(new URL("../scripts/apply-mysql-parity.mjs", import.meta.url), "utf8");
  const body = source.match(/async function ensurePublicListingPerformanceIndexes\(report\) \{([\s\S]*?)\n\}\n/)[1];
  const migrate = new (Object.getPrototypeOf(async function () {}).constructor)("indexExists", "prisma", "report", body);
  const statements = [];
  const report = { createdReferenceIndexes: [] };
  await migrate(async () => false, { $executeRawUnsafe: async sql => statements.push(sql) }, report);
  assert.equal(statements.length, 3);
  assert.match(statements[0], /`is_active`, `is_partner`, `priority`, `featured_rank`, `rating` DESC/);
  assert.match(statements[1], /parent_university_slug.*191.*is_active/);
  assert.match(statements[2], /`site_scope`, `featured_rank`/);
  await migrate(async () => true, { $executeRawUnsafe: async () => assert.fail("Existing indexes must not be rebuilt") }, report);
  assert.equal(report.createdReferenceIndexes.length, 3);
});
