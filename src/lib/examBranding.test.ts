import { describe, expect, it } from "vitest";

import { resolveExamLogo, resolveExamNames } from "@/lib/examBranding";

describe("resolveExamLogo", () => {
  it("uses the verified Panjab University crest for PU CET UG", () => {
    expect(resolveExamLogo({ slug: "pu-cet-ug", logo: "https://puchd.ac.in/asset/pu-logo.png" }))
      .toMatch(/^\/exam-logos\/official-v1\/[a-f0-9]{24}\.webp$/);
  });

  it("uses the saved official logo for other exams", () => {
    expect(resolveExamLogo({ slug: "neet-ug", logo: "https://example.com/neet.png" }))
      .toBe("https://example.com/neet.png");
  });

  it("does not fall back to a featured background image", () => {
    expect(resolveExamLogo({ slug: "new-exam", logo: "" })).toBe("");
  });

  it("replaces obsolete generated ring placeholders but preserves saved official logos", () => {
    for (const version of [1, 2, 3]) {
      expect(resolveExamLogo({ slug: "pu-cet-ug", logo: `https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/exam-logos-v${version}/pu-cet-ug.webp` }))
        .toMatch(/^\/exam-logos\/official-v1\//);
    }
    expect(resolveExamLogo({ slug: "unknown", logo: "/exam-logos-v2/placeholder.webp" })).toBe("");
  });
});

describe("resolveExamNames", () => {
  it("restores an expanded exam name when a refresh saved an SEO title instead", () => {
    const names = resolveExamNames({ slug: "pu-cet-ug", short_name: "PU CET UG", full_name: "PU CET UG 2027: Dates, Eligibility, Pattern" });
    expect(names.shortName).toBe("PU CET UG");
    expect(names.fullName).toContain("Panjab University");
    expect(names.fullName).not.toContain("Dates");
  });
  it("honours a manually edited real name and uses catalog values only for missing names", () => {
    expect(resolveExamNames({ slug: "pu-cet-ug", short_name: "PU CET", full_name: "Updated expanded exam name" }))
      .toEqual({ shortName: "PU CET", fullName: "Updated expanded exam name" });
    expect(resolveExamNames({ slug: "pu-cet-ug" }).shortName).not.toBe("Exam");
    expect(resolveExamNames({ name: "Example" })).toEqual({ shortName: "Example", fullName: "" });
  });
});
