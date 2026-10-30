import { describe, expect, it } from "vitest";
import { groupPublications, indiaDate, publicationBounds, publicationDates, type PublicationRow } from "./articlePublicationDashboard";

describe("publication date ranges", () => {
  const now = Date.parse("2026-10-30T18:31:00Z");
  it("uses India calendar days, including midnight and inclusive custom end dates", () => {
    expect(indiaDate(now)).toBe("2026-10-31");
    expect(publicationDates("today", now)).toEqual({ start: "2026-10-31", end: "2026-10-31" });
    expect(publicationDates("yesterday", now)).toEqual({ start: "2026-10-30", end: "2026-10-30" });
    expect(publicationDates("week", now)).toEqual({ start: "2026-10-25", end: "2026-10-31" });
    expect(publicationDates("month", now)).toEqual({ start: "2026-10-02", end: "2026-10-31" });
    expect(publicationBounds("2026-10-30", "2026-10-31")).toEqual({ from: "2026-10-29T18:30:00.000Z", until: "2026-10-31T18:30:00.000Z" });
  });
  it("handles year boundaries and rejects invalid/reversed dates", () => {
    expect(publicationDates("yesterday", Date.parse("2027-01-01T01:00:00Z"))).toEqual({ start: "2026-12-31", end: "2026-12-31" });
    for (const [start, end] of [["", "2026-10-31"], ["2026-10-31", "2026-10-30"], ["2026-02-30", "2026-03-01"], ["invalid", "invalid"]]) expect(publicationBounds(start, end)).toBeNull();
  });
});

describe("publication writer totals", () => {
  const row = (id: string, author: string, author_id?: string, language_code?: string): PublicationRow => ({ id, author, author_id, language_code, title: id, slug: id, created_at: "2026-10-30T12:00:00Z" });
  it("merges linked and legacy bylines, separates languages, and deduplicates IDs", () => {
    const rows = [row("1", "Old name", "a", "en"), row("2", " Writer A ", undefined, "hi"), row("3", "Writer A"), row("4", "", undefined, "ta")];
    const groups = groupPublications([...rows, rows[0]], [{ id: "a", name: "Writer A" }]);
    expect(groups.map(({ name, english, vernacular, rows }) => ({ name, english, vernacular, count: rows.length }))).toEqual([
      { name: "Writer A", english: 2, vernacular: 1, count: 3 }, { name: "Unassigned writer", english: 0, vernacular: 1, count: 1 },
    ]);
  });
  it("does not merge distinct profiles with the same name", () => {
    const groups = groupPublications([row("1", "Writer", "a"), row("2", "Writer", "b"), row("3", "Writer")], [{ id: "a", name: "Writer" }, { id: "b", name: "Writer" }]);
    expect(groups).toHaveLength(3);
  });
});
