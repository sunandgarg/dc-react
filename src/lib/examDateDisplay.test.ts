import { describe, expect, it } from "vitest";
import { formatExamDate } from "@/lib/examDateDisplay";

describe("formatExamDate", () => {
  it("renders database timestamps as a readable date without shifting the calendar day", () => {
    expect(formatExamDate("2024-05-10T00:00:00.000Z")).toBe("10 May 2024");
    expect(formatExamDate("2027-01-02")).toBe("2 Jan 2027");
  });

  it("keeps pending and editorial date wording intact", () => {
    expect(formatExamDate("Not announced")).toBe("Not announced");
    expect(formatExamDate("April 2027")).toBe("April 2027");
    expect(formatExamDate(null)).toBe("TBA");
    expect(formatExamDate("2027-02-30")).toBe("2027-02-30");
  });
});
