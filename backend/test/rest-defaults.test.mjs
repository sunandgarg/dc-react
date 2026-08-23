import assert from "node:assert/strict";
import test from "node:test";
import { applyDefaults } from "../src/rest.mjs";

test("applies empty arrays for required PostgreSQL array fields", () => {
  const college = applyDefaults("colleges", { name: "QA College", slug: "qa-college" });

  assert.deepEqual(college.categories, []);
  assert.deepEqual(college.tags, []);
  assert.deepEqual(college.related_courses, []);
});

test("does not invent defaults for nullable or jsonb fields", () => {
  const college = applyDefaults("colleges", { name: "QA College", slug: "qa-college" });

  assert.equal(college.data_source_urls, undefined);
  assert.equal(college.parent_university_slug, undefined);
});
