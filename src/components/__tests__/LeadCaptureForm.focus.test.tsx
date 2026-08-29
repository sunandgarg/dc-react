import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeadCaptureForm } from "@/components/LeadCaptureForm";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, initial: _initial, animate: _animate, exit: _exit, whileInView: _whileInView, viewport: _viewport, ...props }: any) => <div {...props}>{children}</div>,
  },
}));
vi.mock("@/components/IITAlumniBadge", () => ({ IITAlumniBadge: () => null }));
vi.mock("@/components/SearchableSelect", () => ({ SearchableSelect: () => null }));
vi.mock("@/hooks/useLocations", () => ({ useStatesAndCities: () => ({ data: { states: [], citiesByState: {} } }) }));
vi.mock("@/hooks/useUserProfile", () => ({ useUserProfile: () => ({ data: null }) }));
vi.mock("@/components/CookieConsent", () => ({ getPrefillCookie: () => ({}), savePrefillCookie: vi.fn() }));
vi.mock("@/components/LeadInlineOtp", () => ({
  useInlineOtp: () => ({ getOtpButton: null, verifyBlock: null, verified: false, requested: false, markMissing: vi.fn() }),
  isValidIndianMobile: (value: string) => /^[6-9]\d{9}$/.test(value),
  PHONE_HINT: "Enter a valid mobile",
  sanitizeIndianMobile: (value: string) => value.replace(/\D/g, "").slice(0, 10),
}));
vi.mock("@/components/ProgramModeToggle", () => ({ ProgramModeToggle: () => null }));
vi.mock("@/components/LeadConsentCheckbox", () => ({
  LeadConsentCheckbox: () => null,
  LEAD_CONSENT_TEXT: "Consent",
}));
vi.mock("@/lib/leadCapture", () => ({ markLeadSubmitted: vi.fn() }));
vi.mock("@/lib/leadTracking", () => ({ detectDeviceType: () => "desktop", inferSourceCategory: () => "website" }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackLeadConversion: vi.fn() }));
vi.mock("@/lib/leadConsent", () => ({ setLeadConsentPreference: vi.fn() }));
vi.mock("@/lib/twoStepLead", () => ({ saveLeadPhase: vi.fn() }));

afterEach(cleanup);

describe.each(["card", "banner", "sidebar", "inline"] as const)("LeadCaptureForm %s variant", (variant) => {
  it("keeps identity-field focus while typing complete values", async () => {
    render(<LeadCaptureForm variant={variant} source={`focus-${variant}`} />);

    const typeWithoutRemount = (placeholder: string, value: string) => {
      const input = screen.getByPlaceholderText(placeholder);
      input.focus();
      let typed = "";
      for (const character of value) {
        typed += character;
        fireEvent.change(input, { target: { value: typed } });
        expect(screen.getByPlaceholderText(placeholder)).toBe(input);
        expect(document.activeElement).toBe(input);
      }
      expect(input).toHaveValue(value);
    };

    typeWithoutRemount("Your name *", "Rahul Sharma");
    typeWithoutRemount("Email address *", "rahul@example.com");
    typeWithoutRemount("Mobile number *", "9876543210");
  });
});
