import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../src/db.mjs";
import { buildMerittoPayload, syncMerittoLead } from "../src/meritto-sync.mjs";

const lead = {
  id: "lead-1", site_scope: "dekhocampus", consent_terms_accepted: true,
  name: "Test Student", email: "test@example.com", phone: "9876543210",
  state: "Delhi", city: "New Delhi", source: "ad_jee_main_2027",
  utm_source: "google", utm_medium: "cpc", utm_campaign: "jee_2027",
};

test("Meritto payload preserves lead identity, location and UTM attribution", () => {
  assert.deepEqual(buildMerittoPayload(lead), {
    search_criteria: "mobile", name: "Test Student", email: "test@example.com",
    mobile: "9876543210", country_dial_code: "+91", state: "Delhi", city: "New Delhi",
    source: "google", medium: "cpc", campaign: "jee_2027",
  });
});

test("Meritto payload removes digits and punctuation from the CRM name", () => {
  assert.equal(buildMerittoPayload({ ...lead, name: "TEST - Sunand Garg 2027" }).name, "TEST Sunand Garg");
  assert.equal(lead.name, "Test Student");
  assert.throws(() => buildMerittoPayload({ ...lead, name: "2027 -" }), /no letters/);
});

test("Meritto sync retries API failures without exposing credentials", async (t) => {
  const previousEnabled = process.env.MERITTO_SYNC_ENABLED;
  const previousSecret = process.env.MERITTO_SECRET_KEY;
  const previousAccess = process.env.MERITTO_ACCESS_KEY;
  process.env.MERITTO_SYNC_ENABLED = "true";
  process.env.MERITTO_SECRET_KEY = "test-secret";
  process.env.MERITTO_ACCESS_KEY = "test-access";
  t.after(() => {
    if (previousEnabled === undefined) delete process.env.MERITTO_SYNC_ENABLED; else process.env.MERITTO_SYNC_ENABLED = previousEnabled;
    if (previousSecret === undefined) delete process.env.MERITTO_SECRET_KEY; else process.env.MERITTO_SECRET_KEY = previousSecret;
    if (previousAccess === undefined) delete process.env.MERITTO_ACCESS_KEY; else process.env.MERITTO_ACCESS_KEY = previousAccess;
  });
  const originalFindUnique = prisma.leads.findUnique;
  prisma.leads.findUnique = async () => lead;
  t.after(() => { prisma.leads.findUnique = originalFindUnique; });
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.nopaperforms.io/lead/v1/createOrUpdate");
    assert.equal(options.headers["secret-key"], "test-secret");
    assert.equal(options.headers["access-key"], "test-access");
    assert.equal(JSON.parse(options.body).search_criteria, "mobile");
    return Response.json({ status: false, code: 401 }, { status: 401 });
  });
  await assert.rejects(syncMerittoLead(lead.id), (error) => error.message.includes("HTTP 401") && !error.message.includes("test-secret"));
});

test("Meritto does not send a lead when the access key is missing", async (t) => {
  const previousEnabled = process.env.MERITTO_SYNC_ENABLED;
  const previousSecret = process.env.MERITTO_SECRET_KEY;
  const previousAccess = process.env.MERITTO_ACCESS_KEY;
  process.env.MERITTO_SYNC_ENABLED = "true";
  process.env.MERITTO_SECRET_KEY = "test-secret";
  delete process.env.MERITTO_ACCESS_KEY;
  t.after(() => {
    if (previousEnabled === undefined) delete process.env.MERITTO_SYNC_ENABLED; else process.env.MERITTO_SYNC_ENABLED = previousEnabled;
    if (previousSecret === undefined) delete process.env.MERITTO_SECRET_KEY; else process.env.MERITTO_SECRET_KEY = previousSecret;
    if (previousAccess === undefined) delete process.env.MERITTO_ACCESS_KEY; else process.env.MERITTO_ACCESS_KEY = previousAccess;
  });
  const request = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected API request"); });
  await assert.rejects(syncMerittoLead(lead.id), /without both API keys/);
  assert.equal(request.mock.callCount(), 0);
});
