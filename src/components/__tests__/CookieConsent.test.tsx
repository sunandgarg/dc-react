import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CookieConsent } from "@/components/CookieConsent";

describe("CookieConsent", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  it("pins the consent bar to the mobile top and desktop bottom", () => {
    render(<CookieConsent />);

    const bar = screen.getByTestId("cookie-consent-bar");
    expect(bar).toHaveClass("top-0", "bottom-auto", "md:top-auto", "md:bottom-0");
    expect(screen.getByRole("button", { name: "Essential only" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept all" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /customise/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /decline/i })).not.toBeInTheDocument();
  });

  it("keeps analytics and marketing disabled for essential consent", () => {
    render(<CookieConsent />);

    act(() => screen.getByRole("button", { name: "Essential only" }).click());

    expect(localStorage.getItem("dc_cookie_consent_v1")).toBe("essential");
    expect(JSON.parse(localStorage.getItem("dc_cookie_prefs_v1") || "{}")).toEqual({
      essential: true,
      prefill: true,
      analytics: false,
      marketing: false,
    });
  });

  it("does not wait for timers to offer consent to a new visitor", () => {
    render(<CookieConsent />);
    expect(screen.getByTestId("cookie-consent-bar")).toBeInTheDocument();
  });

  it("keeps an existing consent choice without showing the banner again", () => {
    localStorage.setItem("dc_cookie_consent_v1", "essential");
    render(<CookieConsent />);
    expect(screen.queryByTestId("cookie-consent-bar")).not.toBeInTheDocument();
  });
});
