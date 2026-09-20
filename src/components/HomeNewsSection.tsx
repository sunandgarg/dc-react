import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useArticleSidebarArticles } from "@/hooks/useArticlesData";

const topics = [
  { label: "JEE", pattern: /\bjee\b|\bjosaa\b/i },
  { label: "CAT", pattern: /\bcat\b/i },
  { label: "CLAT", pattern: /\bclat\b/i },
  { label: "CUET", pattern: /\bcuet\b/i },
] as const;

const NEWS_LIMIT = 5;

export function HomeNewsSection() {
  const { data: articles = [], isLoading } = useArticleSidebarArticles(60);
  const items = useMemo(() => {
    const curated = topics.flatMap((topic) => {
      const article = articles.find((item) => topic.pattern.test([item.title, item.category, ...(item.tags || [])].join(" ")));
      return article ? [{ topic: topic.label, article }] : [];
    });
    const selectedIds = new Set(curated.map(({ article }) => article.id));
    const recent = articles
      .filter((article) => !selectedIds.has(article.id))
      .slice(0, Math.max(0, NEWS_LIMIT - curated.length))
      .map((article) => ({ topic: article.category || "Update", article }));
    return [...curated, ...recent].slice(0, NEWS_LIMIT);
  }, [articles]);

  if (!isLoading && items.length === 0) return null;

  return (
    <section className="border-y border-border bg-muted/20 py-8" aria-labelledby="home-news-heading">
      <div className="container">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">News desk</p>
            <h2 id="home-news-heading" className="mt-1 text-xl font-black tracking-tight text-foreground md:text-2xl">Exam and admission updates</h2>
          </div>
          <Link to="/news" className="flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="View all education news">
            <span>All news</span><ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="Latest exam news">
          {isLoading
            ? Array.from({ length: NEWS_LIMIT }).map((_, index) => <div key={index} className="h-12 animate-pulse border-b border-border bg-muted/60 last:border-0" aria-hidden="true" />)
            : items.map(({ topic, article }) => (
              <Link
                key={article.id}
                to={`/news/${article.slug}`}
                className="group flex min-h-12 items-center gap-3 border-b border-border px-4 py-2.5 text-sm transition-colors last:border-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-red-600" aria-hidden="true" />
                <span className="w-16 shrink-0 text-[10px] font-black uppercase tracking-wide text-red-700 sm:w-20">{topic}</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-foreground transition-colors group-hover:text-primary">{article.title}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
              </Link>
            ))}
        </div>
      </div>
    </section>
  );
}
