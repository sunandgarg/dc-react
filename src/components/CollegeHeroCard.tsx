import { MapPin, Calendar, Shield, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApplyButton } from "@/components/ApplyButton";
import { YouTubeVideoButton } from "@/components/YouTubeVideoButton";
import { CompareToggleButton } from "@/components/CompareToggleButton";
import { FavoriteButton } from "@/components/FavoriteButton";
import { trackEvent } from "@/lib/analytics";

interface Props {
  college: any;
  onCounselling?: () => void;
  onCompare?: () => void;
}

/**
 * 2026 redesign - hero matches Exam detail layout:
 * image on top, logo floating, all meta + CTAs in a card BELOW the image.
 */
export function CollegeHeroCard({ college }: Props) {
  const hasImage = !!college.image;
  const tags: string[] = (college.tags || [])
    .filter((tag: string) => {
      const normalized = String(tag || "").toLowerCase();
      return normalized && !normalized.includes("legacy") && !normalized.includes("csv") && !normalized.includes("import");
    })
    .slice(0, 3);
  const heroBadgeClass = "border border-primary/20 bg-primary/10 text-primary hover:bg-primary/10 text-xs";
  const secondaryActionClass = "h-10 rounded-xl border-border bg-background text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-primary/5";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border overflow-hidden mb-0"
    >
      {/* Image */}
      <div className="relative">
        {hasImage ? (
          <img
            src={college.image}
            alt={`${college.name} campus`}
            width="1600"
            height="560"
            className="w-full h-48 md:h-56 object-cover object-center"
            loading="eager"
            decoding="async"
            {...{ fetchpriority: "high" }}
          />
        ) : (
          <div className="w-full h-48 md:h-56 bg-gradient-to-br from-slate-300 to-slate-500" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
        {college.logo && (
          <div className="absolute left-4 -bottom-6 md:left-6 md:-bottom-8 w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-card border border-border shadow-md p-1.5 flex items-center justify-center overflow-hidden">
            <img src={college.logo} alt={`${college.name} logo`} className="entity-logo-safe w-full h-full rounded-xl" />
          </div>
        )}
      </div>

      {/* Content below image */}
      <div className={`p-4 md:p-6 ${college.logo ? "pt-10 md:pt-12" : ""}`}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {tags.length > 0
            ? tags.map((t) => (
                <Badge key={t} variant="outline" className={heroBadgeClass}>{t}</Badge>
              ))
            : college.category && (
                <Badge variant="outline" className={heroBadgeClass}>{college.category}</Badge>
              )}
          {college.type && <Badge variant="outline" className={heroBadgeClass}>{college.type}</Badge>}
          {college.naac_grade && (
            <Badge variant="outline" className={heroBadgeClass}>NAAC {college.naac_grade}</Badge>
          )}
        </div>

        <h1 data-h className="text-xl md:text-2xl font-bold text-foreground mb-1">{college.name}</h1>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs md:text-sm text-muted-foreground mb-3">
          {college.location && (
            <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{college.location}</span>
          )}
          {college.established && (
            <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Estd. {college.established}</span>
          )}
          {college.naac_grade && (
            <span className="inline-flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" />NAAC {college.naac_grade}</span>
          )}
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2 flex-wrap">
          <ApplyButton
            collegeSlug={college.slug}
            collegeName={college.name}
            applyMode={(college as any).apply_cta_mode}
            applyUrl={(college as any).apply_url}
            className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            label="Apply Now"
          />
          {college.brochure_url && college.brochure_url !== "#" ? (
            <ApplyButton
              collegeSlug={college.slug}
              collegeName={college.name}
              variant="outline"
              className={`${secondaryActionClass} px-4`}
              label="Brochure"
              applyMode="lead_then_link"
              applyUrl={college.brochure_url}
            />
          ) : (
            <ApplyButton
              collegeSlug={college.slug}
              collegeName={college.name}
              variant="outline"
              className={`${secondaryActionClass} px-4`}
              label="Brochure"
            />
          )}
          {college.website && college.website !== "#" && (
            <a
              href={college.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { try { trackEvent("cta_click", { page: "college", cta: "Official Website", college_slug: college.slug }); } catch {} }}
            >
              <Button size="sm" variant="outline" className={secondaryActionClass}>
                <Globe className="w-3.5 h-3.5" />Official Website
              </Button>
            </a>
          )}
          <YouTubeVideoButton
            url={college.youtube_video_url}
            category="college"
            title={`${college.name} - Campus Tour`}
            label="Campus Tour"
            className="h-10 rounded-xl px-4 text-xs font-semibold"
          />
          <CompareToggleButton
            college={{
              slug: college.slug,
              name: college.name,
              short_name: college.short_name,
              image: college.image,
              city: college.city,
              state: college.state,
            }}
            className="h-10 rounded-xl text-xs"
          />
          <FavoriteButton collegeSlug={college.slug} variant="button" />
        </div>
      </div>
    </motion.div>
  );
}
