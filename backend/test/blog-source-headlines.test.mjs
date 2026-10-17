import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/db.mjs";
import { articleHasCompetitorReference, articlePrompt, assessGeneratedArticle, extractEditorialArticleCandidates, researchSignals, verifyEditorialArticle } from "../src/blog-ai.mjs";

test("extracts real article URLs and keeps each source's exact slug", () => {
  const shiksha = extractEditorialArticleCandidates(`
    <a href="/news">All News</a>
    <a href="/news/engineering">Latest Engineering News and Updates</a>
    <a href="https://evil.example/news/fake-story-blogId-99">External article</a>
    <a class="card" href="/news/engineering-jee-main-2027-exam-dates-blogId-244659"><span>JEE Main 2027 Exam Dates: Check Session 1 &amp; Session 2 Schedule</span></a>
    <a href="/news/engineering-jee-main-2027-exam-dates-blogId-244659">JEE Main 2027 Exam Dates: Check Session 1 &amp; Session 2 Schedule</a>
  `, "https://www.shiksha.com/news");
  assert.deepEqual(shiksha, [{
    title: "JEE Main 2027 Exam Dates: Check Session 1 & Session 2 Schedule",
    slug: "engineering-jee-main-2027-exam-dates-blogId-244659",
    url: "https://www.shiksha.com/news/engineering-jee-main-2027-exam-dates-blogId-244659",
  }]);

  const sarvgyan = extractEditorialArticleCandidates(
    '<h2><a href="https://www.sarvgyan.com/articles/ceed-2027">CEED 2027: Registration (Started), Exam Date &amp; Eligibility</a></h2>',
    "https://www.sarvgyan.com/category/articles",
  );
  assert.equal(sarvgyan[0].slug, "ceed-2027");
  assert.equal(sarvgyan[0].title, "CEED 2027: Registration (Started), Exam Date & Eligibility");
});

test("source-led writing keeps only the headline, not the competitor's body or structure", () => {
  const prompt = articlePrompt({ title: "JEE Main 2027 Exam Dates: Check Session 1 & Session 2 Schedule", preserve_title: true }, []);
  assert.match(prompt, /Use the supplied headline exactly as the title and hero_hook/);
  assert.match(prompt, /article body must be independently written and fact-checked/);
  assert.match(prompt, /Never name or link to a competitor in any publishable field/);
});

test("rejects competitor branding across publishable fields, including configured sources", () => {
  const sources = [{ name: "CampusOrbit Education News", url: "https://campusorbit.example.com/news", source_type: "competitor_gap" }];
  assert.equal(articleHasCompetitorReference({ title: "JEE Main 2027 dates", faqs: [{ question: "What next?", answer: "See Campus Orbit for details" }] }, sources), true);
  assert.equal(articleHasCompetitorReference({ title: "JEE Main 2027 dates", tags: ["FindMyCollege"], content_html: "<p>Useful advice.</p>" }, sources), true);
  assert.equal(articleHasCompetitorReference({ title: "JEE Main 2027 dates", content_html: '<a href="https://campusorbit.example.com/news">Read more</a>' }, sources), true);
  assert.equal(articleHasCompetitorReference({ title: "JEE Main 2027 dates", content_html: "<p>Check the NTA notice.</p>" }, sources), false);
});

test("short source headlines pass the title check only when verified as exact", () => {
  const title = "SBI PO answer key 2026 released";
  const draft = { title, content_html: "<p>Article body.</p>", faqs: [] };
  const titleCheck = (settings) => assessGeneratedArticle(draft, draft, 0, settings).checks.find((check) => check.name === "Specific title");
  assert.equal(titleCheck({}).passed, false);
  assert.equal(titleCheck({ sourceTitle: title }).passed, true);
});

test("the article H1, not the listing-card text, becomes the exact title", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("<h1>JEE Main 2027 Exam Dates: Check Session 1 &amp; Session 2 Schedule</h1>", { headers: { "content-type": "text/html" } });
  try {
    const article = await verifyEditorialArticle({ title: "Short listing teaser", slug: "jee-main-2027-blogId-244659", url: "https://www.shiksha.com/news/jee-main-2027-blogId-244659" });
    assert.equal(article.title, "JEE Main 2027 Exam Dates: Check Session 1 & Session 2 Schedule");
    assert.equal(article.slug, "jee-main-2027-blogId-244659");
  } finally { globalThis.fetch = originalFetch; }
});

test("skips an exact source headline if it names the competitor", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("<h1>Shiksha explains JEE Main 2027 application dates</h1>", { headers: { "content-type": "text/html" } });
  try {
    await assert.rejects(verifyEditorialArticle({ title: "Listing teaser", slug: "jee-main-2027-blogId-244659", url: "https://www.shiksha.com/news/jee-main-2027-blogId-244659" }), /no usable headline/);
  } finally { globalThis.fetch = originalFetch; }
});

test("disabled configured competitors stay disabled and mislabeled competitors are not official evidence", async () => {
  const originalFindMany = prisma.blog_research_sources.findMany;
  const originalFetch = globalThis.fetch;
  const fetched = [];
  prisma.blog_research_sources.findMany = async () => [
    { name: "Shiksha", url: "https://www.shiksha.com/news/", source_type: "competitor", is_active: false, display_order: 1 },
    { name: "Sarvgyan", url: "https://www.sarvgyan.com/category/articles", source_type: "official", is_active: true, display_order: 2 },
  ];
  globalThis.fetch = async (url) => {
    fetched.push(url);
    return new Response(url.includes("sarvgyan")
      ? '<h2><a href="/articles/ceed-2027">CEED 2027 Registration Started: Exam Date and Eligibility</a></h2>'
      : "<rss><item><title>Education admission and exam updates for Indian students in 2026 and 2027</title></item></rss>",
    { headers: { "content-type": url.includes("sarvgyan") ? "text/html" : "application/rss+xml" } });
  };
  try {
    const signals = await researchSignals(4);
    assert.equal(fetched.some((url) => url.includes("shiksha.com")), false);
    const sarvgyan = signals.find((source) => source.name === "Sarvgyan");
    assert.equal(sarvgyan.source_type, "competitor_gap");
    assert.equal(sarvgyan.article_candidates[0].slug, "ceed-2027");
  } finally {
    prisma.blog_research_sources.findMany = originalFindMany;
    globalThis.fetch = originalFetch;
  }
});
