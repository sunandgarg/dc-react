import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const metadata = JSON.parse(await readFile(new URL("../prisma/schema-metadata.json", import.meta.url), "utf8"));
const prismaSchema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const parityScript = await readFile(new URL("../scripts/apply-mysql-parity.mjs", import.meta.url), "utf8");

test("exam conducting authority is nullable across schema and REST metadata", () => {
  assert.deepEqual(metadata.exams.fields.conducting_authority, {
    type: "String",
    nullable: true,
    primaryKey: false,
    format: "text",
    default: null,
    foreignKey: null,
  });
  assert.match(prismaSchema, /model exams \{[\s\S]*conducting_authority\s+String\?\s+@db\.LongText/);
});

test("runtime parity adds the optional exam authority column for existing databases", () => {
  assert.match(parityScript, /ensureExamAuthoritySchema/);
  assert.match(parityScript, /ALTER TABLE `exams` ADD COLUMN `conducting_authority` LONGTEXT NULL/);
  assert.match(parityScript, /await ensureExamAuthoritySchema\(report\)/);
});
