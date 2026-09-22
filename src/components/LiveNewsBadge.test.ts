import { describe, expect, it } from "vitest";
import { isArticlePublishedToday } from "./LiveNewsBadge";

describe("isArticlePublishedToday", () => {
  it("uses the India calendar day at midnight boundaries", () => {
    const now = new Date("2026-09-22T00:00:00.000Z");

    expect(isArticlePublishedToday("2026-09-21T18:31:00.000Z", now)).toBe(true);
    expect(isArticlePublishedToday("2026-09-21T18:29:00.000Z", now)).toBe(false);
  });

  it("rejects missing and invalid dates", () => {
    expect(isArticlePublishedToday(null)).toBe(false);
    expect(isArticlePublishedToday("not-a-date")).toBe(false);
  });
});
