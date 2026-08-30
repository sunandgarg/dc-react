/** Production sitemap generator: public routes, live records and crawl-safe filter landings. */
import { writeFileSync } from "fs";
import { resolve } from "path";
import { loadEnv } from "vite";
import { buildCollegeHref, buildCourseHref, buildExamHref } from "../src/lib/entityUrls";
import { eligibilityComboSlugs, predictorComboSlugs } from "../src/lib/seoSubSlugs";
import { LOCK_TARGET_TRENDING_SLUGS, TOOL_SLUGS } from "../src/lib/toolsRegistry";
import {
  SITEMAP_CHUNK_SIZE,
  STATIC_SITEMAP_ROUTES,
} from "../src/lib/sitemapConfig";
import {
  citiesByState,
  collegeCourseGroups,
  collegeExams,
  collegeFeeRanges,
  collegeStreams,
  collegeTypes,
  courseCourseGroups,
  courseDurations,
  courseModes,
  courseSpecializations,
  courseStreams,
  examCategories,
  examCourseGroups,
  examLevels,
  examStreams,
  indianStates,
} from "../src/data/indianLocations";
import { collegeApprovals, collegeNaacGrades } from "../src/data/colleges";
import { SITE_URL } from "../src/lib/constant";

const fileEnv = loadEnv(process.env.NODE_ENV || "production", process.cwd(), "");
const env = { ...fileEnv, ...process.env };
const BASE_URL = (env.SITEMAP_BASE_URL || SITE_URL).replace(/\/+$/, "");
const API_URL = (env.SITEMAP_API_URL === "none"
  ? ""
  : env.SITEMAP_API_URL || env.VITE_API_URL || "").replace(/\/+$/, "");
const SITEMAP_SEED_URL = env.SITEMAP_SEED_URL === "none"
  ? ""
  : env.SITEMAP_SEED_URL || "https://dekhocampus.com/sitemap.xml";
const PAGE_SIZE = 1000;

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const STATIC: SitemapEntry[] = STATIC_SITEMAP_ROUTES;

class SitemapQuery implements PromiseLike<{ data: any[] | null; error: Error | null }> {
  private filters: Array<[string, string]> = [];
  private from = 0;
  private to = PAGE_SIZE - 1;

  constructor(private table: string, private columns: string) {}

  eq(column: string, value: unknown) {
    this.filters.push([column, `eq.${String(value)}`]);
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    this.filters.push([column, `not.${operator}.${String(value)}`]);
    return this;
  }

  range(from: number, to: number) {
    this.from = from;
    this.to = to;
    return this;
  }

  private async execute() {
    try {
      const url = new URL(`/v1/rest/${encodeURIComponent(this.table)}`, API_URL);
      url.searchParams.set("select", this.columns);
      url.searchParams.set("offset", String(this.from));
      url.searchParams.set("limit", String(Math.max(0, this.to - this.from + 1)));
      this.filters.forEach(([column, value]) => url.searchParams.append(column, value));
      const response = await fetch(url);
      const payload = await response.json().catch(() => null);
      if (!response.ok) return { data: null, error: new Error(payload?.message || `HTTP ${response.status}`) };
      return { data: Array.isArray(payload) ? payload : [], error: null };
    } catch (cause) {
      return { data: null, error: cause instanceof Error ? cause : new Error(String(cause)) };
    }
  }

  then<TResult1 = { data: any[] | null; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: any[] | null; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

async function fetchRows(table: string, select: string, configure?: (query: any) => any): Promise<any[]> {
  if (!API_URL) return [];
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = new SitemapQuery(table, select);
    if (configure) query = configure(query);
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.warn(`[sitemap] ${table}: ${error.message}`);
      return rows;
    }
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

function changed(value?: string) {
  return value ? new Date(value).toISOString().slice(0, 10) : undefined;
}

function detailEntries(prefix: string, rows: any[], priority = "0.7"): SitemapEntry[] {
  return rows.filter((row) => row.slug).map((row) => ({
    path: `${prefix}/${row.slug}`,
    lastmod: changed(row.updated_at),
    changefreq: "weekly",
    priority,
  }));
}

function canonicalDetailEntries(rows: any[], buildHref: (row: any) => string, priority = "0.7"): SitemapEntry[] {
  return rows.filter((row) => row.slug).map((row) => ({
    path: buildHref(row),
    lastmod: changed(row.updated_at),
    changefreq: "weekly",
    priority,
  }));
}

function filteredPath(base: string, values: Record<string, string>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) query.set(key, value);
  return `${base}?${query.toString()}`;
}

function addSingles(out: SitemapEntry[], base: string, key: string, values: readonly string[]) {
  for (const value of values.filter((item) => item && item !== "All")) {
    out.push({ path: filteredPath(base, { [key]: value }), changefreq: "weekly", priority: "0.55" });
  }
}

/** Every frontend filter value plus high-intent two-facet landings, without crawl-trap permutations. */
function filterEntries(): SitemapEntry[] {
  const out: SitemapEntry[] = [];

  addSingles(out, "/colleges", "state", indianStates);
  addSingles(out, "/colleges", "stream", collegeStreams);
  addSingles(out, "/colleges", "group", collegeCourseGroups);
  addSingles(out, "/colleges", "type", collegeTypes);
  addSingles(out, "/colleges", "approval", collegeApprovals);
  addSingles(out, "/colleges", "naac", collegeNaacGrades);
  addSingles(out, "/colleges", "fee", collegeFeeRanges);
  addSingles(out, "/colleges", "exam", collegeExams);
  for (const state of indianStates) {
    for (const city of citiesByState[state] || []) {
      out.push({ path: filteredPath("/colleges", { state, city }), changefreq: "weekly", priority: "0.58" });
    }
    for (const stream of collegeStreams) {
      out.push({ path: filteredPath("/colleges", { stream, state }), changefreq: "weekly", priority: "0.6" });
    }
    for (const group of collegeCourseGroups) {
      out.push({ path: filteredPath("/colleges", { group, state }), changefreq: "weekly", priority: "0.6" });
    }
  }

  addSingles(out, "/courses", "stream", courseStreams);
  addSingles(out, "/courses", "group", courseCourseGroups);
  addSingles(out, "/courses", "specialization", courseSpecializations);
  addSingles(out, "/courses", "mode", courseModes);
  addSingles(out, "/courses", "duration", courseDurations);
  for (const stream of courseStreams) for (const mode of courseModes) {
    out.push({ path: filteredPath("/courses", { stream, mode }), changefreq: "weekly", priority: "0.57" });
  }
  for (const group of courseCourseGroups) for (const mode of courseModes) {
    out.push({ path: filteredPath("/courses", { group, mode }), changefreq: "weekly", priority: "0.57" });
  }

  addSingles(out, "/exams", "category", examCategories);
  addSingles(out, "/exams", "stream", examStreams);
  addSingles(out, "/exams", "group", examCourseGroups);
  addSingles(out, "/exams", "level", examLevels);
  for (const stream of examStreams) for (const level of examLevels) {
    out.push({ path: filteredPath("/exams", { stream, level }), changefreq: "weekly", priority: "0.57" });
  }
  for (const category of examCategories) for (const stream of examStreams) {
    out.push({ path: filteredPath("/exams", { category, stream }), changefreq: "weekly", priority: "0.57" });
  }

  return out;
}

function toolEntries(): SitemapEntry[] {
  return [
    ...TOOL_SLUGS.map((slug) => ({ path: `/tools/${slug}`, changefreq: "monthly" as const, priority: "0.55" })),
    ...eligibilityComboSlugs().map((slug) => ({ path: `/eligibility-checker/${slug}`, changefreq: "weekly" as const, priority: "0.55" })),
    ...predictorComboSlugs().map((slug) => ({ path: `/college-predictor/${slug}`, changefreq: "weekly" as const, priority: "0.55" })),
    ...LOCK_TARGET_TRENDING_SLUGS.flatMap((slug) => ["lock-target", "achieve-target", "roadmap", "dream-college-roadmap"].map((prefix) => ({
      path: `/${prefix}/${slug}`,
      changefreq: "weekly" as const,
      priority: "0.55",
    }))),
  ];
}

async function studyEntries(): Promise<SitemapEntry[]> {
  const [subjects, chapters, programs, universities, semesters, collegeSubjects] = await Promise.all([
    fetchRows("study_subjects", "id,slug,class_num,board_slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
    fetchRows("study_chapters", "slug,subject_id,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
    fetchRows("college_programs", "slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
    fetchRows("college_universities", "slug,program_slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
    fetchRows("college_semesters", "semester_num,program_slug,university_slug,updated_at", (q) => q.eq("is_active", true)),
    fetchRows("college_subjects", "slug,semester_num,program_slug,university_slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
  ]);
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const classBoards = new Map<string, SitemapEntry>();
  for (const subject of subjects) {
    classBoards.set(`${subject.class_num}/${subject.board_slug}`, {
      path: `/study-material/class-${subject.class_num}/${subject.board_slug}`,
      lastmod: changed(subject.updated_at), changefreq: "weekly", priority: "0.62",
    });
  }
  return [
    ...classBoards.values(),
    ...subjects.map((subject) => ({ path: `/study-material/class-${subject.class_num}/${subject.board_slug}/${subject.slug}`, lastmod: changed(subject.updated_at), changefreq: "weekly" as const, priority: "0.58" })),
    ...chapters.flatMap((chapter) => {
      const subject = subjectById.get(chapter.subject_id);
      return subject ? [{ path: `/study-material/class-${subject.class_num}/${subject.board_slug}/${subject.slug}/${chapter.slug}`, lastmod: changed(chapter.updated_at), changefreq: "weekly" as const, priority: "0.55" }] : [];
    }),
    ...programs.map((row) => ({ path: `/college-study-material/${row.slug}`, lastmod: changed(row.updated_at), changefreq: "weekly" as const, priority: "0.62" })),
    ...universities.map((row) => ({ path: `/college-study-material/${row.program_slug}/${row.slug}`, lastmod: changed(row.updated_at), changefreq: "weekly" as const, priority: "0.58" })),
    ...semesters.map((row) => ({ path: `/college-study-material/${row.program_slug}/${row.university_slug}/semester-${row.semester_num}`, lastmod: changed(row.updated_at), changefreq: "weekly" as const, priority: "0.55" })),
    ...collegeSubjects.map((row) => ({ path: `/college-study-material/${row.program_slug}/${row.university_slug}/semester-${row.semester_num}/${row.slug}`, lastmod: changed(row.updated_at), changefreq: "weekly" as const, priority: "0.52" })),
  ];
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function decodeXml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

const PUBLIC_ROUTE_ROOTS = [
  "/colleges", "/courses", "/exams", "/premium-programs", "/news", "/careers", "/jobs", "/vacancies",
  "/scholarships", "/study-material", "/college-study-material", "/resources", "/tools", "/cat-universe",
  "/compare", "/eligibility-checker", "/college-predictor", "/exam-calendar", "/exam-calendar-2026",
  "/lock-target", "/achieve-target", "/roadmap", "/dream-college-roadmap", "/about-us", "/about", "/landing",
  "/author", "/legal",
];

function canonicalSeedPath(rawLocation: string) {
  try {
    const url = new URL(decodeXml(rawLocation));
    if (!/(^|\.)dekhocampus\.(com|in)$/i.test(url.hostname)) return null;
    let pathname = url.pathname.replace(/\/+$/, "") || "/";
    if (pathname === "/articles") pathname = "/news";
    else if (pathname.startsWith("/articles/")) pathname = pathname.replace(/^\/articles\//, "/news/");
    if (pathname.startsWith("/college/")) pathname = pathname.replace(/^\/college\//, "/colleges/");
    const allowed = pathname === "/" || PUBLIC_ROUTE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
    return allowed ? `${pathname}${url.search}` : null;
  } catch {
    return null;
  }
}

async function fetchSeedEntries(): Promise<SitemapEntry[]> {
  if (!SITEMAP_SEED_URL) return [];
  const pending = [SITEMAP_SEED_URL];
  const visited = new Set<string>();
  const entries: SitemapEntry[] = [];
  while (pending.length && visited.size < 25) {
    const source = pending.shift()!;
    if (visited.has(source)) continue;
    visited.add(source);
    try {
      const response = await fetch(source, { headers: { "User-Agent": "DekhoCampus sitemap migration/1.0" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = await response.text();
      if (/<sitemapindex\b/i.test(xml)) {
        for (const match of xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)) {
          const child = decodeXml(match[1].trim());
          try {
            const childUrl = new URL(child);
            if (/(^|\.)dekhocampus\.(com|in)$/i.test(childUrl.hostname)) pending.push(childUrl.href);
          } catch { /* skip malformed child sitemap URL */ }
        }
        continue;
      }
      for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
        const block = match[1];
        const location = block.match(/<loc>([\s\S]*?)<\/loc>/i)?.[1]?.trim();
        const path = location ? canonicalSeedPath(location) : null;
        if (!path) continue;
        const lastmod = block.match(/<lastmod>([\s\S]*?)<\/lastmod>/i)?.[1]?.trim();
        entries.push({ path, lastmod: lastmod && /^\d{4}-\d{2}-\d{2}/.test(lastmod) ? lastmod.slice(0, 10) : undefined, changefreq: "weekly", priority: "0.6" });
      }
    } catch (error) {
      console.warn(`[sitemap] seed ${source}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log(`[sitemap] recovered ${entries.length} canonical URL(s) from the published migration seed`);
  return entries;
}

function xmlFor(entries: SitemapEntry[]) {
  const urls = entries.map((entry) => [
    "  <url>",
    `    <loc>${escapeXml(`${BASE_URL}${entry.path}`)}</loc>`,
    entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
    entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
    entry.priority ? `    <priority>${entry.priority}</priority>` : null,
    "  </url>",
  ].filter(Boolean).join("\n"));
  return [`<?xml version="1.0" encoding="UTF-8"?>`, `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`, ...urls, `</urlset>`].join("\n");
}

function sitemapIndex(files: string[]) {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...files.map((file) => `  <sitemap><loc>${escapeXml(`${BASE_URL}/${file}`)}</loc></sitemap>`),
    `</sitemapindex>`,
  ].join("\n");
}

function writeSitemaps(entries: SitemapEntry[]) {
  const files: string[] = [];
  for (let index = 0; index < entries.length; index += SITEMAP_CHUNK_SIZE) {
    const file = `sitemap-${files.length + 1}.xml`;
    writeFileSync(resolve("dist", file), xmlFor(entries.slice(index, index + SITEMAP_CHUNK_SIZE)));
    files.push(file);
  }
  const index = sitemapIndex(files);
  writeFileSync(resolve("dist/sitemap.xml"), index);
  writeFileSync(resolve("dist/sitemap-index.xml"), index);
  return files;
}

(async () => {
  const [colleges, courses, exams, careers, scholarships, articles, landing, catModules, premiumPrograms, jobs, authors, legalPages, study] = await Promise.all([
    fetchRows("colleges", "slug,short_id,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
    fetchRows("courses", "slug,short_id,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
    fetchRows("exams", "slug,short_id,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
    fetchRows("career_profiles", "slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
    fetchRows("scholarships", "slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
    fetchRows("articles", "slug,updated_at,tags", (q) => q.eq("is_active", true).not("slug", "is", null)),
    fetchRows("landing_pages", "slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
    fetchRows("cat_universe_modules", "slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
    fetchRows("promoted_programs", "slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
    fetchRows("jobs", "slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
    fetchRows("authors", "slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
    fetchRows("legal_pages", "slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
    studyEntries(),
  ]);

  const tags = [...new Set(articles.flatMap((article) => Array.isArray(article.tags) ? article.tags : []).filter(Boolean))];
  const liveEntityRowsVisible = Boolean(colleges.length || courses.length || exams.length || articles.length || premiumPrograms.length);
  const seedEntries = liveEntityRowsVisible ? [] : await fetchSeedEntries();
  if (!liveEntityRowsVisible) {
    console.warn("[sitemap] no live entity rows are visible. Configure SITEMAP_API_URL for the deployed Node/MySQL API so detail URLs can be generated.");
  }
  const all: SitemapEntry[] = [
    ...STATIC,
    ...canonicalDetailEntries(colleges, buildCollegeHref, "0.88"),
    ...canonicalDetailEntries(courses, buildCourseHref, "0.85"),
    ...canonicalDetailEntries(exams, buildExamHref, "0.85"),
    ...detailEntries("/careers", careers, "0.72"),
    ...detailEntries("/scholarships", scholarships, "0.72"),
    ...detailEntries("/news", articles, "0.7"),
    ...tags.map((tag) => ({ path: `/news/tag/${encodeURIComponent(String(tag).toLowerCase().trim().replace(/\s+/g, "-"))}`, changefreq: "daily" as const, priority: "0.62" })),
    ...detailEntries("/landing", landing, "0.65"),
    ...detailEntries("/cat-universe", catModules, "0.75"),
    ...detailEntries("/premium-programs", premiumPrograms, "0.86"),
    ...detailEntries("/jobs", jobs, "0.75"),
    ...detailEntries("/vacancies", jobs, "0.72"),
    ...detailEntries("/author", authors, "0.58"),
    ...detailEntries("/legal", legalPages, "0.45"),
    ...study,
    ...toolEntries(),
    ...filterEntries(),
    ...seedEntries,
  ];

  const seen = new Set<string>();
  const unique = all.filter((entry) => entry.path && !seen.has(entry.path) && (seen.add(entry.path), true));
  const files = writeSitemaps(unique);
  console.log(`sitemap written - ${unique.length} URLs across ${files.length} file(s)`);
})().catch((error) => {
  console.warn("[sitemap] fatal:", error?.message || error);
  writeSitemaps(STATIC);
});
