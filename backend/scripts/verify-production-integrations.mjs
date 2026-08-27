#!/usr/bin/env node

import { prisma } from "../src/db.mjs";
import { geminiQuotaHelpers } from "../src/blog-ai.mjs";

const required = (name) => {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is missing from the AWS runtime`);
  return value;
};

async function responseSummary(response) {
  const text = await response.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch {}
  return { response, text, payload };
}

async function verifyGemini() {
  const key = required("GEMINI_API_KEY");
  const provider = await prisma.ai_providers.findFirst({ where: { provider_name: "gemini" }, orderBy: { updated_at: "desc" } });
  const model = geminiQuotaHelpers.normalizeGeminiModel(provider?.default_model);
  const result = await responseSummary(await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Return exactly this JSON object: {\"ok\":true}" }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 20 },
      }),
      signal: AbortSignal.timeout(20_000),
    },
  ));
  if (!result.response.ok) throw new Error(`Gemini ${model} validation failed (${result.response.status}): ${String(result.payload?.error?.message || result.text).slice(0, 240)}`);
  return { configured: true, reachable: true, model };
}

async function verifyOpenAi() {
  const key = required("OPENAI_API_KEY");
  const result = await responseSummary(await fetch("https://api.openai.com/v1/models", {
    headers: { authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20_000),
  }));
  if (!result.response.ok) throw new Error(`OpenAI validation failed (${result.response.status}): ${String(result.payload?.error?.message || result.text).slice(0, 240)}`);
  return { configured: true, reachable: true, imageModel: "gpt-image-1" };
}

async function verifyFast2Sms() {
  const key = required("SMS_FAST2SMS_API_KEY");
  const provider = await prisma.otp_providers.findFirst({ where: { provider_name: "fast2sms", channel: "sms", is_active: true } });
  if (!provider?.template_id) throw new Error("The active Fast2SMS row or OTP template ID is missing from AWS MySQL");
  const result = await responseSummary(await fetch("https://www.fast2sms.com/dev/wallet", {
    method: "POST",
    headers: { authorization: key, accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  }));
  if (!result.response.ok || result.payload?.return === false) {
    throw new Error(`Fast2SMS credential validation failed (${result.response.status}): ${String(result.payload?.message || result.text).slice(0, 240)}`);
  }
  return { configured: true, reachable: true, activeProvider: true, templateConfigured: true, actualSmsSent: false };
}

async function trackingStatus() {
  const rows = await prisma.site_integrations.findMany({ select: { key: true, value: true, enabled: true } });
  return Object.fromEntries(rows.map((row) => [row.key, { configured: Boolean(String(row.value || "").trim()), enabled: Boolean(row.enabled) }]));
}

try {
  const [gemini, openai, fast2sms, tracking] = await Promise.all([
    verifyGemini(),
    verifyOpenAi(),
    verifyFast2Sms(),
    trackingStatus(),
  ]);
  console.log(JSON.stringify({ ok: true, gemini, openai, fast2sms, tracking }, null, 2));
} finally {
  await prisma.$disconnect();
}
