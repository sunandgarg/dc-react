import { describe, expect, it } from "vitest";
import { containsRichArticleHtml } from "./articleContentSanitizer";

describe("containsRichArticleHtml", () => {
  it("detects editor links even when text appears before the first tag", () => {
    expect(containsRichArticleHtml('Start here, then <a href="/courses">browse courses</a>.')).toBe(true);
  });

  it("does not mistake comparison text for HTML", () => {
    expect(containsRichArticleHtml("A score below 50 < 75 is not markup.")).toBe(false);
  });
});
