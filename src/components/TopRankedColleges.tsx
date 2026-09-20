import { ArrowRight, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
import { useFeaturedCollegeCards } from "@/hooks/useCollegesData";
import { useFeaturedColleges } from "@/hooks/useFeaturedColleges";
import { buildCollegeHref } from "@/lib/entityUrls";

const getDisplayName = (name: string) =>
  name
    .replace(/\s+Admission\s+-\s+\[[^\]]+\].*$/i, "")
    .replace(/\s+-\s+\[[^\]]+\].*$/i, "")
    .trim();

export function TopRankedColleges() {
  const { data: featuredSlugs } = useFeaturedColleges();
  const { data: featuredColleges, isLoading } = useFeaturedCollegeCards(featuredSlugs ?? []);
  const colleges = featuredColleges?.slice(0, 6) ?? [];

  if (!isLoading && colleges.length === 0) return null;

  return (
    <section className="bg-background py-7 md:py-9" aria-labelledby="top-colleges-heading">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-accent"><GraduationCap className="h-4 w-4" aria-hidden="true" />Featured</p>
          <h2 id="top-colleges-heading" className="mt-1 text-2xl font-black tracking-tight text-foreground md:text-3xl">Top colleges</h2>
        </div>
        <Link to="/colleges" className="flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-bold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          View all <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0" aria-label="Featured colleges">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-[164px] w-[250px] shrink-0 animate-pulse rounded-2xl bg-muted sm:h-[180px] sm:w-[288px]" aria-hidden="true" />)
          : colleges.map((college: any) => {
            const shortName = college.short_name || college.name;
            const displayName = getDisplayName(college.name || "");
            const showFullName = displayName && displayName.toLowerCase() !== shortName.trim().toLowerCase();
            return (
              <Link
                key={college.slug}
                to={buildCollegeHref(college)}
                className="group relative h-[164px] w-[250px] shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-muted shadow-sm transition hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-[180px] sm:w-[288px]"
              >
                {college.image ? (
                  <img src={college.image} alt="" width="540" height="340" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" decoding="async" />
                ) : (
                  <span className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary to-blue-950" aria-hidden="true" />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" aria-hidden="true" />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                  <span className="min-w-0">
                    <h3 className="truncate text-base font-extrabold text-white drop-shadow-sm">{shortName}</h3>
                    {showFullName && <span className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-3.5 text-white/85 drop-shadow-sm sm:text-[11px]">{displayName}</span>}
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/95 text-foreground shadow-sm transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </span>
              </Link>
            );
          })}
      </div>
    </section>
  );
}
