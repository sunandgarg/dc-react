import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, GraduationCap, BookOpen, FileText, CircleDot, Award, NotebookPen, Newspaper } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";

interface Section {
  label: string;
  href?: string;
  columns?: { title: string; items: { label: string; href: string }[] }[];
  featured?: { title: string; subtitle: string; href: string };
}

function useMegaMenuData(enabled: boolean) {
  return useQuery({
    queryKey: ["mega-menu-data-v2"],
    enabled,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const [c, co, e] = await Promise.all([
        backendClient.from("colleges").select("name,slug,category,state,city").eq("is_active", true).order("rating", { ascending: false }).limit(300),
        backendClient.from("courses").select("name,slug,category,level").eq("is_active", true).limit(300),
        backendClient.from("exams").select("name,slug,category,is_top_exam").eq("is_active", true).order("is_top_exam", { ascending: false }).limit(150),
      ]);
      return { colleges: c.data ?? [], courses: co.data ?? [], exams: e.data ?? [] };
    },
  });
}

const HEADER_STREAMS = ["Engineering", "Management", "Medical", "Science", "Design", "Law", "Arts & Humanities", "Education"];

const listingHref = (pathname: string, key: string, values: string | string[]) => {
  const params = new URLSearchParams();
  const entries = Array.isArray(values) ? values : [values];
  entries.forEach((value) => params.append(key, value));
  return `${pathname}?${params.toString()}`;
};

const preloadNewsPage = () => {
  void import("@/pages/News");
};

export function MegaMenu() {
  const [dataRequested, setDataRequested] = useState(false);
  const { data } = useMegaMenuData(dataRequested);
  const [open, setOpen] = useState<string | null>(null);
  const [panelTop, setPanelTop] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target) && !panelRef.current?.contains(target)) setOpen(null);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, []);

  // Anchor the menu to the complete sticky header, never to an individual
  // trigger. This keeps every section aligned to the same left/right edges.
  const positionPanel = () => {
    const header = ref.current?.closest("header");
    if (header) setPanelTop(Math.max(0, header.getBoundingClientRect().bottom + 8));
  };

  useEffect(() => {
    if (!open) return;
    const update = () => positionPanel();
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const byState = (arr: any[]) => {
    const m: Record<string, any[]> = {};
    arr.forEach((c) => { if (c.state) (m[c.state] ||= []).push(c); });
    return m;
  };
  const states = byState(data?.colleges || []);
  const topStates = Object.entries(states).sort((a, b) => b[1].length - a[1].length).slice(0, 8);

  const sections: Section[] = [
    {
      label: "Colleges",
      href: "/colleges",
      columns: [
        { title: "By Stream", items: HEADER_STREAMS.map((stream) => ({ label: stream, href: listingHref("/colleges", "stream", stream) })).concat([{ label: "All colleges →", href: "/colleges" }]) },
        { title: "By Type", items: [
          { label: "Government & Public", href: listingHref("/colleges", "type", ["Government", "Public", "Public Institute", "Public (Autonomous)", "Public Institute (Autonomous)", "State University", "State Agricultural University", "Open University"]) },
          { label: "Private Colleges", href: listingHref("/colleges", "type", ["Private", "Private Institute", "Private University", "Private (Autonomous)", "Private Institute (Autonomous)"]) },
          { label: "Deemed Universities", href: listingHref("/colleges", "type", ["Deemed", "Deemed University", "Deemed To Be University"]) },
          { label: "Autonomous", href: listingHref("/colleges", "type", ["Private (Autonomous)", "Public (Autonomous)", "Autonomous University", "Private Institute (Autonomous)", "Public Institute (Autonomous)"]) },
        ] },
        { title: "Popular States", items: topStates.slice(0, 6).map(([st, list]) => ({ label: `${st} (${list.length})`, href: `/colleges?state=${encodeURIComponent(st)}` })).concat([{ label: "Browse all states →", href: "/colleges" }]) },
        { title: "Top Ranked", items: (data?.colleges || []).slice(0, 5).map((c: any) => ({ label: c.name, href: `/colleges/${c.slug}` })).concat([{ label: "Browse top colleges →", href: "/colleges" }]) },
      ],
    },
    {
      label: "Courses",
      href: "/courses",
      columns: [
        { title: "By Level", items: [
          { label: "Undergraduate (UG)", href: "/courses?level=Undergraduate" },
          { label: "Postgraduate (PG)", href: "/courses?level=Postgraduate" },
          { label: "Certificate", href: "/courses?level=Certificate" },
          { label: "Doctorate (PhD)", href: "/courses?level=Doctoral" },
        ] },
        { title: "By Stream", items: HEADER_STREAMS.map((stream) => ({ label: stream, href: listingHref("/courses", "stream", stream) })) },
        { title: "By Mode", items: [
          { label: "Full-Time", href: "/courses?mode=Full+Time" },
          { label: "Online", href: "/courses?mode=Online" },
          { label: "Self-Paced", href: "/courses?mode=Self-Paced" },
        ] },
        { title: "Popular", items: (data?.courses || []).slice(0, 6).map((c: any) => ({ label: c.name, href: `/courses/${c.slug}` })).concat([{ label: "All courses →", href: "/courses" }]) },
      ],
    },
    {
      label: "Exams",
      href: "/exams",
      columns: [
        { title: "Top Exams", items: (data?.exams || []).filter((e: any) => e.is_top_exam).slice(0, 7).map((e: any) => ({ label: e.name, href: `/exams/${e.slug}` })).concat([{ label: "All exams →", href: "/exams" }]) },
        { title: "By Stream", items: HEADER_STREAMS.slice(0, 6).map((stream) => ({ label: stream, href: listingHref("/exams", "stream", stream) })) },
        { title: "By Level", items: [
          { label: "Undergraduate (UG)", href: "/exams?level=UG" },
          { label: "Postgraduate (PG)", href: "/exams?level=PG" },
          { label: "After Class 12", href: "/exams?level=12th" },
          { label: "After Class 10", href: "/exams?level=10th" },
        ] },
      ],
    },
    {
      label: "Scholarships",
      href: "/scholarships",
      columns: [
        { title: "By Level", items: [
          { label: "Undergraduate (UG)", href: "/scholarships?level=UG" },
          { label: "All scholarships →", href: "/scholarships" },
        ] },
        { title: "By Category", items: [
          { label: "🏆 Merit", href: "/scholarships?category=Merit" },
          { label: "🎯 Government", href: "/scholarships?category=Government" },
          { label: "🏢 Corporate", href: "/scholarships?category=Corporate" },
          { label: "🤝 NGO", href: "/scholarships?category=NGO" },
        ] },
      ],
    },
    {
      label: "Study Material",
      href: "/study-material",
      columns: [
        { title: "By Class", items: [12, 11, 10, 9, 8].map((c) => ({ label: `📘 Class ${c}`, href: `/study-material/class-${c}` })) },
        { title: "By Board", items: [
          { label: "CBSE", href: "/study-material?board=cbse" },
          { label: "ICSE", href: "/study-material?board=icse" },
          { label: "State Board", href: "/study-material?board=state" },
          { label: "Bihar Board", href: "/study-material?board=bihar-board" },
          { label: "All boards →", href: "/study-material" },
        ] },
        { title: "Quick Picks", items: [
          { label: "📝 Sample Papers", href: "/news/tag/sample-papers" },
          { label: "📅 Date Sheets", href: "/news/tag/date-sheet" },
          { label: "📖 Chapter Notes", href: "/news/tag/notes" },
          { label: "🧠 PYQs (Last 10 yr)", href: "/news/tag/previous-papers" },
        ] },
        { title: "College Study Material", items: [
          { label: "B.Tech Notes and Papers", href: "/college-study-material?program=btech" },
          { label: "BCA Notes and Papers", href: "/college-study-material?program=bca" },
          { label: "MBA Notes and Papers", href: "/college-study-material?program=mba" },
          { label: "Browse universities", href: "/college-study-material" },
        ] },
      ],
    },
    {
      label: "CAT Universe",
      href: "/cat-universe",
      columns: [
        { title: "AI-first prep", items: [
          { label: "Free CAT 2026 Kit", href: "/cat-universe/cat-2026-preparation-kit" },
          { label: "AI Interview Practice", href: "/cat-universe/ai-interview-practice" },
          { label: "AI CAT Coach", href: "/cat-universe/ai-coach" },
        ] },
        { title: "Post Exam", items: [
          { label: "CAT Score Calculator", href: "/cat-universe/cat-score-calculator" },
          { label: "XAT Score Calculator", href: "/cat-universe/xat-score-calculator" },
          { label: "CMAT Score Calculator", href: "/cat-universe/cmat-score-calculator" },
          { label: "SOP, Score and WAT Desk", href: "/cat-universe/sop-exam-score-wat" },
        ] },
        { title: "Pre Exam", items: [
          { label: "Last 10 Year CAT Papers", href: "/cat-universe/cat-previous-year-papers" },
          { label: "XAT Previous Papers", href: "/cat-universe/xat-previous-year-papers" },
          { label: "MAT Previous Papers", href: "/cat-universe/mat-previous-year-papers" },
          { label: "GMAT Previous Papers", href: "/cat-universe/gmat-previous-year-papers" },
        ] },
        { title: "Post Result", items: [
          { label: "IIM Call Predictor", href: "/cat-universe/iim-call-predictor" },
          { label: "Interview Calls and Converts", href: "/cat-universe/interview-calls-converts" },
          { label: "Mock Interviews and Dockets", href: "/cat-universe/mock-interview-and-dockets" },
        ] },
        { title: "College Cut-offs", items: [
          { label: "CAT College Cut-offs", href: "/cat-universe/cat-based-college-cutoffs" },
          { label: "NMAT College Cut-offs", href: "/cat-universe/nmat-based-college-cutoffs" },
          { label: "XAT College Cut-offs", href: "/cat-universe/xat-based-college-cutoffs" },
          { label: "All CAT Universe →", href: "/cat-universe" },
        ] },
      ],
    },
    {
      label: "News",
      href: "/news",
    },
  ];

  const iconFor = (l: string) => {
    if (l === "Colleges") return GraduationCap;
    if (l === "Courses") return BookOpen;
    if (l === "Exams") return FileText;
    if (l === "Scholarships") return Award;
    if (l === "Study Material") return NotebookPen;
    if (l === "CAT Universe") return CircleDot;
    if (l === "News") return Newspaper;
    return CircleDot;
  };

  // One shared outer width gives every menu exactly the same alignment. The
  // inner grid adapts to the number of content columns without changing the
  // panel's position or causing horizontal overflow.
  const menuGridClass = (columns: number) =>
    columns >= 4 ? "grid-cols-4" : columns === 2 ? "grid-cols-2" : "grid-cols-3";

  const activeSection = open ? sections.find((section) => section.label === open) : undefined;

  return (
    <nav
      ref={ref}
      onPointerDown={(event) => event.stopPropagation()}
      className="relative hidden lg:flex items-center gap-0.5"
      aria-label="Main navigation"
    >
      {sections.map((s) => {
        const Icon = iconFor(s.label);
        const active = open === s.label;
        return (
          <div key={s.label}>
            {!s.columns && s.href ? (
              <Link
                to={s.href}
                onPointerEnter={s.label === "News" ? preloadNewsPage : undefined}
                onFocus={s.label === "News" ? preloadNewsPage : undefined}
                onTouchStart={s.label === "News" ? preloadNewsPage : undefined}
                className={`flex items-center gap-1 px-2.5 py-2 text-sm font-medium rounded-xl transition-colors text-foreground/80 hover:text-foreground hover:bg-secondary`}
              >
                <Icon className="w-3.5 h-3.5" />
                {s.label}
              </Link>
            ) : (
              <button
                type="button"
                aria-expanded={active}
                aria-haspopup="menu"
                onPointerEnter={() => {
                  setDataRequested(true);
                  if (open && !active) setOpen(s.label);
                }}
                onFocus={() => setDataRequested(true)}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDataRequested(true);
                  if (active) setOpen(null);
                  else setOpen(s.label);
                }}
                className={`flex items-center gap-1 px-2.5 py-2 text-sm font-medium rounded-xl transition-colors ${active ? "bg-primary/10 text-primary" : "text-foreground/80 hover:text-foreground hover:bg-secondary"}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {s.label}
                <ChevronDown className={`w-3 h-3 transition ${active ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>
        );
      })}
      {activeSection?.columns && (
          <div
            ref={panelRef}
            role="menu"
            onPointerDown={(event) => event.stopPropagation()}
            style={{ top: panelTop }}
            className={`fixed left-1/2 z-[80] grid h-auto w-[min(1370px,calc(100vw-32px))] max-w-[calc(100vw-32px)] max-h-[min(72vh,620px)] -translate-x-1/2 origin-top gap-4 overflow-x-hidden overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_30px_90px_-34px_rgba(15,23,42,.45)] sm:gap-5 sm:p-5 xl:p-6 ${menuGridClass(activeSection.columns.length)}`}
          >
            {activeSection.columns.map((col, i) => (
              <div key={i} className="min-w-0 rounded-2xl bg-slate-50/90 p-3.5 ring-1 ring-inset ring-slate-100 sm:p-4">
                <p className="mb-3 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.13em] text-primary"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{col.title}</p>
                <ul className="space-y-0.5">
                  {col.items.map((it) => (
                    <li key={it.label + it.href}>
                      <Link
                        role="menuitem"
                        to={it.href}
                        onClick={() => setOpen(null)}
                        className="group flex min-h-9 items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-[13px] font-medium leading-5 text-slate-700 transition hover:bg-white hover:text-primary hover:shadow-sm sm:text-sm"
                      >
                        <span className="truncate">{it.label}</span><span className="opacity-0 transition group-hover:opacity-100">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="col-span-full flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div><p className="text-sm font-extrabold text-slate-900">Explore with confidence</p><p className="text-xs text-slate-500">Verified colleges, courses, exams and decision tools in one place.</p></div>
              {activeSection.href && <Link to={activeSection.href} onClick={() => setOpen(null)} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground shadow-lg shadow-primary/20">View all {activeSection.label} →</Link>}
            </div>
          </div>
      )}
    </nav>
  );
}
