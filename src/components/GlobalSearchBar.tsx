import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, BriefcaseBusiness, FileText, GraduationCap, Search, Sparkles, X } from "lucide-react";
import { backendClient } from "@/integrations/backend/client";
import { buildIlikeOr, buildSearchVariants, rankDirectoryResult } from "@/lib/fuzzySearch";
import { compactDisplayText, displayText } from "@/lib/displayText";

type DirectoryResult = {
  entity_type: "College" | "Course" | "Exam" | "Career";
  name: string;
  slug: string;
  subtitle: string;
  image_url: string;
  logo_url?: string;
  score?: number;
};

type GlobalSearchBarProps = {
  variant?: "header" | "hero";
  onAskAI?: (message?: string) => void;
};

const routeFor = (result: DirectoryResult) => {
  if (result.entity_type === "College") return `/colleges/${result.slug}`;
  if (result.entity_type === "Course") return `/courses/${result.slug}`;
  if (result.entity_type === "Exam") return `/exams/${result.slug}`;
  return `/careers/${result.slug}`;
};

const iconFor = (type: DirectoryResult["entity_type"]) => {
  if (type === "College") return GraduationCap;
  if (type === "Course") return BookOpen;
  if (type === "Exam") return FileText;
  return BriefcaseBusiness;
};

export function GlobalSearchBar({ variant = "header", onAskAI }: GlobalSearchBarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryResult[]>([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const normalizedQuery = query.trim().toLowerCase();
  const variants = useMemo(
    () => buildSearchVariants(normalizedQuery).slice(0, normalizedQuery.length <= 2 ? 5 : 8),
    [normalizedQuery],
  );
  const isHero = variant === "hero";

  useEffect(() => {
    const currentRequest = ++requestId.current;
    if (normalizedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const rpc = await (backendClient as any).rpc("search_directory_fast", {
          p_query: normalizedQuery,
          p_limit: 10,
        });

        if (!rpc.error && rpc.data?.length) {
          const rows = (rpc.data || []) as Array<{
            entity_type: string;
            name: string;
            slug: string;
            subtitle?: string;
            image_url?: string;
            logo_url?: string;
            score?: number;
          }>;
          const mapped = rows
            .filter((row) => ["College", "Course", "Exam", "Career"].includes(row.entity_type))
            .map((row) => ({
              entity_type: row.entity_type as DirectoryResult["entity_type"],
              name: compactDisplayText(row.name, `Untitled ${row.entity_type.toLowerCase()}`, 90),
              slug: row.slug,
              subtitle: compactDisplayText(row.subtitle || "", "", 60),
              image_url: row.logo_url || row.image_url || "",
              logo_url: row.logo_url || "",
              score: row.score,
            }))
            .sort((a, b) => rankDirectoryResult(query, b.name, b.subtitle) - rankDirectoryResult(query, a.name, a.subtitle));
          if (requestId.current === currentRequest) setResults(mapped);
          return;
        }

        const fallbackVariants = variants.slice(0, 3);
        const orFor = (column: string) => buildIlikeOr(column, fallbackVariants);
        const [colleges, courses, exams] = await Promise.all([
          backendClient
            .from("colleges")
            .select("name,short_name,slug,city,state,logo,image")
            .eq("is_active", true)
            .or([orFor("name"), orFor("short_name"), orFor("slug"), orFor("city"), orFor("state")].filter(Boolean).join(","))
            .limit(4),
          backendClient
            .from("courses")
            .select("name,full_name,slug,level,category,image")
            .eq("is_active", true)
            .or([orFor("name"), orFor("full_name"), orFor("slug")].join(","))
            .limit(4),
          backendClient
            .from("exams")
            .select("name,short_name,full_name,slug,logo,image,exam_type,category")
            .eq("is_active", true)
            .or([orFor("name"), orFor("short_name"), orFor("full_name"), orFor("slug")].join(","))
            .limit(3),
        ]);
        const fallback: DirectoryResult[] = [
          ...(colleges.data || []).map((row) => ({ entity_type: "College" as const, name: compactDisplayText(row.name, "Untitled college", 90), slug: row.slug, subtitle: compactDisplayText([row.short_name, row.city].filter(Boolean).join(" · "), "", 60), image_url: row.logo || "" })),
          ...(courses.data || []).map((row) => ({ entity_type: "Course" as const, name: compactDisplayText(row.name, "Untitled course", 90), slug: row.slug, subtitle: compactDisplayText(row.level || row.category || "Course", "", 60), image_url: row.image || "" })),
          ...(exams.data || []).map((row) => ({ entity_type: "Exam" as const, name: compactDisplayText(row.name, "Untitled exam", 90), slug: row.slug, subtitle: compactDisplayText(row.exam_type || row.category || "Exam", "", 60), image_url: row.logo || row.image || "" })),
        ].sort((a, b) => rankDirectoryResult(query, b.name, b.subtitle) - rankDirectoryResult(query, a.name, a.subtitle));
        if (requestId.current === currentRequest) setResults(fallback);
      } catch {
        if (requestId.current === currentRequest) setResults([]);
      } finally {
        if (requestId.current === currentRequest) setLoading(false);
      }
    }, normalizedQuery.length <= 2 ? 140 : 90);

    return () => window.clearTimeout(timer);
  }, [normalizedQuery, variants]);

  const askDiya = () => {
    const message = query.trim() || undefined;
    if (onAskAI) onAskAI(message);
    else window.dispatchEvent(new CustomEvent("dc:open-diya", { detail: { message } }));
    setQuery("");
    setFocused(false);
  };

  const choose = (result: DirectoryResult) => {
    setQuery("");
    setFocused(false);
    navigate(routeFor(result));
  };

  const showDropdown = focused && query.trim().length >= 2;

  return (
    <div className={`relative w-full ${isHero ? "max-w-2xl" : "mx-auto"}`}>
      <div className={`flex w-full items-center border bg-white transition focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 ${
        isHero
          ? "min-h-14 rounded-2xl border-border/70 px-2 shadow-[0_16px_45px_-24px_rgba(30,64,175,.45)]"
          : "min-h-11 rounded-2xl border-slate-200 px-3 shadow-[0_1px_3px_rgba(15,23,42,.04)]"
      }`}>
        <Search className={`shrink-0 text-slate-400 ${isHero ? "ml-1 h-5 w-5" : "h-4 w-4"}`} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 160)}
          placeholder="Search colleges, courses, exams and careers..."
          aria-label="Search the entire DekhoCampus website"
          className={`min-w-0 flex-1 border-0 bg-transparent text-foreground outline-none placeholder:text-slate-400 ${
            isHero ? "px-3 py-3 text-base" : "px-3 py-2.5 text-base md:text-[15px]"
          }`}
        />
        {query && (
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setQuery("")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        )}
        {isHero && (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={askDiya}
            className="ml-1 inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ask Diya</span>
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute inset-x-0 top-full z-[80] mt-2 overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
          <div className="max-h-[min(65vh,430px)] overflow-y-auto p-1.5">
            {loading && !results.length && <p className="px-3 py-5 text-center text-sm text-muted-foreground">Searching…</p>}
            {!loading && !results.length && (
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={askDiya}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-50">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></span>
                <span><strong className="block text-sm">Ask Diya about “{query.trim()}”</strong><span className="text-xs text-muted-foreground">No exact match found</span></span>
              </button>
            )}
            {results.map((result) => {
              const Icon = iconFor(result.entity_type);
              return (
                <button key={`${result.entity_type}-${result.slug}`} type="button"
                  onMouseDown={(event) => event.preventDefault()} onClick={() => choose(result)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-50">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-primary">
                    {result.image_url ? <img src={result.image_url} alt="" className="h-full w-full object-cover" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-foreground">{displayText(result.name, "Untitled")}</strong>
                    <span className="block truncate text-xs text-muted-foreground">{result.entity_type}{result.subtitle ? ` · ${displayText(result.subtitle)}` : ""}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
