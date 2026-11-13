import { describe, expect, it } from "vitest";
import { admissionSessionYear } from "./currentYear";

describe("admissionSessionYear", () => {
  it("starts the next admission session on 1 November in India", () => {
    expect(admissionSessionYear(new Date("2026-10-31T18:29:59Z"))).toBe(2026);
    expect(admissionSessionYear(new Date("2026-10-31T18:30:00Z"))).toBe(2027);
  });
});
