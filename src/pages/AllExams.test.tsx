import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AllExams from "./AllExams";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/hooks/useInfiniteData", () => ({ useInfiniteData: (config: unknown) => {
  query(config);
  return { items: [], totalCount: 0, sentinelRef: { current: null }, isLoading: false, isFetchingMore: false, hasMore: false, error: null };
} }));
vi.mock("@/hooks/useSEO", () => ({ useSEO: () => undefined }));
vi.mock("@/hooks/useCanonical", () => ({ useCanonical: () => undefined }));
vi.mock("@/components/Navbar", () => ({ Navbar: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/PageBreadcrumb", () => ({ PageBreadcrumb: () => null }));
vi.mock("@/components/LeadCaptureForm", () => ({ LeadCaptureForm: () => null }));
vi.mock("@/components/DynamicAdBanner", () => ({ DynamicAdBanner: () => null }));
vi.mock("@/components/AlsoCheckSection", () => ({ AlsoCheckSection: () => null }));
vi.mock("@/components/InlineAdSlot", () => ({ InlineAdSlot: () => null }));
vi.mock("@/components/MobileFilterSheet", () => ({ MobileFilterSheet: () => null }));
vi.mock("@/components/MobileBottomFilter", () => ({ MobileBottomFilter: () => null }));
vi.mock("@/components/ExamCard", () => ({ ExamCard: () => null }));
vi.mock("@/components/SkeletonCards", () => ({ ExamCardSkeleton: () => null }));

afterEach(() => { cleanup(); query.mockClear(); });
const renderRoute = (route: string) => render(<MemoryRouter initialEntries={[route]}><AllExams /></MemoryRouter>);
const lastQuery = () => query.mock.calls.at(-1)![0];

describe("Exam scope and educational-level listing parity", () => {
  it.each(["national", "state"])("queries %s curated scope without sending it as an education level", (scope) => {
    renderRoute(`/exams/top-${scope}-entrance-exams-in-india`);
    expect(lastQuery().filters.level).toEqual([scope === "national" ? "National" : "State"]);
    expect(lastQuery().arrayFilters.education_levels).toEqual([]);
  });

  it("keeps UG filtering independent of national scope across query URLs", () => {
    renderRoute("/exams?level=National&level=UG");
    expect(lastQuery().filters.level).toEqual(["National"]);
    expect(lastQuery().arrayFilters.education_levels).toEqual(["UG"]);
  });

  it("removes the hidden scope when the visitor clears filters", () => {
    renderRoute("/exams/top-national-entrance-exams-in-india");
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(lastQuery().filters.level).toBeUndefined();
    expect(lastQuery().arrayFilters.education_levels).toEqual([]);
  });
});
