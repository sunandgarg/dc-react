import assert from "node:assert/strict";
import test from "node:test";
import { buildAutomationPlan, buildAutomationPreview, buildPartnerRequest, getPrefillOverrides, isLeadReadyForAutomation, ruleMatches } from "../src/lead-automation.mjs";
import { retryDelayMs } from "../src/lead-outbox.mjs";

test("matches lead automation conditions with all and any modes", () => {
  const lead = { city: "New Delhi", state: "Delhi", current_situation: "MBA", source: "website" };
  assert.equal(ruleMatches({ match_cities: ["delhi"], match_courses: ["mba"], match_states: [], match_sources: [], match_ctas: [], match_all: true }, lead), true);
  assert.equal(ruleMatches({ match_cities: ["mumbai"], match_courses: ["mba"], match_states: [], match_sources: [], match_ctas: [], match_all: false }, lead), true);
  assert.equal(ruleMatches({ match_cities: ["mumbai"], match_courses: ["btech"], match_states: [], match_sources: [], match_ctas: [], match_all: false }, lead), false);
});

test("matches punctuation-normalized courses and generic specialization fields", () => {
  const lead = { city: "New Delhi", state: "Delhi", current_situation: "B.Tech Computer Science and Engineering", source: "website" };
  assert.equal(ruleMatches({ match_cities: [], match_courses: ["btech"], match_states: ["Delhi"], match_sources: [], match_ctas: [], match_fields: {}, match_all: true }, lead), true);
  assert.equal(ruleMatches({ match_cities: [], match_courses: [], match_states: [], match_sources: [], match_ctas: [], match_fields: { specialization: ["computer science"] }, match_all: true }, lead), true);
  assert.equal(ruleMatches({ match_cities: [], match_courses: [], match_states: [], match_sources: [], match_ctas: [], match_fields: { specialization: ["mechanical"] }, match_all: true }, lead), false);
});

test("accepts a complete routing lead when its course is stored in the course slug", () => {
  assert.equal(isLeadReadyForAutomation({ city: "New Delhi", state: "Delhi", interested_course_slug: "btech" }), true);
  assert.equal(isLeadReadyForAutomation({ city: "New Delhi", state: "Delhi" }), false);
});

test("runs every matching automation and sends a university only once", () => {
  const lead = { city: "Dehradun", state: "Uttarakhand", interested_course_slug: "B.Tech" };
  const rules = [
    { id: "course", name: "B.Tech routing", priority: 10, match_courses: ["btech"], match_cities: [], match_states: [], match_sources: [], match_ctas: [], match_all: true, university_ids: ["u1", "u2"] },
    { id: "city", name: "Dehradun routing", priority: 20, match_courses: [], match_cities: ["dehradun"], match_states: [], match_sources: [], match_ctas: [], match_all: true, university_ids: ["u2", "u3"] },
    { id: "other", name: "MBA routing", priority: 30, match_courses: ["mba"], match_cities: [], match_states: [], match_sources: [], match_ctas: [], match_all: true, university_ids: ["u4"] },
  ];
  const plan = buildAutomationPlan(rules, lead);
  assert.deepEqual(plan.matchedRules.map((rule) => rule.id), ["course", "city"]);
  assert.deepEqual(plan.deliveries.map((delivery) => delivery.universityId), ["u1", "u2", "u3"]);
  assert.deepEqual(plan.deliveries.find((delivery) => delivery.universityId === "u2").rules.map((rule) => rule.id), ["course", "city"]);
  assert.equal(plan.deliveries.find((delivery) => delivery.universityId === "u2").primaryRule.id, "course");

  const preview = buildAutomationPreview(plan, [
    { id: "u1", name: "University One" },
    { id: "u2", name: "University Two" },
    { id: "u3", name: "University Three" },
  ], lead);
  assert.equal(preview.length, 3);
  assert.deepEqual(preview.find((row) => row.university_id === "u2").matched_rules, ["B.Tech routing", "Dehradun routing"]);
  assert.equal(preview.find((row) => row.university_id === "u2").deduplicated, true);
});

test("maps a lead to university API field names", () => {
  const request = buildPartnerRequest({ column_mapping: { name: "full_name", mobile: "mobile_number" }, static_fields: { partner: "dc" }, custom_headers: {}, auth_type: "none" }, { name: "Rahul", phone: "8888888888", email: "rahul@dc.com" });
  assert.deepEqual(request.payload, { full_name: "Rahul", email: "rahul@dc.com", mobile_number: "8888888888", phone: "8888888888", partner: "dc" });
});

test("merges automation prefills from default through matching scenarios", () => {
  const lead = { name: "Rahul Kumar", phone: "+91 88888 88888", city: "New Delhi", source: "article", interested_course_slug: "mba", cta: "apply" };
  const rule = { prefills: { uni1: {
    "*": { campaign_id: "base", first_name: { mode: "lead", leadField: "name", transform: "first" } },
    "course:mba": { campaign_id: "mba-campaign" },
    "source:article": { mobile_digits: { mode: "lead", leadField: "mobile", transform: "digits" } },
  } } };
  assert.deepEqual(getPrefillOverrides(rule, "uni1", lead), {
    campaign_id: "mba-campaign",
    first_name: "Rahul",
    mobile_digits: "918888888888",
  });
});

test("uses bounded exponential retry delays for durable outbox jobs", () => {
  assert.equal(retryDelayMs(1), 15_000);
  assert.equal(retryDelayMs(2), 30_000);
  assert.equal(retryDelayMs(8), 1_920_000);
  assert.equal(retryDelayMs(99), 3_600_000);
});
