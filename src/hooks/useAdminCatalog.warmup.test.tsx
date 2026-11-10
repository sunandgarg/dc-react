import { afterEach, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAdminCatalog } from "./useAdminCatalog";
vi.mock("./useAuth", () => ({ useAuth: () => ({ user: { id: "editor" }, isAdmin: false, roles: ["content"], canAccess: (t: string) => t === "articles" }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("finds a scoped record while the full name scan is pending", async () => {
  const requests: URL[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
    const url = new URL(String(input)); requests.push(url);
    if (!url.searchParams.has("title")) return new Promise<Response>(() => {});
    return new Response(JSON.stringify([{ id: "17", title: "Admission guide", site_scope: "dekhocampus" }]), { headers: { "Content-Type": "application/json" } });
  });
  const client = new QueryClient();
  const { result } = renderHook(() => useAdminCatalog(false, "Admission"), { wrapper: ({ children }) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  await waitFor(() => expect(result.current.data[0]?.id).toBe("17"));
  const lookup = requests.find(url => url.searchParams.has("title"))!;
  expect(lookup.searchParams.get("limit")).toBe("20");
  expect(lookup.searchParams.get("select")).toBe("id,title,site_scope");
  expect(lookup.searchParams.get("site_scope")).toBe("eq.dekhocampus");
  expect(requests.every(url => url.pathname.endsWith("/articles"))).toBe(true);
  client.clear();
});
