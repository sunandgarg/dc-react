import { describe, expect, it } from "vitest";
import {
  applyAdminLeadFilters,
  leadCreatedAtRange,
  normalizeAdminLeadPageSize,
  normalizeAdminLeadSort,
  safeLeadFilterText,
  type AdminLeadFilters,
} from "./adminLeadQuery";

const defaults: AdminLeadFilters = {
  search: "", source: "all", city: "all", state: "all", college: "all",
  course: "all", mode: "all", category: "all", device: "all", status: "all",
  range: "all", customFrom: "", customTo: "",
};

class QueryRecorder {
  calls: Array<[string, ...unknown[]]> = [];
  eq(...args: unknown[]) { this.calls.push(["eq", ...args]); return this; }
  gte(...args: unknown[]) { this.calls.push(["gte", ...args]); return this; }
  lte(...args: unknown[]) { this.calls.push(["lte", ...args]); return this; }
  or(...args: unknown[]) { this.calls.push(["or", ...args]); return this; }
}

describe("admin lead server query", () => {
  it("always applies site scope before every other filter", () => {
    const query = applyAdminLeadFilters(new QueryRecorder(), "sarkari", {
      ...defaults,
      source: "article_detail",
      status: "qualified",
    });
    expect(query.calls).toEqual([
      ["eq", "site_scope", "sarkari"],
      ["eq", "source", "article_detail"],
      ["eq", "status", "qualified"],
    ]);
  });

  it("scrubs boolean-filter syntax from user text", () => {
    expect(safeLeadFilterText('alice),site_scope.eq.dekhocampus,("')).toBe(
      "alice site_scope.eq.dekhocampus",
    );
    const query = applyAdminLeadFilters(new QueryRecorder(), "sarkari", {
      ...defaults,
      search: "alice),site_scope.eq.dekhocampus",
    });
    expect(query.calls[1][1]).not.toContain(",site_scope");
    expect(query.calls[0]).toEqual(["eq", "site_scope", "sarkari"]);
  });

  it("builds bounded dates deterministically", () => {
    expect(leadCreatedAtRange({ range: "7d", customFrom: "", customTo: "" }, new Date("2026-09-11T00:00:00.000Z"))).toEqual({
      from: "2026-09-04T00:00:00.000Z",
    });
  });

  it("clamps page sizes and rejects unknown sort columns", () => {
    expect(normalizeAdminLeadPageSize(-1)).toBe(1);
    expect(normalizeAdminLeadPageSize(10_000)).toBe(200);
    expect(normalizeAdminLeadSort("created_at")).toBe("created_at");
    expect(normalizeAdminLeadSort("site_scope desc; drop table leads")).toBe("created_at");
  });
});
