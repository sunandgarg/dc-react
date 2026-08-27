import { useEffect, useRef, useState } from "react";
import { Check, GraduationCap, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { backendClient } from "@/integrations/backend/client";

type AdEntityPage = "colleges" | "courses" | "exams" | "articles";

const ENTITY_META: Record<AdEntityPage, { table: string; labelColumn: string; select: string }> = {
  colleges: { table: "colleges", labelColumn: "name", select: "slug,name,short_name,city,state,logo,image,is_active,status" },
  courses: { table: "courses", labelColumn: "name", select: "slug,name,category" },
  exams: { table: "exams", labelColumn: "name", select: "slug,name,category" },
  articles: { table: "articles", labelColumn: "title", select: "slug,title,category" },
};

interface EntityOption {
  slug: string;
  label: string;
  secondary: string;
  image?: string | null;
  status?: string | null;
  isActive?: boolean | null;
}

interface Props {
  page: AdEntityPage;
  value: string;
  onChange: (slug: string) => void;
  error?: string;
}

export function AdEntitySearchSelect({ page, value, onChange, error }: Props) {
  const meta = ENTITY_META[page];
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<EntityOption[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(value);

  useEffect(() => {
    setQuery("");
    setRows([]);
    setPageIndex(0);
    setSelectedLabel(value);
  }, [page, value]);

  useEffect(() => {
    setRows([]);
    setPageIndex(0);
  }, [query]);

  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    void (async () => {
      const { data } = await (backendClient as any)
        .from(meta.table)
        .select(page === "colleges" ? `slug,${meta.labelColumn},short_name,city,state,logo,is_active,status` : `slug,${meta.labelColumn}`)
        .eq("slug", value)
        .maybeSingle();
      if (!cancelled && data) setSelectedLabel(data.short_name || data[meta.labelColumn] || value);
    })();
    return () => { cancelled = true; };
  }, [meta.labelColumn, meta.table, value]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      let request = (backendClient as any)
        .from(meta.table)
        .select(meta.select)
        .order(meta.labelColumn, { ascending: true })
        .range(pageIndex * 100, pageIndex * 100 + 99);
      const term = query.trim().replace(/[(),]/g, " ").replace(/\s+/g, " ");
      if (term) request = request.or(`${meta.labelColumn}.ilike.%${term}%,slug.ilike.%${term}%`);
      let { data } = await request;
      if ((!data || data.length === 0) && term.includes(" ")) {
        const fallbackTerm = term
          .split(" ")
          .map((part) => part.trim())
          .filter((part) => part.length >= 3 && !["college", "university", "institute", "school", "of", "and", "the"].includes(part.toLowerCase()))
          .sort((a, b) => b.length - a.length)[0];
        if (fallbackTerm) {
          const fallback = await (backendClient as any)
            .from(meta.table)
            .select(meta.select)
            .or(`${meta.labelColumn}.ilike.%${fallbackTerm}%,slug.ilike.%${fallbackTerm}%`)
            .order(meta.labelColumn, { ascending: true })
            .range(0, 99);
          data = fallback.data;
        }
      }
      const next = ((data || []) as any[]).map((row) => ({
        slug: row.slug,
        label: row.short_name || row[meta.labelColumn] || row.slug,
        secondary: row.category || [row.city, row.state].filter(Boolean).join(", ") || row.slug,
        image: row.logo || row.image || null,
        status: row.status || null,
        isActive: typeof row.is_active === "boolean" ? row.is_active : null,
      }));
      setRows((current) => pageIndex === 0 ? next : [...current, ...next.filter((row) => !current.some((item) => item.slug === row.slug))]);
      setHasMore(next.length === 100);
      setLoading(false);
    }, query.trim() ? 220 : 0);
    return () => window.clearTimeout(timer);
  }, [meta, open, pageIndex, query]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      {value && (
        <div className="mb-2 flex items-center justify-between rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
          <span className="min-w-0 truncate font-semibold">{selectedLabel || value}</span>
          <button type="button" onClick={() => onChange("")} aria-label="Clear selected item" className="ml-2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          placeholder={`Search all ${page} by name or URL slug...`}
          className={`rounded-xl pl-10 pr-10 ${error ? "border-destructive" : ""}`}
          aria-label={`Search all ${page}`}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {open && (
        <div className="absolute z-[80] mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-2xl">
          {!loading && rows.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No matching {page} found.</p>
          ) : rows.map((row) => (
            <button
              key={row.slug}
              type="button"
              onClick={() => { onChange(row.slug); setSelectedLabel(row.label); setOpen(false); setQuery(""); }}
              className="flex w-full items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left last:border-0 hover:bg-muted/70"
            >
              {page === "colleges" && (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background">
                  {row.image ? (
                    <img src={row.image} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
                  ) : (
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{row.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.secondary} · {row.slug}
                  {page === "colleges" && row.status && ` · ${row.status}`}
                  {page === "colleges" && row.isActive === false && " · inactive"}
                </p>
              </div>
              {value === row.slug && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          ))}
          {!loading && hasMore && (
            <button type="button" onClick={() => setPageIndex((current) => current + 1)} className="sticky bottom-0 w-full border-t bg-card px-3 py-2.5 text-center text-xs font-semibold text-primary hover:bg-muted">
              Load 100 more {page}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
