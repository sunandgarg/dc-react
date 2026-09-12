import { describe, expect, it } from "vitest";
import { normalizeArticleSlug, validateArticleSave, visibleArticleText } from "./articleEditor";

describe("article editor save contract", () => {
  it("normalizes an editor-entered slug before persistence", () => {
    expect(normalizeArticleSlug("  CAT 2027: Dates & Pattern!  ")).toBe("cat-2027-dates-and-pattern");
  });

  it("treats visually empty rich text as empty", () => {
    expect(visibleArticleText("<p><br></p><p>&nbsp;</p>")).toBe("");
  });

  it("allows incomplete drafts but protects public articles", () => {
    const incomplete = { title: "CAT update", slug: "CAT update", description: "<p></p>", content: "<p></p>" };
    expect(validateArticleSave({ ...incomplete, status: "Draft" }, true)).toBeNull();
    expect(validateArticleSave({ ...incomplete, status: "Published" }, true)).toMatch(/description/i);
  });

  it("accepts a complete publishable article", () => {
    expect(validateArticleSave({
      title: "CAT 2027 registration update",
      slug: "cat-2027-registration-update",
      status: "Published",
      description: "<p>Registration dates and the steps students need.</p>",
      content: "<h2>Key dates</h2><p>Students should verify the official schedule before applying.</p>",
    }, true)).toBeNull();
  });
});
