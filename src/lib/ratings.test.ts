import { describe, expect, it } from "vitest";
import { displayRating, GENERAL_RATING_FALLBACK, STUDENT_RATING_FALLBACK } from "./ratings";

describe("rating fallbacks", () => {
  it("keeps genuine ratings", () => {
    expect(displayRating(4.6)).toBe(4.6);
  });

  it("uses the requested general and student fallbacks", () => {
    expect(displayRating(0)).toBe(GENERAL_RATING_FALLBACK);
    expect(displayRating(null, STUDENT_RATING_FALLBACK)).toBe(STUDENT_RATING_FALLBACK);
  });
});
