import { describe, expect, it } from "vitest";
import { articleSocialDrafts } from "./articleSocialDrafts";

describe("social article caption previews", () => {
  const article = { title: "JEE subject choices", slug: "JEE Subject Choices", description: "<p>Match papers &amp; course requirements.</p><script>bad()</script>" };
  it("uses only the current article text and tracked canonical links", () => {
    const drafts = articleSocialDrafts(article, "dekhocampus");
    expect(drafts.map(draft => draft.platform)).toEqual(["LinkedIn", "Facebook", "Instagram"]);
    for (const draft of drafts) {
      expect(draft.caption).toContain("Match papers & course requirements.");
      expect(draft.caption).not.toMatch(/<p>|bad\(\)/);
      const url = new URL(draft.url);
      expect(url.origin).toBe("https://dekhocampus.com");
      expect(url.pathname).toBe("/news/jee-subject-choices");
      expect(url.searchParams.get("utm_source")).toBe(draft.platform.toLowerCase());
      expect(url.searchParams.get("utm_medium")).toBe("social");
    }
  });
  it("does not point Sarkari articles to the main site", () => {
    expect(new URL(articleSocialDrafts(article, "sarkari")[0].url).origin).toBe("https://sarkari.dekhocampus.com");
  });
  it("does not invent a link for an empty slug", () => {
    expect(articleSocialDrafts({ ...article, slug: " " }, "dekhocampus")).toEqual([]);
  });
  it("keeps a truncated slug stable when the backend normalizes it again", () => {
    expect(new URL(articleSocialDrafts({ ...article, slug: `${"a".repeat(59)} b` }, "dekhocampus")[0].url).pathname).toBe(`/news/${"a".repeat(59)}`);
  });
});
