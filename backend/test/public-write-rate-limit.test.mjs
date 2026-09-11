import assert from "node:assert/strict";
import test from "node:test";
import { apiSecurityInternals } from "../src/index.mjs";
import { consumePublicWriteLimit, publicWriteRateLimitInternals } from "../src/public-write-rate-limit.mjs";

test.beforeEach(() => publicWriteRateLimitInternals.reset());

test("public intent batches reject scoring amplification before persistence", async () => {
  const rows = Array.from({ length: 11 }, (_, index) => ({
    event_type: "college_viewed",
    visitor_id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  }));
  const request = new Request("https://api.example/v1/rest/intent_events", {
    method: "POST",
    headers: { "content-type": "application/json", "x-dc-client-ip": "192.0.2.10" },
    body: JSON.stringify(rows),
  });
  await assert.rejects(
    () => apiSecurityInternals.sanitizePublicWriteRequest("intent_events", request),
    (error) => error.status === 400 && error.code === "INTENT_SUBJECT_LIMIT",
  );
});

test("public-write limiter accounts for batch cost, isolates clients, and resets", () => {
  const now = 1_000_000;
  for (let batch = 0; batch < 6; batch += 1) {
    consumePublicWriteLimit({ clientKey: "192.0.2.1", table: "intent_events", units: 10, now });
  }
  assert.throws(
    () => consumePublicWriteLimit({ clientKey: "192.0.2.1", table: "intent_events", units: 1, now }),
    (error) => error.status === 429 && error.code === "PUBLIC_WRITE_RATE_LIMIT" && error.retryAfter === 60,
  );
  assert.doesNotThrow(() => consumePublicWriteLimit({ clientKey: "192.0.2.2", table: "intent_events", units: 1, now }));
  assert.doesNotThrow(() => consumePublicWriteLimit({
    clientKey: "192.0.2.1",
    table: "intent_events",
    units: 1,
    now: now + publicWriteRateLimitInternals.WINDOW_MS,
  }));
});

test("save-lead has a bounded body and a dedicated public rate policy", async () => {
  const oversized = new Request("https://api.example/v1/functions/save-lead", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "70000", "x-dc-client-ip": "192.0.2.20" },
    body: JSON.stringify({ name: "Student" }),
  });
  await assert.rejects(
    () => apiSecurityInternals.readRateLimitedPublicJson(oversized, "save-lead", 64 * 1024),
    (error) => error.status === 413 && error.code === "PAYLOAD_TOO_LARGE",
  );
  for (let requestNumber = 0; requestNumber < 20; requestNumber += 1) {
    consumePublicWriteLimit({ clientKey: "192.0.2.21", table: "save-lead", now: 2_000_000 });
  }
  assert.throws(
    () => consumePublicWriteLimit({ clientKey: "192.0.2.21", table: "save-lead", now: 2_000_000 }),
    (error) => error.status === 429 && error.code === "PUBLIC_WRITE_RATE_LIMIT",
  );
});
