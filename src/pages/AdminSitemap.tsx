import { useState } from "react";
import { backendClient } from "@/integrations/backend/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, RefreshCw, Copy, UploadCloud } from "lucide-react";
import { buildCollegeHref, buildCourseHref, buildExamHref } from "@/lib/entityUrls";
import { STRATEGY_SLUGS } from "@/lib/examStrategies";
import { eligibilityComboSlugs, predictorComboSlugs } from "@/lib/seoSubSlugs";
import { LOCK_TARGET_TRENDING_SLUGS, TOOL_SLUGS } from "@/lib/toolsRegistry";
import {
  COLLEGE_DETAIL_TABS,
  COURSE_DETAIL_TABS,
  EXAM_DETAIL_TABS,
  SITEMAP_CHUNK_SIZE,
  STATIC_SITEMAP_ROUTES,
  sitemapPriority,
  type SitemapChangefreq,
} from "@/lib/sitemapConfig";

type AdminSitemapUrl = {
  loc: string;
  pri: number;
  cf: SitemapChangefreq;
  lastmod?: string;
};

const PAGE_SIZE = 1000;

function changed(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : undefined;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sitemapXml(origin: string, urls: AdminSitemapUrl[]) {
  const today = new Date().toISOString().split("T")[0];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url>\n    <loc>${escapeXml(`${origin}${u.loc}`)}</loc>\n    <lastmod>${u.lastmod || today}</lastmod>\n    <changefreq>${u.cf}</changefreq>\n    <priority>${u.pri.toFixed(2).replace(/0$/, "")}</priority>\n  </url>`).join("\n")}\n</urlset>`;
}

function sitemapIndexXml(origin: string, totalUrls: number) {
  const files = Math.max(1, Math.ceil(totalUrls / SITEMAP_CHUNK_SIZE));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Array.from({ length: files }, (_, index) => `  <sitemap><loc>${escapeXml(`${origin}/sitemap-${index + 1}.xml`)}</loc></sitemap>`).join("\n")}\n</sitemapindex>`;
}

async function fetchAllRows(table: string, select: string, configure?: (query: any) => any, optional = false) {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = backendClient.from(table as any).select(select);
    if (configure) query = configure(query);
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) {
      if (optional) return rows;
      throw new Error(`${table}: ${error.message}`);
    }
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

function pushDetails(
  urls: AdminSitemapUrl[],
  rows: any[],
  buildHref: (row: any) => string,
  pri: number,
  tabs: readonly string[] = [],
) {
  for (const row of rows) {
    if (!row.slug) continue;
    const base = buildHref(row);
    urls.push({ loc: base, pri, cf: "weekly", lastmod: changed(row.updated_at) });
    for (const tab of tabs) {
      urls.push({
        loc: `${base}/${tab}`,
        pri: Number(sitemapPriority(pri.toFixed(2), -0.12)),
        cf: "weekly",
        lastmod: changed(row.updated_at),
      });
    }
  }
}

function pushGenericDetails(urls: AdminSitemapUrl[], prefix: string, rows: any[], pri: number, mirrorPrefix?: string) {
  for (const row of rows) {
    if (!row.slug) continue;
    urls.push({ loc: `${prefix}/${row.slug}`, pri, cf: "weekly", lastmod: changed(row.updated_at) });
    if (mirrorPrefix) {
      urls.push({ loc: `${mirrorPrefix}/${row.slug}`, pri: Math.max(0.1, pri - 0.03), cf: "weekly", lastmod: changed(row.updated_at) });
    }
  }
}

export default function AdminSitemap() {
  const [origin, setOrigin] = useState(typeof window !== "undefined" ? window.location.origin : "https://dekhocampus.com");
  const [xml, setXml] = useState("");
  const [building, setBuilding] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [summary, setSummary] = useState("");

  const build = async () => {
    setBuilding(true);
    setXml("");
    setSummary("");
    try {
      const cleanOrigin = origin.replace(/\/+$/, "");
      const urls: AdminSitemapUrl[] = STATIC_SITEMAP_ROUTES.map((route) => ({
        loc: route.path,
        pri: Number(route.priority),
        cf: route.changefreq,
      }));

      const [
        colleges,
        courses,
        exams,
        articles,
        careers,
        scholarships,
        premiumPrograms,
        jobs,
        landingPages,
        catModules,
        authors,
        legalPages,
        studySubjects,
        studyChapters,
        collegePrograms,
        collegeUniversities,
        collegeSemesters,
        collegeSubjects,
      ] = await Promise.all([
        fetchAllRows("colleges", "slug,short_id,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
        fetchAllRows("courses", "slug,short_id,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
        fetchAllRows("exams", "slug,short_id,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
        fetchAllRows("articles", "slug,updated_at,tags", (q) => q.eq("is_active", true).not("slug", "is", null)),
        fetchAllRows("career_profiles", "slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
        fetchAllRows("scholarships", "slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
        fetchAllRows("promoted_programs", "slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
        fetchAllRows("jobs", "slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
        fetchAllRows("landing_pages", "slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
        fetchAllRows("cat_universe_modules", "slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null), true),
        fetchAllRows("authors", "slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
        fetchAllRows("legal_pages", "slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
        fetchAllRows("study_subjects", "id,slug,class_num,board_slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
        fetchAllRows("study_chapters", "slug,subject_id,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
        fetchAllRows("college_programs", "slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
        fetchAllRows("college_universities", "slug,program_slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
        fetchAllRows("college_semesters", "semester_num,program_slug,university_slug,updated_at", (q) => q.eq("is_active", true)),
        fetchAllRows("college_subjects", "slug,semester_num,program_slug,university_slug,updated_at", (q) => q.eq("is_active", true).not("slug", "is", null)),
      ]);

      pushDetails(urls, colleges, buildCollegeHref, 0.88, COLLEGE_DETAIL_TABS);
      pushDetails(urls, courses, buildCourseHref, 0.85, COURSE_DETAIL_TABS);
      pushDetails(urls, exams, buildExamHref, 0.85, [...EXAM_DETAIL_TABS, ...STRATEGY_SLUGS]);
      pushGenericDetails(urls, "/news", articles, 0.7);
      pushGenericDetails(urls, "/careers", careers, 0.72);
      pushGenericDetails(urls, "/scholarships", scholarships, 0.72);
      pushGenericDetails(urls, "/premium-programs", premiumPrograms, 0.86);
      pushGenericDetails(urls, "/jobs", jobs, 0.75, "/vacancies");
      pushGenericDetails(urls, "/landing", landingPages, 0.65);
      pushGenericDetails(urls, "/cat-universe", catModules, 0.75);
      pushGenericDetails(urls, "/author", authors, 0.58);
      pushGenericDetails(urls, "/legal", legalPages, 0.45);

      const subjectById = new Map(studySubjects.map((subject: any) => [subject.id, subject]));
      const classBoards = new Set<string>();
      for (const subject of studySubjects) {
        classBoards.add(`/study-material/class-${subject.class_num}/${subject.board_slug}`);
        urls.push({ loc: `/study-material/class-${subject.class_num}/${subject.board_slug}/${subject.slug}`, pri: 0.58, cf: "weekly", lastmod: changed(subject.updated_at) });
      }
      classBoards.forEach((loc) => urls.push({ loc, pri: 0.62, cf: "weekly" }));
      for (const chapter of studyChapters) {
        const subject = subjectById.get(chapter.subject_id) as any;
        if (subject) urls.push({ loc: `/study-material/class-${subject.class_num}/${subject.board_slug}/${subject.slug}/${chapter.slug}`, pri: 0.55, cf: "weekly", lastmod: changed(chapter.updated_at) });
      }
      collegePrograms.forEach((row: any) => urls.push({ loc: `/college-study-material/${row.slug}`, pri: 0.62, cf: "weekly", lastmod: changed(row.updated_at) }));
      collegeUniversities.forEach((row: any) => urls.push({ loc: `/college-study-material/${row.program_slug}/${row.slug}`, pri: 0.58, cf: "weekly", lastmod: changed(row.updated_at) }));
      collegeSemesters.forEach((row: any) => urls.push({ loc: `/college-study-material/${row.program_slug}/${row.university_slug}/semester-${row.semester_num}`, pri: 0.55, cf: "weekly", lastmod: changed(row.updated_at) }));
      collegeSubjects.forEach((row: any) => urls.push({ loc: `/college-study-material/${row.program_slug}/${row.university_slug}/semester-${row.semester_num}/${row.slug}`, pri: 0.52, cf: "weekly", lastmod: changed(row.updated_at) }));

      TOOL_SLUGS.forEach((slug) => urls.push({ loc: `/tools/${slug}`, pri: 0.55, cf: "monthly" }));
      eligibilityComboSlugs().forEach((slug) => urls.push({ loc: `/eligibility-checker/${slug}`, pri: 0.55, cf: "weekly" }));
      predictorComboSlugs().forEach((slug) => urls.push({ loc: `/college-predictor/${slug}`, pri: 0.55, cf: "weekly" }));
      LOCK_TARGET_TRENDING_SLUGS.forEach((slug) => {
        ["lock-target", "achieve-target", "roadmap", "dream-college-roadmap"].forEach((prefix) => {
          urls.push({ loc: `/${prefix}/${slug}`, pri: 0.55, cf: "weekly" });
        });
      });

      const tags = [...new Set(articles.flatMap((article: any) => Array.isArray(article.tags) ? article.tags : []).filter(Boolean))];
      tags.forEach((tag) => urls.push({ loc: `/news/tag/${encodeURIComponent(String(tag).toLowerCase().trim().replace(/\s+/g, "-"))}`, pri: 0.62, cf: "daily" }));

      const seen = new Set<string>();
      const unique = urls.filter((u) => u.loc && !seen.has(u.loc) && (seen.add(u.loc), true));
      const sitemapCount = Math.ceil(unique.length / SITEMAP_CHUNK_SIZE);
      setXml(unique.length > SITEMAP_CHUNK_SIZE ? sitemapIndexXml(cleanOrigin, unique.length) : sitemapXml(cleanOrigin, unique));
      setCounts({
        static: STATIC_SITEMAP_ROUTES.length,
        tools: TOOL_SLUGS.length,
        colleges: colleges.length,
        college_subpages: colleges.length * COLLEGE_DETAIL_TABS.length,
        courses: courses.length,
        course_subpages: courses.length * COURSE_DETAIL_TABS.length,
        exams: exams.length,
        exam_subpages: exams.length * (EXAM_DETAIL_TABS.length + STRATEGY_SLUGS.length),
        articles: articles.length,
        scholarships: scholarships.length,
        study_material: studySubjects.length + studyChapters.length,
        college_study: collegePrograms.length + collegeUniversities.length + collegeSemesters.length + collegeSubjects.length,
        total_urls: unique.length,
      });
      setSummary(
        unique.length > SITEMAP_CHUNK_SIZE
          ? `Built a sitemap index preview for ${unique.length.toLocaleString()} URLs across ${sitemapCount} chunk file(s). The production build writes sitemap.xml plus sitemap-1.xml, sitemap-2.xml, etc.`
          : `Built a full sitemap preview with ${unique.length.toLocaleString()} URLs.`,
      );
      const { data, error } = await backendClient.functions.invoke("publish-sitemap", {
        body: { target: "https://dekhocampus.com" },
      });
      if (error) throw error;
      const published = data as any;
      setSummary((current) => `${current} Published ${Number(published?.url_count || unique.length).toLocaleString()} URLs in ${Number(published?.chunk_count || sitemapCount).toLocaleString()} AWS-backed chunk file(s). The sitemap index is now live at dekhocampus.com/sitemap.xml.`);
      toast.success(`Sitemap deployment queued for ${unique.length.toLocaleString()} URLs`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to build sitemap");
    } finally {
      setBuilding(false);
    }
  };

  const download = () => {
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sitemap.xml";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = () => {
    navigator.clipboard.writeText(xml);
    toast.success("Copied");
  };

  return (
    <AdminLayout title="Sitemap">
      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <Label>Site origin (no trailing slash)</Label>
            <Input value={origin} onChange={(event) => setOrigin(event.target.value)} />
          </div>
          <Button onClick={build} disabled={building}>
            {building
              ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              : <UploadCloud className="w-4 h-4 mr-1" />}
            {building ? "Generating..." : "Generate and publish"}
          </Button>
        </div>

        {Object.keys(counts).length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            {Object.entries(counts).map(([key, value]) => (
              <span key={key} className="px-3 py-1 rounded-full bg-muted">
                {key}: <b>{value.toLocaleString()}</b>
              </span>
            ))}
          </div>
        )}

        {summary && <p className="text-sm text-muted-foreground">{summary}</p>}

        {xml && (
          <>
            <div className="flex gap-2">
              <Button onClick={download}><Download className="w-4 h-4 mr-1" />Download sitemap.xml</Button>
              <Button variant="outline" onClick={copy}><Copy className="w-4 h-4 mr-1" />Copy</Button>
            </div>
            <Textarea value={xml} readOnly className="font-mono text-xs min-h-[400px]" />
            <p className="text-xs text-muted-foreground">
              Publishing builds from live MySQL data, writes immutable sitemap chunks to private AWS S3, and atomically replaces <code>/sitemap.xml</code>. Submit that one URL in Search Console; Google will follow the current chunk files automatically.
            </p>
          </>
        )}
      </Card>
    </AdminLayout>
  );
}
