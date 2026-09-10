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
