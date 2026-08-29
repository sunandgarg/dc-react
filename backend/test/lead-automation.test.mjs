import assert from "node:assert/strict";
import test from "node:test";
import { buildPartnerRequest, getPrefillOverrides, isLeadReadyForAutomation, ruleMatches } from "../src/lead-automation.mjs";
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
