import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  articleSlugFromTitle,
  assertNoRejectedDraftArtifacts,
  isArticleQualityGateRejection,
  PRODUCTION_BLOG_SMOKE_POLICY,
  rejectedTopicSlugs,
  validateArticleQualityGateRejection,
} from "../src/blog-smoke.mjs";

function qualityError(overrides = {}) {
  const error = new Error("Article failed the editorial quality gate: add verified details");
  Object.assign(error, {
    status: 422,
    code: "ARTICLE_QUALITY_GATE_FAILED",
    details: {
      passed: false,
      score: 76,
      target_score: 90,
      issues: ["Editorial review: add verified details"],
      checks: [{ name: "Useful depth", passed: true }],
      model_review: {
        score: 76,
        publishable: false,
        required_score: 85,
        issues: ["Add verified details"],
        strengths: ["Clear structure"],
        model_used: "openai:gpt-5.4-mini",
      },
      ...overrides,
    },
  });
  return error;
}

test("accepts only a structurally valid 85/90 OpenAI quality rejection", () => {
  assert.deepEqual(validateArticleQualityGateRejection(qualityError()), {
    kind: "independent-review",
    score: 76,
    targetScore: 90,
    reviewScore: 76,
    reviewTarget: 85,
    modelUsed: "openai:gpt-5.4-mini",
    issueCount: 1,
  });
  assert.deepEqual(PRODUCTION_BLOG_SMOKE_POLICY, {
    qualityTarget: 90,
    reviewTarget: 85,
    provider: "openai",
    model: "gpt-5.4-mini",
    modelUsed: "openai:gpt-5.4-mini",
  });
});

test("accepts a deterministic 90-point gate rejection when review was never reached", () => {
  const error = qualityError({
    score: 82,
    issues: ["Required reader module is missing"],
    checks: [{ name: "Required reader modules", passed: false }],
    model_review: undefined,
  });
  assert.deepEqual(validateArticleQualityGateRejection(error), {
    kind: "deterministic",
    score: 82,
    targetScore: 90,
    reviewScore: null,
    reviewTarget: null,
    modelUsed: null,
    issueCount: 1,
  });
});

test("does not classify any other provider or HTTP failure as a quality rejection", () => {
  assert.equal(isArticleQualityGateRejection(qualityError()), true);
  assert.equal(isArticleQualityGateRejection({ status: 500, code: "ARTICLE_QUALITY_GATE_FAILED" }), false);
  assert.equal(isArticleQualityGateRejection({ status: 422, code: "OPENAI_REQUEST_FAILED" }), false);
  assert.equal(isArticleQualityGateRejection(new Error("timeout")), false);
});

test("rejects a malformed quality response or weakened gate", () => {
  assert.throws(() => validateArticleQualityGateRejection(qualityError({ target_score: 89 })), /quality target changed/i);
  assert.throws(() => validateArticleQualityGateRejection(qualityError({ model_review: { ...qualityError().details.model_review, required_score: 84 } })), /review target changed/i);
  assert.throws(() => validateArticleQualityGateRejection(qualityError({ model_review: { ...qualityError().details.model_review, model_used: "gemini:gemini-3.6-flash" } })), /unexpected provider or model/i);
  assert.throws(() => validateArticleQualityGateRejection(qualityError({ issues: [] })), /no actionable issue/i);
  assert.throws(() => validateArticleQualityGateRejection(qualityError({ model_review: undefined })), /neither deterministic nor independent-review failure evidence/i);
});

test("derives the exact rejected slugs and rejects escaped content artifacts", () => {
  const run = {
    status: "failed",
    model_provider: "openai",
    created_article_ids: [],
    selected_topics: [{ title: "JNU UG Admissions & CUET Papers 2027" }],
  };
  assert.equal(articleSlugFromTitle(run.selected_topics[0].title), "jnu-ug-admissions-and-cuet-papers-2027");
  assert.deepEqual(rejectedTopicSlugs(run), ["jnu-ug-admissions-and-cuet-papers-2027"]);
  assert.doesNotThrow(() => assertNoRejectedDraftArtifacts());
  assert.throws(() => assertNoRejectedDraftArtifacts({ articles: [{ id: "escaped" }] }), /leaked 1 article/i);
  assert.throws(() => assertNoRejectedDraftArtifacts({ faqs: [{ id: "escaped" }] }), /leaked 1 FAQ/i);
  assert.throws(() => assertNoRejectedDraftArtifacts({ storageKeys: ["admin-uploads/blog-covers/escaped.webp"] }), /leaked 1 cover/i);
});

test("production smoke rethrows every non-quality error and checks all artifact stores", async () => {
  const source = await readFile(new URL("../scripts/verify-production-blog-agent.mjs", import.meta.url), "utf8");
  assert.match(source, /if \(!isArticleQualityGateRejection\(error\)\) throw error/);
  assert.match(source, /validateArticleQualityGateRejection\(error\)/);
  assert.match(source, /prisma\.articles\.findMany/);
  assert.match(source, /prisma\.faqs\.findMany/);
  assert.match(source, /listRejectedCoverKeys/);
  assert.match(source, /assertNoRejectedDraftArtifacts/);
  assert.match(source, /PRODUCTION_BLOG_SMOKE_POLICY\.qualityTarget/);
});
