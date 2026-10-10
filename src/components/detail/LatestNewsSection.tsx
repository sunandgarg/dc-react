import { Link } from "react-router-dom";
import { Calendar, ChevronRight, Newspaper } from "lucide-react";
import { useEntityNewsArticles } from "@/hooks/useArticlesData";
import { isArticlePublishedToday, LiveNewsBadge } from "@/components/LiveNewsBadge";

interface Props {
  entityName: string;
  entityType: "college" | "course" | "exam" | "career";
  entitySlug: string;
  sectionId?: string;
}

/**
 * "Latest News & Updates" - full grid layout, used at the bottom of detail pages.
 * Pulls articles linked via `article_links` for the given entity.
 */
export function LatestNewsSection({ entityName, entityType, entitySlug, sectionId = "latest-news" }: Props) {
  const { data: articles = [] } = useEntityNewsArticles({ entityName, entityType, entitySlug });
  const items = articles.slice(0, 2);

  if (!items.length) return null;

  return (
    <section id={sectionId} className="bg-card rounded-2xl border border-border p-5 scroll-mt-32">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-primary" />
          Latest News & Updates
        </h2>
        <Link to="/news" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
          Show more <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((a) => (
          <Link
            key={a.id}
            to={`/news/${a.slug}`}
            className="flex gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted transition group"
          >
            {a.featured_image && (
              <img src={a.featured_image} alt={a.title} loading="lazy" className="w-24 h-20 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              {a.category && <span className="text-[10px] uppercase tracking-wide text-primary font-semibold">{a.category}</span>}
              {isArticlePublishedToday(a.created_at) && <LiveNewsBadge className="ml-1 align-middle" />}
              <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary">{a.title}</h3>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                <Calendar className="w-3 h-3" />
                <span>{new Date(a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                {a.author && <span>• {a.author}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-4 flex justify-center">
        <Link to="/news" className="text-sm font-semibold text-primary hover:underline">View All News →</Link>
      </div>
    </section>
  );
}
