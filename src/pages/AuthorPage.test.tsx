import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuthorPage from "./AuthorPage";

const mocks = vi.hoisted(() => ({ profile: vi.fn(), contributions: vi.fn() }));
vi.mock("@/components/Navbar", () => ({ Navbar: () => <nav /> }));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer /> }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/components/detail/RichText", () => ({ RichText: () => null }));
vi.mock("@/integrations/backend/client", () => ({ backendClient: { from: () => {
  const query = { select: () => query, eq: () => query, maybeSingle: mocks.profile };
  return query;
} } }));
vi.mock("@/lib/authorContributions", async (original) => ({
  ...await original<typeof import("@/lib/authorContributions")>(),
  fetchAuthorContributions: mocks.contributions,
}));

function openProfile() {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/author/neha"]}><Routes><Route path="/author/:slug" element={<AuthorPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  mocks.profile.mockReset().mockResolvedValue({ data: { id: "neha", slug: "neha", name: "Neha", expertise: [] }, error: null });
  mocks.contributions.mockReset().mockImplementation(async (source, _author, offset, search) => {
    if (source.table !== "articles") return { rows: [], count: 0 };
    const count = search ? 1 : 63;
    const rows = Array.from({ length: Math.min(12, count - offset) }, (_, i) => ({ id: `${offset + i}`, slug: `post-${offset + i}`, title: search ? "CUET guidance" : `Article ${offset + i}`, created_at: "2026-09-20T00:00:00Z" }));
    return { rows, count, nextOffset: offset + rows.length < count ? offset + rows.length : undefined };
  });
});

describe("public writer profile", () => {
  it("does not publish an old writer photo in the page or Person schema by default", async () => {
    mocks.profile.mockResolvedValue({ data: { id: "neha", slug: "neha", name: "Neha", photo: "https://example.com/old-photo.jpg", avatar_style: "illustration", expertise: [] }, error: null });
    const view = openProfile();
    expect(await screen.findByAltText("Woman writer illustration")).toBeInTheDocument();
    expect(screen.queryByAltText("Neha profile photo")).not.toBeInTheDocument();
    const schema = JSON.parse(view.container.querySelector('script[type="application/ld+json"]')?.textContent || "{}");
    expect(schema).not.toHaveProperty("image");
  });

  it("shows existing posts and loads older posts beyond 50", async () => {
    openProfile();
    expect(await screen.findByText("Articles (63)")).toBeInTheDocument();
    expect(screen.getByText("Article 0").closest("a")).toHaveAttribute("href", "/news/post-0");
    for (let offset = 12; offset <= 60; offset += 12) {
      fireEvent.click(screen.getByRole("button", { name: "Load more articles" }));
      await screen.findByText(`Article ${offset}`);
    }
    expect(screen.getByText("Article 62")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more articles" })).not.toBeInTheDocument();
  });

  it("filters content type and searches across older work, not just loaded cards", async () => {
    openProfile();
    await screen.findByText("Articles (63)");
    fireEvent.change(screen.getByLabelText("Content type"), { target: { value: "articles" } });
    expect(screen.queryByRole("region", { name: "Colleges" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search contributions"), { target: { value: "CUET" } });
    expect(await screen.findByText("CUET guidance")).toBeInTheDocument();
    expect(screen.getByText("Articles (1)")).toBeInTheDocument();
  });

  it("shows a retry action for contribution errors rather than no published content", async () => {
    mocks.contributions.mockRejectedValue(new Error("Network error"));
    openProfile();
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(7));
    expect(screen.getByText(/Could not load articles/)).toBeInTheDocument();
    expect(screen.queryByText("No published articles yet.")).not.toBeInTheDocument();
    mocks.contributions.mockResolvedValue({ rows: [], count: 0 });
    fireEvent.click(screen.getAllByRole("button", { name: "Try again" })[0]);
    expect(await screen.findByText("No published articles yet.")).toBeInTheDocument();
  });

  it("distinguishes profile API failures from an unknown author", async () => {
    mocks.profile.mockResolvedValue({ data: null, error: new Error("Offline") });
    openProfile();
    expect(await screen.findByText("Could not load this writer profile.")).toBeInTheDocument();
    expect(screen.queryByText("Author not found.")).not.toBeInTheDocument();
  });
});
