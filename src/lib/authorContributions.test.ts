import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { AUTHOR_PAGE_SIZE, AUTHOR_SOURCES, fetchAuthorContributions } from "./authorContributions";

const mock = vi.hoisted(() => ({ calls: [] as Array<[string, ...unknown[]]>, result: { data: [] as unknown[], error: null as null | Error, count: 0 as number | null } }));
vi.mock("@/integrations/backend/client", () => ({
  backendClient: { from: (table: string) => {
    mock.calls.push(["from", table]);
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "neq", "or", "ilike", "order", "range"]) {
      query[method] = (...args: unknown[]) => { mock.calls.push([method, ...args]); return query; };
    }
    query.then = (resolve: (value: typeof mock.result) => void) => Promise.resolve(mock.result).then(resolve);
    return query;
  } },
}));

beforeEach(() => { mock.calls = []; mock.result = { data: [], error: null, count: 0 }; });

describe("writer profile contributions", () => {
  it("only selects columns actually present in each table", () => {
    const schema = readFileSync("backend/prisma/schema.prisma", "utf8");
    for (const source of AUTHOR_SOURCES) {
      const model = schema.match(new RegExp(`model ${source.table} \\{([\\s\\S]*?)\\n\\}`))![1];
      for (const column of source.columns.split(",")) expect(model).toMatch(new RegExp(`\\n\\s+${column}\\s+`));
    }
  });

  it("does not proxy public author pages into the local login API", () => {
    const config = readFileSync("vite.config.ts", "utf8");
    const pattern = config.match(/"(\^\/auth[^"\n]+)":/)!;
    expect(pattern).not.toBeNull();
    const route = new RegExp(pattern[1]);
    expect(route.test("/auth/v1/token")).toBe(true);
    expect(route.test("/auth")).toBe(false);
    expect(route.test("/author/neha")).toBe(false);
    expect(route.test("/authors")).toBe(false);
  });

  it("includes legacy article bylines only when no explicit author is assigned", async () => {
    const author = { id: "writer-id", name: 'Neha, "Writer"' };
    await fetchAuthorContributions(AUTHOR_SOURCES[0], author);
    expect(mock.calls).toContainEqual(["or", 'author_id.eq."writer-id",author_id.is.null']);
    expect(mock.calls).toContainEqual(["or", 'author_id.eq."writer-id",author.eq."Neha, \\"Writer\\""']);
    // Flat groups are ANDed by the API: ID wins, otherwise null ID + exact name.
    const belongs = (id: string | null, name: string) => (id === author.id || id === null) && (id === author.id || name === author.name);
    expect(belongs(null, author.name)).toBe(true);
    expect(belongs(author.id, "Old name")).toBe(true);
    expect(belongs("other-writer", author.name)).toBe(false);
    expect(belongs(null, "Other writer")).toBe(false);
    expect(mock.calls).toContainEqual(["eq", "site_scope", "dekhocampus"]);
    expect(mock.calls).toContainEqual(["eq", "status", "Published"]);
  });

  it.each(AUTHOR_SOURCES)("filters inactive $table and respects its publication fields", async (source) => {
    await fetchAuthorContributions(source, { id: "writer", name: "Neha" });
    expect(mock.calls).toContainEqual(["eq", "is_active", true]);
    if (source.table !== "articles") {
      expect(mock.calls).toContainEqual(["eq", "author_id", "writer"]);
      expect(mock.calls.filter(([method]) => method === "or")).toEqual([]);
      if (source.hasStatus) expect(mock.calls).toContainEqual(["neq", "status", "Draft"]);
    }
  });

  it("sorts newest first with stable pagination beyond the old 50-post cap", async () => {
    mock.result = { data: Array.from({ length: AUTHOR_PAGE_SIZE }, (_, i) => ({ id: `old-${i}` })), error: null, count: 131 };
    const page = await fetchAuthorContributions(AUTHOR_SOURCES[0], { id: "writer", name: "Neha" }, 60, " CUET ");
    expect(mock.calls).toContainEqual(["range", 60, 71]);
    expect(mock.calls).toContainEqual(["order", "created_at", { ascending: false }]);
    expect(mock.calls).toContainEqual(["order", "id", { ascending: false }]);
    expect(mock.calls).toContainEqual(["ilike", "title", "%CUET%"]);
    expect(page.nextOffset).toBe(72);
    mock.result = { data: [{ id: "last" }], count: 73, error: null };
    expect((await fetchAuthorContributions(AUTHOR_SOURCES[0], { id: "writer", name: "Neha" }, 72)).nextOffset).toBeUndefined();
  });

  it("does not silently convert API errors into an empty profile", async () => {
    mock.result.error = new Error("Could not load articles");
    await expect(fetchAuthorContributions(AUTHOR_SOURCES[0], { id: "writer", name: "Neha" })).rejects.toThrow("Could not load articles");
  });

  it("links directly to canonical entity URLs and the specific study subject", () => {
    const row = { id: "one", slug: "computer-science", short_id: 20001, created_at: "2026-09-28", class_num: 12, board_slug: "cbse" };
    expect(AUTHOR_SOURCES[2].href(row)).toBe("/courses/computer-science-20001");
    expect(AUTHOR_SOURCES[6].href(row)).toBe("/study-material/class-12/cbse/computer-science");
  });
});
