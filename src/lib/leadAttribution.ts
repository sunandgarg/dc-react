const KEY = "dc_lead_utm_v1";
const FIELDS = ["utm_source", "utm_medium", "utm_campaign"] as const;

export function getLeadAttribution(): Record<string, string> {
  if (typeof window === "undefined") return {};
  let stored: Record<string, string> = {};
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) stored = saved;
  } catch { /* storage may be unavailable */ }
  const params = new URLSearchParams(window.location.search);
  const current: Record<string, string> = {};
  for (const field of FIELDS) {
    const value = params.get(field)?.trim().slice(0, 160);
    if (value) current[field] = value;
  }
  if (Object.keys(current).length) {
    stored = { ...stored, ...current };
    try { sessionStorage.setItem(KEY, JSON.stringify(stored)); } catch { /* storage may be unavailable */ }
  }
  return Object.fromEntries(FIELDS.filter((field) => typeof stored[field] === "string" && stored[field]).map((field) => [field, stored[field]]));
}
