import { functionUrl } from "@/lib/backendMode";
import { rememberSubmittedLead, saveSessionOtpProof, saveSessionPrefill, type LeadSession } from "@/lib/leadSession";

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
  if (!response.ok || body.success !== true || !body.lead_id) throw new Error(body.message || body.error || "Could not save your details");
  const identity: LeadSession = {};
  for (const key of ["name", "email", "phone", "city", "state"] as const) {
    if (typeof payload[key] === "string") identity[key] = payload[key];
  }
  if (typeof payload.current_situation === "string") identity.course = payload.current_situation;
  if (body.phase === "complete" || payload.phase === "complete") rememberSubmittedLead(identity, body.lead_id);
  else saveSessionPrefill(identity);
  if (typeof payload.otp_verification_token === "string" && payload.otp_verification_token) saveSessionOtpProof(payload.otp_verification_token);
  return body as { success: true; lead_id: string; phase: "identity" | "complete"; existing_count?: number };
}
