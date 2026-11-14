import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveLeadPhase } from "./twoStepLead";
import { getLeadSession, getSessionOtpProof, hasSubmittedLead, saveSessionOtpProof, saveSessionPrefill } from "./leadSession";
import { getPrefillCookie } from "@/components/CookieConsent";
import { trackLeadConversion } from "./analytics";

vi.mock("./analytics", () => ({ trackLeadConversion: vi.fn() }));

const identity = { name: "Test Student", email: "student@example.org", phone: "9876543210" };
beforeEach(() => {
  vi.clearAllMocks();
  document.cookie = "dc_lead_session_v1=; Max-Age=0; Path=/";
  sessionStorage.clear(); localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());
describe("durable lead acknowledgement", () => {
  it.each([{ success: false }, { success: true }, {}])("rejects incomplete acknowledgements %j", async body => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => body }));
    await expect(saveLeadPhase({ phase: "complete" })).rejects.toThrow();
    expect(trackLeadConversion).not.toHaveBeenCalled();
  });
  it("accepts a saved lead", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, lead_id: "saved", phase: "complete" }) }));
    await expect(saveLeadPhase({ phase: "complete" })).resolves.toMatchObject({ lead_id: "saved" });
    expect(trackLeadConversion).toHaveBeenCalledExactlyOnceWith({ transaction_id: "saved", source: "website_form" });
  });
  it("remembers a completed lead without optional cookie consent", async () => {
    localStorage.setItem("dc_cookie_consent_v1", "rejected");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, lead_id: "saved", phase: "complete" }) }));
    await saveLeadPhase({ ...identity, phase: "complete", current_situation: "B.Tech / B.E.", state: "Delhi", city: "Delhi" });
    expect(hasSubmittedLead()).toBe(true);
    expect(getPrefillCookie()).toMatchObject({ ...identity, course: "B.Tech / B.E.", state: "Delhi", city: "Delhi" });
    expect(localStorage.getItem("dc_cookie_consent_v1")).toBe("rejected");
    expect(localStorage.getItem("dc_cookie_prefs_v1")).toBeNull();
    expect(localStorage.getItem("dc_user_prefill_v1")).toBeNull();
  });
  it("prefills a saved identity but unlocks repeat gates only after completion", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, lead_id: "saved", phase: "identity" }) }));
    await saveLeadPhase({ ...identity, phase: "identity" });
    expect(getLeadSession()).toMatchObject(identity);
    expect(hasSubmittedLead()).toBe(false);
    expect(trackLeadConversion).not.toHaveBeenCalled();
  });
  it("does not remember a failed submission", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Unavailable" }) }));
    await expect(saveLeadPhase({ ...identity, phase: "complete" })).rejects.toThrow("Unavailable");
    expect(getLeadSession()).toEqual({});
    expect(hasSubmittedLead()).toBe(false);
    expect(trackLeadConversion).not.toHaveBeenCalled();
  });
  it("does not carry a submitted lead ID to a different phone", () => {
    saveSessionPrefill({ ...identity, leadId: "saved" });
    saveSessionPrefill({ phone: "9876543211" });
    expect(hasSubmittedLead()).toBe(false);
    expect(getLeadSession()).toEqual({ phone: "9876543211" });
  });
  it("ignores malformed session cookies", () => {
    document.cookie = "dc_lead_session_v1=%7Bbad; Path=/";
    expect(getLeadSession()).toEqual({});
  });
  it("reuses only unexpired OTP proofs for the exact same phone", () => {
    const token = `header.${btoa(JSON.stringify({ purpose: "lead_otp", phone: "+919876543210", exp: Math.floor(Date.now() / 1000) + 900 }))}.signature`;
    saveSessionOtpProof(token);
    expect(getSessionOtpProof(identity.phone)).toBe(token);
    expect(getSessionOtpProof("9876543211")).toBe("");
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 901_000);
    expect(getSessionOtpProof(identity.phone)).toBe("");
    vi.restoreAllMocks();
    saveSessionOtpProof("broken");
    expect(getSessionOtpProof(identity.phone)).toBe("");
  });
});
