import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Landmark, ArrowRight, ShieldCheck, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { backendClient } from "@/integrations/backend/client";
import { buildCollegeHref } from "@/lib/entityUrls";
import type { DbCollege } from "@/hooks/useCollegesData";

interface Props {
  college: DbCollege;
}

function AffiliationLogo({
  logo,
  image,
  name,
  size = "child",
}: {
  logo?: string | null;
  image?: string | null;
  name: string;
  size?: "parent" | "child";
}) {
  const [src, setSrc] = useState(logo || image || "");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(logo || image || "");
    setFailed(false);
  }, [logo, image]);

  const isParent = size === "parent";
  const fallbackClass = isParent
    ? "w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-border"
    : "w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center border border-border shrink-0";

  if (!src || failed) {
    return (
      <div className={fallbackClass} aria-label={`${name} logo unavailable`}>
        <Landmark className={isParent ? "w-6 h-6 text-primary" : "w-4 h-4 text-primary"} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} logo`}
      className={
        isParent
          ? "w-12 h-12 rounded-xl object-contain bg-background border border-border p-1.5 shrink-0"
          : "entity-logo-safe w-8 h-8 rounded-md border border-border bg-background p-1 object-contain shrink-0"
      }
      loading="lazy"
      onError={() => {
        if (image && src !== image) {
          setSrc(image);
          return;
        }
        setFailed(true);
      }}
    />
  );
}

/**
 * Frontend display of the college ↔ university affiliation.
 *
 * Psychology (trust hierarchy):
 *  - Affiliated colleges gain authority by visibly stating their parent - we
 *    surface this prominently with a "Trusted by" framing (ShieldCheck) so it
 *    reads as a credential, not boilerplate.
 *  - Universities benefit from showing scale ("12 affiliated colleges") and
 *    let interested students hop into specific affiliated programs.
 *  - Standalone / unset colleges render nothing - no noise.
 */
export function CollegeAffiliationCard({ college }: Props) {
  const kind = college.affiliation_kind || "standalone";
  const parentSlug = college.parent_university_slug || null;

  // Affiliated → fetch parent
  const { data: parent } = useQuery({
    queryKey: ["college-parent-university", parentSlug],
    queryFn: async () => {
      if (!parentSlug) return null;
      const { data } = await backendClient
        .from("colleges")
        .select("slug, name, short_name, city, state, logo, image, naac_grade, type, short_id")
        .eq("slug", parentSlug)
        .maybeSingle();
      return data;
    },
    enabled: kind === "affiliated" && !!parentSlug,
    staleTime: 10 * 60 * 1000,
  });

  // University → fetch children
  const { data: children } = useQuery({
    queryKey: ["university-affiliated-colleges", college.slug],
    queryFn: async () => {
      const { data } = await backendClient
        .from("colleges")
        .select("slug, name, short_name, city, state, logo, image, short_id")
        .eq("parent_university_slug", college.slug)
        .eq("is_active", true)
        .order("name")
        .limit(24);
      return data || [];
    },
    enabled: kind === "university",
    staleTime: 10 * 60 * 1000,
  });

  if (kind === "standalone") return null;

  if (kind === "affiliated") {
    if (!parent) return null;
    return (
      <Link
        to={buildCollegeHref(parent as any)}
        className="group block bg-gradient-to-br from-primary/5 via-card to-card border border-primary/20 rounded-2xl p-4 hover:border-primary/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <AffiliationLogo
            logo={parent.logo}
            image={parent.image}
            name={parent.name}
            size="parent"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-primary font-semibold mb-0.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Affiliated to
            </div>
            <div className="text-sm md:text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
              {parent.name}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {[parent.city, parent.state].filter(Boolean).join(", ")}
              {parent.naac_grade ? ` · NAAC ${parent.naac_grade}` : ""}
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>
      </Link>
    );
  }

  // kind === "university"
  const list = children || [];
  if (list.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm md:text-base font-semibold text-foreground">
            Affiliated Colleges
          </h3>
          <Badge variant="secondary" className="text-[10px]">{list.length}</Badge>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {list.map((c) => (
          <Link
            key={c.slug}
            to={buildCollegeHref(c as any)}
            className="snap-start shrink-0 w-44 group rounded-xl border border-border p-3 hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <AffiliationLogo logo={c.logo} image={c.image} name={c.name} />
            </div>
            <div className="text-xs font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {c.short_name || c.name}
            </div>
            <div className="text-[10px] text-muted-foreground truncate mt-0.5">
              {[c.city, c.state].filter(Boolean).join(", ")}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
