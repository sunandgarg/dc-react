import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import WriterProfile from "./WriterProfile";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/components/AdminLayout", () => ({ AdminLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "writer-user" } }) }));
vi.mock("@/integrations/backend/client", () => ({ backendClient: { functions: { invoke: mocks.invoke } } }));

function openProfile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><MemoryRouter><WriterProfile /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => mocks.invoke.mockReset());
describe("private writer profile", () => {
  it("links to the writer's actual published work and their article drafts", async () => {
    mocks.invoke.mockResolvedValue({ data: { author: { slug: "neha", name: "Neha", expertise: [] }, suggested_name: "Neha" }, error: null });
    openProfile();
    expect(await screen.findByRole("link", { name: "View my published work" })).toHaveAttribute("href", "/author/neha#contributions");
    expect(screen.getByRole("link", { name: "My articles and drafts" })).toHaveAttribute("href", "/admin/articles");
    expect(screen.getByLabelText("Byline name")).toHaveValue("Neha");
  });
  it("prevents editing an empty form after a failed profile load and supports retry", async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: new Error("Offline") });
    openProfile();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your writer profile");
    expect(screen.queryByRole("button", { name: "Save my profile" })).not.toBeInTheDocument();
    mocks.invoke.mockResolvedValue({ data: { author: null, suggested_name: "Neha" }, error: null });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Save my profile" })).toBeInTheDocument();
  });
});
