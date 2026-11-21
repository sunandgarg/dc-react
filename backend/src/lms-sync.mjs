import { prisma } from "./db.mjs";

const ENDPOINT = "https://lms.dekhocampus.com/api/inbound/generic-lead";

export function buildLmsPayload(lead) {
  const pageUrl = (() => {
    try {
      const url = new URL(lead.page_url);
      return url.protocol === "https:" && ["dekhocampus.com", "www.dekhocampus.com"].includes(url.hostname) ? url : null;
    } catch { return null; }
  })();
  return Object.fromEntries(Object.entries({
    external_id: lead.id,
    name: lead.name,
    email: lead.email,
    mobile: lead.phone ? `+91${String(lead.phone).replace(/\D/g, "").slice(-10)}` : undefined,
    state: lead.state,
    city: lead.city,
    utm_source: lead.utm_source || "dekhocampus",
    utm_medium: lead.utm_medium,
    utm_campaign: lead.utm_campaign,
    course_interest: lead.interested_course_slug || lead.current_situation,
    source: lead.source,
    category: lead.source_category,
    device: lead.device_type,
    mode: lead.program_mode && lead.program_mode !== "unknown" ? lead.program_mode : undefined,
    otp_verified: lead.otp_verified ? "Y" : "N",
    consent: lead.consent_terms_accepted ? "Y" : "N",
    exam: lead.interested_exam_slug,
    cta_source: lead.cta,
    landing_page: pageUrl?.href,
    page: pageUrl?.pathname,
    last_query: lead.initial_query,
    date_of_registration: lead.created_at?.toISOString(),
  }).filter(([, value]) => value !== null && value !== undefined && value !== ""));
}

export async function syncLmsLead(leadId) {
  if (process.env.LMS_SYNC_ENABLED !== "true") return { skipped: "disabled" };
  const key = process.env.LMS_GENERIC_LEAD_API_KEY?.trim();
  if (!key) throw new Error("LMS sync is enabled without its API key");

  const lead = await prisma.leads.findUnique({ where: { id: leadId } });
  if (!lead || lead.site_scope !== "dekhocampus" || !lead.consent_terms_accepted) return { skipped: "ineligible" };

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": lead.id },
    body: JSON.stringify(buildLmsPayload(lead)),
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status !== 202) throw new Error(`LMS lead sync failed (HTTP ${response.status})`);
  return { synced: true };
}
