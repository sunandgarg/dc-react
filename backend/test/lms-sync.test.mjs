import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../src/db.mjs";
import { buildLmsPayload, syncLmsLead } from "../src/lms-sync.mjs";

const lead = {
  id: "aef64e10-12d5-4ac4-91fd-bf668722f0cb", site_scope: "dekhocampus",
  consent_terms_accepted: true, name: "Test Student", email: "test@example.com",
  phone: "9876543210", state: "Delhi", city: "New Delhi", source: "JEE-paid",
  utm_source: "google", utm_medium: "cpc", utm_campaign: "jee_2027",
  interested_course_slug: "btech", interested_exam_slug: "jee-main", otp_verified: true,
  page_url: "https://dekhocampus.com/ad/jee-main-2027?utm_medium=cpc",
  created_at: new Date("2026-11-21T04:50:00.000Z"),
};

test("LMS payload keeps a stable submission ID and attribution", () => {
  const payload = buildLmsPayload(lead);
  assert.equal(payload.external_id, lead.id);
  assert.equal(payload.mobile, "+919876543210");
  assert.equal(payload.utm_campaign, "jee_2027");
  assert.equal(payload.page, "/ad/jee-main-2027");
  assert.equal(payload.consent, "Y");
  assert.equal(payload.otp_verified, "Y");
  assert.equal(payload.date_of_registration, "2026-11-21T04:50:00.000Z");
  assert.equal(buildLmsPayload({ ...lead, page_url: "https://other.example/page" }).landing_page, undefined);
});

test("LMS sync sends a consented lead with the same idempotency key on retries", async (t) => {
  const previousEnabled = process.env.LMS_SYNC_ENABLED;
  const previousKey = process.env.LMS_GENERIC_LEAD_API_KEY;
  process.env.LMS_SYNC_ENABLED = "true";
  process.env.LMS_GENERIC_LEAD_API_KEY = "test-key";
  t.after(() => {
    if (previousEnabled === undefined) delete process.env.LMS_SYNC_ENABLED; else process.env.LMS_SYNC_ENABLED = previousEnabled;
    if (previousKey === undefined) delete process.env.LMS_GENERIC_LEAD_API_KEY; else process.env.LMS_GENERIC_LEAD_API_KEY = previousKey;
  });
  const originalFindUnique = prisma.leads.findUnique;
  prisma.leads.findUnique = async () => lead;
  t.after(() => { prisma.leads.findUnique = originalFindUnique; });
  const request = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://lms.dekhocampus.com/api/inbound/generic-lead");
    assert.equal(options.headers.Authorization, "Bearer test-key");
    assert.equal(options.headers["Idempotency-Key"], lead.id);
    assert.equal(JSON.parse(options.body).external_id, lead.id);
    return Response.json({ lead_id: "lms-id" }, { status: 202 });
  });
  assert.deepEqual(await syncLmsLead(lead.id), { synced: true });
  assert.equal(request.mock.callCount(), 1);
});

test("LMS sync omits unconsented leads and keeps API errors free of the key", async (t) => {
  const previousEnabled = process.env.LMS_SYNC_ENABLED;
  const previousKey = process.env.LMS_GENERIC_LEAD_API_KEY;
  process.env.LMS_SYNC_ENABLED = "true";
  process.env.LMS_GENERIC_LEAD_API_KEY = "test-key";
  t.after(() => {
    if (previousEnabled === undefined) delete process.env.LMS_SYNC_ENABLED; else process.env.LMS_SYNC_ENABLED = previousEnabled;
    if (previousKey === undefined) delete process.env.LMS_GENERIC_LEAD_API_KEY; else process.env.LMS_GENERIC_LEAD_API_KEY = previousKey;
  });
  const originalFindUnique = prisma.leads.findUnique;
  prisma.leads.findUnique = async () => ({ ...lead, consent_terms_accepted: false });
  t.after(() => { prisma.leads.findUnique = originalFindUnique; });
  const request = t.mock.method(globalThis, "fetch", async () => Response.json({}, { status: 401 }));
  assert.deepEqual(await syncLmsLead(lead.id), { skipped: "ineligible" });
  assert.equal(request.mock.callCount(), 0);
  prisma.leads.findUnique = async () => lead;
  await assert.rejects(syncLmsLead(lead.id), (error) => error.message.includes("HTTP 401") && !error.message.includes("test-key"));
});
