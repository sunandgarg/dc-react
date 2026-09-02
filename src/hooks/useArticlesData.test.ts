import { describe, expect, it } from "vitest";
import { legacyArticleSlugCandidates } from "@/hooks/useArticlesData";

describe("legacy article slug compatibility", () => {
  it("resolves imported terminal punctuation without changing the public slug", () => {
    expect(legacyArticleSlugCandidates("academic-calendar-2026-27")).toEqual([
      "academic-calendar-2026-27-",
      "academic-calendar-2026-27,",
    ]);
  });
});
