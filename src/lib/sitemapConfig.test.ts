import { describe, expect, it } from "vitest";
import { COLLEGE_DETAIL_TABS, COURSE_DETAIL_TABS, EXAM_DETAIL_TABS, STATIC_SITEMAP_ROUTES } from "./sitemapConfig";

const REQUIRED_PUBLIC_ROOTS = [
  "/",
  "/colleges",
  "/courses",
  "/exams",
  "/premium-programs",
  "/news",
  "/careers",
  "/jobs",
  "/vacancies",
  "/scholarships",
  "/study-material",
  "/college-study-material",
  "/resources",
  "/tools",
  "/cat-universe",
  "/compare",
  "/eligibility-checker",
  "/college-predictor",
  "/exam-calendar",
  "/lock-target",
  "/about-us",
];

describe("sitemap configuration", () => {
  it("covers every canonical public root", () => {
    const configured = new Set(STATIC_SITEMAP_ROUTES.map((route) => route.path));
    expect(REQUIRED_PUBLIC_ROOTS.filter((route) => !configured.has(route))).toEqual([]);
  });

  it("contains no private or duplicate routes", () => {
    const paths = STATIC_SITEMAP_ROUTES.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.some((path) => path.startsWith("/admin") || path.startsWith("/dashboard") || path === "/auth")).toBe(false);
  });

  it("keeps every detail sitemap tab unique and crawlable", () => {
    for (const tabs of [COLLEGE_DETAIL_TABS, COURSE_DETAIL_TABS, EXAM_DETAIL_TABS]) {
      expect(new Set(tabs).size).toBe(tabs.length);
      expect(tabs).toContain("overview");
      expect(tabs).toContain("faq");
    }
    expect(COLLEGE_DETAIL_TABS).toContain("courses");
    expect(EXAM_DETAIL_TABS).toContain("answer-key");
  });
});
