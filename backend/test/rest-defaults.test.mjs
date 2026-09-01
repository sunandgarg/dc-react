import assert from "node:assert/strict";
import test from "node:test";
import { applyDefaults, decodeRow, nextShortIdValue, normalizeForDatabase, omitDerivedFields, resolveConflictColumns } from "../src/rest.mjs";

test("returns MySQL decimal fields as JSON numbers", () => {
  const row = decodeRow("colleges", { rating: { toNumber: () => 4.75 } });
  assert.equal(row.rating, 4.75);
});

test("canonicalizes imported storage URLs at the API boundary", () => {
  const previous = process.env.MEDIA_BASE_URL;
  process.env.MEDIA_BASE_URL = "https://dekhocampus.com/storage/v1/object/public";
  try {
    const row = decodeRow("career_profiles", {
      image: "https://old-media.example/storage/v1/object/public/admin-uploads/careers/photo.webp",
    });
    assert.equal(row.image, "https://dekhocampus.com/storage/v1/object/public/admin-uploads/careers/photo.webp");
  } finally {
    if (previous === undefined) delete process.env.MEDIA_BASE_URL;
    else process.env.MEDIA_BASE_URL = previous;
  }
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

test("materializes SQL current-date defaults before raw inserts", () => {
  const university = applyDefaults("universities", { name: "QA University" });
  assert.match(university.daily_count_reset_at, /^\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(university.daily_count_reset_at, "CURRENT_DATE");
});

test("does not accept manually supplied college course counts", () => {
  assert.deepEqual(
    omitDerivedFields("colleges", { slug: "qa-college", courses_count: 999 }),
    { slug: "qa-college" },
  );
  assert.deepEqual(
    omitDerivedFields("courses", { slug: "mba", courses_count: 999 }),
    { slug: "mba", courses_count: 999 },
  );
});
