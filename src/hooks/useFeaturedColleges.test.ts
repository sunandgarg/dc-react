import { describe, expect, it } from "vitest";
import { uniqueFeatured } from "./useFeaturedColleges";

describe("uniqueFeatured", () => {
  it("uses the newest admin state when duplicate college slugs exist", () => {
    const rows = [
      { id: "old", college_slug: "iim-ahmedabad", category: null, state: null, display_order: 4, is_active: true, updated_at: "2026-02-24T17:06:46.419Z" },
      { id: "new", college_slug: "iim-ahmedabad", category: null, state: null, display_order: 2, is_active: false, updated_at: "2026-09-07T06:48:10.316Z" },
      { id: "active", college_slug: "lovely-professional-university", category: null, state: null, display_order: 1, is_active: true, updated_at: "2026-09-07T06:48:10.316Z" },
    ];

    expect(uniqueFeatured(rows, true).map((row) => row.college_slug)).toEqual(["lovely-professional-university"]);
  });
});
