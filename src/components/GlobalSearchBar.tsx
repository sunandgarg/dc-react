import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Search, Sparkles, X } from "lucide-react";
import { displayText } from "@/lib/displayText";
import { searchDirectory, type DirectorySearchResult } from "@/lib/directorySearch";
import { SearchResultIcon } from "@/components/SearchResultIcon";

type GlobalSearchBarProps = {
  variant?: "header" | "hero";
  onAskAI?: (message?: string) => void;
};

const routeFor = (result: DirectorySearchResult) => {
  if (result.entity_type === "College") return `/colleges/${result.slug}`;
  if (result.entity_type === "Course") return `/courses/${result.slug}`;
  if (result.entity_type === "Exam") return `/exams/${result.slug}`;
  return `/careers/${result.slug}`;
};

export function GlobalSearchBar({ variant = "header", onAskAI }: GlobalSearchBarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectorySearchResult[]>([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const normalizedQuery = query.trim().toLowerCase();
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
        const nextResults = await searchDirectory(normalizedQuery, 10);
        if (requestId.current === currentRequest) setResults(nextResults);
      } catch {
        if (requestId.current === currentRequest) setResults([]);
      } finally {
        if (requestId.current === currentRequest) setLoading(false);
      }
    }, normalizedQuery.length <= 2 ? 90 : 55);

    return () => window.clearTimeout(timer);
  }, [normalizedQuery]);

  const askDiya = () => {
    const message = query.trim() || undefined;
    if (onAskAI) onAskAI(message);
    else window.dispatchEvent(new CustomEvent("dc:open-diya", { detail: { message } }));
    setQuery("");
    setFocused(false);
  };

  const choose = (result: DirectorySearchResult) => {
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
            {results.map((result) => (
                <button key={`${result.entity_type}-${result.slug}`} type="button"
                  onMouseDown={(event) => event.preventDefault()} onClick={() => choose(result)}
                  className="flex min-h-16 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50">
                  <SearchResultIcon
                    type={result.entity_type}
                    imageUrl={result.logo_url || result.image_url}
                    alt={`${displayText(result.name, result.entity_type)} logo`}
                  />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-foreground">{displayText(result.name, "Untitled")}</strong>
                    <span className="block truncate text-xs text-muted-foreground">{result.entity_type}{result.subtitle ? ` · ${displayText(result.subtitle)}` : ""}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
