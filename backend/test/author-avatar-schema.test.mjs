import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const metadata = JSON.parse(await readFile(new URL("../prisma/schema-metadata.json", import.meta.url), "utf8"));
const prismaSchema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const parityScript = await readFile(new URL("../scripts/apply-mysql-parity.mjs", import.meta.url), "utf8");

test("existing authors default to the illustrated avatar without deleting their saved photos", () => {
  assert.equal(metadata.authors.fields.avatar_style.default, "illustration");
  assert.equal(metadata.authors.fields.avatar_emoji.default, "✍️");
  assert.match(prismaSchema, /model authors \{[\s\S]*avatar_style\s+String\s+@default\("illustration"\)/);
  assert.match(parityScript, /ALTER TABLE \\`authors\\` ADD COLUMN \$\{quote\(column\)\}/);
  assert.match(parityScript, /await ensureAuthorAvatarSchema\(report\)/);
});
