import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("college detail summary layout", () => {
  const hero = readFileSync(resolve(process.cwd(), "src/components/CollegeHeroCard.tsx"), "utf8");
  const courseDetail = readFileSync(resolve(process.cwd(), "src/pages/CourseDetail.tsx"), "utf8");
  const examDetail = readFileSync(resolve(process.cwd(), "src/pages/ExamDetail.tsx"), "utf8");
  const youtubeButton = readFileSync(resolve(process.cwd(), "src/components/YouTubeVideoButton.tsx"), "utf8");
  const stats = readFileSync(resolve(process.cwd(), "src/components/detail/CollegeTrustBento.tsx"), "utf8");
  const detail = readFileSync(resolve(process.cwd(), "src/pages/CollegeDetail.tsx"), "utf8");

  it("uses one primary treatment for hero badges and actions", () => {
    expect(hero).toMatch(/heroBadgeClass/);
    expect(hero).toMatch(/secondaryActionClass/);
    expect(hero).not.toMatch(/bg-success\/90|bg-accent\/90|border-red-500|border-blue-500/);
  });

  it("uses the same restrained hero treatment for courses and exams", () => {
    for (const source of [courseDetail, examDetail]) {
      expect(source).toMatch(/HERO_BADGE_CLASS/);
      expect(source).toMatch(/HERO_SECONDARY_ACTION_CLASS/);
    }
    expect(courseDetail).not.toMatch(/bg-accent\/90|border-blue-500|text-blue-600|!bg-\[#e85d3a\]/);
    expect(examDetail).not.toMatch(/bg-accent\/90|bg-success\/90|border-blue-500|text-blue-600|!bg-\[#e85d3a\]/);
  });

  it("keeps YouTube actions red on college, course, and exam heroes", () => {
    expect(youtubeButton).toMatch(/border-red-500\/40/);
    expect(youtubeButton).toMatch(/bg-red-600/);
    expect(hero).not.toMatch(/\[&_span\]:!bg-primary/);
    expect(courseDetail).toMatch(/category="course"/);
    expect(examDetail).toMatch(/category="exam"/);
  });

  it("shows the requested four summary facts only once", () => {
    expect(stats).toMatch(/label: "Rating"/);
    expect(stats).toMatch(/label: "Courses"/);
    expect(stats).toMatch(/label: "Avg Package"/);
    expect(stats).toMatch(/label: "Type"/);
    expect(stats).not.toMatch(/label: "Course Fees"|label: "Student Rating"/);
    expect(detail.match(/<CollegeTrustBento college=\{college\} \/>/g)).toHaveLength(1);
    expect(detail).not.toMatch(/CollegeQuickFacts/);
    expect(detail).not.toMatch(/\{ icon: Star, label: "Rating"/);
  });

  it("shows a university-specific institution type when the stored type is generic", () => {
    expect(stats).toMatch(/displayInstitutionType/);
    expect(stats).toMatch(/`\$\{type\} University`/);
  });
});
