import { isStrictIndianMobile, normalizeIndianMobile } from "@/lib/phone";

const SESSION_COOKIE = "dc_lead_session_v1";
const OTP_KEY = "dc_lead_otp_v1";
export const LEAD_SESSION_EVENT = "dc:lead-saved";

export interface LeadSession {
  leadId?: string;
  name?: string;
  email?: string;
  phone?: string;
  course?: string;
  state?: string;
  city?: string;
  className?: string;
}

const fields = ["leadId", "name", "email", "phone", "course", "state", "city", "className"] as const;

export function getLeadSession(): LeadSession {
  try {
    const raw = document.cookie.split("; ").find(c => c.startsWith(`${SESSION_COOKIE}=`));
    const data = JSON.parse(decodeURIComponent(raw?.slice(SESSION_COOKIE.length + 1) || "{}"));
    return Object.fromEntries(fields.filter(key => typeof data[key] === "string" && data[key].length <= 320).map(key => [key, data[key]]));
  } catch { return {}; }
}

export function hasSubmittedLead(): boolean {
  const lead = getLeadSession();
  return Boolean(lead.leadId && lead.name?.trim() && isStrictIndianMobile(lead.phone || "") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email || ""));
}

export function saveSessionPrefill(data: LeadSession) {
  try {
    const previous = getLeadSession();
    const changedPhone = data.phone && normalizeIndianMobile(data.phone) !== normalizeIndianMobile(previous.phone || "");
    const merged = { ...(changedPhone ? {} : previous), ...data };
    const clean = Object.fromEntries(fields.filter(key => typeof merged[key] === "string" && merged[key]!.length <= 320 && merged[key]!.trim()).map(key => [key, merged[key]]));
    // Essential session cookie: no persistent expiry and no change to optional cookie consent.
    document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(JSON.stringify(clean))}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  } catch { /* Storage restrictions must not turn a saved lead into a failed submission. */ }
}

export function rememberSubmittedLead(data: LeadSession, leadId: string) {
  saveSessionPrefill({ ...data, leadId });
  window.dispatchEvent(new Event(LEAD_SESSION_EVENT));
}

// This expiry/phone check is only for UI reuse. The download API validates the signed proof.
export function getSessionOtpProof(phone: string): string {
  try {
    const token = sessionStorage.getItem(OTP_KEY) || "";
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.purpose === "lead_otp" && payload.phone === `+91${normalizeIndianMobile(phone)}` && Number(payload.exp) * 1000 > Date.now()) return token;
  } catch { /* Missing or malformed proof requires verification. */ }
  return "";
}

export function saveSessionOtpProof(token: string) {
  try { sessionStorage.setItem(OTP_KEY, token); } catch { /* Verification still works in the current form. */ }
}

export function clearSessionOtpProof() {
  try { sessionStorage.removeItem(OTP_KEY); } catch { /* noop */ }
}
