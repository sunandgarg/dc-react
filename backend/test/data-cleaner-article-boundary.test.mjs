import assert from "node:assert/strict";
import test from "node:test";
import { isDataCleanerFieldEditable } from "../src/data-cleaner.mjs";

test("article cleaner cannot mutate tenant identity or duplicate-sensitive fields", () => {
  for (const field of ["id", "site_scope", "title", "slug", "created_at", "updated_at"]) {
    assert.equal(isDataCleanerFieldEditable("articles", field), false, `${field} must remain protected`);
  }
  assert.equal(isDataCleanerFieldEditable("articles", "description"), true);
  assert.equal(isDataCleanerFieldEditable("articles", "content"), true);
});

test("identity-field restriction remains specific to articles", () => {
  assert.equal(isDataCleanerFieldEditable("scholarships", "title"), true);
  assert.equal(isDataCleanerFieldEditable("colleges", "name"), true);
  assert.equal(isDataCleanerFieldEditable("colleges", "id"), false);
});
