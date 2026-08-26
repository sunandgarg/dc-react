import { prisma } from "./db.mjs";

export function configured(value) {
  return Boolean(String(value || "").trim());
}

export async function integrationStatus() {
  const [siteRows, aiRows, otpRows, emailRows] = await Promise.all([
    prisma.site_integrations.findMany({ select: { key: true, label: true, category: true, value: true, enabled: true } }),
    prisma.ai_providers.findMany({ select: { provider_name: true, display_name: true, api_key_encrypted: true, default_model: true, is_active: true } }),
    prisma.otp_providers.findMany({ select: { provider_name: true, display_name: true, channel: true, api_key: true, template_id: true, is_active: true } }),
    prisma.email_providers.findMany({ select: { provider_name: true, display_name: true, api_key: true, api_secret: true, is_active: true } }),
  ]);

  return {
    runtime: {
      database: true,
      native_auth: configured(process.env.AUTH_JWT_SECRET),
      google_oauth: configured(process.env.GOOGLE_CLIENT_ID),
      s3_storage: configured(process.env.AWS_S3_BUCKET) && configured(process.env.MEDIA_BASE_URL),
      supabase_storage_rollback: configured(process.env.SUPABASE_STORAGE_URL) && configured(process.env.SUPABASE_STORAGE_SERVICE_KEY),
      sms: configured(process.env.SMS_WEBHOOK_URL) || configured(process.env.SMS_FAST2SMS_API_KEY),
    },
    site: siteRows.map((row) => ({ key: row.key, label: row.label, category: row.category, configured: configured(row.value), enabled: Boolean(row.enabled) })),
    ai: aiRows.map((row) => ({ provider_name: row.provider_name, display_name: row.display_name, configured: configured(row.api_key_encrypted), default_model: row.default_model, active: Boolean(row.is_active) })),
    otp: otpRows.map((row) => ({
      provider_name: row.provider_name,
      display_name: row.display_name,
      channel: row.channel,
      configured: row.provider_name === "fast2sms"
        ? configured(process.env.SMS_FAST2SMS_API_KEY) && configured(row.template_id)
        : configured(row.api_key) && configured(row.template_id),
      active: Boolean(row.is_active),
    })),
    email: emailRows.map((row) => ({ provider_name: row.provider_name, display_name: row.display_name, configured: configured(row.api_key) && configured(row.api_secret), active: Boolean(row.is_active) })),
  };
}
