import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LeadCaptureForm } from "./LeadCaptureForm";
import { LeadGateDialog } from "./LeadGateDialog";
import { getSessionOtpProof, hasSubmittedLead, rememberSubmittedLead, saveSessionOtpProof } from "@/lib/leadSession";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/useUserProfile", () => ({ useUserProfile: () => ({ data: null }) }));
vi.mock("@/hooks/useLocations", () => ({ useStatesAndCities: () => ({ data: { states: [], citiesByState: {} } }) }));
vi.mock("@/components/IITAlumniBadge", () => ({ IITAlumniBadge: () => null }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackLeadConversion: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const identity = { name: "Test Student", email: "student@example.org", phone: "9876543210" };
const proof = (phone = identity.phone, expires = Date.now() + 900_000) => `header.${btoa(JSON.stringify({ purpose: "lead_otp", phone: `+91${phone}`, exp: Math.floor(expires / 1000) }))}.signature`;
const success = vi.fn();
const close = vi.fn();
const reply = (data: unknown, ok = true) => ({ ok, json: async () => data }) as Response;
const zip = () => render(<LeadGateDialog open onOpenChange={close} onSuccess={success} forceShow simple contactOnly otpDownload="jee-main-171-papers" />);

beforeEach(() => {
  document.cookie = "dc_lead_session_v1=; Max-Age=0; Path=/";
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks();
  vi.stubGlobal("AbortSignal", { timeout: () => new AbortController().signal });
  vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL) => {
    if (String(url).endsWith("/jee-paper-bundle")) return reply({ download_url: "https://downloads.example/signed.zip" });
    if (String(url).endsWith("/send-otp")) return reply({ success: true, verified: true, verification_token: proof() });
    return reply({ success: true, lead_id: "saved", phase: "complete" });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("save once and verify only for the ZIP", () => {
  it("keeps the JEE lead card visible after saving and on revisit", async () => {
    const first = render(<LeadCaptureForm contactOnly keepVisibleAfterSubmit source="JEE-paid" onSuccess={success} />);
    fireEvent.change(screen.getByPlaceholderText("Your name *"), { target: { value: identity.name } });
    fireEvent.change(screen.getByPlaceholderText("Email address *"), { target: { value: identity.email } });
    fireEvent.change(screen.getByPlaceholderText("Mobile number *"), { target: { value: identity.phone } });
    fireEvent.click(screen.getByRole("button", { name: "Save & continue" }));
    await waitFor(() => expect(success).toHaveBeenCalledWith("saved", undefined));
    expect(screen.getByPlaceholderText("Mobile number *")).toHaveValue(identity.phone);
    expect(screen.queryByText("Thank You! 🎉")).not.toBeInTheDocument();
    first.unmount();
    render(<LeadCaptureForm contactOnly keepVisibleAfterSubmit source="JEE-paid" />);
    expect(screen.getByPlaceholderText("Mobile number *")).toHaveValue(identity.phone);
    expect(screen.queryByText("Thank You! 🎉")).not.toBeInTheDocument();
  });

  it("saves an ordinary one-step form without OTP and reuses it for another site's gate", async () => {
    const first = render(<LeadCaptureForm contactOnly onSuccess={success} />);
    expect(screen.queryByRole("button", { name: "Get OTP" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Your name *"), { target: { value: identity.name } });
    fireEvent.change(screen.getByPlaceholderText("Email address *"), { target: { value: identity.email } });
    fireEvent.change(screen.getByPlaceholderText("Mobile number *"), { target: { value: identity.phone } });
    fireEvent.click(screen.getByRole("button", { name: "Save & continue" }));
    await waitFor(() => expect(success).toHaveBeenCalledWith("saved", undefined));
    expect(hasSubmittedLead()).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({ phase: "complete", otp_verified: false });
    expect(screen.queryByPlaceholderText("Mobile number *")).not.toBeInTheDocument();
    first.unmount(); success.mockClear();
    render(<LeadGateDialog open forceShow onOpenChange={close} onSuccess={success} source="apply_another_college" />);
    await waitFor(() => expect(success).toHaveBeenCalledWith("saved"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("prefills the ZIP form from a non-verified lead and still requires OTP", async () => {
    rememberSubmittedLead(identity, "saved");
    const first = zip();
    expect(screen.getByPlaceholderText("Your name *")).toHaveValue(identity.name);
    expect(screen.getByPlaceholderText("Email address *")).toHaveValue(identity.email);
    expect(screen.getByPlaceholderText("Mobile number *")).toHaveValue(identity.phone);
    fireEvent.click(screen.getByRole("button", { name: "Save & continue" }));
    expect(fetch).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Get OTP" }));
    await waitFor(() => expect(screen.queryByText(/Sending OTP to/)).not.toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("Enter 6-digit OTP sent via SMS"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Verified" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Save & continue" }));
    await waitFor(() => expect(success).toHaveBeenCalledWith("saved", "https://downloads.example/signed.zip"));
    const savedProof = getSessionOtpProof(identity.phone);
    first.unmount(); success.mockClear(); vi.mocked(fetch).mockClear();
    zip();
    await waitFor(() => expect(success).toHaveBeenCalledWith("saved", "https://downloads.example/signed.zip"));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toMatch(/jee-paper-bundle$/);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({ phone: identity.phone, otp_verification_token: savedProof });
  });

  it.each(["expired", "different phone", "malformed"])("requires verification for a %s proof", async kind => {
    rememberSubmittedLead(identity, "saved");
    saveSessionOtpProof(kind === "expired" ? proof(identity.phone, Date.now() - 1000) : kind === "different phone" ? proof("9876543211") : "broken");
    zip();
    expect(screen.getByRole("button", { name: "Get OTP" })).toBeEnabled();
    expect(fetch).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it("returns to verification if the server rejects a cached proof", async () => {
    rememberSubmittedLead(identity, "saved"); saveSessionOtpProof(proof());
    vi.mocked(fetch).mockResolvedValueOnce(reply({ error: "OTP_REQUIRED" }, false));
    zip();
    await waitFor(() => expect(screen.getByRole("button", { name: "Get OTP" })).toBeEnabled());
    expect(getSessionOtpProof(identity.phone)).toBe("");
    expect(success).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("Email address *")).toHaveValue(identity.email);
  });

  it("does not start a delayed download after the visitor closes the dialog", async () => {
    rememberSubmittedLead(identity, "saved"); saveSessionOtpProof(proof());
    let finish!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = zip();
    view.rerender(<LeadGateDialog open={false} onOpenChange={close} onSuccess={success} otpDownload="jee-main-171-papers" />);
    await act(async () => finish(reply({ download_url: "https://downloads.example/late.zip" })));
    expect(success).not.toHaveBeenCalled();
  });

  it("does not unlock paper gates when saving the simple form fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(reply({ error: "Unavailable" }, false));
    render(<LeadCaptureForm contactOnly onSuccess={success} />);
    fireEvent.change(screen.getByPlaceholderText("Your name *"), { target: { value: identity.name } });
    fireEvent.change(screen.getByPlaceholderText("Email address *"), { target: { value: identity.email } });
    fireEvent.change(screen.getByPlaceholderText("Mobile number *"), { target: { value: identity.phone } });
    fireEvent.click(screen.getByRole("button", { name: "Save & continue" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save & continue" })).toBeEnabled());
    expect(hasSubmittedLead()).toBe(false);
    expect(success).not.toHaveBeenCalled();
  });
});
