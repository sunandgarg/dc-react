import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/db.mjs";
import { articlePrompt, articleRevisionPrompt, assessGeneratedArticle, blogStudioContentVersion, blogStudioPublicationStatus, handleBlogStudio, resolveBlogStudioEvidence, prepareStudioArticlePublication, commitStudioArticlePublication, safeEditorialResearchUrl } from "../src/blog-ai.mjs";
import { handleRest } from "../src/rest.mjs";
import { handleContentReviews } from "../src/content-review.mjs";
import { readFile } from "node:fs/promises";
import { createHmac } from "node:crypto";
import { handleRequest } from "../src/index.mjs";

const evidence = [
  { name: "Admission authority", url: "https://admissions.example.gov.in/notice", source_type: "official", evidence_kind: "page_excerpt", signal: "The admission authority explains how applicants should compare qualifying subjects with the programme requirements." },
  { name: "University admission office", url: "https://university.example.ac.in/admission", source_type: "university", evidence_kind: "page_excerpt", signal: "The university admission office describes the document review process and asks applicants to retain their submitted records." },
];
const draft = {
  title: "Admission planning decisions before choosing your college",
  slug: "admission-planning-decisions",
  description: "Admission planning decisions before choosing your college start with a shortlist, a document check and a clear record of your choices.",
  meta_title: "Admission planning decisions for your college choice",
  meta_description: "Compare admission planning decisions before choosing your college, check programme requirements and keep a clear record of each choice.",
  category: "Admissions", vertical: "Education", tags: ["admission planning"],
  content_html: `<p>Admission planning decisions before choosing your college start with checking the route that fits your subjects and the documents you already hold. Start with your shortlist. A course name cannot tell you whether the published subject requirements match the qualifications on your marksheet, so keep the programme information beside your academic records.</p><h2>Which programme fits your subjects?</h2>${["Your qualifying subjects", "A document folder", "An application record", "A comparison sheet", "The next decision"].map((label) => `<p>${label} should help you compare the choices in front of you without rushing into an application that does not fit your goal. Keep the stated programme requirements beside your own records and note any question that needs an answer from the admission office. Give each college a separate entry so the details for one route do not become assumptions about another.</p>`).join("")}<h2>How should you retain the application record?</h2><ul><li>Keep your chosen programme name with the corresponding academic records.</li><li>Save the submitted application receipt in the same folder.</li><li>Write down the question you will ask the admission office before changing a choice.</li></ul>`,
  faqs: [
    { question: "Where can I keep a shortlist?", answer: "A saved shortlist can live in a simple document that you can reopen when comparing programmes." },
    { question: "Who answers a programme question?", answer: "Contact the admission office responsible for the particular programme before relying on informal advice." },
    { question: "Can I share my application password?", answer: "Keep login credentials private and share only the records that the admission office requests." },
    { question: "What should I do after submitting?", answer: "Read the acknowledgement and preserve a copy alongside the final application form." },
  ],
};

const snapshot = (siteScope = "dekhocampus") => ({
  id: "evidence-record", user_id: "admin-1", feature: "blog-studio", operation: "editorial-evidence", created_at: new Date(),
  metadata: { site_scope: siteScope, evidence, content_version: blogStudioContentVersion(draft, siteScope, evidence) },
});

const articleFixture = (status = "Draft") => {
  const { content_html, faqs, ...fields } = draft;
  return { ...fields, id: "studio-article", site_scope: "dekhocampus", status, is_active: status === "Published", tags: [...draft.tags, "blog-studio"], content: content_html.replace("each college", 'each <a href="/colleges">college</a>') };
};
const faqFixture = () => draft.faqs.map((faq, index) => ({ ...faq, id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, display_order: index, is_active: true }));

async function mockedPublication(run, { initialStatus = "Draft", stale = false, required = false, missing = false, rejectReview = false } = {}) {
  const overrides = [];
  const replace = (object, key, value) => { overrides.push([object, key, object[key]]); object[key] = value; };
  const state = { article: articleFixture(initialStatus), faqs: faqFixture(), writes: [], requests: [], review: null, lockedArticle: null };
  state.record = missing ? null : { ...snapshot(), created_at: new Date(Date.now() - (stale ? 25 * 60 * 60_000 : 0)), metadata: { ...snapshot().metadata, saved_article_id: state.article.id } };
  const query = async (sql, ...params) => {
    if (sql.includes("article_write_locks")) return [{ site_scope: params[0] }];
    if (sql.includes("FROM `ai_usage_events`")) return state.record ? [state.record] : [];
    if (sql.includes("FROM `content_change_reviews`")) return state.review ? [state.review] : [];
    if (sql.includes("FROM `articles`")) return [{ ...(sql.includes("FOR UPDATE") && state.lockedArticle ? state.lockedArticle : state.article) }];
    return [];
  };
  replace(prisma, "$queryRawUnsafe", query);
  replace(prisma, "$executeRawUnsafe", async (sql, ...params) => { state.writes.push({ sql, params }); return 1; });
  replace(prisma, "$transaction", async (operation) => operation(prisma));
  replace(prisma.faqs, "findMany", async () => state.faqs);
  replace(prisma.articles, "findMany", async () => []);
  replace(prisma.blog_auto_agent_settings, "findUnique", async () => ({ word_limit: 400, minimum_sources: 2, editorial_quality_target: 75, human_review_required: required }));
  replace(prisma.ai_runtime_controls, "findUnique", async () => null);
  replace(prisma.ai_providers, "findFirst", async () => ({ api_key_encrypted: "test-placeholder", default_model: "gpt-5.6-luna" }));
  replace(prisma.blog_ai_provider_settings, "findUnique", async () => null);
  replace(prisma.ai_usage_events, "create", async ({ data }) => { state.writes.push({ sql: "MOCK_USAGE_EVENT", params: [data] }); return data; });
  replace(globalThis, "fetch", async (url, options = {}) => {
    state.requests.push({ url, options });
    if (url === "https://api.openai.com/v1/chat/completions") return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ score: rejectReview ? 10 : 95, publishable: !rejectReview, issues: rejectReview ? ["Unsupported factual claim"] : [] }) } }] });
    assert.ok(evidence.some((source) => source.url === url), "Only server-stored research URLs may be refreshed");
    assert.equal(options.redirect, "error");
    return new Response(`<p>${evidence.find((source) => source.url === url).signal}</p>`);
  });
  try { await run(state); } finally { for (const [object, key, previous] of overrides.reverse()) object[key] = previous; }
}

test("Draft saves and unchanged published saves do not need live research or providers", async () => {
  await mockedPublication(async (state) => {
    assert.equal(await prepareStudioArticlePublication(state.article, { ...state.article, title: "A revised private title", status: "Draft", is_active: false }), null);
    assert.equal(await prepareStudioArticlePublication(state.article, { ...state.article, updated_at: new Date(), views: 9 }), null);
    assert.equal(state.requests.length, 0);
    const result = await handleRest("articles", new Request("http://localhost/v1/rest/articles?id=eq.studio-article", { method: "PATCH", body: JSON.stringify({ views: 9 }) }), { allowManualArticleTopicDuplicate: true });
    assert.equal(result.status, 200);
    assert.equal(state.requests.length, 0);
    assert.ok(state.writes.some(({ sql }) => sql.startsWith("UPDATE `articles`")));
  }, { initialStatus: "Published", stale: true, missing: true });
});

test("normal manual articles retain their existing publishing workflow", async () => {
  await mockedPublication(async (state) => {
    state.article.tags = ["manual"];
    assert.equal(await prepareStudioArticlePublication(state.article, { ...state.article, status: "Published", is_active: true }), null);
    const result = await handleRest("articles", new Request("http://localhost/v1/rest/articles?id=eq.studio-article", { method: "PATCH", body: JSON.stringify({ status: "Published", is_active: true }) }), { allowManualArticleTopicDuplicate: true });
    assert.equal(result.status, 200);
    assert.equal(state.requests.length, 0);
  }, { missing: true });
});

test("manual PATCH and bulk publication refresh stale server evidence and review final edited copy", async () => {
  await mockedPublication(async (state) => {
    const result = await handleRest("articles", new Request("http://localhost/v1/rest/articles?id=in.(studio-article)", { method: "PATCH", body: JSON.stringify({ status: "Published", is_active: true, description: `${draft.description} Keep the shortlist ready.`, data_source_urls: ["https://arbitrary.invalid/edited"] }) }), { allowManualArticleTopicDuplicate: true });
    assert.equal(result.status, 200);
    assert.equal(state.requests.filter(({ url }) => url !== "https://api.openai.com/v1/chat/completions").length, 2);
    assert.equal(state.requests.filter(({ url }) => url === "https://api.openai.com/v1/chat/completions").length, 1);
    const prompt = JSON.parse(state.requests.at(-1).options.body).messages.at(-1).content;
    assert.match(prompt, /Keep the shortlist ready/);
    assert.doesNotMatch(prompt, /arbitrary\.invalid/);
    const stored = state.writes.find(({ sql }) => sql.startsWith("UPDATE `ai_usage_events`"));
    assert.ok(JSON.parse(stored.params[0]).reviewed_content_version);
    assert.ok(state.writes.some(({ sql }) => sql.startsWith("UPDATE `articles`")));
  }, { stale: true });
});

test("upsert publishing cannot bypass the Studio final-content review", async () => {
  await mockedPublication(async (state) => {
    await assert.rejects(handleRest("articles", new Request("http://localhost/v1/rest/articles?on_conflict=id", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ id: state.article.id, site_scope: "dekhocampus", status: "Published", is_active: true }) }), { allowManualArticleTopicDuplicate: true }), (error) => error.code === "ARTICLE_QUALITY_GATE_FAILED");
    assert.ok(state.requests.some(({ url }) => url === "https://api.openai.com/v1/chat/completions"));
    assert.equal(state.writes.some(({ sql }) => /^(?:UPDATE|INSERT INTO) `articles`/.test(sql)), false);
  }, { rejectReview: true });
});

test("missing evidence or human-review policy blocks publication but never private Draft saves", async () => {
  for (const options of [{ missing: true }, { required: true }]) await mockedPublication(async (state) => {
    await assert.rejects(prepareStudioArticlePublication(state.article, { ...state.article, status: "Published", is_active: true }), (error) => /STUDIO_(?:EVIDENCE_REQUIRED|HUMAN_REVIEW_REQUIRED)/.test(error.code) && /Submit for human review/.test(error.message));
    const result = await handleRest("articles", new Request("http://localhost/v1/rest/articles?id=eq.studio-article", { method: "PATCH", body: JSON.stringify({ status: "Draft", is_active: false, content: "Work in progress" }) }), { allowManualArticleTopicDuplicate: true });
    assert.equal(result.status, 200);
    assert.equal(state.requests.length, 0);
  }, options);
});

test("publication rechecks the locked content and FAQ version, so concurrent edits cannot slip through", async () => {
  await mockedPublication(async (state) => {
    state.lockedArticle = { ...state.article, content: `${state.article.content}<p>A concurrent edit not reviewed by the provider.</p>` };
    await assert.rejects(handleRest("articles", new Request("http://localhost/v1/rest/articles?id=eq.studio-article", { method: "PATCH", body: JSON.stringify({ status: "Published", is_active: true }) }), { allowManualArticleTopicDuplicate: true }), (error) => error.code === "STUDIO_CONTENT_CHANGED_DURING_REVIEW");
    assert.equal(state.writes.some(({ sql }) => sql.startsWith("UPDATE `articles`")), false);
    const after = { ...state.article, status: "Published", is_active: true };
    const prepared = await prepareStudioArticlePublication(state.article, after);
    state.faqs = state.faqs.map((faq, index) => index ? faq : { ...faq, answer: "A concurrent FAQ correction." });
    await assert.rejects(commitStudioArticlePublication(prisma, state.article, after, prepared), (error) => error.code === "STUDIO_CONTENT_CHANGED_DURING_REVIEW");
  });
});

test("admin Content Review accepts an explicit human approval of the complete exact Studio snapshot", async () => {
  await mockedPublication(async (state) => {
    const after = { ...state.article, status: "Published", is_active: true, faqs: state.faqs };
    state.review = { id: "review-1", status: "pending", entity_type: "articles", entity_id: state.article.id, entity_slug: state.article.slug, operation: "update", before_json: state.article, after_json: after, changed_fields: ["status", "is_active"] };
    const request = (notes) => new Request("http://localhost/v1/functions/content-reviews", { method: "PATCH", body: JSON.stringify({ id: "review-1", status: "approved", review_notes: notes }) });
    await assert.rejects(handleContentReviews(request(""), "admin-reviewer"), (error) => error.code === "STUDIO_HUMAN_REVIEW_NOTE_REQUIRED");
    // No FAQ edits are included, but the full FAQ snapshot is shown to the reviewer.
    const updateFaqs = prisma.faqs.updateMany;
    prisma.faqs.updateMany = async () => ({ count: 1 });
    try {
      const result = await handleContentReviews(request("Checked final copy, programme requirements and factual claims."), "admin-reviewer");
      assert.equal(result.applied, true);
      const event = state.writes.find(({ sql }) => sql === "MOCK_USAGE_EVENT").params[0];
      assert.equal(event.metadata.human_reviewed_by, "admin-reviewer");
      assert.equal(event.metadata.human_reviewed_content_version, blogStudioContentVersion(after));
      assert.equal(state.requests.length, 0);
    } finally { prisma.faqs.updateMany = updateFaqs; }
  }, { missing: true, required: true });
});

test("research URL safety rejects local addresses, credentials, ports and unsafe protocols", () => {
  for (const url of ["http://authority.gov.in/a", "https://localhost/a", "https://127.0.0.1/a", "https://10.0.0.1/a", "https://[::1]/a", "https://u:p@authority.gov.in/a", "https://authority.gov.in:8443/a", "https://authority.internal/a"]) assert.equal(safeEditorialResearchUrl(url), null, url);
  assert.equal(safeEditorialResearchUrl("https://authority.gov.in/notice"), "https://authority.gov.in/notice");
});

test("human recovery is visible and remains behind existing article and admin approval permissions", async () => {
  const [index, editor, review] = await Promise.all(["../src/index.mjs", "../../src/pages/AdminArticles.tsx", "../../src/pages/AdminContentReview.tsx"].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  assert.ok(index.indexOf("await authorizeRest(table, request)") < index.indexOf("payload?._request_human_review === true"));
  assert.match(index, /functionMatch\[1\] === "content-reviews"[\s\S]*?isAdmin\(identity.id\)[\s\S]*?handleContentReviews/);
  assert.match(editor, /canPublish && editing.id[\s\S]*?Submit for human review/);
  assert.match(review, /complete proposed article and FAQs/);
});

test("the authenticated recovery action stages a review without changing article or writer permissions", async () => {
  await mockedPublication(async (state) => {
    const previousSecret = process.env.AUTH_JWT_SECRET;
    const previousUsers = prisma.app_auth_users.findUnique;
    const previousQuery = prisma.$queryRawUnsafe;
    const secret = "synthetic-test-jwt-secret-not-a-real-credential";
    process.env.AUTH_JWT_SECRET = secret;
    prisma.app_auth_users.findUnique = async ({ where }) => ({ id: where.id, user_metadata: {}, created_at: new Date(), updated_at: new Date() });
    let role = "manager";
    prisma.$queryRawUnsafe = async (sql, ...params) => {
      if (sql.includes("FROM `user_roles`")) return sql.includes("`role` = 'admin'") ? (role === "admin" ? [{ 1: 1 }] : []) : [{ role }];
      return previousQuery(sql, ...params);
    };
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = (id) => {
      const data = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}`;
      return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
    };
    const recovery = (authorized = true) => new Request("http://localhost/v1/rest/articles?id=eq.studio-article&site_scope=eq.dekhocampus", { method: "PATCH", headers: { ...(authorized ? { authorization: `Bearer ${token("test-editor")}` } : {}), prefer: "return=representation" }, body: JSON.stringify({ ...state.article, status: "Published", is_active: true, faqs: state.faqs, _request_human_review: true }) });
    try {
      assert.equal((await handleRequest(recovery(false))).status, 401);
      role = "content_writer";
      assert.equal((await handleRequest(recovery())).status, 403);
      assert.equal(state.writes.length, 0);
      role = "manager";
      const response = await handleRequest(recovery());
      assert.equal(response.status, 202);
      assert.equal(response.headers.get("x-dc-review-status"), "pending");
      assert.ok(state.writes.some(({ sql }) => sql.startsWith("INSERT INTO `content_change_reviews`")));
      assert.equal(state.writes.some(({ sql }) => sql.startsWith("UPDATE `articles`")), false);
      const deniedApproval = await handleRequest(new Request("http://localhost/v1/functions/content-reviews", { method: "PATCH", headers: { authorization: `Bearer ${token("test-editor")}` }, body: JSON.stringify({ id: "review-1", status: "approved", review_notes: "Checked facts" }) }));
      assert.equal(deniedApproval.status, 403);
      assert.equal(state.requests.length, 0);
    } finally {
      if (previousSecret === undefined) delete process.env.AUTH_JWT_SECRET; else process.env.AUTH_JWT_SECRET = previousSecret;
      prisma.app_auth_users.findUnique = previousUsers;
      prisma.$queryRawUnsafe = previousQuery;
    }
  }, { required: true, missing: true });
});

test("public REST and ArticleDetail never expose the internal origin marker", async () => {
  await mockedPublication(async (state) => {
    const request = new Request("http://localhost/v1/rest/articles?select=id,tags");
    const publicResult = await handleRest("articles", request, { publicAccess: true });
    assert.deepEqual(publicResult.body[0].tags, draft.tags);
    const adminResult = await handleRest("articles", request, {});
    assert.ok(adminResult.body[0].tags.includes("blog-studio"));
    const source = await readFile(new URL("../../src/pages/ArticleDetail.tsx", import.meta.url), "utf8");
    assert.match(source, /tags: \(dbArticle.tags \|\| \[\]\).filter\(\(tag\) => tag !== "blog-studio"\)/);
    assert.ok(source.indexOf('tag !== "blog-studio"') < source.indexOf("keywords: article.tags"));
  });
});

test("Studio can save unfinished Draft content with no evidence snapshot or provider request", async () => {
  await mockedPublication(async (state) => {
    const previousAuthor = prisma.authors.findFirst;
    const previousCreate = prisma.articles.create;
    prisma.authors.findFirst = async () => ({ id: "editor-author", name: "Test editorial author" });
    prisma.articles.create = async ({ data }) => { state.writes.push({ sql: "MOCK_ARTICLE_CREATE", params: [data] }); return data; };
    try {
      const result = await handleBlogStudio(new Request("http://localhost/studio", { method: "POST", body: JSON.stringify({ action: "publish", status: "Draft", site_scope: "dekhocampus", draft: { title: "My unfinished admission draft", slug: "unfinished-admission-draft", content_html: "<p>Work in progress.</p>", faqs: [] } }) }), "admin-editor");
      assert.equal(result.article.status, "Draft");
      assert.equal(state.requests.length, 0);
      const saved = state.writes.find(({ sql }) => sql === "MOCK_ARTICLE_CREATE").params[0];
      assert.equal(saved.is_active, false);
      assert.ok(saved.tags.includes("blog-studio"));
      const event = state.writes.find(({ sql }) => sql === "MOCK_USAGE_EVENT").params[0];
      assert.equal(event.metadata.reviewed_content_version, null);
      assert.deepEqual(event.metadata.evidence, []);
    } finally { prisma.authors.findFirst = previousAuthor; prisma.articles.create = previousCreate; }
  }, { missing: true });
});

test("Studio status respects the saved review policy while retaining explicit draft saves", () => {
  assert.equal(blogStudioPublicationStatus("Published", { human_review_required: true }), "Draft");
  assert.equal(blogStudioPublicationStatus("Draft", { human_review_required: false }), "Draft");
  assert.equal(blogStudioPublicationStatus("Published", { human_review_required: false }), "Published");
});

test("the reviewed content version changes with article or FAQ edits, not presentation suggestions", () => {
  const version = blogStudioContentVersion(draft, "dekhocampus", evidence);
  assert.notEqual(blogStudioContentVersion({ ...draft, content_html: `${draft.content_html}<p>Keep the receipt.</p>` }, "dekhocampus", evidence), version);
  assert.notEqual(blogStudioContentVersion({ ...draft, faqs: [] }, "dekhocampus", evidence), version);
  assert.equal(blogStudioContentVersion({ ...draft, entity_suggestions: [{ entity_type: "exam", entity_slug: "x" }] }, "dekhocampus", evidence), version);
  const persisted = { ...draft, content: draft.content_html };
  assert.equal(blogStudioContentVersion({ ...persisted, content_html: "Client-supplied field that REST does not store" }), blogStudioContentVersion(persisted));
});

test("Studio evidence rejects missing, expired, invalid, other-user or other-site snapshots", async () => {
  const resolve = (record, id = "evidence-record") => resolveBlogStudioEvidence(id, "admin-1", "dekhocampus", 2, { ai_usage_events: { findUnique: async () => record } });
  assert.deepEqual((await resolve(snapshot())).signals, evidence);
  for (const record of [null, { ...snapshot(), user_id: "admin-2" }, snapshot("sarkari"), { ...snapshot(), created_at: new Date(Date.now() - 25 * 60 * 60_000) }, { ...snapshot(), created_at: "invalid" }]) {
    await assert.rejects(resolve(record), (error) => error.code === "STUDIO_EVIDENCE_REQUIRED");
  }
  await assert.rejects(resolve(snapshot(), ""), (error) => error.code === "STUDIO_EVIDENCE_REQUIRED");
  await assert.rejects(resolve({ ...snapshot(), metadata: { ...snapshot().metadata, evidence: evidence.map((source) => ({ ...source, evidence_kind: "availability_only" })) } }), (error) => error.code === "INSUFFICIENT_EDITORIAL_SOURCES");
});

test("writing and revision prompts require matching primary-source facts rather than URL availability", () => {
  for (const prompt of [articlePrompt(draft.title, evidence), articleRevisionPrompt(draft, draft.title, evidence)]) {
    assert.match(prompt, /URL availability alone does not verify facts/);
    assert.match(prompt, /different exam/);
    assert.match(prompt, /official authority's fetched excerpt/);
  }
});

test("Studio checks edited content against stored excerpts and saves review-required articles privately", async () => {
  const overrides = [];
  const replace = (object, key, value) => { overrides.push([object, key, object[key]]); object[key] = value; };
  const requests = [];
  const saved = [];
  const reviewed = [];
  let siteScope = "dekhocampus";
  let humanReviewRequired = true;
  replace(prisma.blog_auto_agent_settings, "findUnique", async () => ({ word_limit: 400, minimum_sources: 2, editorial_quality_target: 75, human_review_required: humanReviewRequired }));
  replace(prisma.articles, "findMany", async () => []);
  replace(prisma.authors, "findFirst", async () => ({ id: "author-1", name: "Test editorial author" }));
  replace(prisma.ai_usage_events, "findUnique", async () => snapshot(siteScope));
  replace(prisma.ai_usage_events, "create", async ({ data }) => data);
  replace(prisma.ai_runtime_controls, "findUnique", async () => null);
  replace(prisma.ai_providers, "findFirst", async () => ({ api_key_encrypted: "test-placeholder", default_model: "gpt-5.6-luna" }));
  replace(prisma.blog_ai_provider_settings, "findUnique", async () => null);
  replace(prisma, "$transaction", async (operation) => operation({
    $queryRawUnsafe: async (sql, scope) => sql.includes("article_write_locks") ? [{ site_scope: scope }] : [{ id: "entity-1" }],
    articles: { findMany: async () => [], create: async ({ data }) => { saved.push(data); return data; } },
    faqs: { createMany: async ({ data }) => { assert.ok(data.every((faq) => faq.is_active === (saved.at(-1).status === "Published"))); } },
    article_links: { create: async () => {} },
    ai_usage_events: { update: async ({ data }) => { reviewed.push(data.metadata); } },
  }));
  replace(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/chat/completions");
    const prompt = JSON.parse(options.body).messages.at(-1).content;
    requests.push(prompt);
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ score: 95, publishable: true, issues: [] }) } }] });
  });
  try {
    const edited = { ...draft, description: `${draft.description} Keep the shortlist ready.`, content_html: draft.content_html.replace("each college", 'each <a href="/colleges">college</a>') };
    const assessment = assessGeneratedArticle(edited, edited, 400, { editorial_quality_target: 75, evidenceSignals: evidence });
    assert.equal(assessment.passed, true, assessment.issues.join("; "));
    for (const scenario of [
      { scope: "dekhocampus", required: true, requested: "Published", expected: "Draft" },
      { scope: "dekhocampus", required: false, requested: "Draft", expected: "Draft" },
      { scope: "sarkari", required: false, requested: "Published", expected: "Published" },
    ]) {
      siteScope = scenario.scope;
      humanReviewRequired = scenario.required;
      const result = await handleBlogStudio(new Request("http://localhost/studio", { method: "POST", body: JSON.stringify({ action: "publish", status: scenario.requested, site_scope: siteScope, draft: edited, evidence_id: "evidence-record", research_sources: ["https://invented.example.gov.in/facts"], entity_links: [] }) }), "admin-1");
      assert.equal(result.article.status, scenario.expected);
      assert.equal(saved.at(-1).is_active, scenario.expected === "Published");
      assert.deepEqual(saved.at(-1).data_source_urls, evidence.map((source) => source.url));
      assert.equal(saved.at(-1).data_verified_at, null);
      assert.equal(result.content_changed, true);
      assert.equal(reviewed.at(-1).reviewed_content_version, scenario.expected === "Published" ? result.content_version : null);
      if (scenario.expected === "Published") {
        assert.match(requests.at(-1), /The admission authority explains/);
        assert.match(requests.at(-1), /Keep the shortlist ready/);
        assert.match(requests.at(-1), /URL availability alone does not verify facts/);
        assert.doesNotMatch(requests.at(-1), /invented\.example/);
        assert.equal(result.content_version, blogStudioContentVersion({ ...saved.at(-1), faqs: edited.faqs }));
      }
    }
  } finally {
    for (const [object, key, previous] of overrides.reverse()) object[key] = previous;
  }
});
