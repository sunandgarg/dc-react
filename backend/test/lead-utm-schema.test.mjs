import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const metadata = JSON.parse(await readFile(new URL("../prisma/schema-metadata.json", import.meta.url), "utf8"));
const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const parity = await readFile(new URL("../scripts/apply-mysql-parity.mjs", import.meta.url), "utf8");

test("lead UTMs are available in the database and REST schema", () => {
  for (const column of ["utm_source", "utm_medium", "utm_campaign"]) {
    assert.equal(metadata.leads.fields[column]?.nullable, true);
    assert.match(schema, new RegExp(`\\b${column}\\s+String\\?\\s+@db\\.VarChar\\(160\\)`));
  }
  assert.match(parity, /await ensureLeadAttributionSchema\(report\)/);
});
