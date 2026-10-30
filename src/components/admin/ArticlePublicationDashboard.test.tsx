import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArticlePublicationDashboard, fetchPublicationRows } from "./ArticlePublicationDashboard";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/backend/client", () => ({ backendClient: { from: mocks.from } }));
const rows = [{ id: "a", title: "English guide", slug: "guide", author: "Writer A", author_id: "a", language_code: "en", created_at: "2026-10-30T12:00:00Z" },
  { id: "b", title: "हिन्दी गाइड", slug: "guide-hi", author: "", author_id: "b", language_code: "hi", created_at: "2026-10-30T12:00:00Z" }];
function mockRows(pages = [rows], error: Error | null = null) {
  let call = 0;
  const filters: unknown[][] = [];
  const chain = { select: () => chain, eq: (...args: unknown[]) => { filters.push(args); return chain; },
    gte: (...args: unknown[]) => { filters.push(args); return chain; }, lt: (...args: unknown[]) => { filters.push(args); return chain; },
    order: () => chain, range: vi.fn(() => chain), abortSignal: () => Promise.resolve({ data: pages[call++] || [], error }) };
  mocks.from.mockReturnValue(chain);
  return { filters, chain };
}
const clients: QueryClient[] = [];
function mount() { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  return render(<QueryClientProvider client={client}><ArticlePublicationDashboard siteScope="dekhocampus" authors={[{ id: "a", name: "Writer A" }, { id: "b", name: "Writer B" }]} /></QueryClientProvider>); }
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); vi.clearAllMocks(); });

describe("publication dashboard", () => {
  it("reads beyond the server page limit with live-only and half-open date filters", async () => {
    const full = Array.from({ length: 500 }, (_, i) => ({ ...rows[0], id: String(i) }));
    const { filters, chain } = mockRows([full, [rows[1]]]);
    expect(await fetchPublicationRows("dekhocampus", "start", "end")).toHaveLength(501);
    expect(chain.range.mock.calls).toEqual([[0, 499], [500, 999]]);
    expect(filters).toEqual(expect.arrayContaining([["site_scope", "dekhocampus"], ["status", "Published"], ["is_active", true], ["created_at", "start"], ["created_at", "end"]]));
  });
  it("filters the article list on writer click and validates custom dates", async () => {
    mockRows(); mount();
    await screen.findByRole("link", { name: /English guide/ });
    fireEvent.click(screen.getByRole("button", { name: "Writer B" }));
    expect(screen.queryByRole("link", { name: /English guide/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Unassigned writer/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /हिन्दी गाइड/ })).toHaveAttribute("href", "/news/guide-hi");
    expect(within(screen.getByRole("table")).getByRole("button", { name: "Writer B" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Show all writers" }));
    expect(screen.getByRole("link", { name: /English guide/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    fireEvent.change(screen.getByLabelText("Publication start date"), { target: { value: "2099-01-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Choose valid dates");
  });
  it("does not show partial totals when a page fails", async () => {
    mockRows([], new Error("Unavailable")); mount();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Counts could not be loaded"));
    expect(screen.queryByText("Published pages")).not.toBeInTheDocument();
  });
});
