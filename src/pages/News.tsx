import { Fragment, useState, useMemo, useEffect, useRef, useCallback, memo } from "react";
import { Search, Clock, TrendingUp, GraduationCap, Briefcase, Building2, FileText, Award, Globe, BookOpen, Users, Newspaper, X, Tag as TagIcon, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { LeadCaptureForm } from "@/components/LeadCaptureForm";
import { AlsoCheckSection } from "@/components/AlsoCheckSection";
import { Link, useSearchParams, useParams, useNavigate } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";
import { DynamicAdBanner } from "@/components/DynamicAdBanner";
import { GoogleAd } from "@/components/ads/GoogleAd";
import { plainText } from "@/lib/plainText";
import { useImportantExams } from "@/hooks/useExamsData";
import { buildExamHref } from "@/lib/entityUrls";
import { NumberedPagination } from "@/components/NumberedPagination";
import { normalizePage } from "@/lib/pagination";
import { isArticlePublishedToday, LiveNewsBadge } from "@/components/LiveNewsBadge";

const categories = [
  { label: "All News", icon: Newspaper, value: "" },
  { label: "Admission News", icon: GraduationCap, value: "Admissions" },
  { label: "Trending News", icon: TrendingUp, value: "Trending" },
  { label: "Job Opportunities", icon: Briefcase, value: "Jobs" },
  { label: "College News", icon: Building2, value: "College" },
  { label: "Exam News", icon: FileText, value: "Exam Updates" },
  { label: "Success Stories", icon: Award, value: "Success" },
  { label: "Scholarships", icon: BookOpen, value: "Scholarships" },
  { label: "Career", icon: Users, value: "Career" },
  { label: "World Today", icon: Globe, value: "World" },
];

const PAGE_SIZE = 12;
const ARTICLE_COLS = "id,slug,title,description,featured_image,category,tags,created_at,featured_rank";

// Reuse one Intl formatter instead of re-instantiating on every render
const dateFmtLong = new Intl.DateTimeFormat("en-IN", { month: "long", day: "numeric", year: "numeric" });
const dateFmtShort = new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric", year: "numeric" });

// Debounce hook - search input shouldn't fire a query on every keystroke
function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

type Article = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  featured_image: string | null;
  category: string | null;
  tags: string[] | null;
  created_at: string;
  featured_rank: number | null;
};

// Memoized card components - prevents re-render storms when parent state changes
const LatestCard = memo(function LatestCard({ a, eager, live }: { a: Article; eager: boolean; live: boolean }) {
  return (
    <Link to={`/news/${a.slug}`} className="group">
      <div className="flex gap-4 rounded-2xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-lg sm:p-4">
        <div className="h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-white sm:h-24 sm:w-40">
          {a.featured_image ? (
            <img
              src={a.featured_image}
              alt={a.title}
              width={416}
              height={256}
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
              <Newspaper className="w-10 h-10 text-primary/20" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {a.category && <Badge variant="secondary" className="text-xs">{a.category}</Badge>}
            {live && <LiveNewsBadge />}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />{dateFmtShort.format(new Date(a.created_at))}
            </span>
          </div>
          <h3 className="font-semibold leading-5 text-foreground group-hover:text-primary transition-colors line-clamp-3 text-sm sm:text-base">{a.title}</h3>
          {a.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{plainText(a.description)}</p>
          )}
        </div>
      </div>
    </Link>
  );
});

const SidebarItem = memo(function SidebarItem({ a, live }: { a: Article; live: boolean }) {
  return (
    <Link to={`/news/${a.slug}`} className="flex gap-3 group">
      <div className="w-24 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
        {a.featured_image ? (
          <img src={a.featured_image} alt={a.title} width={96} height={80} loading="lazy" decoding="async" className="w-full h-full object-contain bg-white" />
        ) : (
          <div className="w-full h-full bg-primary/10 flex items-center justify-center"><FileText className="w-6 h-6 text-primary/30" /></div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">{dateFmtLong.format(new Date(a.created_at))}</p>
          {live && <LiveNewsBadge />}
        </div>
        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">{a.title}</h3>
      </div>
    </Link>
  );
});

function NewsLinkModule({
  title,
  items,
  moreHref,
  moreLabel,
}: {
  title: string;
  items: Array<{ href: string; title: string; meta?: string; isLive?: boolean }>;
  moreHref: string;
  moreLabel: string;
}) {
  if (!items.length) return null;
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="border-l-4 border-orange-500 pl-3 text-base font-extrabold text-foreground">{title}</h2>
      <ul className="mt-3 divide-y divide-border">
        {items.map((item) => (
          <li key={`${item.href}-${item.title}`}>
            <Link to={item.href} className="group block py-3 first:pt-1">
              <span className="line-clamp-2 text-sm font-semibold leading-5 text-foreground transition-colors group-hover:text-primary">{item.title}</span>
              {item.isLive && <LiveNewsBadge className="mt-1" />}
              {item.meta && <span className="mt-1 block text-[11px] text-muted-foreground">{item.meta}</span>}
            </Link>
          </li>
        ))}
      </ul>
      <Link to={moreHref} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
        {moreLabel} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}

function GridSkeleton() {
  return (
    <>
      <div className="grid lg:grid-cols-3 gap-6 mb-10">
        <div className="lg:col-span-2 h-[300px] md:h-[400px] rounded-2xl bg-muted animate-pulse" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-24 h-20 rounded-xl bg-muted animate-pulse" />
              <div className="flex-1 space-y-2 py-2">
                <div className="h-3 w-1/3 bg-muted animate-pulse rounded" />
                <div className="h-3 w-full bg-muted animate-pulse rounded" />
                <div className="h-3 w-2/3 bg-muted animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border overflow-hidden">
            <div className="h-44 bg-muted animate-pulse" />
            <div className="p-4 space-y-2">
              <div className="h-3 w-1/3 bg-muted animate-pulse rounded" />
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
              <div className="h-3 w-2/3 bg-muted animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function News() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { tag: tagFromPath } = useParams<{ tag?: string }>();
  const navigate = useNavigate();
  const queryTag = (searchParams.get("tag") || "").toLowerCase().trim();

  useEffect(() => {
    if (queryTag && !tagFromPath) {
      const next = new URLSearchParams(searchParams);
      next.delete("tag");
      const qs = next.toString();
      navigate(`/news/tag/${queryTag}${qs ? `?${qs}` : ""}`, { replace: true });
    }
  }, [queryTag, tagFromPath, navigate, searchParams]);

  const tagParam = (tagFromPath || queryTag || "").toLowerCase().trim();
  const [activeCategory, setActiveCategory] = useState(() => searchParams.get("category") || "");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounced(searchQuery.trim(), 350);
  const page = normalizePage(searchParams.get("page"));
  const { data: importantExamData } = useImportantExams(8);
  const importantExams = useMemo(
    () => Array.isArray(importantExamData) ? importantExamData : [],
    [importantExamData],
  );

  useEffect(() => {
    const nextCategory = searchParams.get("category") || "";
    setActiveCategory((current) => current === nextCategory ? current : nextCategory);
  }, [searchParams]);

  const newsPageHref = useCallback((targetPage: number) => {
    const next = new URLSearchParams(searchParams);
    if (targetPage <= 1) next.delete("page");
    else next.set("page", String(targetPage));
    const query = next.toString();
    const path = tagParam ? `/news/tag/${tagParam}` : "/news";
    return `${path}${query ? `?${query}` : ""}`;
  }, [searchParams, tagParam]);

  const setNewsPage = useCallback((targetPage: number, replace = false) => {
    const next = new URLSearchParams(searchParams);
    if (targetPage <= 1) next.delete("page");
    else next.set("page", String(targetPage));
    setSearchParams(next, { replace });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [searchParams, setSearchParams]);

  const changeCategory = (value: string) => {
    setActiveCategory(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set("category", value);
    else next.delete("category");
    next.delete("page");
    setSearchParams(next);
  };

  const changeSearch = (value: string) => {
    setSearchQuery(value);
    if (page === 1) return;
    const next = new URLSearchParams(searchParams);
    next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const clearTag = () => navigate("/news", { replace: true });

  // Pinned articles - separate, long-cached query. Doesn't depend on filters/page/search.
  const { data: pinnedData = [] } = useQuery<Article[]>({
    queryKey: ["news-pinned"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await backendClient
        .from("articles")
        .select(ARTICLE_COLS)
        .eq("site_scope", "dekhocampus")
        .eq("status", "Published")
        .eq("is_active", true)
        .not("featured_rank", "is", null)
        .order("featured_rank", { ascending: true })
        .limit(5);
      if (error) throw error;
      return (data || []) as Article[];
    },
  });

  // A stale cache or a defensive test mock can return a non-array here. Keep
  // the news page renderable instead of crashing on `.map()`.
  const pinned = useMemo(() => Array.isArray(pinnedData) ? pinnedData : [], [pinnedData]);
  const pinnedIds = useMemo(() => pinned.map(p => p.id), [pinned]);
  const hasFilters = !!(tagParam || activeCategory || debouncedSearch);

  // Latest list uses an exact count so numbered pages remain stable and linkable.
  const { data: latestData, isLoading, isFetching } = useQuery({
    queryKey: ["news-latest", { tagParam, activeCategory, debouncedSearch, page, excl: hasFilters ? [] : pinnedIds }],
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    queryFn: async () => {
      let q = backendClient
        .from("articles")
        .select(ARTICLE_COLS, { count: "exact" })
        .eq("site_scope", "dekhocampus")
        .eq("status", "Published")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (tagParam) q = q.contains("tags", [tagParam]);
      if (activeCategory) q = q.ilike("category", `%${activeCategory}%`);
      if (debouncedSearch) q = q.or(`title.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`);
      // Exclude pinned IDs from the "latest" stream only on the unfiltered home view,
      // so pinned items don't appear twice. With filters active, show everything matching.
      if (!hasFilters && pinnedIds.length) {
        q = q.not("id", "in", `(${pinnedIds.join(",")})`);
      }

      const from = (page - 1) * PAGE_SIZE;
      q = q.range(from, from + PAGE_SIZE - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data || []) as Article[], total: count ?? 0 };
    },
  });

  const latest = useMemo(() => latestData?.rows || [], [latestData?.rows]);
  const totalArticles = latestData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalArticles / PAGE_SIZE));

  useEffect(() => {
    if (latestData && page > totalPages) setNewsPage(totalPages, true);
  }, [latestData, page, setNewsPage, totalPages]);

  // Hero + sidebar ONLY appear on the unfiltered home view. When any filter
  // (category, tag, or search) is active, show a plain card grid like a
  // category archive page.
  const showPinnedHero = !hasFilters && pinned.length > 0 && page === 1;
  const featured = showPinnedHero ? pinned[0] : undefined;
  const sidebar = showPinnedHero ? pinned.slice(1, 5) : [];
  const gridArticles = latest;
  const liveArticleIds = useMemo(() => {
    // The first page is the global latest stream. Do not relabel older
    // pagination pages as live when they happen to share today's date.
    if (page !== 1) return new Set<string>();
    const seen = new Set<string>();
    return new Set(
      [...pinned, ...latest]
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
        .filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return isArticlePublishedToday(item.created_at);
        })
        .slice(0, 6)
        .map((item) => item.id),
    );
  }, [latest, page, pinned]);

  const latestSidebarArticles = useMemo(() => {
    const seen = new Set<string>();
    return [...pinned, ...latest]
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .slice(0, 5)
      .map((item) => ({
        href: `/news/${item.slug}`,
        title: item.title,
        meta: `${item.category || "Education"} · ${dateFmtShort.format(new Date(item.created_at))}`,
        isLive: liveArticleIds.has(item.id),
      }));
  }, [latest, pinned, liveArticleIds]);

  const admissionAlerts = useMemo(() => {
    const terms = /admission|application|counselling|counseling|seat allotment|registration|merit list/i;
    const seen = new Set<string>();
    const items = [...pinned, ...latest]
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        const haystack = [item.title, item.category, ...(item.tags || [])].join(" ");
        return haystack.includes("2027") && terms.test(haystack);
      })
      .slice(0, 5)
      .map((item) => ({ href: `/news/${item.slug}`, title: item.title, meta: item.category || "Admissions", isLive: liveArticleIds.has(item.id) }));
    return items.length ? items : [{
      href: "/news?category=Admissions",
      title: "Latest 2027 admissions, counselling and application updates",
      meta: "Admissions 2027",
    }];
  }, [latest, pinned, liveArticleIds]);

  const importantExamLinks = useMemo(() => {
    const items = importantExams.map((exam) => ({
      href: buildExamHref(exam),
      title: exam.short_name || exam.name,
      meta: [exam.level, exam.category].filter(Boolean).join(" · "),
    }));
    return items.length ? items : [
      { href: "/exams/top-engineering-entrance-exams-in-india", title: "Engineering entrance exams", meta: "JEE, GATE and more" },
      { href: "/exams/top-medical-entrance-exams-in-india", title: "Medical entrance exams", meta: "NEET and more" },
      { href: "/exams/top-management-entrance-exams-in-india", title: "Management entrance exams", meta: "CAT, XAT and more" },
    ];
  }, [importantExams]);

  const pageTitle = tagParam
    ? `${tagParam.replace(/-/g, " ")} News & Updates | DekhoCampus`
    : "Education News - Admissions, Exams & Career Updates | DekhoCampus";
  const canonicalPath = newsPageHref(page);

  const showSkeleton = isLoading && latest.length === 0;
  const empty = !isLoading && latest.length === 0 && pinned.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={page > 1 ? `${pageTitle} - Page ${page}` : pageTitle}
        description={tagParam ? `Latest articles tagged ${tagParam} - admissions, tips, results, and updates.` : "Daily updates on admissions, entrance exams, results, scholarships and career opportunities."}
        canonical={canonicalPath}
      />
      {/* Preload the LCP image so the hero paints fast */}
      {featured?.featured_image && (
        <link rel="preload" as="image" href={featured.featured_image} />
      )}
      <Navbar />
      <main className="container py-8 md:py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-5xl font-extrabold text-black dark:text-white">
            {tagParam ? `${tagParam.replace(/-/g, " ")}` : "DekhoCampus News"}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            {tagParam ? `Showing articles tagged with this topic.` : "Updates on the Latest Career Opportunities, Online Education, Online Universities, & more."}
          </p>
        </div>

        <AlsoCheckSection variant="strip" className="mb-4" />

        {tagParam && (
          <div className="flex justify-center mb-4">
            <button onClick={clearTag} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/30 hover:bg-primary/15">
              <TagIcon className="w-3.5 h-3.5" />
              Tag: <span className="font-bold">{tagParam}</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex gap-3 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          {categories.map((cat) => (
            <button key={cat.label} onClick={() => changeCategory(cat.value)}
              className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl border min-w-[90px] transition-all text-center ${
                activeCategory === cat.value ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border hover:bg-muted text-muted-foreground"
              }`}>
              <cat.icon className="w-6 h-6" />
              <span className="text-[11px] font-semibold whitespace-nowrap">{cat.label}</span>
            </button>
          ))}
        </div>

        <div className="relative mb-8 max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => changeSearch(e.target.value)} placeholder="Search news..." className="pl-10 rounded-xl h-11" />
        </div>

        {showSkeleton ? (
          <GridSkeleton />
        ) : empty ? (
          <div className="text-center py-20 text-muted-foreground">
            <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-semibold">No news found</p>
            <p className="text-sm">Try a different category or search term</p>
          </div>
        ) : (
          <>
            {(featured || sidebar.length > 0) && (
              <div className="grid lg:grid-cols-3 gap-6 mb-10">
                {featured && (
                  <Link to={`/news/${featured.slug}`} className="lg:col-span-2 group">
                    <div className="relative rounded-2xl overflow-hidden h-[300px] md:h-[400px] bg-muted">
                      {featured.featured_image ? (
                        <img
                          src={featured.featured_image}
                          alt={featured.title}
                          width={1200}
                          height={400}
                          fetchPriority="high"
                          decoding="async"
                          className="w-full h-full object-contain bg-white"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center"><Newspaper className="w-16 h-16 text-primary/30" /></div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-6">
                        <Badge className="mb-2 bg-accent text-accent-foreground">{featured.category || "Featured"}</Badge>
                        {liveArticleIds.has(featured.id) && <LiveNewsBadge intensity="high" className="ml-2" />}
                        <span className="text-white/70 text-sm ml-2">{dateFmtLong.format(new Date(featured.created_at))}</span>
                        <h2 className="text-xl md:text-2xl font-bold text-white group-hover:text-accent transition-colors line-clamp-2 mt-1">{featured.title}</h2>
                      </div>
                    </div>
                  </Link>
                )}
                {sidebar.length > 0 && (
                  <div className="space-y-4">
                    {sidebar.map((a) => <SidebarItem key={a.id} a={a} live={liveArticleIds.has(a.id)} />)}
                  </div>
                )}
              </div>
            )}

            {gridArticles.length > 0 && (
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
                <section className="min-w-0">
                  <h2 className="text-2xl font-bold text-foreground mb-6 border-b border-border pb-3">Latest Posts</h2>
                  <div className={`space-y-4 transition-opacity ${isFetching ? "opacity-60" : "opacity-100"}`}>
                    {gridArticles.map((a, i) => (
                      <Fragment key={a.id}>
                        <LatestCard a={a} eager={i < 3} live={liveArticleIds.has(a.id)} />
                        {i === Math.min(5, Math.floor(gridArticles.length / 2)) && (
                          <div className="sm:col-span-2 xl:col-span-3 my-2 space-y-4">
                            <DynamicAdBanner position="mid-page" page="articles" />
                            <LeadCaptureForm
                              variant="banner"
                              title="Confused about colleges or courses?"
                              subtitle="Talk to a free expert counsellor - personalised guidance in under 24 hours."
                              source="news_mid_grid"
                            />
                          </div>
                        )}
                      </Fragment>
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <NumberedPagination
                      page={page}
                      totalPages={totalPages}
                      disabled={isFetching}
                      hrefForPage={newsPageHref}
                      onPageChange={setNewsPage}
                      className="mt-8"
                    />
                  )}
                </section>

                <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
                  <section className="min-h-[250px] overflow-hidden rounded-lg border border-border bg-card p-2" aria-label="Advertisement">
                    <p className="pb-1 text-center text-[10px] font-medium uppercase text-muted-foreground">Advertisement</p>
                    <GoogleAd placement="article" position="top" pageKey="news" className="min-h-[220px]" />
                  </section>
                  <NewsLinkModule title="Latest Articles" items={latestSidebarArticles} moreHref="/news" moreLabel="View all articles" />
                  <NewsLinkModule title="Admission Alerts 2027" items={admissionAlerts} moreHref="/news?category=Admissions" moreLabel="View admission updates" />
                  <NewsLinkModule title="Important Exams" items={importantExamLinks} moreHref="/exams" moreLabel="Explore all exams" />
                </aside>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
