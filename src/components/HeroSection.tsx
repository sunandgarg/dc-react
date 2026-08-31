import { useState, useEffect, useMemo, useRef } from "react";
import {
  Send,
  Sparkles,
  Zap,
  MapPin,
  ArrowRight,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useHeroSettings } from "@/hooks/useHeroSettings";
import { useSiteIntegration, useSiteIntegrationEnabled } from "@/hooks/useSiteIntegration";
import dcLogo from "@/assets/dc-logo-small.webp";
import catCollege from "@/assets/hero-colleges-attached.png";
import catCourse from "@/assets/hero-courses-attached.png";
import catExam from "@/assets/hero-exams-attached.png";
import catApplication from "@/assets/hero-application-attached.png";
import catReviews from "@/assets/hero-reviews-attached.png";
import catNews from "@/assets/hero-news-attached.png";
import { HeroCounsellingCard } from "@/components/HeroCounsellingCard";
import { displayText } from "@/lib/displayText";
import { searchDirectory } from "@/lib/directorySearch";
import { SearchResultIcon } from "@/components/SearchResultIcon";

const YEAR = new Date().getFullYear();
const suggestedPrompts = [
  "Best colleges for B.Tech CSE?",
  `How to crack JEE Main ${YEAR}?`,
  "IIT vs NIT - what's right for me?",
  "Top MBA colleges after graduation?",
];

const heroTiles = [
  { label: "13,004+ Colleges", icon: catCollege, href: "/colleges", tone: "bg-rose-50 border-rose-100" },
  { label: "840+ Courses", icon: catCourse, href: "/courses", tone: "bg-sky-50 border-sky-100" },
  { label: "219+ Exams", icon: catExam, href: "/exams", tone: "bg-violet-50 border-violet-100" },
  { label: "Application Form", icon: catApplication, href: "/colleges", tone: "bg-emerald-50 border-emerald-100" },
  { label: "Review", icon: catReviews, href: "/news", tone: "bg-amber-50 border-amber-100" },
  { label: "News", icon: catNews, href: "/news", tone: "bg-cyan-50 border-cyan-100" },
] as const;

interface SearchResult {
  type: "College" | "Course" | "Exam" | "Career";
  name: string;
  location: string;
  slug: string;
  logo?: string;
  image?: string;
}

interface HeroSectionProps {
  onOpenChat?: (initialMessage?: string) => void;
}

export function HeroSection({ onOpenChat }: HeroSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [dbResults, setDbResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const requestId = useRef(0);
  const navigate = useNavigate();

  const [bgIndex, setBgIndex] = useState(0);
  const { data: heroSettings } = useHeroSettings();
  const { data: textGradientEnabled = true } = useSiteIntegrationEnabled("hero_text_gradient", true);
  const { data: textGradientValue = "0.72" } = useSiteIntegration("hero_text_gradient_strength");
  const textGradientStrength = Math.min(1, Math.max(0.1, Number(textGradientValue) || 0.72));
  const bgImages = useMemo(() => {
    return (heroSettings?.is_active && heroSettings.image_urls?.filter(Boolean)) || [];
  }, [heroSettings]);
  const rotationMs = (heroSettings?.rotation_seconds ?? 11) * 1000;

  // 2026 UX: ambient campus carousel - admin-configurable rotation, respects reduced-motion
  useEffect(() => {
    if (bgImages.length <= 1) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setBgIndex((i) => (i + 1) % bgImages.length), rotationMs);
    return () => clearInterval(id);
  }, [bgImages.length, rotationMs]);

  useEffect(() => {
    const q = searchQuery.trim();
    const currentRequest = ++requestId.current;
    if (!q || q.length < 2) {
      setDbResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const results = await searchDirectory(q, 10);
        if (requestId.current !== currentRequest) return;
        setDbResults(results.map((row) => ({
          type: row.entity_type,
          name: row.name,
          slug: row.slug,
          location: row.subtitle,
          image: row.image_url,
          logo: row.logo_url,
        })));
      } catch {
        /* skip */
      } finally {
        if (requestId.current === currentRequest) setIsSearching(false);
      }
    }, q.length <= 2 ? 90 : 55);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleAskAI = (e: React.FormEvent) => {
    e.preventDefault();
    if (onOpenChat) {
      onOpenChat(searchQuery.trim() || undefined);
      setSearchQuery("");
    }
  };

  const handleResultClick = (item: SearchResult) => {
    setSearchQuery("");
    setIsFocused(false);
    const route =
      item.type === "College" ? `/colleges/${item.slug}` :
      item.type === "Course"  ? `/courses/${item.slug}`  :
      item.type === "Exam" ? `/exams/${item.slug}` :
      `/careers/${item.slug}`;
    navigate(route);
  };

  const handleSuggestionClick = (prompt: string) => {
    if (onOpenChat) onOpenChat(prompt);
  };

  // Keep the menu open for a valid query even when the directory has no
  // matching record. That empty state is the hand-off to Ask Diya.
  const showDropdown = isFocused && searchQuery.trim().length >= 2;
  const rotatingWord = { label: "Path", className: "text-primary" } as const;
  return (
    <section
      className={`relative isolate overflow-visible bg-[linear-gradient(118deg,#fff7f1_0%,#f8fbff_48%,#eef5ff_100%)] ${showDropdown ? "z-[500]" : "z-0"}`}
      aria-label="Hero"
    >
      {/* Background - bold campus image at top, smoothly fading to background where search bar sits */}
      {bgImages.length > 0 && <div className="absolute inset-x-0 top-0 h-[58%] md:h-[62%] overflow-hidden" aria-hidden="true">
          <div
            key={bgIndex}
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${bgImages[bgIndex % bgImages.length]})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: heroSettings?.overlay_mode === "none" ? 1 : (heroSettings?.overlay_opacity ?? 0.45) + 0.4,
              filter: `blur(${heroSettings?.blur_px ?? 3}px) saturate(${heroSettings?.saturation ?? 1.05}) brightness(${heroSettings?.brightness ?? 1}) grayscale(${heroSettings?.grayscale ?? 0})`,
              transform: "scale(1.05)",
              WebkitMaskImage:
                "linear-gradient(to bottom, rgba(0,0,0,0.95) 35%, rgba(0,0,0,0.6) 75%, rgba(0,0,0,0) 100%)",
              maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.95) 35%, rgba(0,0,0,0.6) 75%, rgba(0,0,0,0) 100%)",
            }}
          />
        {/* Admin-configurable tint/overlay */}
        {heroSettings && heroSettings.overlay_mode !== "none" && (
          <div className="absolute inset-0 pointer-events-none" style={{
            background: heroSettings.overlay_mode === "gradient"
              ? `linear-gradient(180deg, ${heroSettings.tint_color}00 0%, ${heroSettings.tint_color}${Math.round(heroSettings.overlay_opacity * 255).toString(16).padStart(2,"0")} 100%)`
              : heroSettings.overlay_mode === "tint"
                ? `${heroSettings.tint_color}${Math.round(heroSettings.overlay_opacity * 255).toString(16).padStart(2,"0")}`
                : heroSettings.overlay_mode === "light"
                  ? `rgba(255,255,255,${heroSettings.overlay_opacity})`
                  : `rgba(0,0,0,${heroSettings.overlay_opacity})`,
          }} />
        )}
        {/* Crisp top + smooth fade to base background */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/35 to-background pointer-events-none" />
      </div>}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_22%_12%,hsl(var(--accent)/0.12),transparent_34%),radial-gradient(circle_at_82%_28%,hsl(var(--primary)/0.11),transparent_38%)]" />
        <div className="absolute -right-40 top-24 h-[520px] w-[520px] rounded-full border-[70px] border-primary/[0.035]" />
        <div className="absolute -left-52 top-28 h-[460px] w-[460px] rounded-full border-[60px] border-accent/[0.04]" />
      </div>

      <div className="container relative z-10 px-4 py-8 md:py-14 lg:py-16">
        {bgImages.length > 0 && textGradientEnabled && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-3 left-0 w-full md:w-[76%] lg:w-[68%]"
            style={{
              background: `radial-gradient(ellipse at 31% 38%, rgba(255,255,255,${textGradientStrength}) 0%, rgba(255,255,255,${textGradientStrength * 0.78}) 43%, rgba(255,255,255,0) 78%)`,
            }}
          />
        )}
        <div className="relative max-w-7xl mx-auto">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)] lg:gap-12">
            <div className="space-y-5 text-left md:space-y-6">
              {/* AI Badge + Built by IIT Delhi Alumni hero statement */}
              <div className="flex flex-col items-start justify-start gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/25">
              <img src={dcLogo} alt="DekhoCampus" className="w-4 h-4 object-contain" />
              <span className="text-[11px] md:text-xs font-bold tracking-[0.12em] uppercase text-accent">
                Built by IIT Delhi Alumni
              </span>
            </span>

              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground select-none flex-wrap" aria-label="AI-first guidance">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>AI-first guidance</span>
              </span>
          </div>

          {/* Primary promise */}
          <div>
            <h1
              className="max-w-5xl select-none text-[32px] font-black leading-[1.02] tracking-[-0.052em] text-foreground min-[360px]:text-[36px] min-[390px]:text-[40px] min-[412px]:text-[41px] min-[430px]:text-[44px] sm:text-[56px] sm:leading-[0.96] md:text-[68px] lg:text-[86px]"
              style={{ overflowWrap: "normal", wordBreak: "normal" }}
            >
              <span className="block whitespace-nowrap text-[#111827] sm:inline sm:whitespace-normal" style={{ overflowWrap: "normal", wordBreak: "normal" }}>
                Discover Your Ideal{" "}
              </span>
              <span
                className="relative inline-flex min-w-[3.5em] overflow-hidden align-baseline"
                style={{ overflowWrap: "normal", wordBreak: "normal" }}
              >
                <span
                  key={rotatingWord.label}
                  className={`absolute left-0 top-0 inline-block animate-dc-word-roll whitespace-nowrap ${rotatingWord.className}`}
                  style={{ overflowWrap: "normal", wordBreak: "normal" }}
                >
                  {rotatingWord.label}
                </span>
                <span className="invisible whitespace-nowrap">College</span>
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-sm font-medium leading-6 text-slate-600 sm:text-base md:text-lg md:leading-8">
              Search verified colleges, courses and exams, then move forward with clear guidance, transparent information and human support when you need it.
            </p>
          </div>

          {/* Unified Search Bar with AI icon */}
          <div className="relative z-[120] max-w-2xl">
            <form
              onSubmit={handleAskAI}
              toolname="search_dekhocampus"
              tooldescription="Search DekhoCampus for colleges, courses, exams, careers, or education guidance."
            >
              <div className="relative">
                <div
                  className={`relative flex items-center bg-card/90 backdrop-blur-xl rounded-full shadow-[0_10px_40px_-12px_hsl(var(--primary)/0.25)] border p-1.5 transition-all ${isFocused ? "border-primary/40 ring-2 ring-primary/10" : "border-border/60"}`}
                >
                  <div className="flex-shrink-0 w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center ml-1">
                    {searchQuery.trim() ? (
                      <Search className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <Search className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    name="query"
                    toolparamdescription="College, course, exam, career, or education question to search for."
                    placeholder="Search Colleges, Courses, Exams or Ask AI..."
                    className="flex-1 bg-transparent border-0 text-sm md:text-base placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 py-2.5 md:py-3 px-1 text-foreground min-w-0"
                    aria-label="Search or ask AI"
                  />
                  <Button
                    type="submit"
                    size="default"
                    className="rounded-full bg-accent hover:bg-accent/90 text-accent-foreground px-4 md:px-6 shadow-lg h-10 md:h-11 relative"
                    aria-label="Ask AI"
                  >
                    <Send className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline font-semibold text-sm">Ask AI</span>
                    <span className="absolute -top-1.5 -right-1.5 px-1.5 h-4 rounded-full bg-white border border-accent/30 text-[9px] text-accent font-bold flex items-center justify-center shadow-sm">
                      AI
                    </span>
                  </Button>
                </div>

                {/* Search Results Dropdown */}
                {showDropdown && (
                  <div className="absolute left-0 right-0 top-full z-[620] mt-2 max-h-[min(68vh,560px)] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card shadow-2xl">
                    <div className="divide-y divide-border/50">
                      {dbResults.map((item) => (
                        <button
                          key={`${item.type}-${item.slug}`}
                          onMouseDown={() => handleResultClick(item)}
                          className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                        >
                          <SearchResultIcon
                            type={item.type}
                            imageUrl={item.logo || item.image}
                            alt={`${displayText(item.name, item.type)} logo`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-foreground md:text-base">{displayText(item.name, "Untitled")}</p>
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground md:text-sm">
                              <span>{item.type}</span>
                              {item.location && (
                                <>
                                  <span>•</span>
                                  <MapPin className="w-3 h-3" />
                                  <span className="truncate">{displayText(item.location)}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                      ))}
                      {isSearching && !dbResults.length && (
                        <div className="flex min-h-[72px] items-center px-4 py-3 text-sm text-muted-foreground">Searching...</div>
                      )}
                      {!isSearching && !dbResults.length && (
                        <button
                          type="button"
                          onMouseDown={handleAskAI as any}
                          className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Sparkles className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground md:text-base">Ask Diya about “{searchQuery.trim()}”</p>
                            <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">No exact match found</p>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                    {/* Ask AI option at bottom */}
                    {dbResults.length > 0 && <div className="sticky bottom-0 border-t border-border bg-card px-4 py-3">
                      <button
                        onMouseDown={handleAskAI as any}
                        className="flex min-h-12 w-full items-center gap-3 text-left transition-opacity hover:opacity-80"
                      >
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-accent text-sm">Ask AI Counselor</p>
                          <p className="text-xs text-muted-foreground">Get personalized guidance for "{searchQuery}"</p>
                        </div>
                      </button>
                    </div>}
                  </div>
                )}
              </div>
            </form>

            {/* Prompt chips */}
            <div className="mt-3 flex flex-wrap items-center justify-start gap-1.5 md:gap-2">
              <Zap className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs text-muted-foreground font-medium">Try:</span>
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSuggestionClick(prompt)}
                  className="px-2.5 py-1 text-[11px] md:text-xs bg-card border border-border/60 rounded-full text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  {prompt}
                </button>
              ))}
              </div>

          <div className="mt-5 flex w-full min-w-0 max-w-full snap-x gap-3 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:max-w-4xl sm:grid-cols-6 sm:gap-2 sm:overflow-visible sm:pb-0 sm:[scrollbar-width:auto] md:gap-3">
            {heroTiles.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                className={`group flex min-h-[92px] w-[132px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-2xl border ${item.tone} px-2 py-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:w-auto sm:shrink md:min-h-[112px] md:gap-2.5`}
              >
                <img src={item.icon} alt="" loading="eager" decoding="async" width={44} height={44} className="h-8 w-8 object-contain transition-transform group-hover:scale-105 md:h-11 md:w-11" />
                <span className="max-w-[86px] text-[11px] font-extrabold leading-tight text-foreground md:text-xs">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

            </div>

            <HeroCounsellingCard onStart={(message) => handleSuggestionClick(message)} />
          </div>

        </div>
      </div>
    </section>
  );
}
