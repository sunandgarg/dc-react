import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ScholarshipDetail from "./ScholarshipDetail";

const mocks = vi.hoisted(() => ({ scholarship: { title: "Kotak Kanya Scholarship", slug: "kotak-kanya-scholarship", apply_url: "", meta_description: "<p>Official details &amp; application link pending.</p>" } }));
vi.mock("@/integrations/backend/client", () => ({
  backendClient: {
    from: () => ({ select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: mocks.scholarship }) }),
      neq: () => ({ limit: async () => ({ data: [] }) }),
    }) }),
  },
}));
vi.mock("@/components/Navbar", () => ({ Navbar: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/SEO", () => ({ SEO: ({ description }: { description: string }) => <span data-testid="seo-description">{description}</span> }));
vi.mock("@/components/AuthorByline", () => ({ AuthorByline: () => null }));
vi.mock("@/components/AlsoCheckSection", () => ({ AlsoCheckSection: () => null }));
vi.mock("@/components/LeadGateDialog", () => ({ LeadGateDialog: () => null }));

function openScholarship() {
  return render(<MemoryRouter initialEntries={["/scholarships/kotak-kanya-scholarship"]}>
    <Routes><Route path="/scholarships/:slug" element={<ScholarshipDetail />} /></Routes>
  </MemoryRouter>);
}

describe("scholarship application status", () => {
  it("does not invite applications when no verified application URL exists", async () => {
    mocks.scholarship.apply_url = "";
    openScholarship();
    expect(await screen.findByRole("heading", { name: "Application Status" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Apply Now/i })).not.toBeInTheDocument();
    expect(screen.getByText(/No verified application link is available yet/)).toBeInTheDocument();
    expect(screen.getByTestId("seo-description")).toHaveTextContent("Official details & application link pending.");
    expect(screen.getAllByRole("button", { name: /Free Guidance/i }).length).toBeGreaterThan(0);
  });

  it("keeps the application path for a scholarship with an HTTPS URL", async () => {
    mocks.scholarship.apply_url = "https://example.org/apply";
    openScholarship();
    expect(await screen.findByRole("heading", { name: "How to Apply" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Apply Now/i }).length).toBeGreaterThan(0);
  });
});
