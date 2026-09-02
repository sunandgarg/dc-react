import assert from "node:assert/strict";
import test from "node:test";
import { buildSesMessage, normalizeEmailRequest, sesRuntimeConfig } from "../src/email.mjs";

test("normalizes and deduplicates SES recipients", () => {
  const message = normalizeEmailRequest({
    to: [" Student@Example.com ", "student@example.com"],
    subject: "Admission update",
    text: "Your enquiry was received.",
  });
  assert.deepEqual(message.recipients, ["student@example.com"]);
});

test("rejects malformed email addresses before calling SES", () => {
  assert.throws(
    () => normalizeEmailRequest({ to: "not-an-email", subject: "Test", text: "Body" }),
    /valid email address/,
  );
});

test("builds a UTF-8 SES message from IAM-backed provider settings", () => {
  const message = normalizeEmailRequest({
    to: "student@example.com",
    subject: "DekhoCampus\r\nBcc: blocked@example.com",
    text: "Plain text",
    html: "<p>Plain text</p>",
  });
  const request = buildSesMessage(message, {
    from_email: "noreply@dekhocampus.com",
    from_name: "DekhoCampus",
    reply_to: "support@dekhocampus.com",
  });

  assert.equal(request.FromEmailAddress, "DekhoCampus <noreply@dekhocampus.com>");
  assert.equal(request.Content.Simple.Subject.Data, "DekhoCampus Bcc: blocked@example.com");
  assert.deepEqual(request.Destination.ToAddresses, ["student@example.com"]);
  assert.deepEqual(request.ReplyToAddresses, ["support@dekhocampus.com"]);
});

test("uses the AWS region as the SES region fallback", () => {
  const previous = { enabled: process.env.SES_ENABLED, sesRegion: process.env.SES_REGION, awsRegion: process.env.AWS_REGION };
  process.env.SES_ENABLED = "true";
  delete process.env.SES_REGION;
  process.env.AWS_REGION = "ap-south-1";
  try {
    const runtime = sesRuntimeConfig();
    assert.equal(runtime.enabled, true);
    assert.equal(runtime.region, "ap-south-1");
    assert.equal(runtime.identity, "dekhocampus.com");
  } finally {
    if (previous.enabled === undefined) delete process.env.SES_ENABLED; else process.env.SES_ENABLED = previous.enabled;
    if (previous.sesRegion === undefined) delete process.env.SES_REGION; else process.env.SES_REGION = previous.sesRegion;
    if (previous.awsRegion === undefined) delete process.env.AWS_REGION; else process.env.AWS_REGION = previous.awsRegion;
  }
});
