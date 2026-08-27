import assert from "node:assert/strict";
import test from "node:test";
import { applyDefaults, nextShortIdValue, resolveConflictColumns } from "../src/rest.mjs";

test("applies empty arrays for required PostgreSQL array fields", () => {
  const college = applyDefaults("colleges", { name: "QA College", slug: "qa-college" });

  assert.deepEqual(college.categories, []);
  assert.deepEqual(college.tags, []);
  assert.deepEqual(college.related_courses, []);
});

test("defaults required jsonb objects but leaves nullable fields alone", () => {
  const college = applyDefaults("colleges", { name: "QA College", slug: "qa-college" });

  assert.deepEqual(college.data_source_urls, {});
  assert.equal(college.parent_university_slug, undefined);
});

test("allocates short ids in the imported resource ranges", () => {
  assert.equal(nextShortIdValue("colleges", null), 10001);
  assert.equal(nextShortIdValue("courses", 24567n), 24568);
  assert.equal(nextShortIdValue("exams", 30500), 30501);
  assert.equal(nextShortIdValue("scholarships", 100), undefined);
});

test("uses primary keys for upserts without an explicit conflict target", () => {
  assert.deepEqual(resolveConflictColumns("blog_auto_agent_settings"), ["id"]);
});

test("preserves an explicit upsert conflict target", () => {
  assert.deepEqual(resolveConflictColumns("blog_research_sources", "url"), ["url"]);
});
