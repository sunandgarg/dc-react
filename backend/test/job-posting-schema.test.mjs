import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const metadata = JSON.parse(await readFile(new URL("../prisma/schema-metadata.json", import.meta.url), "utf8"));
const prismaSchema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const parityScript = await readFile(new URL("../scripts/apply-mysql-parity.mjs", import.meta.url), "utf8");
const apiSource = await readFile(new URL("../src/index.mjs", import.meta.url), "utf8");

test("articles expose optional structured job metadata through Prisma and REST metadata", () => {
  assert.equal(metadata.articles.fields.job_posting?.type, "Json");
  assert.equal(metadata.articles.fields.job_posting?.nullable, true);
  assert.match(prismaSchema, /\bjob_posting\s+Json\?/);
  assert.match(apiSource, /publicReadSelections[\s\S]*?\["articles", "[^"]*job_posting/);
});

test("routine application deployment adds the job metadata column idempotently", () => {
  assert.match(parityScript, /\["articles", "job_posting", "JSON NULL"\]/);
  assert.match(parityScript, /if \(await columnInfo\(table, column\)\) continue/);
});
