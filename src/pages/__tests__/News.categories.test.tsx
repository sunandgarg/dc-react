import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import News from "@/pages/News";

vi.mock("@/components/Navbar", () => ({ Navbar: () => <nav /> }));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer /> }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/hooks/useArticleCategories", () => ({
  useArticleCategories: () => ({ data: [
    { slug: "admission", name: "Admission" },
    { slug: "career-guidance", name: "Career Guidance" },
  ] }),
}));
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return { ...actual, useQuery: () => ({ data: { rows: [], count: 0 }, isLoading: false }) };
});

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="search">{location.search}</span>;
}

describe("public news categories", () => {
  it("uses the editor category names and filters by the selected value", () => {
    render(<MemoryRouter initialEntries={["/news"]}><Routes><Route path="/news" element={<><News /><LocationProbe /></>} /></Routes></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Admission" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Career Guidance" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Admission News" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Career Guidance" }));
    expect(screen.getByTestId("search")).toHaveTextContent("category=Career+Guidance");
  });
});
