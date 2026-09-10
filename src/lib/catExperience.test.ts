import { describe, expect, it } from "vitest";
import { averageInterviewScore, CAT_KIT_RESOURCES } from "@/lib/catExperience";

describe("CAT experience helpers", () => {
  it("describes every resource in the CAT 2026 bundle", () => {
    expect(CAT_KIT_RESOURCES).toHaveLength(16);
    expect(new Set(CAT_KIT_RESOURCES.map((item) => item.title)).size).toBe(16);
  });

  it("calculates a stable interview average", () => {
    expect(averageInterviewScore([])).toBe(0);
    expect(averageInterviewScore([
      { clarity: 8, structure: 7, relevance: 9, evidence: 6, confidence: 5 },
      { clarity: 7, structure: 8, relevance: 8, evidence: 7, confidence: 7 },
    ])).toBe(7.2);
  });
});
