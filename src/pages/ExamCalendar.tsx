import { Fragment as FragmentWithKey, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { AlsoCheckSection } from "@/components/AlsoCheckSection";
import { LeadGateDialog } from "@/components/LeadGateDialog";
import { Bell } from "lucide-react";
import { Calendar, Search, ChevronRight, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { backendClient } from "@/integrations/backend/client";
import { useQuery } from "@tanstack/react-query";
import { currentYear } from "@/lib/currentYear";

type ExamRow = {
  slug: string;
  name: string;
  short_name: string | null;
  category: string | null;
  exam_date: string | null;
  application_start_date: string | null;
  application_end_date: string | null;
  result_date: string | null;
  registration_url: string | null;
  logo: string | null;
  image: string | null;
  mode: string | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

function ExamCalendarLogo({ exam }: { exam: ExamRow }) {
  const sources = useMemo(
    () => [exam.logo, exam.image].filter((source, index, all): source is string => Boolean(source?.trim()) && all.indexOf(source) === index),
    [exam.logo, exam.image],
  );
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => setSourceIndex(0), [exam.slug, exam.logo, exam.image]);

  const initials = (exam.short_name || exam.name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const source = sources[sourceIndex];

  return (
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <span className="px-1 text-center text-[10px] font-black text-primary">{initials || <Calendar className="h-5 w-5" />}</span>
      {source && (
        <img
          key={source}
          src={source}
          alt={`${exam.name} logo`}
          className="entity-logo-safe absolute inset-0 h-full w-full rounded-xl"
          loading="lazy"
          decoding="async"
          onError={() => setSourceIndex((current) => current + 1)}
        />
      )}
    </div>
  );
}

export default function ExamCalendar() {
  const year = currentYear();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [monthFilter, setMonthFilter] = useState<number | null>(null);
  const [updatesOpen, setUpdatesOpen] = useState(false);

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["exam-calendar", year],
    queryFn: async () => {
      const { data, error } = await backendClient
        .from("exams")
        .select("slug,name,short_name,category,exam_date,application_start_date,application_end_date,result_date,registration_url,logo,image,mode")
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as ExamRow[];
    },
    staleTime: 5 * 60_000,
  });

  const categories = useMemo(() => {
    const s = new Set<string>();
    exams.forEach((e) => e.category && s.add(e.category));
    return ["All", ...Array.from(s).sort()];
  }, [exams]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return exams.filter((e) => {
      if (cat !== "All" && e.category !== cat) return false;
      if (ql && !`${e.name} ${e.short_name ?? ""}`.toLowerCase().includes(ql)) return false;
      return true;
    });
  }, [exams, q, cat]);

  // Bucket by month using best-available date (exam_date → application_end_date → application_start_date)
  const byMonth = useMemo(() => {
    const buckets: Record<number, Array<{ row: ExamRow; date: Date }>> = {};
    for (let i = 0; i < 12; i++) buckets[i] = [];
    filtered.forEach((row) => {
      const d =
        parseDate(row.exam_date) ||
        parseDate(row.application_end_date) ||
        parseDate(row.application_start_date);
      if (!d) return;
      if (d.getFullYear() !== year) return;
      buckets[d.getMonth()].push({ row, date: d });
    });
    Object.values(buckets).forEach((arr) => arr.sort((a, b) => a.date.getTime() - b.date.getTime()));
    return buckets;
  }, [filtered, year]);

  const monthsToShow = monthFilter !== null ? [monthFilter] : MONTHS.map((_, i) => i);

  const totalCount = Object.values(byMonth).reduce((acc, a) => acc + a.length, 0);
  const examUpdateOptions = useMemo(
    () => Array.from(new Set(exams.map((exam) => exam.short_name || exam.name))).sort(),
    [exams],
  );

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`Exam Calendar ${year} - All Important Entrance Exam Dates | DekhoCampus`}
        description={`Complete ${year} exam calendar with dates for JEE, NEET, CAT, GATE & all major entrance exams. Application start, last date, exam date & results.`}
      />
      <Navbar />

      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <PageBreadcrumb items={[{ label: "Home", href: "/" }, { label: `Exam Calendar ${year}` }]} />

        <AlsoCheckSection variant="strip" className="mb-5" />

        <section className="mt-3 rounded-3xl bg-primary p-5 text-primary-foreground md:p-7">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              <Calendar className="w-3 h-3" /> Live · {year}
            </div>
            <h1 className="mt-2.5 text-[28px] font-black leading-[1.05] tracking-tight text-white md:text-4xl">
              Every exam date.<br/>One calm plan for your <span className="text-amber-300">future.</span>
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] text-blue-100 md:text-base">
              Track applications, admit cards, exam days and results without the last-minute scramble.
            </p>

            {/* Search */}
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search JEE, NEET, CAT…"
                className="h-11 rounded-2xl border-white bg-white pl-9 text-sm text-foreground"
              />
            </div>

            {/* Category pills */}
            <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 snap-x">
              {categories.slice(0, 8).map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`shrink-0 snap-start px-3.5 h-9 rounded-full text-[12px] font-semibold whitespace-nowrap border transition ${
                    cat === c
                      ? "bg-amber-400 text-slate-950 border-amber-400"
                      : "border-white/20 bg-white/10 text-white hover:bg-white/15"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Month chips */}
            <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 snap-x">
              <button
                onClick={() => setMonthFilter(null)}
                className={`shrink-0 snap-start px-3.5 h-9 rounded-full text-[12px] font-semibold whitespace-nowrap border transition ${
                  monthFilter === null ? "bg-amber-400 text-slate-950 border-amber-400" : "border-white/20 bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                All
              </button>
              {MONTHS.map((m, i) => (
                <button
                  key={m}
                  onClick={() => setMonthFilter(monthFilter === i ? null : i)}
                  className={`shrink-0 snap-start inline-flex items-center gap-1 px-3.5 h-9 rounded-full text-[12px] font-semibold whitespace-nowrap border transition ${
                    monthFilter === i ? "bg-amber-400 text-slate-950 border-amber-400" : "border-white/20 bg-white/10 text-white hover:bg-white/15"
                  }`}
                >
                  <span>{m}</span>
                  {byMonth[i].length > 0 && (
                    <span className={`rounded-full px-1.5 text-[10px] font-bold ${monthFilter === i ? "bg-slate-950/10 text-slate-950" : "bg-white/15 text-white"}`}>
                      {byMonth[i].length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <p className="mt-3 text-[11px] font-medium text-blue-100">
              <Filter className="inline w-3 h-3 mr-1" />
              {totalCount} exam{totalCount !== 1 ? "s" : ""} tracked
            </p>
          </div>
        </section>

        <section className="mt-4 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white md:flex-row md:items-center md:justify-between md:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-slate-950">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black">Do not let an important date surprise you.</h2>
              <p className="mt-0.5 text-sm text-slate-300">Register once, choose your target exam and get the important updates in one place.</p>
            </div>
          </div>
          <Button type="button" onClick={() => setUpdatesOpen(true)} disabled={isLoading || examUpdateOptions.length === 0} className="h-11 shrink-0 rounded-xl bg-amber-400 px-5 font-extrabold text-slate-950 hover:bg-amber-300 disabled:opacity-60">
            Register for exam updates
          </Button>
        </section>


        {/* Month sections */}
        <div className="mt-6 space-y-6">
          {isLoading && (
            <div className="text-center py-10 text-muted-foreground text-sm">Loading calendar…</div>
          )}

          {!isLoading && totalCount === 0 && (
            <div className="text-center py-10 bg-card border border-border rounded-2xl">
              <p className="text-sm text-muted-foreground">No exams match your filter.</p>
            </div>
          )}

          {!isLoading && (() => {
            const visibleMonths = monthsToShow.filter((mi) => byMonth[mi].length > 0);
            return visibleMonths.map((mi) => {
              const items = byMonth[mi];
            const now = new Date();
            const isCurrentMonth = now.getMonth() === mi && now.getFullYear() === year;
            return (
              <FragmentWithKey key={mi}>
              <section>
                {/* Month header - full-width sticky divider */}
                <div className="sticky top-14 z-10 -mx-4 mb-3 border-y border-border/60 bg-background px-4 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-lg font-black tracking-tight text-foreground">
                        {MONTHS[mi]} <span className="text-muted-foreground font-bold">{year}</span>
                      </h2>
                      {isCurrentMonth && (
                        <span className="text-[9px] font-bold text-orange-600 uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-100">Now</span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {items.length} exam{items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
                  {items.map(({ row, date }) => {
                    const day = date.getDate();
                    const isExamDate = !!row.exam_date;
                    return (
                      <Link
                        key={row.slug}
                        to={`/exams/${row.slug}`}
                        className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-primary/[0.02]"
                      >
                        {/* Date tile */}
                        <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full ${
                          isExamDate
                            ? "bg-primary text-primary-foreground"
                            : "bg-slate-100 text-slate-800"
                        }`}>
                          <span className="text-[9px] font-bold uppercase opacity-80 leading-none">{MONTHS[mi]}</span>
                          <span className="text-lg font-black leading-none mt-1">{day}</span>
                        </div>

                        <ExamCalendarLogo exam={row} />

                        {/* Body */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-foreground group-hover:text-primary">
                            {row.short_name || row.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isExamDate ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                            }`}>
                              {isExamDate ? "Exam day" : row.application_end_date ? "Apply by" : "Apply from"}
                            </span>
                            {row.category && (
                              <span className="text-[10px] text-muted-foreground truncate">{row.category}</span>
                            )}
                          </div>
                        </div>

                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                      </Link>
                    );
                  })}
                </div>
              </section>
              </FragmentWithKey>
              );
            });
          })()}
        </div>

        
      </main>

      <Footer />
      <LeadGateDialog
        open={updatesOpen}
        onOpenChange={setUpdatesOpen}
        title="Get exam-date updates"
        subtitle="Choose your target exam and register for application, admit-card, exam-day and result updates."
        source="exam_calendar_updates"
        forceShow
        simple
        interestLabel="Target exam"
        interestOptions={examUpdateOptions}
      />
    </div>
  );
}
