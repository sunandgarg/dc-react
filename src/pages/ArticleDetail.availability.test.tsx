import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ArticleDetail from "./ArticleDetail";

const mocks = vi.hoisted(() => ({ query: { data: null, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() } }));
vi.mock("@/hooks/useArticlesData", () => ({ useDbArticle: () => mocks.query, useArticleSidebarArticles: () => ({ data: [] }) }));
vi.mock("@/hooks/useArticleCategories", () => ({ useArticleCategories: () => ({ data: [] }) }));
vi.mock("@/hooks/useExamsData", () => ({ useImportantExams: () => ({ data: [] }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: null }) }));
vi.mock("@/hooks/useSEO", () => ({ useSEO: vi.fn() }));
vi.mock("@/data/articles", () => ({ articles: [] }));
vi.mock("@/components/Navbar", () => ({ Navbar: () => <nav>Navigation</nav> }));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer>Footer</footer> }));

function openArticle() {
  return render(<MemoryRouter initialEntries={["/news/test-article"]}><Routes><Route path="/news/:slug" element={<ArticleDetail />} /></Routes></MemoryRouter>);
}

beforeEach(() => {
  Object.assign(mocks.query, { data: null, isLoading: false, isError: false, isFetching: false });
  mocks.query.refetch.mockReset();
});

describe("article availability", () => {
  it("offers retry after a transient API error instead of claiming the article is missing", () => {
    mocks.query.isError = true;
    openArticle();
    expect(screen.getByRole("alert")).toHaveTextContent("Article temporarily unavailable");
    expect(screen.queryByText("Article Not Found")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mocks.query.refetch).toHaveBeenCalledOnce();
  });

  it("disables duplicate retries while the retry is in flight", () => {
    Object.assign(mocks.query, { isError: true, isFetching: true });
    openArticle();
    expect(screen.getByRole("button", { name: "Retrying…" })).toBeDisabled();
  });

  it("still treats a successful empty article lookup as genuinely missing", () => {
    openArticle();
    expect(screen.getByRole("heading", { name: "Article Not Found" })).toBeInTheDocument();
    expect(screen.queryByText("Article temporarily unavailable")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse News" })).toHaveAttribute("href", "/news");
  });
});
