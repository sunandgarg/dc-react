import { describe, expect, it } from "vitest";
import { articleAuthorFilter, articleCreatedSince, sortArticleAuthors } from "./adminArticleFilters";

describe("admin article filters", () => {
  it("prioritizes the requested authors, then sorts remaining names alphabetically", () => {
    const authors = ["Zoya", "Geethika Reddy", "Neha Sharma", "Amit", "Manav Gupta"].map((name) => ({ id: name, name }));
    expect(sortArticleAuthors(authors).map((author) => author.name)).toEqual(["Manav Gupta", "Neha Sharma", "Geethika Reddy", "Amit", "Zoya"]);
    expect(authors[0].name).toBe("Zoya");
  });
  it("uses rolling 1, 2 and 7 day creation cutoffs and no cutoff for all dates", () => {
    const now = Date.parse("2026-09-27T12:00:00Z");
    expect(articleCreatedSince("1", now)).toBe("2026-09-26T12:00:00.000Z");
    expect(articleCreatedSince("2", now)).toBe("2026-09-25T12:00:00.000Z");
    expect(articleCreatedSince("7", now)).toBe("2026-09-20T12:00:00.000Z");
    expect(articleCreatedSince("", now)).toBeUndefined();
  });
  it("matches both author profile and legacy text without unescaped query separators", () => {
    expect(articleAuthorFilter({ id: "writer-id", name: "Manav, Writer" })).toBe('author_id.eq."writer-id",author.eq."Manav, Writer"');
  });
});
