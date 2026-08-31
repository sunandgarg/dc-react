export type SitemapChangefreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

export interface SitemapRoute {
  path: string;
  changefreq: SitemapChangefreq;
  priority: string;
}

// Cloudflare Pages limits individual assets to 25 MiB. Image sitemap entries are
// substantially larger than plain URLs, so keep each static child comfortably
// below both Cloudflare's byte limit and Google's 50,000 URL limit.
export const SITEMAP_CHUNK_SIZE = 3_000;

export const STATIC_SITEMAP_ROUTES: SitemapRoute[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/colleges", changefreq: "daily", priority: "0.9" },
  { path: "/courses", changefreq: "daily", priority: "0.9" },
  { path: "/exams", changefreq: "daily", priority: "0.9" },
  { path: "/premium-programs", changefreq: "daily", priority: "0.9" },
  { path: "/news", changefreq: "daily", priority: "0.85" },
  { path: "/careers", changefreq: "weekly", priority: "0.8" },
  { path: "/jobs", changefreq: "daily", priority: "0.8" },
  { path: "/vacancies", changefreq: "daily", priority: "0.8" },
  { path: "/scholarships", changefreq: "weekly", priority: "0.8" },
  { path: "/study-material", changefreq: "weekly", priority: "0.75" },
  { path: "/college-study-material", changefreq: "weekly", priority: "0.75" },
  { path: "/resources", changefreq: "weekly", priority: "0.7" },
  { path: "/tools", changefreq: "weekly", priority: "0.7" },
  { path: "/cat-universe", changefreq: "daily", priority: "0.8" },
  { path: "/compare", changefreq: "weekly", priority: "0.6" },
  { path: "/eligibility-checker", changefreq: "weekly", priority: "0.7" },
  { path: "/college-predictor", changefreq: "weekly", priority: "0.7" },
  { path: "/exam-calendar", changefreq: "daily", priority: "0.75" },
  { path: "/exam-calendar-2026", changefreq: "daily", priority: "0.75" },
  { path: "/lock-target", changefreq: "weekly", priority: "0.7" },
  { path: "/achieve-target", changefreq: "weekly", priority: "0.65" },
  { path: "/roadmap", changefreq: "weekly", priority: "0.65" },
  { path: "/dream-college-roadmap", changefreq: "weekly", priority: "0.65" },
  { path: "/about-us", changefreq: "monthly", priority: "0.5" },
  { path: "/about", changefreq: "monthly", priority: "0.4" },
  { path: "/legal/privacy-policy", changefreq: "monthly", priority: "0.35" },
  { path: "/legal/terms-of-service", changefreq: "monthly", priority: "0.35" },
  { path: "/legal/refund-policy", changefreq: "monthly", priority: "0.35" },
  { path: "/legal/cookie-policy", changefreq: "monthly", priority: "0.35" },
];

export const COLLEGE_DETAIL_TABS = [
  "overview",
  "highlights",
  "courses",
  "admissions",
  "placements",
  "cutoff",
  "rankings",
  "reviews",
  "infrastructure",
  "gallery",
  "scholarships",
  "hostel",
  "compare",
  "faculty",
  "recruiters",
  "contact",
  "news",
  "faq",
] as const;

export const COURSE_DETAIL_TABS = [
  "overview",
  "highlights",
  "eligibility",
  "syllabus",
  "fees",
  "admission",
  "career",
  "placements",
  "specializations",
  "top-exams",
  "top-colleges",
  "cutoff",
  "faq",
] as const;

export const EXAM_DETAIL_TABS = [
  "overview",
  "highlights",
  "dates",
  "application",
  "eligibility",
  "syllabus",
  "pattern",
  "preparation",
  "admit-card",
  "answer-key",
  "results",
  "counselling",
  "cutoff",
  "colleges",
  "faq",
] as const;

export function sitemapPriority(value: string, delta = 0) {
  const next = Math.max(0.1, Math.min(1, Number(value) + delta));
  return next.toFixed(2).replace(/0$/, "");
}
