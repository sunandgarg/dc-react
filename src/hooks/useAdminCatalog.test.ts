import { afterEach, expect, it, vi } from "vitest";
import { fetchCatalogNames, fetchCatalogRecord } from "./useAdminCatalog";

afterEach(() => vi.restoreAllMocks());
it("reads only scoped article names across the REST page limit, then fetches one selected detail", async () => {
  const requests: URL[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
    const url = new URL(String(input));
    requests.push(url);
    const after = url.searchParams.get("id");
    const rows = after?.startsWith("eq.") ? [{ id: "1000", content: "Full text" }] :
      Array.from({ length: after ? 1 : 1000 }, (_, i) => ({ id: String(after ? 1000 : i), title: "Article " + (after ? 1000 : i), site_scope: "dekhocampus" }));
    return new Response(JSON.stringify(rows), { headers: { "Content-Type": "application/json" } });
  });
  const names = await fetchCatalogNames(["articles"], new AbortController().signal);
  expect(requests.map(q => q.searchParams.get("id"))).toEqual([null, "gt.999"]);
  expect(requests.every(q => q.searchParams.get("select") === "id,title,site_scope" && q.searchParams.get("site_scope") === "eq.dekhocampus")).toBe(true);
  expect(names.at(-1)?.name).toBe("Article 1000");
  expect(await fetchCatalogRecord("articles", "1000", "dekhocampus")).toMatchObject({ content: "Full text" });
  expect(requests.at(-1)?.searchParams.get("id")).toBe("eq.1000");
  expect(requests.at(-1)?.searchParams.get("limit")).toBe("1");
});
