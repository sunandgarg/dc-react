import { describe, expect, it } from "vitest";
import { canonicalSitemapSectionPath, COLLEGE_DETAIL_TABS, COURSE_DETAIL_TABS, EXAM_DETAIL_TABS, STATIC_SITEMAP_ROUTES, hasExamPapers } from "./sitemapConfig";

it("submits exam paper routes only when a paper link exists", () => {
  expect(hasExamPapers({ sample_paper_url: "#", question_papers: [] })).toBe(false);
  expect(hasExamPapers({ sample_paper_url: "", question_papers: [{ label: "2025 paper", url: "https://example.com/paper.pdf" }] })).toBe(true);
  expect(hasExamPapers({ sample_paper_url: "", question_papers: [{ url: "https://example.com/paper.pdf" }] })).toBe(false);
  expect(hasExamPapers({ sample_paper_url: "", question_papers: '[{"url":"#"}]' })).toBe(false);
});

const REQUIRED_PUBLIC_ROOTS = [
  "/",
  "/colleges",
  "/courses",
  "/exams",
  "/questions",
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
  it("normalizes recovered college/course section aliases but preserves distinct resources", () => {
    expect(canonicalSitemapSectionPath("/colleges/chandigarh-university-10026/courses")).toBe("/colleges/chandigarh-university-10026");
    expect(canonicalSitemapSectionPath("/colleges/chandigarh-university-10026/contact")).toBe("/colleges/chandigarh-university-10026");
    expect(canonicalSitemapSectionPath("/courses/computer-science-12345/eligibility")).toBe("/courses/computer-science-12345");
    for (const path of ["/colleges", "/colleges/top-btech-colleges-in-india", "/exams/jee-12345/answer-key", "/college-study-material/btech/university/semester-1", "/news/article"]) {
      expect(canonicalSitemapSectionPath(path)).toBe(path);
    }
  });
  it("covers every canonical public root", () => {
    const configured = new Set(STATIC_SITEMAP_ROUTES.map((route) => route.path));
    expect(REQUIRED_PUBLIC_ROOTS.filter((route) => !configured.has(route))).toEqual([]);
  });

  it("contains no private or duplicate routes", () => {
    const paths = STATIC_SITEMAP_ROUTES.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.some((path) => path.startsWith("/admin") || path.startsWith("/dashboard") || path === "/auth")).toBe(false);
  });

  it("does not submit college or course section aliases as separate canonical pages", () => {
    expect(COLLEGE_DETAIL_TABS).toEqual([]);
    expect(COURSE_DETAIL_TABS).toEqual([]);
    expect(new Set(EXAM_DETAIL_TABS).size).toBe(EXAM_DETAIL_TABS.length);
    expect(EXAM_DETAIL_TABS).toContain("overview");
    expect(EXAM_DETAIL_TABS).toContain("faq");
    expect(EXAM_DETAIL_TABS).toContain("answer-key");
  });
});
