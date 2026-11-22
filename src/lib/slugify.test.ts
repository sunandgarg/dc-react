import { describe, expect, it } from "vitest";
import { articleSlugify, slugify, syncArticleAutoSlug, syncAutoSlug } from "./slugify";

describe("slugify", () => {
  it("creates URL-safe slugs", () => {
    expect(slugify("B.Com & Corporate Finance")).toBe("b-com-and-corporate-finance");
  });

  it("does not leave a trailing hyphen when truncation splits a word", () => {
    const slug = slugify(`${"a".repeat(59)} b`);
    expect(slug).toBe("a".repeat(59));
    expect(slugify(slug)).toBe(slug);
  });

  it("keeps following the source until the slug is manually overridden", () => {
    expect(syncAutoSlug("", "", "Computer Science")).toBe("computer-science");
    expect(syncAutoSlug("computer-science", "Computer Science", "Computer Engineering")).toBe("computer-engineering");
    expect(syncAutoSlug("custom-course-url", "Computer Science", "Computer Engineering")).toBe("custom-course-url");
  });

  it("keeps an article slug readable and preserves an editor override", () => {
    const title = "NDA 2027 syllabus: last official Maths and GAT topics with the latest UPSC exam pattern and paper details";
    expect(articleSlugify(title)).toBe("nda-2027-syllabus-last-official-maths-and-gat-topics-with-the-latest-upsc-exam-pattern-and-paper");
    expect(articleSlugify(title)).not.toMatch(/-[a-z]$/);
    expect(syncArticleAutoSlug("", "", title)).toBe(articleSlugify(title));
    expect(syncArticleAutoSlug("nda-2027-syllabus-maths-gat", title, "NDA 2027 syllabus updated")).toBe("nda-2027-syllabus-maths-gat");
  });
});
