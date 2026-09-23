import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import {
  EXAM_FILTER_VERSION,
  classifyExamFilters,
  loadCanonicalExamCatalog,
  renderExamThemeLogo,
  validateExamFilters,
} from "../src/exam-catalog.mjs";

const repositoryRoot = new URL("../../", import.meta.url).pathname;
const prismaSchema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const parityScript = await readFile(new URL("../scripts/apply-mysql-parity.mjs", import.meta.url), "utf8");
const restSource = await readFile(new URL("../src/rest.mjs", import.meta.url), "utf8");

test("canonical exam catalog contains the complete deduplicated 400+ inventory", async () => {
  const { catalog, deletedSlugs, refreshReports } = await loadCanonicalExamCatalog(repositoryRoot);
  assert.equal(catalog.length, 485);
  assert.equal(deletedSlugs.length, 17);
  assert.equal(refreshReports.length, 41);
  assert.equal(new Set(catalog.map((exam) => exam.slug)).size, catalog.length);
  assert.equal(catalog.some((exam) => deletedSlugs.includes(exam.slug)), false);
});

test("all canonical exams receive valid non-empty public filters", async () => {
  const { catalog } = await loadCanonicalExamCatalog(repositoryRoot);
  for (const exam of catalog) {
    const filters = classifyExamFilters(exam);
    assert.deepEqual(validateExamFilters(filters), [], exam.slug);
    assert.equal(filters.exam_filter_version, EXAM_FILTER_VERSION);
  }
});

test("known exam families map to the intended listing facets", () => {
  const jee = classifyExamFilters({ slug: "jee-main", name: "JEE Main", full_name: "Joint Entrance Examination Main", eligibility: "Class 12" });
  assert.equal(jee.listing_category, "Entrance");
  assert.ok(jee.exam_streams.includes("Engineering"));
  assert.ok(jee.course_groups.includes("B.E. / B.Tech"));
  assert.ok(jee.education_levels.includes("12th"));

  const board = classifyExamFilters({ slug: "cbse-class-10-board-exam", name: "CBSE Class 10 Board Exam" });
  assert.equal(board.listing_category, "Board");
  assert.deepEqual(board.education_levels, ["10th"]);

  const afcat = classifyExamFilters({ slug: "afcat", name: "AFCAT", full_name: "Air Force Common Admission Test" });
  assert.equal(afcat.listing_category, "Sarkari");
  assert.ok(afcat.exam_streams.includes("Defence"));
  assert.ok(afcat.course_groups.includes("Government Recruitment"));

  const ielts = classifyExamFilters({ slug: "ielts", name: "IELTS", full_name: "International English Language Testing System" });
  assert.equal(ielts.listing_category, "Study Abroad");
  assert.deepEqual(ielts.education_levels, ["UG", "PG"]);
});

test("exam filter columns and runtime migration stay in schema parity", () => {
  for (const field of ["listing_category", "exam_streams", "course_groups", "education_levels", "exam_filter_version"]) {
    assert.match(prismaSchema, new RegExp(`model exams \\{[\\s\\S]*${field}`));
    assert.match(parityScript, new RegExp(`exams\\.${field}|${field}`));
  }
  assert.match(restSource, /JSON_OVERLAPS\(\$\{sqlColumn\}, \?\)/);
});

test("generated exam logos use the approved 1080 by 950 WebP canvas", async () => {
  const buffer = await renderExamThemeLogo({ slug: "sample-exam", name: "Sample Exam", short_name: "SAMPLE" }, null);
  const metadata = await sharp(buffer).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 950);
});
