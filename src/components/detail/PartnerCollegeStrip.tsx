import { Link } from "react-router-dom";
import { Building2, MapPin, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildCollegeHref } from "@/lib/entityUrls";
import { usePartnerColleges, type DbCollege } from "@/hooks/useCollegesData";

interface PartnerCollegeStripProps {
  title?: string;
  subtitle?: string;
  excludeSlug?: string;
  limit?: number;
  compact?: boolean;
  frame?: boolean;
}

function partnerCollegeLocation(college: DbCollege) {
  return [college.city, college.state].filter(Boolean).join(", ") || college.location || "India";
}

export function PartnerCollegeStrip({
  title = "Partner Colleges",
  subtitle = "DekhoCampus partner colleges you can explore or apply to next.",
  excludeSlug,
  limit = 6,
  compact = false,
  frame = false,
}: PartnerCollegeStripProps) {
  const { data: colleges = [], isLoading } = usePartnerColleges(limit, excludeSlug);

  if (isLoading) {
    return (
      <div className={compact ? "space-y-2" : "grid sm:grid-cols-2 gap-2"}>
        {[0, 1, 2, 3].map((index) => <div key={index} className="h-14 rounded-xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  if (!colleges.length) return null;

  if (compact) {
    return (
      <div className="bg-card rounded-2xl border border-border p-4">
        <h3 data-h className="text-sm font-bold text-foreground mb-3">{title}</h3>
        <div className="space-y-2">
          {colleges.slice(0, limit).map((college) => (
            <Link key={college.slug} to={buildCollegeHref(college)} className="block border-b border-border py-1 text-xs text-primary hover:underline last:border-0">
              {college.short_name || college.name}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={frame ? "rounded-2xl border border-border bg-card p-4 md:p-5" : undefined}>
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 data-h className="text-base font-bold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Link to="/colleges?partner=true">
          <Button variant="outline" size="sm" className="rounded-xl text-xs">View partner colleges</Button>
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {colleges.slice(0, limit).map((college) => (
          <Link
            key={college.slug}
            to={buildCollegeHref(college)}
            className="group flex min-w-0 items-center gap-3 rounded-xl border border-transparent bg-muted p-2.5 transition-colors hover:border-primary/30 hover:bg-primary/5"
          >
            {(college.logo || college.image) ? (
              <img
                src={college.logo || college.image}
                alt={`${college.name} logo`}
                className="h-11 w-11 flex-none rounded-lg border border-border bg-card object-contain p-1"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex h-11 w-11 flex-none items-center justify-center rounded-lg border border-border bg-card text-primary">
                <Building2 className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{college.short_name || college.name}</div>
              <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3 flex-none" />
                <span className="truncate">{partnerCollegeLocation(college)}</span>
              </div>
            </div>
            <div className="flex flex-none flex-col items-end gap-1">
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[10px] text-emerald-700">Partner</Badge>
              {Number(college.rating || 0) > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-foreground">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {Number(college.rating).toFixed(1)}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
