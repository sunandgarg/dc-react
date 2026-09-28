import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
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

afterEach(() => {
  document.body.className = "";
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
});
