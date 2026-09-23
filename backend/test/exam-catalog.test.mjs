import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import {
  EXAM_FILTER_VERSION,
  classifyExamFilters,
  loadCanonicalExamCatalog,
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

test("every exam has an audited identity, with no generated ring logos or hidden omissions", async () => {
  const { catalog } = await loadCanonicalExamCatalog(repositoryRoot);
  const identities = JSON.parse(await readFile(new URL("../../shared/exam-identities.json", import.meta.url), "utf8"));
  const audit = JSON.parse(await readFile(new URL("../../reports/exam-official-logo-audit.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(identities).sort(), catalog.map((row) => row.slug).sort());
  const unresolved = [];
  const checkedAssets = new Set();
  for (const exam of catalog) {
    const identity = identities[exam.slug];
    assert.ok(identity.short_name && identity.full_name, exam.slug);
    assert.doesNotMatch(identity.full_name, /20\d{2}\s*[:|]|dates.*eligibility/i, exam.slug);
    assert.doesNotMatch(identity.logo, /exam-logos-v[123]/, exam.slug);
    if (identity.logo_status === "unresolved") {
      assert.equal(identity.logo, "", exam.slug);
      assert.ok(identity.review_note, exam.slug);
      unresolved.push(exam.slug);
    } else {
      assert.ok(identity.source_url, exam.slug);
      if (identity.logo_status === "official_source_reviewed") assert.ok(identity.source_page, exam.slug);
      if (identity.logo.startsWith("/exam-logos/") && !checkedAssets.has(identity.logo)) {
        const metadata = await sharp(await readFile(new URL(`../../public${identity.logo}`, import.meta.url))).metadata();
        assert.equal(metadata.format, "webp", exam.slug);
        assert.ok(metadata.width > 0 && metadata.height > 0 && Math.max(metadata.width, metadata.height) <= 700, exam.slug);
        checkedAssets.add(identity.logo);
      }
    }
  }
  assert.deepEqual(unresolved.sort(), audit.unresolved.map((row) => row.slug).sort());
  assert.equal(Object.values(audit.counts).reduce((sum, value) => sum + value, 0), catalog.length);
});
