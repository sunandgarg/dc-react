import { act, render, waitFor } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteIntegrations, isCopyAllowedTarget, shouldBlockPublicCopy } from "./SiteIntegrations";

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
  document.body.classList.remove("content-copy-protected");
});

describe("SiteIntegrations copy guard", () => {
  it("never blocks selection after a client-side navigation into admin", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "Article editor copy";

    expect(shouldBlockPublicCopy("/admin/articles", paragraph.firstChild)).toBe(false);
  });

  it("recognizes text-node targets inside contenteditable editors", () => {
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    const paragraph = document.createElement("p");
    paragraph.textContent = "Selectable copy";
    editor.appendChild(paragraph);

    expect(isCopyAllowedTarget(paragraph.firstChild)).toBe(true);
    expect(shouldBlockPublicCopy("/news/example", paragraph.firstChild)).toBe(false);
  });

  it("continues to protect ordinary public article text", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "Protected copy";

    expect(shouldBlockPublicCopy("/news/example", paragraph.firstChild)).toBe(true);
  });

  it("updates the body protection class across public and admin route transitions", async () => {
    let navigate: ReturnType<typeof useNavigate> | undefined;
    function Harness() {
      navigate = useNavigate();
      return <SiteIntegrations />;
    }

    render(
      <MemoryRouter initialEntries={["/news/example"]}>
        <Harness />
      </MemoryRouter>,
    );

    await waitFor(() => expect(document.body).toHaveClass("content-copy-protected"));
    act(() => navigate?.("/admin/articles"));
    await waitFor(() => expect(document.body).not.toHaveClass("content-copy-protected"));
    act(() => navigate?.("/news/example"));
    await waitFor(() => expect(document.body).toHaveClass("content-copy-protected"));
  });
});
