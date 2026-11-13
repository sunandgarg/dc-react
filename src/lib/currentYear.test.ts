import { describe, expect, it } from "vitest";
import { admissionSessionYear, currentAdmissionTitle } from "./currentYear";

describe("admissionSessionYear", () => {
  it("starts the next admission session on 1 November in India", () => {
    expect(admissionSessionYear(new Date("2026-10-31T18:29:59Z"))).toBe(2026);
    expect(admissionSessionYear(new Date("2026-10-31T18:30:00Z"))).toBe(2027);
  });
});

describe("currentAdmissionTitle", () => {
  it("rolls generic admission titles without changing dated ranking claims", () => {
    const date = new Date("2026-11-12T12:00:00Z");
    expect(currentAdmissionTitle("Amity: Admission, Courses, Fees 2026 | DekhoCampus", date))
      .toBe("Amity: Admission, Courses, Fees 2027 | DekhoCampus");
    expect(currentAdmissionTitle("Amity NIRF Ranking 2026 | DekhoCampus", date))
      .toBe("Amity NIRF Ranking 2026 | DekhoCampus");
    expect(currentAdmissionTitle("Amity Admission 2026 NIRF Ranking 2026 | DekhoCampus", date))
      .toBe("Amity Admission 2026 NIRF Ranking 2026 | DekhoCampus");
  });
});
