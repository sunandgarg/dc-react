import assert from "node:assert/strict";
import test from "node:test";
import {
  articlePrompt,
  articleSiteProfile,
  articleTitleSimilarity,
  articleTopicSimilarity,
  assessGeneratedArticle,
  assertArticleTopicsAvailable,
  compactArticleCoverage,
  findDuplicateArticleTitle,
  findDuplicateArticleTopic,
  handleArticleCover,
  handleBlogStudio,
  indiaDayWindow,
  loadArticleCoverage,
  normalizeArticleTitle,
  normalizeArticleSiteScope,
  normalizeTopicSuggestions,
  STRICT_ARTICLE_DUPLICATE_THRESHOLD,
} from "../src/blog-ai.mjs";

test("same-day duplicate coverage uses the India calendar boundary", () => {
  const { start, end } = indiaDayWindow(new Date("2026-09-18T20:00:00.000Z"));
  assert.equal(start.toISOString(), "2026-09-18T18:30:00.000Z");
  assert.equal(end.toISOString(), "2026-09-19T18:30:00.000Z");
});

test("article coverage applies a bounded created-at window to the final query", async () => {
  const start = new Date("2026-09-18T18:30:00.000Z");
  const end = new Date("2026-09-19T18:30:00.000Z");
  let captured;
  await loadArticleCoverage("dekhocampus", {
    articles: {
      findMany: async (args) => {
        captured = args;
        return [];
      },
    },
  }, { start, end });
  assert.deepEqual(captured.where.created_at, { gte: start, lt: end });
  assert.equal(captured.where.site_scope, "dekhocampus");
});

test("Sarkari studio uses a dedicated government-job editorial profile", () => {
  assert.equal(normalizeArticleSiteScope("sarkari"), "sarkari");
  assert.equal(normalizeArticleSiteScope(""), "dekhocampus");
  assert.equal(normalizeArticleSiteScope(null), "dekhocampus");
  assert.throws(
    () => normalizeArticleSiteScope("unknown"),
    (error) => error?.status === 400 && error?.code === "INVALID_ARTICLE_SITE_SCOPE",
  );
  assert.throws(
    () => normalizeArticleSiteScope(" sarkari "),
    (error) => error?.status === 400 && error?.code === "INVALID_ARTICLE_SITE_SCOPE",
  );
  assert.equal(articleSiteProfile("sarkari").defaultCategory, "Latest Jobs");
  const prompt = articlePrompt("SSC CGL 2026 notification", [], 800, [], "sarkari");
  assert.match(prompt, /Sarkari DekhoCampus/);
  assert.match(prompt, /Latest Jobs, Results, Admit Card, Answer Key, Admissions, Syllabus, Scholarships/);
  assert.match(prompt, /Never imply that Sarkari DekhoCampus is the recruiting authority/);
});

test("custom article AI endpoints reject explicit non-canonical tenant scopes", async () => {
  for (const handler of [handleBlogStudio, handleArticleCover]) {
    await assert.rejects(
      handler(new Request("http://localhost/admin/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ site_scope: " sarkari ", topic: "SSC CGL 2026" }),
      })),
      (error) => error?.status === 400 && error?.code === "INVALID_ARTICLE_SITE_SCOPE",
    );
  }
});

test("normalizes article titles without collapsing meaningful numbers", () => {
  assert.equal(normalizeArticleTitle("JEE Main 2026: Dates & Registration"), "jee main 2026 dates and registration");
});

test("detects near-duplicate DekhoCampus coverage", () => {
  const existing = [{ title: "JEE Main 2026 Registration Dates and Application Process", slug: "jee-main-2026-registration-dates" }];
  assert.ok(articleTitleSimilarity(existing[0].title, "JEE Main 2026 Application and Registration Dates") >= 0.82);
  assert.equal(findDuplicateArticleTitle({ title: "JEE Main 2026 Application and Registration Dates" }, existing), existing[0]);
});

test("allows genuinely different articles", () => {
  const existing = [{ title: "JEE Main 2026 Registration Dates", slug: "jee-main-2026-registration-dates" }];
  assert.equal(findDuplicateArticleTitle({ title: "NEET Biology Revision Strategy for 2026" }, existing), null);
});

test("blocks cosmetic headline changes for the same entity, year and intent", () => {
  const existing = [{
    title: "UPSC NDA 2 Admit Card 2026 Release Date and Download Steps",
    slug: "upsc-nda-2-admit-card-2026",
    description: "Release and download instructions for the NDA 2 hall ticket.",
    tags: ["NDA", "admit card"],
  }];
  const candidate = {
    title: "How to Download NDA II Hall Ticket 2026 and Check Exam-Day Rules",
    angle: "The hall-ticket download workflow and exam-day checks",
    search_intent: "admit card download",
    primary_entity: "UPSC NDA 2",
  };
  assert.ok(articleTopicSimilarity(existing[0], candidate) >= 0.82);
  assert.equal(findDuplicateArticleTopic(candidate, existing), existing[0]);
});

test("allows the same exam to answer a materially different intent", () => {
  const existing = [{ title: "JEE Main 2026 Registration Dates and Application Process" }];
  const candidate = { title: "JEE Main 2026 Physics Syllabus and Chapter Weightage" };
  assert.ok(articleTopicSimilarity(existing[0], candidate) < 0.82);
  assert.equal(findDuplicateArticleTopic(candidate, existing), null);
});

test("keeps separate sessions and annual editions distinct", () => {
  assert.ok(articleTopicSimilarity("CAT 2025 Slot 1 Paper Analysis", "CAT 2025 Slot 2 Paper Analysis") < 0.82);
  assert.ok(articleTopicSimilarity("NEET UG 2025 Counselling Dates", "NEET UG 2026 Counselling Dates") < 0.82);
});

test("the final write gate blocks renamed coverage below the suggestion threshold", async () => {
  const existing = [{
    id: "existing-article",
    title: "JEE Main 2026 Counselling Schedule and Process",
    slug: "jee-main-2026-counselling-schedule-and-process",
  }];
  const candidate = { title: "JEE Main 2026 Counselling Dates Complete Student Guide" };
  const score = articleTopicSimilarity(existing[0], candidate);
  assert.ok(score >= STRICT_ARTICLE_DUPLICATE_THRESHOLD && score < 0.82);
  await assert.rejects(
    assertArticleTopicsAvailable([candidate], { client: { articles: { findMany: async () => existing } } }),
    (error) => error?.status === 409 && error?.code === "DUPLICATE_ARTICLE" && /already covers/i.test(error.message),
  );
});

test("the final write gate excludes the article being legitimately edited", async () => {
  const existing = [{
    id: "current-article",
    title: "JEE Main 2026 Counselling Schedule and Process",
    slug: "jee-main-2026-counselling-schedule-and-process",
  }];
  await assert.doesNotReject(assertArticleTopicsAvailable([existing[0]], {
    client: { articles: { findMany: async () => existing } },
    excludeIds: [existing[0].id],
  }));
});

test("compresses prior coverage into an inexpensive subject and intent fingerprint", () => {
  const fingerprint = compactArticleCoverage({ title: "Bihar NEET UG Merit List 2026 Release Date" });
  assert.match(fingerprint, /bihar/);
  assert.match(fingerprint, /neet/);
  assert.match(fingerprint, /ug/);
  assert.match(fingerprint, /merit-list/);
  assert.match(fingerprint, /2026/);
});

test("editorial quality gate accepts useful structured copy and rejects thin source-led copy", () => {
  const usefulParagraph = Array.from({ length: 8 }, (_, paragraphIndex) => `<p>${Array.from({ length: 50 }, (_, index) => (
    index % 12 === 11 ? "CAT preparation decision practice review." : `specific${paragraphIndex}-${index} guidance`
  )).join(" ")}</p>`).join("");
  const decisionTable = "<table><thead><tr><th>Study block</th><th>Decision</th></tr></thead><tbody><tr><td>Practice</td><td>Protect a fixed slot</td></tr></tbody></table>";
  const good = assessGeneratedArticle({
    title: "CAT 2026 Preparation Plan for Working Graduates",
    description: "A practical CAT 2026 plan that helps working graduates divide practice, review errors and protect mock-test time each week.",
    meta_title: "CAT 2026 Preparation Plan for Working Graduates",
    meta_description: "Build a realistic CAT 2026 study plan around a full-time job, weekly mock analysis, focused revision blocks and measurable improvement priorities.",
    content_html: `<h2>Answer first</h2><p>Working graduates can make CAT 2026 preparation sustainable by protecting fixed practice and review blocks.</p>${usefulParagraph}<h2>Key facts</h2><ul><li>Practise</li><li>Review</li></ul>${decisionTable}<h2>Decision guidance</h2><p>Track decisions and revise the plan.</p>`,
    faqs: [1, 2, 3, 4].map((number) => ({ question: `Question ${number}?`, answer: `Useful answer ${number}.` })),
  }, "CAT 2026 preparation plan for working graduates", 1200);
  assert.equal(good.passed, true, good.issues.join("; "));

  const semanticAnswerFirst = assessGeneratedArticle({
    ...{
      title: "CAT 2026 Preparation Plan for Working Graduates",
      description: "A practical CAT 2026 plan that helps working graduates divide practice, review errors and protect mock-test time each week.",
      meta_title: "CAT 2026 Preparation Plan for Working Graduates",
      meta_description: "Build a realistic CAT 2026 study plan around a full-time job, weekly mock analysis, focused revision blocks and measurable improvement priorities.",
      content_html: `<p>Working graduates can make CAT 2026 preparation sustainable by protecting fixed practice and review blocks.</p>${usefulParagraph}<h2>Key facts</h2><ul><li>Practise</li><li>Review</li></ul>${decisionTable}<h2>Decision guidance</h2><p>Track decisions and revise the plan.</p>`,
      faqs: [1, 2, 3, 4].map((number) => ({ question: `Question ${number}?`, answer: `Useful answer ${number}.` })),
    },
  }, "CAT 2026 preparation plan for working graduates", 1200);
  assert.equal(semanticAnswerFirst.passed, true, semanticAnswerFirst.issues.join("; "));
  assert.equal(semanticAnswerFirst.checks.find((check) => check.name === "Required reader modules")?.passed, true);

  const flattened = assessGeneratedArticle({
    ...{
      title: "CUET UG 2027 Subject Choice for Delhi University and BHU",
      description: "A practical CUET UG 2027 subject-choice check for students comparing university eligibility rules before they submit the form.",
      meta_title: "CUET UG 2027 Subject Choice for DU and BHU",
      meta_description: "Check CUET UG 2027 subject matching before choosing papers for Delhi University and BHU, with a practical eligibility check.",
      content_html: `<p>CUET UG 2027 subject choice can decide whether an otherwise strong score is usable for the course you want.</p>${usefulParagraph}<h2>Which subjects should you choose?</h2><p>Check<br>What to confirm<br>Real consequence<br>Recognition<br>Commerce Mathematics and Accountancy Subject mismatch Check the university rule</p>`,
      faqs: [1, 2, 3, 4].map((number) => ({ question: `Question ${number}?`, answer: `Useful answer ${number}.` })),
    },
  }, "CUET UG 2027 subject selection", 1200);
  assert.equal(flattened.passed, false);
  assert.ok(flattened.issues.some((issue) => issue.includes("line-by-line table copy")));

  const missingSpecificity = assessGeneratedArticle({
    title: "CAT 2026 Preparation Plan for Working Graduates",
    description: "A practical CAT 2026 plan that helps working graduates divide practice, review errors and protect mock-test time each week.",
    meta_title: "CAT 2026 Preparation Plan for Working Graduates",
    meta_description: "Build a realistic CAT 2026 study plan around a full-time job, weekly mock analysis, focused revision blocks and measurable improvement priorities.",
    content_html: `<p>Students can make CAT 2026 preparation sustainable by protecting fixed practice and review blocks.</p>${usefulParagraph}<h2>Key facts</h2><ul><li>Practise</li><li>Review</li></ul>${decisionTable}<h2>Decision guidance</h2><p>Track decisions and revise the plan.</p>`,
    faqs: [1, 2, 3, 4].map((number) => ({ question: `Question ${number}?`, answer: `Useful answer ${number}.` })),
  }, "CAT 2026 preparation plan for working graduates", 1200, {
    evidenceSignals: [{ name: "Delhi University admissions", signal: "The official rule names Delhi University as the responsible institution." }],
  });
  assert.equal(missingSpecificity.passed, false);
  assert.ok(missingSpecificity.issues.some((issue) => issue.includes("supported named authority")));

  const bad = assessGeneratedArticle({
    title: "CAT update",
    description: "Thin copy",
    content_html: '<h2>Update</h2><p>Read https://example.com for details.</p>',
    faqs: [],
  }, "CAT 2026 preparation", 1200);
  assert.equal(bad.passed, false);
  assert.ok(bad.issues.some((issue) => issue.includes("source URL")));

  const leaked = assessGeneratedArticle({
    title: "CAT 2026 Preparation Plan for Working Graduates",
    description: "According to Shiksha, this plan helps working graduates prepare for CAT with weekly practice and review.",
    meta_title: "CAT 2026 Preparation Plan for Working Graduates",
    meta_description: "Build a realistic CAT 2026 study plan around a full-time job, weekly mock analysis, focused revision blocks and measurable improvement priorities.",
    content_html: `<h2>Answer first</h2><p>Working graduates can make CAT 2026 preparation sustainable by protecting fixed practice and review blocks.</p>${usefulParagraph}<h2>Key facts</h2><ul><li>Practise</li><li>Review</li></ul>${decisionTable}<h2>Decision guidance</h2><p>Track decisions and revise the plan.</p>`,
    faqs: [1, 2, 3, 4].map((number) => ({ question: `Question ${number}?`, answer: `Useful answer ${number}.` })),
  }, "CAT 2026 preparation plan for working graduates", 1200);
  assert.equal(leaked.passed, false);
  assert.ok(leaked.issues.some((issue) => issue.includes("competitor name or source-attribution phrase")));
});

test("compact article mode enforces the 350-400 word body range", () => {
  const compactParagraphs = Array.from({ length: 3 }, (_, paragraphIndex) => `<p>${Array.from({ length: 100 }, (_, index) => index % 18 === 0 ? "CAT 2027 preparation" : `decision${paragraphIndex}-${index}`).join(" ")}</p>`).join("");
  const compact = assessGeneratedArticle({
    title: "CAT 2027 Preparation Plan for Working Graduates",
    description: "A focused CAT 2027 preparation plan for working graduates who need a realistic weekly routine, mock review and clear next steps.",
    meta_title: "CAT 2027 Preparation Plan for Graduates",
    meta_description: "Build a practical CAT 2027 preparation routine with weekly practice, mock review and time-saving decisions for working graduates.",
    content_html: `<h2>Answer first</h2><p>CAT 2027 preparation works for working graduates when the weekly plan protects practice time and honest mock review.</p>${compactParagraphs}<h2>What to protect each week</h2><ul><li>Practice</li><li>Review</li></ul><table><thead><tr><th>Block</th><th>Action</th></tr></thead><tbody><tr><td>Mock</td><td>Review errors</td></tr></tbody></table><h2>When the plan needs changing</h2><p>Short. Change one decision after each mock, then keep the rest of the routine steady so improvement has a fair chance to show.</p>`,
    faqs: [1, 2, 3, 4].map((number) => ({ question: `Who should use plan ${number}?`, answer: `Working graduates can use this plan ${number}.` })),
  }, "CAT 2027 preparation plan for working graduates", 350);
  assert.equal(compact.passed, true, compact.issues.join("; "));
  assert.ok(compact.checks.find((check) => check.name === "Useful depth")?.passed);

  const compactListParagraphs = Array.from({ length: 3 }, (_, paragraphIndex) => `<p>${Array.from({ length: 94 }, (_, index) => index % 18 === 0 ? "CAT 2027 preparation" : `decision-list${paragraphIndex}-${index}`).join(" ")}</p>`).join("");
  const compactListOnly = assessGeneratedArticle({
    title: "CAT 2027 Preparation Plan for Working Graduates",
    description: "A focused CAT 2027 preparation plan for working graduates who need a realistic weekly routine, mock review and clear next steps.",
    meta_title: "CAT 2027 Preparation Plan for Graduates",
    meta_description: "Build a practical CAT 2027 preparation routine with weekly practice, mock review and time-saving decisions for working graduates.",
    content_html: `<h2>Answer first</h2><p>CAT 2027 preparation works for working graduates when the weekly plan protects practice time and honest mock review.</p>${compactListParagraphs}<h2>What to protect each week</h2><ul><li>Practice one timed section.</li><li>Review every avoidable error.</li><li>Change one decision after the mock.</li></ul><h2>When the plan needs changing</h2><p>Short. Change one decision after each mock, then keep the rest of the routine steady so improvement has a fair chance to show.</p>`,
    faqs: [1, 2, 3, 4].map((number) => ({ question: `Who should use list plan ${number}?`, answer: `Working graduates can use this list plan ${number}.` })),
  }, "CAT 2027 preparation plan for working graduates", 350);
  assert.equal(compactListOnly.passed, true, compactListOnly.issues.join("; "));
  assert.equal(compactListOnly.checks.find((check) => check.name === "Decision structure")?.passed, true);
});

test("normalizes Gemini topic strings and alternate object keys", () => {
  assert.deepEqual(normalizeTopicSuggestions({ topics: ["NEET UG counselling checklist"] }), [{
    title: "NEET UG counselling checklist",
    angle: "",
    category: "Education",
    tags: [],
    trend_based: false,
  }]);
  assert.deepEqual(normalizeTopicSuggestions({ opportunities: [{ headline: "IIT application document guide", tags: "admissions" }] }), [{
    headline: "IIT application document guide",
    title: "IIT application document guide",
    angle: "",
    category: "Education",
    tags: [],
    trend_based: false,
  }]);
  assert.deepEqual(normalizeTopicSuggestions({ research: { article_opportunities: { first: { topic: "CUET subject choice guide" } } } }), [{
    topic: "CUET subject choice guide",
    title: "CUET subject choice guide",
    angle: "",
    category: "Education",
    tags: [],
    trend_based: false,
  }]);
});
