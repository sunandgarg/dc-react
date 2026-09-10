import assert from "node:assert/strict";
import test from "node:test";
import { catExperienceInternals } from "../src/cat-experience.mjs";

const { cleanProfile, fallbackCoachPlan, fallbackFeedback, questionFor, safeScores } = catExperienceInternals;

test("CAT interview profiles are constrained to supported options", () => {
  assert.deepEqual(cleanProfile({ target: " IIM Ahmedabad \u0000 ", focus: "unknown", difficulty: "pressure" }), {
    target: "IIM Ahmedabad",
    focus: "general",
    difficulty: "pressure",
  });
});

test("guided interview scoring rewards concrete evidence and stays bounded", () => {
  const answer = "I led a team of 5, reduced processing time by 22%, and learned to test assumptions before deciding next time.";
  const feedback = fallbackFeedback(answer);
  assert.equal(feedback.scores.evidence, 8);
  assert.equal(feedback.strengths.length, 2);
  assert.deepEqual(safeScores({ clarity: 99, structure: -4 }, feedback.scores), {
    clarity: 10,
    structure: 1,
    relevance: feedback.scores.relevance,
    evidence: feedback.scores.evidence,
    confidence: feedback.scores.confidence,
  });
});

test("interview questions are deterministic and rotate", () => {
  const profile = cleanProfile({ focus: "academics" });
  assert.notEqual(questionFor(profile, 0), questionFor(profile, 1));
  assert.equal(questionFor(profile, 0), questionFor(profile, 10));
});

test("guided CAT coach creates a complete daily and weekly plan", () => {
  const plan = fallbackCoachPlan({ target_percentile: 97, hours_per_day: 3, weakest_section: "QA" });
  assert.equal(plan.section_goals.length, 3);
  assert.equal(plan.today.length, 3);
  assert.equal(plan.week.length, 7);
  assert.equal(plan.checkpoints.length, 3);
  assert.match(plan.headline, /97 percentile/);
});

test("CAT bundle delivery keeps the collection on private AWS storage", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../src/cat-experience.mjs", import.meta.url), "utf8"));
  assert.match(source, /const KIT_BUCKET = "user-documents"/);
  assert.match(source, /const KIT_OBJECT_PATH = "cat-kits\/CAT-2026-Preparation-Kit\.zip"/);
  assert.match(source, /KIT_MINIMUM_BYTES/);
  assert.match(source, /signStorageDownload\(KIT_BUCKET, KIT_OBJECT_PATH/);
  assert.doesNotMatch(source, /storage\/v1\/object\/public.*CAT-2026/);
});
