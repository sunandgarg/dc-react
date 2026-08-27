import assert from "node:assert/strict";
import test from "node:test";
import { applyDefaults, decodeRow, nextShortIdValue, normalizeForDatabase, resolveConflictColumns } from "../src/rest.mjs";

test("returns MySQL decimal fields as JSON numbers", () => {
  const row = decodeRow("colleges", { rating: { toNumber: () => 4.75 } });
  assert.equal(row.rating, 4.75);
});

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

test("stores blank optional dates as null for MySQL", () => {
  assert.equal(normalizeForDatabase("", { type: "DateTime", nullable: true, format: "date" }), null);
  assert.equal(normalizeForDatabase("2026-08-27", { type: "DateTime", nullable: true, format: "date" }), "2026-08-27");
});
