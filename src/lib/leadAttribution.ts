const KEY = "dc_lead_utm_v1";
const LOCAL_KEY = "dc_lead_attribution_v2";
const TTL_MS = 90 * 24 * 60 * 60 * 1000;
const FIELDS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "gclid", "gbraid", "wbraid", "fbclid", "msclkid", "ttclid",
] as const;

type StoredAttribution = Record<string, string> & { captured_at?: string };

function readStored(): StoredAttribution {
  try {
    const local = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
    const capturedAt = Date.parse(local?.captured_at || "");
    if (local && typeof local === "object" && Number.isFinite(capturedAt) && Date.now() - capturedAt <= TTL_MS) return local;
  } catch { /* storage may be unavailable */ }
  try {
    const session = JSON.parse(sessionStorage.getItem(KEY) || "{}");
    if (session && typeof session === "object" && !Array.isArray(session)) return session;
  } catch { /* storage may be unavailable */ }
  return {};
}

export function getLeadAttribution(): Record<string, string> {
  if (typeof window === "undefined") return {};
  let stored = readStored();
  const params = new URLSearchParams(window.location.search);
  const current: Record<string, string> = {};
  for (const field of FIELDS) {
    const value = params.get(field)?.trim().slice(0, 160);
    if (value) current[field] = value;
  }
  if (Object.keys(current).length) {
    stored = { ...stored, ...current, captured_at: new Date().toISOString() };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(stored));
      localStorage.setItem(LOCAL_KEY, JSON.stringify(stored));
    } catch { /* storage may be unavailable */ }
  }
  return Object.fromEntries(FIELDS.filter((field) => typeof stored[field] === "string" && stored[field]).map((field) => [field, stored[field]]));
}
