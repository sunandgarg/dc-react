import { prisma } from "./db.mjs";

const ENDPOINT = "https://api.nopaperforms.io/lead/v1/createOrUpdate";

export function buildMerittoPayload(lead) {
  const payload = {
    search_criteria: "mobile",
    name: lead.name,
    email: lead.email,
    mobile: lead.phone,
    country_dial_code: "+91",
    source: lead.utm_source || "DekhoCampus",
    medium: lead.utm_medium || "website",
    campaign: lead.utm_campaign || lead.source || "website",
  };
  if (lead.state) payload.state = lead.state;
  if (lead.city) payload.city = lead.city;
  return payload;
}

export async function syncMerittoLead(leadId) {
  if (process.env.MERITTO_SYNC_ENABLED !== "true") return { skipped: "disabled" };
  const secret = process.env.MERITTO_SECRET_KEY?.trim();
  const access = process.env.MERITTO_ACCESS_KEY?.trim();
  if (!secret || !access) throw new Error("Meritto sync is enabled without both API keys");

  const lead = await prisma.leads.findUnique({ where: { id: leadId } });
  if (!lead || lead.site_scope !== "dekhocampus" || !lead.consent_terms_accepted) return { skipped: "ineligible" };

  const headers = { "content-type": "application/json", "secret-key": secret, "access-key": access };
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(buildMerittoPayload(lead)),
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.status !== true) {
    throw new Error(`Meritto lead sync failed (HTTP ${response.status}, API ${Number(result?.code) || "unknown"})`);
  }
  return { synced: true, merittoLeadId: result.data?.lead_id || null };
}
