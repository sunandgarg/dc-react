import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useArticleSidebarArticles } from "@/hooks/useArticlesData";
import { isArticlePublishedToday, LiveNewsBadge } from "@/components/LiveNewsBadge";

const NEWS_LIMIT = 6;

export function HomeNewsSection() {
  const { data: articles = [], isLoading } = useArticleSidebarArticles(60);
  const items = useMemo(() => {
    return articles
      .slice(0, NEWS_LIMIT);
  }, [articles]);

  if (!isLoading && items.length === 0) return null;

  return (
    <section className="border-y border-border bg-muted/20 py-6 sm:py-8" aria-labelledby="home-news-heading">
      <div className="container">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">News desk</p>
            <h2 id="home-news-heading" className="mt-1 text-lg font-black leading-tight tracking-tight text-foreground sm:text-xl md:text-2xl">Exam and admission updates</h2>
          </div>
          <Link to="/news" className="flex min-h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-1.5 text-xs font-bold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-2" aria-label="View all education news">
            <span>All news</span><ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="Latest exam news">
          {isLoading
            ? Array.from({ length: NEWS_LIMIT }).map((_, index) => <div key={index} className="h-12 animate-pulse border-b border-border bg-muted/60 last:border-0" aria-hidden="true" />)
            : items.map((article) => (
              <Link
                key={article.id}
                to={`/news/${article.slug}`}
                className="group flex min-h-12 items-center gap-2 border-b border-border px-3 py-2.5 text-sm transition-colors last:border-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:gap-3 sm:px-4"
              >
                {isArticlePublishedToday(article.created_at) && <LiveNewsBadge intensity="low" className="shrink-0" />}
                <span className="min-w-0 flex-1 truncate font-semibold text-foreground transition-colors group-hover:text-primary" title={article.title}>{article.title}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
              </Link>
            ))}
        </div>
      </div>
    </section>
  );
}
