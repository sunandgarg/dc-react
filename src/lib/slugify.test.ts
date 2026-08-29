import { describe, expect, it } from "vitest";
import { slugify, syncAutoSlug } from "./slugify";

describe("slugify", () => {
  it("creates URL-safe slugs", () => {
    expect(slugify("B.Com & Corporate Finance")).toBe("b-com-and-corporate-finance");
  });

  it("keeps following the source until the slug is manually overridden", () => {
    expect(syncAutoSlug("", "", "Computer Science")).toBe("computer-science");
    expect(syncAutoSlug("computer-science", "Computer Science", "Computer Engineering")).toBe("computer-engineering");
    expect(syncAutoSlug("custom-course-url", "Computer Science", "Computer Engineering")).toBe("custom-course-url");
  });
});
