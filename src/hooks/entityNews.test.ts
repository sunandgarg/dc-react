import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchEntityNewsArticles } from "./useArticlesData";

const options = { entityName: "VSAT", entityType: "exam" as const, entitySlug: "vsat" };
const row = { id: "historic-linked", slug: "older-exam-news", title: "Earlier linked update" };
const response = (data: unknown) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
afterEach(() => vi.restoreAllMocks());

describe("bounded entity news feeds", () => {
  it("keeps explicitly linked older articles without downloading the full catalogue", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response([{ article_id: row.id }]))
      .mockResolvedValueOnce(response([row]));
    expect(await fetchEntityNewsArticles(options)).toEqual([row]);
    const url = new URL(String(fetcher.mock.calls[1][0]));
    expect(url.searchParams.get("id")).toBe("in.(historic-linked)");
    expect(url.searchParams.get("limit")).toBe("3");
    expect(url.searchParams.get("status")).toBe("eq.Published");
    expect(url.searchParams.get("site_scope")).toBe("eq.dekhocampus");
    expect(url.searchParams.get("select")?.split(",")).not.toContain("content");
  });
  it("tries a bounded matching feed then recent news when no links match", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response([])).mockResolvedValueOnce(response([])).mockResolvedValueOnce(response([row]));
    expect(await fetchEntityNewsArticles(options)).toEqual([row]);
    for (const [input] of fetcher.mock.calls.slice(1)) expect(new URL(String(input)).searchParams.get("limit")).toBe("3");
    expect(new URL(String(fetcher.mock.calls[1][0])).searchParams.get("or")).toContain("title.ilike.%VSAT%");
  });
  it("reports API failures instead of treating them as an empty catalogue", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"error":"Unavailable"}', { status: 503 }));
    await expect(fetchEntityNewsArticles(options)).rejects.toThrow("Unavailable");
  });
});
