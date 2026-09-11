import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleCoverGenerator } from "../ArticleCoverGenerator";

const { invoke, toastError, toastSuccess } = vi.hoisted(() => ({
  invoke: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/integrations/backend/client", () => ({
  backendClient: { functions: { invoke } },
}));

vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}));

describe("ArticleCoverGenerator", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires an article title before generating", () => {
    render(<ArticleCoverGenerator title=" " onGenerated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /generate branded cover/i }));
    expect(invoke).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Enter the article title first");
  });

  it("generates a template cover and returns its public URL", async () => {
    invoke.mockResolvedValue({ data: { featured_image: "https://cdn.example.com/cover.webp" }, error: null });
    const onGenerated = vi.fn();
    render(<ArticleCoverGenerator title="  NEET counselling checklist  " slug="neet-checklist" onGenerated={onGenerated} />);
    fireEvent.click(screen.getByRole("button", { name: /generate branded cover/i }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("admin-article-cover", {
      body: { title: "NEET counselling checklist", slug: "neet-checklist", site_scope: "dekhocampus" },
    }));
    await waitFor(() => expect(onGenerated).toHaveBeenCalledWith("https://cdn.example.com/cover.webp"));
    expect(toastSuccess).toHaveBeenCalledWith("Branded cover generated");
  });

  it("keeps Sarkari cover generation in the Sarkari workspace", async () => {
    invoke.mockResolvedValue({ data: { featured_image: "https://cdn.example.com/sarkari-cover.webp" }, error: null });
    render(<ArticleCoverGenerator title="SSC CGL notification" siteScope="sarkari" onGenerated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /generate branded cover/i }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("admin-article-cover", {
      body: { title: "SSC CGL notification", slug: undefined, site_scope: "sarkari" },
    }));
  });
});
