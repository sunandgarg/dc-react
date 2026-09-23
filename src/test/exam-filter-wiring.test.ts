import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { examCategories, examCourseGroups, examLevels, examStreams } from "@/data/indianLocations";

describe("exam listing facets", () => {
  it("keeps the four requested filter groups and complete supported values", () => {
    expect(examCategories).toEqual(["Entrance", "Board", "Sarkari", "Study Abroad"]);
    expect(examLevels).toEqual(["UG", "PG", "12th", "10th"]);
    expect(examStreams.length).toBeGreaterThanOrEqual(20);
    expect(examCourseGroups.length).toBeGreaterThanOrEqual(25);
  });

  it("queries dedicated filter columns instead of legacy editorial fields", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/AllExams.tsx"), "utf8");
    expect(source).toContain("f.listing_category");
    expect(source).toContain("exam_streams: selectedStreams");
    expect(source).toContain("course_groups: selectedCourseGroups");
    expect(source).toContain("education_levels: selectedLevels");
    expect(source).toContain("includeCount: true");
    expect(source).not.toContain("f.exam_type = selectedCategories");
  });
});
