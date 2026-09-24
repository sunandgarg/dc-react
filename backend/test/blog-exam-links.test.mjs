import test from "node:test";
import assert from "node:assert/strict";
import { candidateOfficialExamUrl, insertVerifiedExamLinks, matchExamRecord, resolveExamLinkContext } from "../src/blog-exam-links.mjs";
import { articlePrompt, assessGeneratedArticle } from "../src/blog-ai.mjs";

const jee = {
  slug: "jee-main-2026", name: "JEE Main", short_name: "JEE Main",
  full_name: "Joint Entrance Examination Main", official_website: "https://jeemain.nta.nic.in/",
  is_active: true, data_verified_at: null,
};

test("matches the named exam rather than a generic admission record", () => {
  assert.equal(matchExamRecord("JEE Main 2027 session choice", [
    { ...jee, name: "CAT", short_name: "CAT", full_name: "Common Admission Test" }, jee,
  ]), jee);
  assert.equal(matchExamRecord("College admission funding options", [jee]), null);
});

test("only public HTTPS official or verified exam URLs are candidates", () => {
  assert.equal(candidateOfficialExamUrl(jee), "https://jeemain.nta.nic.in/");
  assert.equal(candidateOfficialExamUrl({ ...jee, official_website: "http://jeemain.nta.nic.in/" }), null);
  assert.equal(candidateOfficialExamUrl({ ...jee, official_website: "https://localhost/admin", data_verified_at: new Date() }), null);
  assert.equal(candidateOfficialExamUrl({ ...jee, official_website: "https://shiksha.com/jee", data_verified_at: new Date() }), null);
  assert.equal(candidateOfficialExamUrl({ ...jee, official_website: "https://unknown-example.com/" }), null);
  assert.equal(candidateOfficialExamUrl({ ...jee, official_website: "https://exam-board.example.org/", data_verified_at: new Date() }), "https://exam-board.example.org/");
});

test("links an active exact exam page and live official site", async () => {
  const context = await resolveExamLinkContext("JEE Main 2027 registration", {
    client: { exams: { findMany: async () => [jee] } },
    fetchImpl: async () => new Response("ok", { status: 200 }),
  });
  assert.deepEqual(context.internalLinks, [{ path: "/exams/jee-main-2026", label: "JEE Main exam guide" }]);
  assert.equal(context.officialSignal.url, "https://jeemain.nta.nic.in/");
  const html = insertVerifiedExamLinks('<p>Start with the <a href="/exams">exam list</a>.</p>', context);
  assert.match(html, /href="\/exams\/jee-main-2026"/);
  assert.doesNotMatch(html, /href="\/exams"/);
  assert.match(html, /href="https:\/\/jeemain\.nta\.nic\.in\/"/);
  assert.equal(insertVerifiedExamLinks(html, context), html);
});

test("inactive exam page or dead and redirected official sites are not linked", async () => {
  const client = { exams: { findMany: async () => [{ ...jee, is_active: false }] } };
  const inactive = await resolveExamLinkContext("JEE Main result", { client, fetchImpl: async () => new Response("ok") });
  assert.deepEqual(inactive.internalLinks, []);
  assert.ok(inactive.officialSignal);
  const dead = await resolveExamLinkContext("JEE Main result", { client, fetchImpl: async () => new Response("missing", { status: 404 }) });
  assert.equal(dead.officialSignal, null);
  const redirected = await resolveExamLinkContext("JEE Main result", {
    client,
    fetchImpl: async () => ({ ok: true, url: "https://shiksha.com/jee", body: null }),
  });
  assert.equal(redirected.officialSignal, null);
});

test("generation prioritizes the exact exam link without the generic-entity hard stop", () => {
  const prompt = articlePrompt("JEE Main 2027 registration", [
    { name: "JEE Main official exam website", url: "https://jeemain.nta.nic.in/", source_type: "official" },
  ], 400, [], { verifiedExamLinks: [{ path: "/exams/jee-main-2026", label: "JEE Main exam guide" }] });
  assert.ok(prompt.indexOf('"path":"/exams/jee-main-2026"') < prompt.indexOf('"path":"/exams"'));
  assert.match(prompt, /official website appears here/);

  const result = assessGeneratedArticle({
    title: "JEE Main 2027 registration rules and dates explained",
    description: "Read what students should verify before the JEE Main registration window opens and how to use the official portal safely.",
    content_html: "<p>Registration details can change before the application window opens.</p>",
  }, "JEE Main 2027 registration", 400, {
    evidenceSignals: [{ name: "NTA JEE Main bulletin", signal: "National Testing Agency" }],
  });
  assert.ok(!result.issues.some((issue) => issue.includes("article stays generic instead of using a supported named authority")));
  assert.ok(!result.checks.some((check) => check.name === "Evidence-led specificity"));
});
