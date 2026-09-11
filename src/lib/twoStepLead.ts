import { functionUrl } from "@/lib/backendMode";

const LEAD_URL = functionUrl("save-lead");

function intentIdentity() {
  if (typeof window === "undefined") return {};
  try {
    return {
      intent_visitor_id: localStorage.getItem("dc_intent_visitor_v1") || undefined,
      intent_session_id: localStorage.getItem("dc_session_id") || undefined,
    };
  } catch {
    return {};
  }
}

export async function saveLeadPhase(payload: Record<string, unknown>) {
  const response = await fetch(LEAD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...intentIdentity(), ...payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || "Could not save your details");
  return body as { success: true; lead_id: string; phase: "identity" | "complete"; existing_count?: number };
}
