import { prisma } from "./db.mjs";

export function configured(value) {
  return Boolean(String(value || "").trim());
}

export async function integrationStatus() {
  const [siteRows, aiRows, otpRows, emailRows] = await Promise.all([
    prisma.site_integrations.findMany({ select: { key: true, label: true, category: true, value: true, enabled: true } }),
    prisma.ai_providers.findMany({ select: { provider_name: true, display_name: true, api_key_encrypted: true, default_model: true, is_active: true } }),
    prisma.otp_providers.findMany({ select: { provider_name: true, display_name: true, channel: true, api_key: true, template_id: true, is_active: true } }),
    prisma.email_providers.findMany({ select: { provider_name: true, display_name: true, region: true, from_email: true, is_active: true } }),
  ]);

  return {
    runtime: {
      database: true,
      native_auth: configured(process.env.AUTH_JWT_SECRET),
      google_oauth: configured(process.env.GOOGLE_CLIENT_ID),
      s3_storage: configured(process.env.AWS_S3_BUCKET) && configured(process.env.MEDIA_BASE_URL),
      sms: configured(process.env.SMS_WEBHOOK_URL) || configured(process.env.SMS_FAST2SMS_API_KEY),
      ses_email: String(process.env.SES_ENABLED || "").toLowerCase() === "true" && configured(process.env.SES_FROM_EMAIL),
    },
    site: siteRows.map((row) => ({ key: row.key, label: row.label, category: row.category, configured: configured(row.value), enabled: Boolean(row.enabled) })),
    ai: aiRows.map((row) => {
      const runtimeKey = row.provider_name === "gemini"
        ? process.env.GEMINI_API_KEY
        : row.provider_name === "openai"
          ? process.env.OPENAI_API_KEY
          : "";
      return { provider_name: row.provider_name, display_name: row.display_name, configured: configured(runtimeKey) || configured(row.api_key_encrypted), default_model: row.default_model, active: Boolean(row.is_active) };
    }),
    otp: otpRows.map((row) => ({
      provider_name: row.provider_name,
      display_name: row.display_name,
      channel: row.channel,
      configured: row.provider_name === "fast2sms"
        ? configured(process.env.SMS_FAST2SMS_API_KEY) && configured(row.template_id)
        : configured(row.api_key) && configured(row.template_id),
      active: Boolean(row.is_active),
    })),
    email: emailRows.map((row) => ({
      provider_name: row.provider_name,
      display_name: row.display_name,
      configured: row.provider_name === "aws_ses"
        ? String(process.env.SES_ENABLED || "").toLowerCase() === "true" && configured(row.from_email || process.env.SES_FROM_EMAIL)
        : false,
      region: row.region || process.env.SES_REGION || process.env.AWS_REGION || null,
      credential_source: row.provider_name === "aws_ses" ? "iam_runtime" : null,
      active: Boolean(row.is_active),
    })),
  };
}
