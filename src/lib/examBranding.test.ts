import { describe, expect, it } from "vitest";

import { resolveExamLogo } from "@/lib/examBranding";

describe("resolveExamLogo", () => {
  it("uses the verified Panjab University crest for PU CET UG", () => {
    expect(resolveExamLogo({ slug: "pu-cet-ug", logo: "https://example.com/broken.png" }))
      .toBe("https://puchd.ac.in/asset/pu-logo.png");
  });

  it("uses the saved official logo for other exams", () => {
    expect(resolveExamLogo({ slug: "neet-ug", logo: "https://example.com/neet.png" }))
      .toBe("https://example.com/neet.png");
  });

  it("does not fall back to a featured background image", () => {
    expect(resolveExamLogo({ slug: "new-exam", logo: "" })).toBe("");
  });
});

