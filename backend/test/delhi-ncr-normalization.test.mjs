import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const scriptUrl = new URL("../scripts/normalize-delhi-ncr.mjs", import.meta.url);
const setupUrl = new URL("../scripts/setup-runtime-database.mjs", import.meta.url);

test("explicit state cleanup verifies its result without running on every deployment", async () => {
  const [script, setup] = await Promise.all([
    readFile(scriptUrl, "utf8"),
    readFile(setupUrl, "utf8"),
  ]);

  assert.match(script, /UPDATE colleges/);
  assert.match(script, /'delhi'/);
  assert.match(script, /'new delhi'/);
  assert.match(script, /'nct of delhi'/);
  assert.match(script, /'delhi ncr'/);
  assert.match(script, /BINARY state <> BINARY 'Delhi NCR'/);
  assert.doesNotMatch(script, /information_schema/);
  assert.doesNotMatch(setup, /scripts\/normalize-delhi-ncr\.mjs/);
});
