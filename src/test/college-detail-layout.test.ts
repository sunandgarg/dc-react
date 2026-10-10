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

  it("keeps the college/course canonical and schema URL stable while sections remain navigable", () => {
    expect(detail).toContain("canonical: college ? buildCollegeHref(college as any) : undefined");
    expect(detail).toContain("url: absoluteSiteUrl(buildCollegeHref(college as any))");
    expect(courseDetail).toContain("canonical: course ? buildCourseHref(course as any) : undefined");
    expect(courseDetail).toContain("url: absoluteSiteUrl(buildCourseHref(course as any))");
    expect(detail).toContain("updateUrlOnScroll");
    expect(courseDetail).toContain("updateUrlOnScroll");
  });

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

  it("shows the three summary facts once without a course count", () => {
    expect(stats).toMatch(/label: "DekhoCampus Rating"/);
    expect(stats).not.toMatch(/label: "Courses"|courses_count/);
    expect(stats).toMatch(/sm:grid-cols-3/);
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

  it("shows one swipeable college fact at a time on mobile with direct controls", () => {
    expect(stats).toMatch(/snap-x snap-mandatory/);
    expect(stats).toMatch(/w-full shrink-0 snap-start/);
    expect(stats).toMatch(/sm:grid sm:grid-cols-3/);
    expect(stats).toMatch(/onClick=\{\(\) => goToCard\(index\)\}/);
  });

  it("orders college tabs like their page sections", () => {
    const tabs = detail.match(/const COLLEGE_SECTIONS:[\s\S]*?\];/)?.[0] || "";
    expect(tabs).not.toMatch(/id: "contact"/);
    expect(detail).toMatch(/id="college-about-extra" hidden=\{!aboutExpanded\}/);
    expect(detail).toMatch(/<CollegeContactSection[^>]*\/>/);
    expect(detail).not.toMatch(/cursor-help/);
    expect(detail).not.toMatch(/Contact Information/);
    expect(tabs.indexOf('id: "faculty"')).toBeLessThan(tabs.indexOf('id: "scholarships"'));
    expect(tabs.indexOf('id: "faq"')).toBeLessThan(tabs.indexOf('id: "news"'));
    expect(detail).toMatch(/<LatestNewsSection[^>]*sectionId="news"/);
    expect(tabs).not.toMatch(/id: "reviews"/);
    expect(detail).not.toMatch(/<CollegeReviews\b/);
  });

  it("keeps mobile admission actions at the end and approval logos in one swipeable row", () => {
    expect(detail.indexOf("<CollegeDecisionRail college={college} />")).toBeGreaterThan(detail.indexOf("<UsefulLinks"));
    expect(detail).toMatch(/snap-x snap-mandatory items-center gap-3 overflow-x-auto/);
    expect(detail).toMatch(/sm:flex-wrap sm:overflow-visible/);
    expect(detail).toMatch(/shrink-0 snap-start/);
  });
});
