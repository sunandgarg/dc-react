import { afterEach, expect, it, vi } from "vitest";
import { fetchCatalogNames, fetchCatalogRecord } from "./useAdminCatalog";

afterEach(() => vi.restoreAllMocks());
it("reads only scoped article names across the REST page limit, then fetches one selected detail", async () => {
  const requests: URL[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
    const url = new URL(String(input));
    requests.push(url);
    const offset = Number(url.searchParams.get("offset"));
    const rows = url.searchParams.has("id") ? [{ id: "1000", content: "Full text" }] :
      Array.from({ length: offset === 0 ? 1000 : 1 }, (_, i) => ({ id: String(offset + i), title: "Article " + (offset + i), site_scope: "dekhocampus" }));
    return new Response(JSON.stringify(rows), { headers: { "Content-Type": "application/json" } });
  });
  const names = await fetchCatalogNames(["articles"], new AbortController().signal);
  expect(requests.map(q => q.searchParams.get("offset"))).toEqual(["0", "1000"]);
  expect(requests.every(q => q.searchParams.get("select") === "id,title,site_scope" && q.searchParams.get("site_scope") === "eq.dekhocampus")).toBe(true);
  expect(names.at(-1)?.name).toBe("Article 1000");
  expect(await fetchCatalogRecord("articles", "1000", "dekhocampus")).toMatchObject({ content: "Full text" });
  expect(requests.at(-1)?.searchParams.get("id")).toBe("eq.1000");
  expect(requests.at(-1)?.searchParams.get("limit")).toBe("1");
});
