import { fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteIntegrations } from "./SiteIntegrations";

const settings = vi.hoisted(() => ({ rows: [{ key: "content_copy_protection", value: "copy_blocked", enabled: true }] }));
vi.mock("@/integrations/backend/client", () => ({
  backendClient: {
    from: () => ({
      select: async () => ({
        data: settings.rows,
      }),
    }),
  },
}));

afterEach(() => {
  document.body.className = "";
  document.getElementById("gads-lib")?.remove();
  document.getElementById("gads-init-base")?.remove();
  document.getElementById("gtm-init")?.remove();
});

describe("SiteIntegrations", () => {
  it("does not block copy, selection, cut, or the context menu, even with a legacy setting", () => {
    render(<MemoryRouter><SiteIntegrations /></MemoryRouter>);

    ["copy", "cut", "contextmenu", "selectstart"].forEach((type) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });
    expect(document.body).not.toHaveClass("content-copy-protected");
  });
  it("queues the Ads destination before interaction and loads its tag even with GA4 configured", async () => {
    settings.rows = [
      { key: "google_ads_id", value: "AW-17921423601", enabled: true },
      { key: "google_ads_conversion_label", value: "FnxTCITPl7gdEPHxzOFC", enabled: true },
      { key: "ga4_measurement_id", value: "G-EXAMPLE", enabled: true },
    ];
    (window as any).gtag = vi.fn();
    render(<MemoryRouter><SiteIntegrations /></MemoryRouter>);
    await waitFor(() => expect((window as any).gtag).toHaveBeenCalledWith("config", "AW-17921423601"));
    expect(document.getElementById("gads-lib")).toBeNull();
    fireEvent.pointerDown(window);
    await waitFor(() => expect(document.getElementById("gads-lib")).toHaveAttribute("src", "https://www.googletagmanager.com/gtag/js?id=AW-17921423601"));
  });
});
