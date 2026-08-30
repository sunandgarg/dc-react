import { describe, expect, it } from "vitest";
import { rankPartnerColleges, rankSimilarColleges } from "./collegeRecommendations";

const college = (slug: string, overrides: Record<string, unknown> = {}) => ({
  slug,
  city: "Mumbai",
  state: "Maharashtra",
  category: "Engineering",
  type: "Private College",
  affiliation_kind: "standalone",
  rating: 4,
  ...overrides,
});

describe("college recommendations", () => {
  it("keeps universities comparable and ranks the Delhi NCR region together", () => {
    const current = college("noida-university", { city: "Noida", state: "Uttar Pradesh", type: "Private University", affiliation_kind: "university" });
    const ranked = rankSimilarColleges([
      college("mumbai-university", { type: "Private University", affiliation_kind: "university" }),
      college("delhi-college", { city: "Delhi", state: "Delhi" }),
      college("gurugram-university", { city: "Gurugram", state: "Haryana", type: "Private University", affiliation_kind: "university" }),
    ], current);
    expect(ranked.map((item) => item.slug)).toEqual(["gurugram-university", "mumbai-university", "delhi-college"]);
  });

  it("keeps colleges ahead of universities on a college page", () => {
    const ranked = rankSimilarColleges([
      college("near-university", { city: "Mumbai", type: "University", affiliation_kind: "university" }),
      college("near-college", { city: "Pune" }),
    ], college("current"));
    expect(ranked[0].slug).toBe("near-college");
  });

  it("uses the consented visitor location for partner ordering", () => {
    const ranked = rankPartnerColleges([
      college("mumbai-partner", { is_partner: true }),
      college("noida-partner", { city: "Noida", state: "Uttar Pradesh", is_partner: true }),
    ], { city: "Gurugram", state: "Haryana" });
    expect(ranked[0].slug).toBe("noida-partner");
  });

  it("prefers an exact city over the wider region", () => {
    const current = college("current", { city: "Noida", state: "Uttar Pradesh" });
    const ranked = rankSimilarColleges([
      college("delhi", { city: "Delhi", state: "Delhi" }),
      college("noida", { city: "Noida", state: "Uttar Pradesh" }),
    ], current);
    expect(ranked[0].slug).toBe("noida");
  });
});
