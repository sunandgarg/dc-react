import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";
import type { SiteScope } from "@/lib/siteScope";
import type { ArticleAuthorOption } from "@/lib/adminArticleFilters";
import { groupPublications, indiaDate, publicationBounds, publicationDates, type PublicationPeriod, type PublicationRow } from "@/lib/articlePublicationDashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberedPagination } from "@/components/NumberedPagination";

export async function fetchPublicationRows(siteScope: SiteScope, from: string, until: string, signal?: AbortSignal) {
  const rows: PublicationRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await backendClient.from("articles")
      .select("id,title,slug,author,author_id,language_code,created_at")
      .eq("site_scope", siteScope).eq("status", "Published").eq("is_active", true)
      .gte("created_at", from).lt("created_at", until)
      .order("created_at", { ascending: false }).order("id", { ascending: true })
      .range(offset, offset + 499).abortSignal(signal);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
}

const periods: [PublicationPeriod, string][] = [["today", "Today"], ["yesterday", "Yesterday"], ["week", "Last 7 days"], ["month", "Last 30 days"], ["custom", "Custom"]];
const displayDate = (value: string) => new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function ArticlePublicationDashboard({ siteScope, authors }: { siteScope: SiteScope; authors: ArticleAuthorOption[] }) {
  const [period, setPeriod] = useState<PublicationPeriod>("today");
  const [custom, setCustom] = useState(() => publicationDates("today"));
  const [today, setToday] = useState(indiaDate);
  const [writer, setWriter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  useEffect(() => { const timer = window.setInterval(() => setToday(indiaDate()), 60_000); return () => window.clearInterval(timer); }, []);
  const dates = period === "custom" ? custom : publicationDates(period, Date.parse(`${today}T12:00:00+05:30`));
  const bounds = publicationBounds(dates.start, dates.end);
  const query = useQuery({
    queryKey: ["db-articles-admin", siteScope, "publication-dashboard", bounds?.from, bounds?.until],
    enabled: Boolean(bounds),
    queryFn: ({ signal }) => fetchPublicationRows(siteScope, bounds!.from, bounds!.until, signal),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const groups = useMemo(() => groupPublications(query.data || [], authors), [query.data, authors]);
  const selected = groups.find((group) => group.key === writer);
  const rows = selected ? selected.rows : groups.flatMap((group) => group.rows).sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
  const english = groups.reduce((sum, group) => sum + group.english, 0);
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
  useEffect(() => { setWriter(null); setPage(1); }, [dates.start, dates.end, siteScope]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / 20)));

  return <section aria-label="Article publication dashboard" className="mb-6 rounded-2xl border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold">Publication dashboard</h2><p className="text-xs text-muted-foreground">Published articles by writer · India time (IST)</p></div>
      <Button variant="outline" size="sm" disabled={!bounds || query.isFetching} onClick={() => { setToday(indiaDate()); void query.refetch(); }}>{query.isFetching ? "Loading…" : "Refresh counts"}</Button>
    </div>
    <div className="my-4 flex flex-wrap gap-2" aria-label="Publication date range">
      {periods.map(([value, label]) => <Button key={value} size="sm" variant={period === value ? "default" : "outline"} aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</Button>)}
    </div>
    {period === "custom" && <div className="mb-3 flex flex-wrap gap-3">
      <label className="text-sm">From<Input type="date" aria-label="Publication start date" value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })} /></label>
      <label className="text-sm">To<Input type="date" aria-label="Publication end date" value={custom.end} onChange={(e) => setCustom({ ...custom, end: e.target.value })} /></label>
    </div>}
    <p className="mb-3 text-xs text-muted-foreground">{dates.start} to {dates.end}, inclusive. Counts use the publication date displayed on the site and the article byline, not the account that clicked Publish. Drafts and inactive articles are excluded.</p>
    {!bounds ? <p role="alert" className="text-sm text-destructive">Choose valid dates with the end date on or after the start date.</p> : query.isError ? <p role="alert" className="text-sm text-destructive">Counts could not be loaded. Use Refresh counts to retry.</p> : query.isPending ? <p role="status" className="text-sm">Loading publication counts…</p> : <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Published pages", total], ["English", english], ["Vernacular", total - english], ["Writers", groups.length]].map(([label, count]) => <div key={label} className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold tabular-nums">{count}</p></div>)}
      </div>
      {total === 0 ? <p className="text-sm text-muted-foreground">No published articles in this date range.</p> : <>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Published pages per writer. Select a writer to see their articles.</caption>
          <thead><tr className="border-b text-muted-foreground"><th className="p-2">Writer</th><th className="p-2">English</th><th className="p-2">Vernacular</th><th className="p-2">Total</th></tr></thead>
          <tbody>{groups.map((group) => <tr key={group.key} className={writer === group.key ? "border-b bg-primary/5" : "border-b"}><td className="p-2"><button className="text-left font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2" aria-pressed={writer === group.key} onClick={() => { setWriter(group.key); setPage(1); }}>{group.name}</button></td><td className="p-2 tabular-nums">{group.english}</td><td className="p-2 tabular-nums">{group.vernacular}</td><td className="p-2 font-semibold tabular-nums">{group.rows.length}</td></tr>)}</tbody>
        </table></div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{selected ? `${selected.name} · ${rows.length} articles` : `All writers · ${total} articles`}</h3>{selected && <Button size="sm" variant="ghost" onClick={() => { setWriter(null); setPage(1); }}>Show all writers</Button>}</div>
        <ul className="my-2 divide-y">{rows.slice((currentPage - 1) * 20, currentPage * 20).map((row) => <li key={row.id} className="py-3"><a className="break-words text-sm font-medium text-primary hover:underline" href={`${siteScope === "sarkari" ? "https://sarkari.dekhocampus.com/news" : "/news"}/${encodeURIComponent(row.slug)}`} target="_blank" rel="noopener noreferrer">{row.title}<span className="sr-only"> (opens in a new tab)</span></a><p className="mt-1 text-xs text-muted-foreground">{authors.find((author) => author.id === row.author_id)?.name || row.author || "Unassigned writer"} · {(row.language_code || "en").toUpperCase()} · <time dateTime={row.created_at}>{displayDate(row.created_at)} IST</time></p></li>)}</ul>
        {rows.length > 20 && <NumberedPagination page={currentPage} totalPages={Math.ceil(rows.length / 20)} onPageChange={setPage} />}
      </>}
    </>}
  </section>;
}
