import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../src/index.mjs";
import { handleStorage, JEE_PAPERS_ZIP_PATH, LEGACY_JEE_PAPERS_ZIP_PATH } from "../src/storage.mjs";
import { authSecurityInternals } from "../src/auth.mjs";

const request = body => new Request("https://api.example/v1/functions/jee-paper-bundle", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("ZIP rejects missing, forged and mismatched OTP proofs", async () => {
  const proof = authSecurityInternals.issueLeadOtpProof("+919876543210");
  for (const body of [{ phone: "9876543210" }, { phone: "9876543210", otp_verification_token: "forged" }, { phone: "9876543211", otp_verification_token: proof }]) {
    assert.equal((await handleRequest(request(body))).status, 403);
  }
});

test("ZIP verification issues a five-minute signed S3 download without querying the database", async t => {
  const keys = { AWS_S3_BUCKET: "test-media-bucket", MEDIA_BASE_URL: "https://api.example/storage/v1/object/public", AWS_ACCESS_KEY_ID: "test-access-key", AWS_SECRET_ACCESS_KEY: "test-secret-key" };
  for (const [key, value] of Object.entries(keys)) {
    const previous = process.env[key]; process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const proof = authSecurityInternals.issueLeadOtpProof("+919876543210");
  const response = await handleRequest(request({ phone: "9876543210", otp_verification_token: proof }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const url = new URL((await response.json()).download_url);
  assert.ok(url.pathname.endsWith(JEE_PAPERS_ZIP_PATH));
  assert.equal(url.searchParams.get("X-Amz-Expires"), "300");
  assert.ok(url.searchParams.get("X-Amz-Signature"));
});

test("both public ZIP URLs reject downloads without OTP", async () => {
  for (const path of [JEE_PAPERS_ZIP_PATH, LEGACY_JEE_PAPERS_ZIP_PATH]) {
    await assert.rejects(handleStorage(new Request(`https://api.example/storage/v1/object/public/study-material/${path}`)), e => e.status === 403 && e.code === "OTP_REQUIRED");
  }
});
