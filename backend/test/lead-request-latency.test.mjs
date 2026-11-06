import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../src/db.mjs";
import { sendPhoneOtp } from "../src/auth.mjs";
import { handleRequest } from "../src/index.mjs";

// Prisma model delegates expose methods through a Proxy, not own descriptors.
function stubDelegate(t, delegate, method, implementation) {
  const original = delegate[method];
  delegate[method] = implementation;
  t.after(() => { delegate[method] = original; });
}

test("identity acknowledgement does not wait for intent enrichment", async (t) => {
  stubDelegate(t, prisma.leads, "count", async () => 0);
  let committed = false;
  stubDelegate(t, prisma, "$transaction", async fn => {
    const result = await fn({ leads: { create: async () => ({ id: "saved-id" }) } });
    committed = true;
    return result;
  });
  let release;
  stubDelegate(t, prisma, "$queryRawUnsafe", () => new Promise(resolve => { release = resolve; }));
  const response = await handleRequest(new Request("https://example.com/v1/functions/save-lead", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Test", email: "test@example.com", phone: "9876543210", phase: "identity", intent_visitor_id: "2c7c94ce-7ee9-42f7-b32d-790b8d7b183a" }),
  }));
  assert.equal(committed, true);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).lead_id, "saved-id");
  await new Promise(setImmediate);
  assert.equal(typeof release, "function");
  stubDelegate(t, prisma, "$executeRawUnsafe", async () => 1);
  release([{ id: "saved-id" }]);
  await new Promise(setImmediate);
});

test("OTP is persisted before SMS and provider requests have an eight-second deadline", async (t) => {
  const previous = process.env.SMS_WEBHOOK_URL;
  process.env.SMS_WEBHOOK_URL = "https://sms.example.test/send";
  t.after(() => { if (previous === undefined) delete process.env.SMS_WEBHOOK_URL; else process.env.SMS_WEBHOOK_URL = previous; });
  stubDelegate(t, prisma.app_auth_otps, "findFirst", async () => null);
  let stored;
  stubDelegate(t, prisma.app_auth_otps, "create", async ({ data }) => { stored = data; return data; });
  const signal = new AbortController().signal;
  t.mock.method(AbortSignal, "timeout", ms => { assert.equal(ms, 8000); return signal; });
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.ok(stored?.otp_hash);
    assert.equal(options.signal, signal);
    assert.equal(stored.phone, JSON.parse(options.body).phone);
    return new Response("{}", { status: 200 });
  });
  const result = await sendPhoneOtp(new Request("https://example.com/send-otp", { method: "POST", body: JSON.stringify({ phone: "+919876543210" }) }));
  assert.equal(result.success, true);
});

test("an ambiguous SMS timeout retains its challenge in case delivery completes", async (t) => {
  const previous = process.env.SMS_WEBHOOK_URL;
  process.env.SMS_WEBHOOK_URL = "https://sms.example.test/send";
  t.after(() => { if (previous === undefined) delete process.env.SMS_WEBHOOK_URL; else process.env.SMS_WEBHOOK_URL = previous; });
  stubDelegate(t, prisma.app_auth_otps, "findFirst", async () => null);
  let id;
  stubDelegate(t, prisma.app_auth_otps, "create", async ({ data }) => { id = data.id; return data; });
  let invalidated = false;
  stubDelegate(t, prisma.app_auth_otps, "updateMany", async ({ where, data }) => { assert.equal(where.id, id); invalidated = data.consumed_at instanceof Date; return { count: 1 }; });
  t.mock.method(globalThis, "fetch", async () => { throw new DOMException("Timed out", "TimeoutError"); });
  await assert.rejects(sendPhoneOtp(new Request("https://example.com/send-otp", { method: "POST", body: JSON.stringify({ phone: "+919876543210" }) })), e => e.status === 504 && e.code === "SMS_DELIVERY_TIMEOUT");
  assert.equal(invalidated, false);
});
