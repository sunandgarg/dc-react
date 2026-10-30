import { act, render, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { SiteIntegrations } from "./SiteIntegrations";

vi.mock("@/integrations/backend/client", () => ({
  backendClient: {
    from: () => ({
      select: async () => ({
        data: [{ key: "content_copy_protection", value: "copy_blocked", enabled: true }],
      }),
    }),
  },
}));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("location", new URL("https://dekhocampus.com/news/example"));
});

afterEach(() => {
  cleanup();
  document.querySelectorAll("#gtm-init").forEach((node) => node.remove());
  vi.unstubAllGlobals();
  document.body.className = "";
});

describe("SiteIntegrations", () => {
  it("starts immediately after opt-in without a second interaction or a 15-second timer", async () => {
    render(<MemoryRouter><SiteIntegrations /></MemoryRouter>);
    expect(document.getElementById("gtm-init")).toBeNull();
    await act(async () => {
      localStorage.setItem("dc_cookie_consent_v1", "accepted");
      localStorage.setItem("dc_cookie_prefs_v1", '{"analytics":true,"marketing":true}');
      window.dispatchEvent(new Event("dc:cookie-consent-resolved"));
    });
    await waitFor(() => expect(document.getElementById("gtm-init")).not.toBeNull());
    await act(async () => window.dispatchEvent(new Event("dc:cookie-consent-resolved")));
    expect(document.querySelectorAll("#gtm-init")).toHaveLength(1);
  });
  it("never injects tags for Essential only", async () => {
    localStorage.setItem("dc_cookie_consent_v1", "essential");
    render(<MemoryRouter><SiteIntegrations /></MemoryRouter>);
    await act(async () => window.dispatchEvent(new Event("scroll")));
    expect(document.getElementById("gtm-init")).toBeNull();
  });
  it("does not block copy, selection, cut, or the context menu, even with a legacy setting", () => {
    render(<MemoryRouter><SiteIntegrations /></MemoryRouter>);

    ["copy", "cut", "contextmenu", "selectstart"].forEach((type) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });
    expect(document.body).not.toHaveClass("content-copy-protected");
  });
});
