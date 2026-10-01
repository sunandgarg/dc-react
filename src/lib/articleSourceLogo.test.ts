import { describe, expect, it } from "vitest";
import { resolveArticleSourceLogo } from "@/lib/articleSourceLogo";

describe("resolveArticleSourceLogo", () => {
  it("uses the reviewed official marks for legacy exam logos on articles", () => {
    for (const slug of ["aibe", "cuet-2026", "rajasthan-ptet", "ugc-net-june-2026"]) {
      expect(resolveArticleSourceLogo(`https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/exam-logos-v2/${slug}.webp`))
        .toMatch(/^\/exam-logos\/official-v1\/[a-f0-9]{24}\.webp$/);
    }
  });

  it("does not display an unmapped generated ring or alter a real source logo", () => {
    expect(resolveArticleSourceLogo("/exam-logos-v2/unknown.webp")).toBe("");
    expect(resolveArticleSourceLogo("https://example.edu/official-logo.png")).toBe("https://example.edu/official-logo.png");
    expect(resolveArticleSourceLogo(null)).toBe("");
  });
});
