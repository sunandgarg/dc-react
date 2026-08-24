import assert from "node:assert/strict";
import test from "node:test";
import { buildPartnerRequest, getPrefillOverrides, ruleMatches } from "../src/lead-automation.mjs";

test("matches lead automation conditions with all and any modes", () => {
  const lead = { city: "New Delhi", state: "Delhi", current_situation: "MBA", source: "website" };
  assert.equal(ruleMatches({ match_cities: ["delhi"], match_courses: ["mba"], match_states: [], match_sources: [], match_ctas: [], match_all: true }, lead), true);
  assert.equal(ruleMatches({ match_cities: ["mumbai"], match_courses: ["mba"], match_states: [], match_sources: [], match_ctas: [], match_all: false }, lead), true);
  assert.equal(ruleMatches({ match_cities: ["mumbai"], match_courses: ["btech"], match_states: [], match_sources: [], match_ctas: [], match_all: false }, lead), false);
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
