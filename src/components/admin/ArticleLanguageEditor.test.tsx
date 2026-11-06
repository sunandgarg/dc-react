import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArticleLanguageEditor } from "./ArticleLanguageEditor";

const api = vi.hoisted(() => ({ from: vi.fn(), invoke: vi.fn() }));
vi.mock("@/integrations/backend/client", () => ({ backendClient: { from: api.from, functions: { invoke: api.invoke } } }));
const original = { id: "11111111-2222-4333-8444-555555555555", site_scope: "dekhocampus" as const, language_code: "en", title: "Application guide", slug: "application-guide", status: "Published", is_active: true };
const hindi = { ...original, id: "hindi-id", language_code: "hi", english_article_id: original.id, status: "Draft", title: "आवेदन की जानकारी", is_active: false };
const clients: QueryClient[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  const chain = { select: () => chain, eq: () => chain, or: () => chain, limit: async () => ({ data: [original, hindi], error: null }) };
  api.from.mockReturnValue(chain);
  api.invoke.mockResolvedValue({ data: { engine_status: "not_connected", slots: [
    { language_code: "hi", status: "existing_draft" }, { language_code: "pa", status: "waiting_engine" },
  ] }, error: null });
});
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); });
function mount(article = original) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const onOpen = vi.fn();
  render(<QueryClientProvider client={client}><ArticleLanguageEditor article={article} canCreate onOpen={onOpen} /></QueryClientProvider>);
  return onOpen;
}

describe("automatic translation queue", () => {
  it("explains the zero-credit pause, shows queued slots and resumes existing drafts", async () => {
    const onOpen = mount();
    const queued = await screen.findByRole("button", { name: /ਪੰਜਾਬੀ.*Queued.*awaiting engine/ });
    expect(screen.getByText(/No API credits are used/)).toBeTruthy();
    expect(api.invoke).toHaveBeenCalledWith("article-translation-queue", { body: { article_id: original.id, site_scope: "dekhocampus" } });
    fireEvent.click(screen.getByRole("button", { name: /हिन्दी.*Draft/ }));
    expect(onOpen).toHaveBeenLastCalledWith(hindi, false);
    fireEvent.click(queued);
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ english_article_id: original.id, language_code: "pa", status: "Draft", content: "" }), true);
  });

  it("shows a queue read failure without blocking manual translation editing", async () => {
    api.invoke.mockResolvedValue({ data: null, error: new Error("Queue unavailable") });
    const onOpen = mount();
    await screen.findByRole("button", { name: "Retry queue" });
    fireEvent.click(screen.getByRole("button", { name: /हिन्दी.*Draft/ }));
    expect(onOpen).toHaveBeenLastCalledWith(hindi, false);
    expect(screen.queryByText(/Queued.*awaiting engine/)).toBeNull();
  });

  it("does not enqueue or call the queue API for an unsaved English article", () => {
    mount({ ...original, id: "", status: "Draft" });
    expect(screen.getByText(/Publishing a new English article queues/)).toBeTruthy();
    expect(api.invoke).not.toHaveBeenCalled();
  });
});
