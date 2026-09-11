import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const metadata = JSON.parse(await readFile(new URL("../prisma/schema-metadata.json", import.meta.url), "utf8"));
const prismaSchema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const parityScript = await readFile(new URL("../scripts/apply-mysql-parity.mjs", import.meta.url), "utf8");

test("course fee study level and duration are exposed by Prisma and the REST contract", () => {
  for (const field of ["academic_level", "duration"]) {
    assert.equal(metadata.course_fees.fields[field]?.type, "String");
    assert.equal(metadata.course_fees.fields[field]?.nullable, true);
    assert.match(prismaSchema, new RegExp(`\\b${field}\\s+String\\?`));
  }
});

test("college course counts are derived from unique saved course offerings", () => {
  assert.match(parityScript, /COUNT\(DISTINCT SHA2\(CONCAT_WS/);
  assert.match(parityScript, /trg_sync_course_fees_ins/);
  assert.match(parityScript, /trg_sync_course_fees_upd/);
  assert.match(parityScript, /trg_sync_course_fees_del/);
});

test("routine deployments do not rerun the full college course-count backfill", () => {
  assert.match(parityScript, /const courseCountTriggersPresent = requiredTriggers\.every/);
  assert.match(parityScript, /if \(courseCountTriggersPresent\) \{[\s\S]*?return;[\s\S]*?UPDATE \\`colleges\\` college/);
  assert.match(parityScript, /WHERE NOT \(college\.\\`courses_count\\` <=> COALESCE\(fees\.\\`offering_count\\`, 0\)\)/);
});
