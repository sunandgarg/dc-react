import assert from "node:assert/strict";

export const PRODUCTION_BLOG_SMOKE_POLICY = Object.freeze({
  qualityTarget: 90,
  reviewTarget: 85,
  provider: "openai",
  model: "gpt-5.4-mini",
  modelUsed: "openai:gpt-5.4-mini",
});

export function isArticleQualityGateRejection(error) {
  return error?.status === 422 && error?.code === "ARTICLE_QUALITY_GATE_FAILED";
}

export function validateArticleQualityGateRejection(error) {
  assert.equal(error?.status, 422, "Quality-gate rejection must use HTTP 422");
  assert.equal(error?.code, "ARTICLE_QUALITY_GATE_FAILED", "Unexpected quality-gate error code");
  assert.match(String(error?.message || ""), /^Article failed the editorial quality gate:/, "Quality-gate rejection did not identify the guarded operation");

  const details = error?.details;
  assert.ok(details && typeof details === "object" && !Array.isArray(details), "Quality-gate rejection has no structured details");
  assert.equal(details.passed, false, "Rejected article was not marked as failed");
  assert.equal(details.target_score, PRODUCTION_BLOG_SMOKE_POLICY.qualityTarget, "Deterministic article quality target changed");
  assert.ok(Number.isInteger(details.score) && details.score >= 0 && details.score <= 100, "Quality-gate rejection has an invalid score");
  assert.ok(Array.isArray(details.issues) && details.issues.some((issue) => String(issue || "").trim()), "Quality-gate rejection has no actionable issue");
  assert.ok(Array.isArray(details.checks) && details.checks.length > 0, "Quality-gate rejection has no deterministic check evidence");

  const review = details.model_review;
  if (review !== undefined && review !== null) {
    assert.ok(review && typeof review === "object" && !Array.isArray(review), "Independent review evidence is malformed");
    assert.equal(review.required_score, PRODUCTION_BLOG_SMOKE_POLICY.reviewTarget, "Independent article review target changed");
    assert.equal(review.publishable, false, "Independent review did not reject the guarded draft");
    assert.ok(Number.isInteger(review.score) && review.score >= 0 && review.score <= 100, "Independent review has an invalid score");
    assert.ok(Array.isArray(review.issues) && review.issues.some((issue) => String(issue || "").trim()), "Independent review rejection has no actionable issue");
    assert.equal(review.model_used, PRODUCTION_BLOG_SMOKE_POLICY.modelUsed, "Independent review used an unexpected provider or model");
    assert.ok(details.score <= review.score, "Combined quality score is inconsistent with the independent review");
    return {
      kind: "independent-review",
      score: details.score,
      targetScore: details.target_score,
      reviewScore: review.score,
      reviewTarget: review.required_score,
      modelUsed: review.model_used,
      issueCount: details.issues.length,
    };
  }

  const deterministicFailure = details.checks.some((check) => check?.passed === false)
    || details.issues.some((issue) => /^Critical:/i.test(String(issue || "")));
  assert.equal(deterministicFailure, true, "Quality-gate rejection has neither deterministic nor independent-review failure evidence");
  return {
    kind: "deterministic",
    score: details.score,
    targetScore: details.target_score,
    reviewScore: null,
    reviewTarget: null,
    modelUsed: null,
    issueCount: details.issues.length,
  };
}

export function articleSlugFromTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function rejectedTopicSlugs(run) {
  assert.equal(run?.status, "failed", "Quality-gate run was not persisted as failed");
  assert.equal(run?.model_provider, PRODUCTION_BLOG_SMOKE_POLICY.provider, "Quality-gate run used an unexpected text provider");
  assert.ok(Array.isArray(run?.created_article_ids), "Quality-gate run has malformed created-article evidence");
  assert.equal(run.created_article_ids.length, 0, "Quality-gate run recorded a created article");
  assert.ok(Array.isArray(run?.selected_topics) && run.selected_topics.length > 0, "Quality-gate run has no selected-topic evidence");
  const slugs = [...new Set(run.selected_topics
    .map((topic) => articleSlugFromTitle(typeof topic === "string" ? topic : topic?.title))
    .filter(Boolean))];
  assert.ok(slugs.length > 0, "Quality-gate run selected topics without usable slugs");
  return slugs;
}

export function assertNoRejectedDraftArtifacts({ articles = [], faqs = [], storageKeys = [] } = {}) {
  assert.equal(articles.length, 0, `Quality-gate rejection leaked ${articles.length} article row(s)`);
  assert.equal(faqs.length, 0, `Quality-gate rejection leaked ${faqs.length} FAQ row(s)`);
  assert.equal(storageKeys.length, 0, `Quality-gate rejection leaked ${storageKeys.length} cover object(s)`);
}
