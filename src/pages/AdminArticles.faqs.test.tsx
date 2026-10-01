import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import AdminArticles from "./AdminArticles";

const mocks = vi.hoisted(() => ({ role: "content_writer", writes: [] as unknown[], articles: [] as unknown[], faqData: [] as unknown[], faqError: null as Error | null,
  toastError: vi.fn(), from: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.toastError } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ isAdmin: mocks.role === "admin", roles: [mocks.role], can: (_resource: string, action: string) =>
  mocks.role === "admin" || action === "create" || (mocks.role !== "content_writer" && ["view", "edit"].includes(action)) || (mocks.role === "content_head" && action === "publish") }) }));
vi.mock("@/integrations/backend/client", () => ({ backendClient: { from: mocks.from } }));
vi.mock("@/hooks/useArticlesData", async (importOriginal) => ({ ...await importOriginal<typeof import("@/hooks/useArticlesData")>(),
  useAdminArticles: () => ({ data: { rows: mocks.articles, total: mocks.articles.length }, isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock("@/components/AdminLayout", () => ({ AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/PermGate", () => ({ PermGate: () => null }));
vi.mock("@/components/RichTextEditor", () => ({ RichTextEditor: ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) =>
  <label>{label}<textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} /></label> }));
vi.mock("@/components/admin/AuthorPicker", () => ({ AuthorPicker: () => null }));
vi.mock("@/components/admin/ImageUploadField", () => ({ ImageUploadField: () => null }));
vi.mock("@/components/admin/ArticleCoverGenerator", () => ({ ArticleCoverGenerator: () => null }));
vi.mock("@/components/admin/ArticleScorePanel", () => ({ ArticleScorePanel: () => null }));
vi.mock("@/components/admin/FeaturedRankPicker", () => ({ FeaturedRankPicker: () => null }));
vi.mock("@/components/admin/FeaturedRankPanel", () => ({ FeaturedRankPanel: () => null }));
vi.mock("@/components/admin/EntityMultiPicker", () => ({ EntityMultiPicker: () => null }));
vi.mock("@/components/admin/StudyMaterialQuickTagger", () => ({ StudyMaterialQuickTagger: () => null }));
vi.mock("@/components/admin/CollegeStudyTagger", () => ({ CollegeStudyTagger: () => null }));
vi.mock("@/components/admin/ArticleLinksEditor", () => ({ ArticleLinksEditor: () => null }));
vi.mock("@/components/admin/LinksSummary", () => ({ LinksSummary: () => null }));

const draftKey = "admin.articles.editing.v2.dekhocampus";
const draft = { title: "Admission guide", slug: "admission-guide", description: "An informative admission description.",
  content: "An article containing useful admission information.", status: "Draft", author: "Neha", is_active: false, faqs: [] };
const clientList: QueryClient[] = [];
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clientList.push(client);
  return render(<QueryClientProvider client={client}><MemoryRouter><AdminArticles /></MemoryRouter></QueryClientProvider>);
}
function expandFaqs() { fireEvent.click(screen.getByRole("button", { name: "FAQs (shown on article page)" })); }
function addFaq() {
  fireEvent.click(screen.getByRole("button", { name: "Add FAQ" }));
  fireEvent.change(screen.getByRole("textbox", { name: "FAQ 1 question" }), { target: { value: "When do admissions open?" } });
  fireEvent.change(screen.getByRole("textbox", { name: "FAQ 1 answer" }), { target: { value: "Check the official admission schedule." } });
}
beforeEach(() => {
  sessionStorage.clear(); localStorage.clear(); mocks.role = "content_writer"; mocks.writes.length = 0;
  mocks.articles = []; mocks.faqData = []; mocks.faqError = null; mocks.toastError.mockClear();
  mocks.from.mockImplementation((table: string) => {
    let write = false;
    const response = () => Promise.resolve(write ? { data: { id: "new-article", slug: draft.slug }, error: null, status: mocks.role === "content_head" ? 201 : 202 }
      : { data: table === "faqs" ? mocks.faqData : [], error: table === "faqs" ? mocks.faqError : null });
    const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: () => chain,
      insert: (payload: unknown) => { write = true; mocks.writes.push(payload); return chain; },
      update: (payload: unknown) => { write = true; mocks.writes.push(payload); return chain; },
      maybeSingle: response, then: (resolve: (data: unknown) => unknown, reject: (error: unknown) => unknown) => response().then(resolve, reject) };
    return chain;
  });
});
afterEach(() => { cleanup(); clientList.splice(0).forEach((client) => client.clear()); });

describe("article FAQ workflow", () => {
  for (const role of ["content_writer", "content", "content_head"]) {
    it(`${role} can add FAQs before saving and submit them with the article`, async () => {
      mocks.role = role;
      mount();
      fireEvent.click(screen.getByRole("button", { name: "Add Article" }));
      expandFaqs();
      expect(screen.getByRole("button", { name: "Add FAQ" })).toBeEnabled();
      expect(screen.queryByText(/Save draft to add FAQs/)).not.toBeInTheDocument();
      addFaq();
      // A draft survives leaving the editor or switching admin pages.
      await waitFor(() => expect(JSON.parse(sessionStorage.getItem(draftKey)!).faqs).toHaveLength(1));
      const entered = JSON.parse(sessionStorage.getItem(draftKey)!);
      cleanup();
      sessionStorage.setItem(draftKey, JSON.stringify({ ...draft, faqs: entered.faqs }));
      mount(); expandFaqs();
      expect(screen.getByRole("textbox", { name: "FAQ 1 question" })).toHaveValue("When do admissions open?");
      // Collapsing and reopening FAQs must not discard the answer.
      expandFaqs(); expandFaqs();
      expect(screen.getByRole("textbox", { name: "FAQ 1 answer" })).toHaveValue("Check the official admission schedule.");
      fireEvent.click(screen.getByRole("button", { name: role === "content_head" ? "Save Draft" : "Submit for approval" }));
      await waitFor(() => expect(mocks.writes).toHaveLength(1));
      expect(mocks.writes[0]).toMatchObject({ status: "Draft", is_active: false, faqs: entered.faqs });
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    }, 15_000);
  }

  it("incomplete FAQs prevent submitting and leave the draft open", async () => {
    sessionStorage.setItem(draftKey, JSON.stringify(draft)); mount(); expandFaqs();
    fireEvent.click(screen.getByRole("button", { name: "Add FAQ" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit for approval" }));
    expect(mocks.toastError).toHaveBeenCalledWith("FAQ 1 needs both a question and an answer.");
    expect(mocks.writes).toHaveLength(0);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("managers can edit loaded FAQs and add more without deleting saved FAQs", async () => {
    mocks.role = "content";
    mocks.faqData = [{ id: "saved-faq", question: "Existing question?", answer: "Existing answer", is_active: 1 }];
    sessionStorage.setItem(draftKey, JSON.stringify({ ...draft, id: "existing-article", faqs: undefined }));
    mount(); expandFaqs();
    await waitFor(() => expect(screen.getByRole("textbox", { name: "FAQ 1 question" })).toHaveValue("Existing question?"));
    expect(screen.queryByRole("button", { name: "Remove FAQ 1" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "FAQ 1 answer" }), { target: { value: "Updated answer" } });
    fireEvent.click(screen.getByRole("button", { name: "Add FAQ" }));
    expect(screen.getByRole("button", { name: "Remove FAQ 2" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove FAQ 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit for approval" }));
    await waitFor(() => expect(mocks.writes[0]).toMatchObject({ faqs: [{ id: "saved-faq", answer: "Updated answer", is_active: true }] }));
  });

  it("normalizes an old saved draft with numeric FAQ flags before editing or saving", async () => {
    mocks.role = "content";
    sessionStorage.setItem(draftKey, JSON.stringify({ ...draft, id: "existing-article", faqs: [
      { id: "saved-faq", question: "Existing question?", answer: "Existing answer", is_active: 0 },
    ] }));
    mount(); expandFaqs();
    expect(screen.getByRole("checkbox", { name: "Show this FAQ" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Submit for approval" }));
    await waitFor(() => expect(mocks.writes[0]).toMatchObject({ faqs: [{ id: "saved-faq", is_active: false }] }));
  });

  for (const role of ["admin", "content"]) {
    it(`${role} can reopen another author's article and save its existing FAQs`, async () => {
      mocks.role = role;
      const { faqs: _omitted, ...listedArticle } = draft;
      mocks.articles = [{ ...listedArticle, id: "existing-article", author: "Another Author", created_at: "2026-09-28T10:00:00Z" }];
      mocks.faqData = [{ id: "saved-faq", question: "Existing question?", answer: "Existing answer", is_active: 1 }];
      mount();
      fireEvent.click(screen.getByRole("button", { name: "Edit Admission guide" }));
      expandFaqs();
      await waitFor(() => expect(screen.getByRole("textbox", { name: "FAQ 1 question" })).toHaveValue("Existing question?"));
      fireEvent.click(screen.getByRole("button", { name: role === "admin" ? "Save Draft" : "Submit for approval" }));
      await waitFor(() => expect(mocks.writes[0]).toMatchObject({ author: "Another Author", faqs: [{ id: "saved-faq", is_active: true }] }));
    });
  }

  it("failed FAQ loading cannot overwrite saved FAQs and can be retried", async () => {
    mocks.role = "content"; mocks.faqError = new Error("Temporary outage");
    sessionStorage.setItem(draftKey, JSON.stringify({ ...draft, id: "existing-article", faqs: undefined }));
    mount(); expandFaqs();
    await screen.findByRole("button", { name: "Retry loading FAQs" });
    expect(screen.getByRole("button", { name: "Add FAQ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit for approval" })).toBeDisabled();
    mocks.faqError = null;
    fireEvent.click(screen.getByRole("button", { name: "Retry loading FAQs" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Add FAQ" })).toBeEnabled());
    expect(mocks.writes).toHaveLength(0);
  });

  it("saving a draft for tagging reloads FAQ IDs before another save", async () => {
    mocks.role = "content_head";
    mocks.faqData = [{ id: "persisted-faq-id", question: "When?", answer: "Next month", is_active: true }];
    sessionStorage.setItem(draftKey, JSON.stringify({ ...draft, faqs: [{ question: "When?", answer: "Next month", is_active: true }] }));
    mount(); expandFaqs();
    fireEvent.click(screen.getByRole("button", { name: "Save draft to enable tagging" }));
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem(draftKey)!).faqs[0].id).toBe("persisted-faq-id"));
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    await waitFor(() => expect(mocks.writes).toHaveLength(2));
    expect(mocks.writes[1]).toMatchObject({ faqs: [{ id: "persisted-faq-id" }] });
  });
});
