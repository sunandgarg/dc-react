import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Globe2, Search, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { scoreArticleForEditor, type ArticleScoreCategory, type ArticleScoreInput, type ArticleScoreStatus } from "@/lib/articleScore";

type ScoreTab = "seo" | "aeo" | "geo";

type ArticleScorePanelProps = {
  article: ArticleScoreInput;
  faqs?: ArticleScoreInput["faqs"];
  faqsLoaded?: boolean;
};

const tabMeta: Record<ScoreTab, { label: string; description: string; icon: typeof Search }> = {
  seo: { label: "SEO", description: "Search fundamentals", icon: Search },
  aeo: { label: "AEO", description: "Direct-answer readiness", icon: ShieldCheck },
  geo: { label: "GEO", description: "AI-search citability", icon: Globe2 },
};

const statusMeta: Record<ArticleScoreStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  pass: { label: "Pass", icon: CheckCircle2, className: "text-emerald-700" },
  warn: { label: "Review", icon: AlertTriangle, className: "text-amber-700" },
  fail: { label: "Fix", icon: XCircle, className: "text-red-700" },
};

const scoreTone = (score: number) => score >= 85 ? "text-emerald-700" : score >= 65 ? "text-amber-700" : "text-red-700";
const categoryForTab = (report: ReturnType<typeof scoreArticleForEditor>, tab: ScoreTab): ArticleScoreCategory => report[tab];

export function ArticleScorePanel({ article, faqs, faqsLoaded = true }: ArticleScorePanelProps) {
  const [activeTab, setActiveTab] = useState<ScoreTab | null>(null);
  const report = useMemo(() => scoreArticleForEditor({ ...article, faqs, faqsLoaded }), [article, faqs, faqsLoaded]);
  const unresolved = [...report.seo.checks, ...report.aeo.checks, ...report.geo.checks].filter((check) => check.status !== "pass");
  const activeCategory = activeTab ? categoryForTab(report, activeTab) : null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-label="Article search preflight">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold">Search preflight</h3>
            <Badge variant={report.overall >= 85 ? "default" : "secondary"}>{report.overall}/100</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Live local checks for SEO, answer extraction, and generative-search clarity. Click a score to inspect every check; nothing is silently ignored.
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>{report.wordCount.toLocaleString()} visible words</div>
          <div>{unresolved.length ? `${unresolved.length} review item${unresolved.length === 1 ? "" : "s"}` : "All local checks pass"}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Article score categories">
        {(Object.keys(tabMeta) as ScoreTab[]).map((tab) => {
          const meta = tabMeta[tab];
          const category = report[tab];
          const Icon = meta.icon;
          const selected = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`article-score-${tab}`}
              onClick={() => setActiveTab(selected ? null : tab)}
              className={cn(
                "rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/50 hover:bg-muted/40",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" aria-hidden="true" />{meta.label}</span>
                <span className={cn("text-xl font-bold tabular-nums", scoreTone(category.score))}>{category.score}</span>
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">{meta.description}</span>
            </button>
          );
        })}
      </div>

      {activeTab && activeCategory && (
        <div id={`article-score-${activeTab}`} role="tabpanel" className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold">{tabMeta[activeTab].label} checks</h4>
              <p className="text-xs text-muted-foreground">Every rule contributes to this category score.</p>
            </div>
            <span className={cn("text-lg font-bold", scoreTone(activeCategory.score))}>{activeCategory.score}/100</span>
          </div>
          <div className="mt-3 space-y-2">
            {activeCategory.checks.map((check) => {
              const meta = statusMeta[check.status];
              const Icon = meta.icon;
              return (
                <details key={check.key} className="group rounded-md border border-border bg-background">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs [&::-webkit-details-marker]:hidden">
                    <Icon className={cn("h-4 w-4 shrink-0", meta.className)} aria-hidden="true" />
                    <span className="min-w-0 flex-1 font-medium">{check.label}</span>
                    <span className={cn("shrink-0 font-semibold", meta.className)}>{meta.label}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
                    <p>{check.detail}</p>
                    {check.status !== "pass" && check.fix && <p className="mt-1 font-medium text-foreground">Fix: {check.fix}</p>}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        This is an editorial preflight, not a Google ranking guarantee. It cannot see live Search Console, crawl/index status, Core Web Vitals, or third-party AI answers from this screen.
      </p>
    </section>
  );
}
