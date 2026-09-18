import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const scriptUrl = new URL("../scripts/normalize-delhi-ncr.mjs", import.meta.url);
const setupUrl = new URL("../scripts/setup-runtime-database.mjs", import.meta.url);

test("runtime database setup canonicalizes exact college state aliases", async () => {
  const [script, setup] = await Promise.all([
    readFile(scriptUrl, "utf8"),
    readFile(setupUrl, "utf8"),
  ]);

  assert.match(script, /prisma\.colleges\.updateMany/);
  assert.match(script, /"Delhi", "delhi", "DELHI"/);
  assert.match(script, /"New Delhi", "new delhi"/);
  assert.match(script, /"NCT of Delhi", "nct of delhi"/);
  assert.match(script, /"Delhi NCR"/);
  assert.doesNotMatch(script, /information_schema/);
  assert.match(setup, /scripts\/normalize-delhi-ncr\.mjs/);
});
