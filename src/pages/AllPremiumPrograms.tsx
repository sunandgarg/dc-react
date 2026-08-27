import { useMemo, useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AlsoCheckSection } from "@/components/AlsoCheckSection";
import { SEO } from "@/components/SEO";
import { LeadGateDialog } from "@/components/LeadGateDialog";
import { ProgramCard } from "@/components/TrendingPrograms";
import { GraduationCap } from "lucide-react";
import { getProgramCategoryIcon } from "@/lib/programCategoryImages";

interface ProgramCategory { id: string; slug: string; name: string; icon_emoji: string; icon_url: string; }

export default function AllPremiumPrograms() {
  const [params, setParams] = useSearchParams();
  const initialCat = params.get("cat") || "all";
  const [activeCat, setActiveCat] = useState<string>(initialCat);
  const [showLead, setShowLead] = useState(false);

  useEffect(() => {
    if (activeCat === "all") { params.delete("cat"); setParams(params, { replace: true }); }
    else { params.set("cat", activeCat); setParams(params, { replace: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCat]);

  const { data: programs, isLoading } = useQuery({
    queryKey: ["all-promoted-programs"],
    queryFn: async () => {
      const { data, error } = await backendClient
        .from("promoted_programs").select("*").eq("is_active", true).order("display_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: categories } = useQuery({
    queryKey: ["program-categories-all"],
    queryFn: async (): Promise<ProgramCategory[]> => {
      const { data, error } = await (backendClient as any)
        .from("program_categories").select("id,slug,name,icon_emoji,icon_url")
        .eq("is_active", true).order("display_order");
      if (error) throw error;
      return (data || []) as ProgramCategory[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    if (!programs) return [] as any[];
    if (activeCat === "all") return programs as any[];
    return (programs as any[]).filter((p) =>
      p.category_slug === activeCat || (Array.isArray(p.category_slugs) && p.category_slugs.includes(activeCat)),
    );
  }, [programs, activeCat]);

  const cats = categories || [];

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Premium Programs from IIT, IIM & Top Institutes | DekhoCampus" description="Browse premium online programs from IIT, IIM and global universities. Exclusive prices, EMI options, and free counselling." />
      <Navbar />

      <section className="bg-gradient-to-br from-primary/10 via-background to-accent/10 border-b border-border">
        <div className="container py-10 md:py-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wide mb-3">
            <GraduationCap className="w-3.5 h-3.5" /> Premium Programs
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">All Premium Programs</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            100% <span className="text-primary font-semibold">online programs</span> from top-ranked institutes - <span className="text-primary font-semibold">learn</span> from <span className="text-primary font-semibold">anywhere</span>, at your own pace with exclusive <span className="text-primary font-bold">DekhoCampus</span> pricing.
          </p>
        </div>
      </section>

      <main className="container py-8">
        <AlsoCheckSection variant="strip" className="mb-6" />
        {/* Categories on top */}
        {cats.length > 0 && (
          <nav aria-label="Program categories" className="mb-8 -mx-1">
            <div className="flex items-start gap-7 md:gap-10 lg:justify-between overflow-x-auto scrollbar-hide pb-3 px-1">
              <Chip label="All" emoji="✨" active={activeCat === "all"} onClick={() => setActiveCat("all")} />
              {cats.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  emoji={c.icon_emoji}
                  iconUrl={c.icon_url}
                  artworkUrl={getProgramCategoryIcon(c.slug) || c.icon_url}
                  active={activeCat === c.slug}
                  onClick={() => setActiveCat(c.slug)}
                />
              ))}
            </div>
          </nav>
        )}

        {/* Cards below */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {isLoading && Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border h-[360px] animate-pulse" />
          ))}
          {!isLoading && filtered.length === 0 && (
            <div className="col-span-full text-center py-20 text-muted-foreground">
              <p className="text-lg font-semibold mb-2">No programs found in this category</p>
              <button onClick={() => setActiveCat("all")} className="text-primary underline">Show all programs</button>
            </div>
          )}
          {!isLoading && filtered.map((prog: any) => (
            <ProgramCard key={prog.id} prog={prog} onLead={() => setShowLead(true)} />
          ))}
        </div>

        {!isLoading && filtered.length > 0 && (
          <p className="text-center text-sm text-muted-foreground mt-8">
            Showing {filtered.length} program{filtered.length === 1 ? "" : "s"}{activeCat !== "all" ? ` in ${cats.find((c) => c.slug === activeCat)?.name || activeCat}` : ""}.
            {" "}<Link to="/" className="text-primary underline">Back to home</Link>
          </p>
        )}
      </main>

      <Footer />
      <LeadGateDialog open={showLead} onOpenChange={setShowLead} title="🎓 Get Program Details & Free Counseling" subtitle="Fill the form to download syllabus & get free counselling!" source="all_premium_programs" />
    </div>
  );
}

function Chip({ label, emoji, iconUrl, artworkUrl, active, onClick }: { label: string; emoji?: string; iconUrl?: string; artworkUrl?: string; active: boolean; onClick: () => void; }) {
  if (artworkUrl) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        aria-label={label}
        className={`group relative flex w-[112px] md:w-[132px] shrink-0 flex-col items-center gap-2 rounded-xl px-2 py-2 transition-all ${
          active
            ? "bg-primary/5 text-primary"
            : "text-foreground hover:bg-muted/60"
        }`}
      >
        <img src={artworkUrl} alt="" aria-hidden loading="lazy" className="h-10 w-10 md:h-11 md:w-11 object-contain" />
        <span className={`text-xs md:text-sm font-semibold leading-tight text-center whitespace-nowrap ${active ? "text-primary" : "text-foreground"}`}>
          {label}
        </span>
        {active && <span className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-primary" />}
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`group relative flex w-[112px] md:w-[132px] shrink-0 flex-col items-center gap-2 rounded-xl px-2 py-2 transition-all ${active ? "bg-primary/5" : "hover:bg-muted/60"}`}>
      <span className={`inline-flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-full text-xl md:text-2xl transition-all ${
        active ? "ring-2 ring-primary bg-white" : "bg-white border border-border group-hover:border-primary/50"
      }`}>
        {iconUrl ? (
          <img
            src={iconUrl}
            alt=""
            aria-hidden
            loading="lazy"
            className="w-8 h-8 md:w-9 md:h-9 object-contain"
          />
        ) : (
          <span aria-hidden>{emoji || "🎓"}</span>
        )}
      </span>
      <span className={`text-xs md:text-sm font-semibold whitespace-nowrap ${active ? "text-primary" : "text-foreground"}`}>{label}</span>
      {active && <span className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-primary" />}
    </button>
  );
}
