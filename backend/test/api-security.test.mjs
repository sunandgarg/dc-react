import assert from "node:assert/strict";
import test from "node:test";
import { apiSecurityInternals } from "../src/index.mjs";

test("anonymous application writes discard privileged fields", async () => {
  const request = new Request("http://localhost/rest/v1/job_applications", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      full_name: "Test User",
      email: "test@example.com",
      phone: "9876543210",
      job_slug: "editor",
      status: "hired",
      admin_notes: "spoofed",
      user_id: "another-user",
      created_at: "2000-01-01T00:00:00Z",
    }),
  });
  const sanitized = await apiSecurityInternals.sanitizePublicWriteRequest("job_applications", request);
  assert.deepEqual(await sanitized.json(), {
    full_name: "Test User",
    email: "test@example.com",
    phone: "9876543210",
    job_slug: "editor",
    status: "submitted",
  });
});

test("anonymous analytics writes cannot impersonate a user", async () => {
  const request = new Request("http://localhost/rest/v1/user_events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify([{ session_id: "browser-session", event_type: "page_view", user_id: "admin", metadata: { page: "/" } }]),
  });
  const sanitized = await apiSecurityInternals.sanitizePublicWriteRequest("user_events", request);
  assert.deepEqual(await sanitized.json(), [{ session_id: "browser-session", event_type: "page_view", metadata: { page: "/" } }]);
});

test("anonymous writes enforce batch and body limits", async () => {
  const rows = Array.from({ length: 101 }, () => ({ event_type: "page_view" }));
  const request = new Request("http://localhost/rest/v1/user_events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(rows),
  });
  await assert.rejects(
    () => apiSecurityInternals.sanitizePublicWriteRequest("user_events", request),
    (error) => error.status === 400 && error.code === "INVALID_PUBLIC_WRITE",
  );
});

test("anonymous writes cap nested analytics metadata", async () => {
  let metadata = { marker: "too-deep" };
  for (let depth = 0; depth < 12; depth += 1) metadata = { nested: metadata };
  const request = new Request("http://localhost/rest/v1/user_events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event_type: "page_view", metadata }),
  });
  const sanitized = await apiSecurityInternals.sanitizePublicWriteRequest("user_events", request);
  assert.doesNotMatch(JSON.stringify(await sanitized.json()), /too-deep/);
});

test("site scope is derived only from a trusted Sarkari origin", () => {
  assert.equal(apiSecurityInternals.siteScopeForRequest(new Request("https://aws-origin.dekhocampus.com/v1/save-lead", {
    headers: { origin: "https://sarkari.dekhocampus.com" },
  })), "sarkari");
  assert.equal(apiSecurityInternals.siteScopeForRequest(new Request("https://aws-origin.dekhocampus.com/v1/save-lead", {
    headers: { origin: "https://sarkari-dekhocampus.pages.dev" },
  })), "sarkari");
  assert.equal(apiSecurityInternals.siteScopeForRequest(new Request("https://aws-origin.dekhocampus.com/v1/save-lead", {
    headers: { origin: "https://attacker.example" },
  })), "dekhocampus");
  assert.equal(apiSecurityInternals.siteScopeForRequest(new Request("https://aws-origin.dekhocampus.com/v1/save-lead")), "dekhocampus");
});

test("anonymous article policy overrides caller filters", () => {
  const request = new Request("https://aws-origin.dekhocampus.com/rest/v1/articles?site_scope=eq.invalid&status=eq.Draft&is_active=eq.false", {
    headers: { origin: "https://sarkari.dekhocampus.com" },
  });
  const secured = apiSecurityInternals.enforcePublicArticlePolicy(request);
  const url = new URL(secured.url);
  assert.equal(url.searchParams.get("site_scope"), "eq.sarkari");
  assert.equal(url.searchParams.get("status"), "eq.Published");
  assert.equal(url.searchParams.get("is_active"), "eq.true");
});

test("anonymous article policy preserves an allowlisted explicit scope for server-side sitemap builds", () => {
  const request = new Request("https://aws-origin.dekhocampus.com/rest/v1/articles?site_scope=eq.sarkari&status=eq.Draft");
  const secured = apiSecurityInternals.enforcePublicArticlePolicy(request);
  const url = new URL(secured.url);
  assert.equal(url.searchParams.get("site_scope"), "eq.sarkari");
  assert.equal(url.searchParams.get("status"), "eq.Published");
  assert.equal(url.searchParams.get("is_active"), "eq.true");
});

test("admin article and lead writes reject non-canonical site scopes", () => {
  assert.doesNotThrow(() => apiSecurityInternals.assertValidSiteScopePayload("articles", { site_scope: "sarkari" }));
  assert.doesNotThrow(() => apiSecurityInternals.assertValidSiteScopePayload("leads", [{ site_scope: "dekhocampus" }]));
  assert.throws(
    () => apiSecurityInternals.assertValidSiteScopePayload("articles", { site_scope: "other-site" }),
    (error) => error.status === 400 && error.code === "INVALID_SITE_SCOPE",
  );
});
