#!/usr/bin/env node

import assert from "node:assert/strict";
import sharp from "sharp";
import { createBlogCover, DEFAULT_BLOG_COVER_TEMPLATE_KEY } from "../src/blog-ai.mjs";
import { prisma } from "../src/db.mjs";
import { toStoredMediaKeys } from "../src/media-values.mjs";
import { deleteStorageObjectKeys } from "../src/storage.mjs";

const titles = [
  "A pragmatic year-long plan for engineering and technology admissions in India: timelines, counselling workflows, and contingency steps",
  "ICAR AIEEA PG 2026 Seat Matrix and Choice Locking Strategy: Online Allotment Protocols and College Verification Steps",
  "AICTE Pragati and Saksham Scholarship 2026-27: Eligibility Criteria, Income Caps, and Portal Application Timeline",
  "NSP AY 2026-27 Registration Process: Step-by-Step One Time Registration and Aadhaar Biometric Unlocking Guide",
  "UPSC Civil Services Mains 2026 Schedule Analysis: Weekend Shift Timings, Entry Desk Rules, and Paper-Wise Instructions",
  "AP EAMCET BiPC Phase 1 Seat Allotment 2026: Online Self-Reporting Workflow, Joining Deadlines, and College Verification Checklist",
  "JEECUP 2026 Round 6 Seat Allotment Reporting: Physical Document Verification at District Help Centres and Fee Submission Steps",
  "JSSC Para Teacher Sahayak Acharya Recruitment 2026: 7299 Vacancies Breakdown, JTET Rules, and Online Portal Steps",
  "ICSI CS December 2026 Registration Opens: Examination Form Fee, Module Choices, and Step-by-Step Submission Guide",
  "Odisha College Canteen Dietary Mandate: High-Oil Food Restrictions and Health Rules for Student Hostels",
  "Reorganizing the National Testing Agency: What the Appointment of New Senior Directors Means for Future Entrance Examinations",
  "Creator Economy Education in India: Specialized Undergraduate Courses in Digital Storytelling and YouTube Media Production",
  "Electric Vehicle Design and Battery Engineering Degrees in India: Top Colleges, Syllabi, and Career Opportunities",
  "Maharashtra Pharma D Admission 2026: Institutional Quota Rules, Eligibility Criteria, and Post-Merit Seat Allocation Schedule",
  "High-Speed Rail Engineering Opportunities in India: Specialized Courses, Skill Requirements, and Career Scope in Bullet Train Infrastructure",
  "Nandan Nilekani High-Powered Task Force on NTA Reforms: How Public Consultations Will Reshape Exam Security and Student Mental Health",
  "IIT BHU Non-Teaching Recruitment 2026: SAMARTH Portal Registration Steps, Cadre-Wise Qualification, and Speed Post Verification Rules",
  "WBJEE 2026 Online Decentralised Counselling Controversy: JUTA Objections, Seat Upgradation Rules, and Eligibility Criteria",
  "MCC NEET UG Counselling 2026 Round 2 AIQ Schedule: Registration Window, Choice Filling, and Seat Resignation Rules",
  "BITSAT 2026 Iteration 9 Admission Mandate: Fee Payment Deadline and Campus Reporting Protocols",
  "AP EAMCET 2026 BiPC Phase 1 Seat Allotment Guidelines: Online Reporting, Self-Acceptance, and College Joining Protocol",
  "NIELIT Amaravati Quantum and AI University Campus: Courses, MeitY Grant, and Temporary Setup at ANU",
  "JKSSB PWD Draftsman and Works Supervisor Recruitment 2026: Vacancy Breakup and August 30 Application Deadline",
  "TG PGECET 2026 Phase 2 Web Options Strategy: Verified Candidate List and MTech College Preference Rules",
  "NEET PG 2026 Single Shift CBT Guidelines: Mandatory Identification Proofs and Test Centre Entry Timings",
  "BSEB 2027 Dummy Registration Card Correction Window Extended: Verification Steps and Student Declaration Mandate",
  "Maharashtra BSc Nursing CAP 2026: Registration Timeline, Mandatory CET Verification, and Seat Matrix Guide",
  "Bihar Mahila Vishwavidyalaya 2026: Admission Vision, All-Women Faculty Model, and Balika PhD Fellowship Details",
];

const requestedArticleId = String(process.env.ARTICLE_COVER_REPAIR_ID || "").trim();

const matches = await prisma.articles.findMany({
  where: requestedArticleId
    ? { id: requestedArticleId, title: { in: titles } }
    : { title: { in: titles } },
  select: { id: true, title: true, slug: true, featured_image: true },
});
const requestedTitles = requestedArticleId ? matches.map((article) => article.title) : titles;
assert.ok(!requestedArticleId || matches.length === 1, `Article ${requestedArticleId} is not on the repair allowlist`);
const grouped = Map.groupBy(matches, (article) => article.title);
const missing = requestedTitles.filter((title) => !grouped.has(title));
const ambiguous = requestedTitles.filter((title) => (grouped.get(title)?.length || 0) !== 1);
assert.deepEqual(missing, [], `Missing article titles: ${missing.join(" | ")}`);
assert.deepEqual(ambiguous, [], `Article titles must match exactly one row: ${ambiguous.join(" | ")}`);

const replacements = [];
for (const title of requestedTitles) {
  const article = grouped.get(title)[0];
  const diagnostics = {};
  const featuredImage = await createBlogCover(article.slug, article.title, {
    imageMode: "template",
    templateUrl: DEFAULT_BLOG_COVER_TEMPLATE_KEY,
    includeLogo: false,
    aspectRatio: "16:9",
    resolution: "web",
    diagnostics,
  });
  const response = await fetch(featuredImage, { signal: AbortSignal.timeout(30_000) });
  assert.equal(response.ok, true, `New cover is not publicly readable for ${article.slug}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, "webp", `New cover is not WebP for ${article.slug}`);
  assert.equal(metadata.width, 1600, `Unexpected cover width for ${article.slug}`);
  assert.equal(metadata.height, 900, `Unexpected cover height for ${article.slug}`);
  const bottomCenter = await sharp(bytes)
    .extract({ left: 800, top: 820, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer();
  assert.ok([...bottomCenter].every((channel) => channel > 220), `Retired dark-panel cover detected for ${article.slug}`);
  const titleStats = await sharp(bytes)
    .extract({ left: 260, top: 270, width: 1080, height: 380 })
    .greyscale()
    .stats();
  assert.ok(titleStats.channels[0].min < 80, `Rendered title is missing for ${article.slug}`);

  await prisma.articles.update({
    where: { id: article.id },
    data: { featured_image: featuredImage, updated_at: new Date() },
  });
  replacements.push({
    id: article.id,
    slug: article.slug,
    title: article.title,
    hook: article.title,
    old_image: article.featured_image || null,
    new_image: featuredImage,
    source_mode: diagnostics.sourceMode,
  });
}

const oldKeys = [...new Set(replacements
  .map((entry) => String(toStoredMediaKeys(entry.old_image) || ""))
  .filter((key) => key.startsWith("admin-uploads/blog-covers/")))];
if (oldKeys.length && !requestedArticleId) await deleteStorageObjectKeys(oldKeys);

console.log(JSON.stringify({
  ok: true,
  requested: requestedTitles.length,
  matched: matches.length,
  replaced: replacements.length,
  old_s3_objects_deleted: requestedArticleId ? 0 : oldKeys.length,
  rollback_objects_preserved: requestedArticleId ? oldKeys.length : 0,
  openai_image_calls: 0,
  replacements,
}, null, 2));
await prisma.$disconnect();
