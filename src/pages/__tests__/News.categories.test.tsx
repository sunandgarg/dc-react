import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import News from "@/pages/News";

const queries = vi.hoisted(() => [] as Array<{ queryKey: unknown[]; queryFn: () => Promise<unknown> }>);
beforeEach(() => { queries.length = 0; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

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
  return { ...actual, useQuery: (options: typeof queries[number]) => { queries.push(options); return { data: { rows: [], total: 36 }, isLoading: false }; } };
});

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="search">{location.search}</span>;
}

describe("public news categories", () => {
  it.each([
    ["/news", "eq.en"],
    ["/news?category=News", "eq.en"],
    ["/news?category=Vernacular", "neq.en"],
    ["/news?category=Vernacular&language=ta", "eq.ta"],
  ])("filters %s before counting or paginating", async (url, languageFilter) => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]", { headers: { "content-type": "application/json", "content-range": "*/0" } }));
    render(<MemoryRouter initialEntries={[url]}><News /></MemoryRouter>);
    await queries.find(({ queryKey }) => queryKey[0] === "news-latest")!.queryFn();
    const query = new URL(String(fetcher.mock.calls.at(-1)![0])).searchParams;
    expect(query.get("language_code")).toBe(languageFilter);
    expect(query.get("category")).toBe(url.includes("category=News") ? "eq.News" : null);
    expect(query.get("limit")).toBe("12");
    expect(screen.getByRole("button", { name: "Vernacular" })).toBeInTheDocument();
    if (url.includes("Vernacular")) expect(screen.getByRole("link", { name: "தமிழ்" })).toHaveAttribute("href", "/news?category=Vernacular&language=ta");
  });

  it("uses the editor category names and filters by the selected value", () => {
    render(<MemoryRouter initialEntries={["/news"]}><Routes><Route path="/news" element={<><News /><LocationProbe /></>} /></Routes></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Admission" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Career Guidance" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Admission News" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Career Guidance" }));
    expect(screen.getByTestId("search")).toHaveTextContent("category=Career+Guidance");
  });

  it("returns from a paginated language archive to unfiltered English news", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]", { headers: { "content-type": "application/json" } }));
    render(<MemoryRouter initialEntries={["/news?category=Vernacular&language=ta&page=2"]}><Routes><Route path="/news" element={<><News /><LocationProbe /></>} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole("link", { name: "English · All News" }));
    expect(screen.getByTestId("search").textContent).toBe("");
    expect(screen.getByRole("button", { name: "All News" })).toHaveAttribute("aria-pressed", "true");
    const latestQuery = queries.filter(({ queryKey }) => queryKey[0] === "news-latest").at(-1)!;
    await latestQuery.queryFn();
    const query = new URL(String(fetcher.mock.calls.at(-1)![0])).searchParams;
    expect(query.get("language_code")).toBe("eq.en");
    expect(query.get("category")).toBeNull();
    expect(query.get("offset")).toBe("0");
  });
});
