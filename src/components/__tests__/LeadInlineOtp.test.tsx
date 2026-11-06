import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useInlineOtp } from "@/components/LeadInlineOtp";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function OtpHarness({ phone }: { phone: string }) {
  const otp = useInlineOtp(phone, "test-form");
  return (
    <div>
      {otp.getOtpButton}
      {otp.verifyBlock}
      <output data-testid="otp-state">{`${otp.requested}:${otp.verified}`}</output>
    </div>
  );
}

describe("useInlineOtp phone corrections", () => {
  beforeEach(() => {
    // jsdom 20 predates the browser's AbortSignal.timeout API.
    vi.stubGlobal("AbortSignal", { timeout: () => new AbortController().signal });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, results: [{ provider: "fast2sms", channel: "sms" }] }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("invalidates the old OTP and restores Get OTP when the phone changes", async () => {
    const { rerender } = render(<OtpHarness phone="9876543210" />);

    fireEvent.click(screen.getByRole("button", { name: "Get OTP" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "45s" })).toBeDisabled());
    expect(screen.getByPlaceholderText("Enter 6-digit OTP sent via SMS")).toBeInTheDocument();
    const firstRequest = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const firstBody = JSON.parse(String(firstRequest.body));
    expect(firstBody).toMatchObject({ action: "send", channel: "sms" });
    expect(firstBody).not.toHaveProperty("provider_name");
    expect(firstBody).not.toHaveProperty("otp");

    rerender(<OtpHarness phone="9876543211" />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Get OTP" })).toBeEnabled());
    expect(screen.queryByPlaceholderText("Enter 6-digit OTP sent via SMS")).not.toBeInTheDocument();
    expect(screen.getByTestId("otp-state")).toHaveTextContent("false:false");

    fireEvent.click(screen.getByRole("button", { name: "Get OTP" }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ body: expect.stringContaining("+919876543211") }),
    ));
  });

  it("shows the OTP input before the provider request completes", async () => {
    let resolveRequest!: (value: unknown) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }) as Promise<Response>);

    render(<OtpHarness phone="9876543210" />);
    fireEvent.click(screen.getByRole("button", { name: "Get OTP" }));

    expect(screen.getByPlaceholderText("Enter 6-digit OTP sent via SMS")).toBeInTheDocument();
    expect(screen.getByText(/Sending OTP to/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();

    resolveRequest({
      ok: true,
      json: async () => ({ success: true, results: [{ provider: "fast2sms", channel: "sms" }] }),
    });
    await waitFor(() => expect(screen.queryByText(/Sending OTP to/)).not.toBeInTheDocument());
  });

  it("keeps the resend cooldown after a timeout and releases the sending state", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"));
    render(<OtpHarness phone="9876543210" />);
    fireEvent.click(screen.getByRole("button", { name: "Get OTP" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "45s" })).toBeDisabled());
    expect(screen.getByTestId("otp-state")).toHaveTextContent("true:false");
    expect(vi.mocked(fetch).mock.calls[0][1]?.signal).toBeDefined();
  });

  it("ignores a verification response for a phone that was edited while pending", async () => {
    const { rerender } = render(<OtpHarness phone="9876543210" />);
    fireEvent.click(screen.getByRole("button", { name: "Get OTP" }));
    await waitFor(() => expect(screen.queryByText(/Sending OTP to/)).not.toBeInTheDocument());
    let finish!: (value: unknown) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }) as Promise<Response>);
    fireEvent.change(screen.getByPlaceholderText("Enter 6-digit OTP sent via SMS"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(screen.getByRole("button", { name: "Verifying…" })).toBeDisabled();
    rerender(<OtpHarness phone="9876543211" />);
    finish({ ok: true, json: async () => ({ verified: true, verification_token: "old-phone-proof" }) });
    await waitFor(() => expect(screen.getByRole("button", { name: "Get OTP" })).toBeEnabled());
    expect(screen.getByTestId("otp-state")).toHaveTextContent("false:false");
  });
});
