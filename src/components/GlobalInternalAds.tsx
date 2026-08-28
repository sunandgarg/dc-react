import { DynamicAdBanner } from "@/components/DynamicAdBanner";
import { useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

export interface InternalAdContext {
  page?: string;
  itemSlug?: string;
  isPublic: boolean;
}

const NON_ITEM_COLLEGE_PREFIX = "top-";

/** Maps every public route to the targeting vocabulary used by Admin > Internal Ads. */
export function getInternalAdContext(pathname: string): InternalAdContext {
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/target-dashboard") ||
    pathname.startsWith("/my-targets") ||
    pathname.startsWith("/target-with-ai") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/lp") ||
    pathname.startsWith("/landing/")
  ) {
    return { isPublic: false };
  }

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return { page: "home", isPublic: true };

  const [section, slug] = parts;
  if (["colleges", "courses", "exams"].includes(section)) {
    return {
      page: section,
      itemSlug: slug && !slug.startsWith(NON_ITEM_COLLEGE_PREFIX) ? slug : undefined,
      isPublic: true,
    };
  }
  if (section === "articles" || section === "news") {
    return {
      page: "articles",
      itemSlug: slug && slug !== "tag" ? slug : undefined,
      isPublic: true,
    };
  }
  if (section === "premium-programs") return { page: "premium_programs", itemSlug: slug, isPublic: true };
  if (section === "scholarships") return { page: "scholarships", itemSlug: slug, isPublic: true };
  if (["careers", "jobs", "vacancies"].includes(section)) return { page: "careers", itemSlug: slug, isPublic: true };
  if (section === "tools") return { page: "tools", itemSlug: slug, isPublic: true };
  const toolAliases: Record<string, string> = {
    "college-predictor": "college-predictor",
    "eligibility-checker": "eligibility-checker",
    "exam-calendar": "exam-calendar-2026",
    "exam-calendar-2026": "exam-calendar-2026",
    "lock-target": "lock-target",
    "achieve-target": "lock-target",
    roadmap: "lock-target",
    "dream-college-roadmap": "lock-target",
  };
  if (toolAliases[section]) return { page: "tools", itemSlug: slug || toolAliases[section], isPublic: true };
  if (["study-material", "resources", "college-study-material"].includes(section)) {
    return { page: "study_material", itemSlug: slug, isPublic: true };
  }
  if (section === "cat-universe") return { page: "cat_universe", itemSlug: slug, isPublic: true };

  // Public utility, legal, comparison and informational pages can still receive
  // universal ads even when they do not have a dedicated page targeting group.
  return { isPublic: true };
}

export function GlobalInternalAds({ area }: { area: "top" | "bottom" }) {
  const { pathname, search } = useLocation();
  const context = getInternalAdContext(pathname);
  const [topAnchor, setTopAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (area !== "top") return;
    setTopAnchor(document.getElementById("global-internal-ad-top-anchor"));
  }, [area, pathname]);

  if (!context.isPublic) return null;
  const selectedState = new URLSearchParams(search).get("state") || undefined;
  const selectedCity = new URLSearchParams(search).get("city") || undefined;

  if (area === "top") {
    if (!topAnchor) return null;
    return createPortal(
      <section aria-label="Sponsored content">
        <DynamicAdBanner position="leaderboard" page={context.page} itemSlug={context.itemSlug} state={selectedState} city={selectedCity} />
        <div className="container py-2 empty:hidden">
          <DynamicAdBanner position="top" page={context.page} itemSlug={context.itemSlug} state={selectedState} city={selectedCity} />
        </div>
      </section>,
      topAnchor,
    );
  }

  const hasEmbeddedMidPageSlot =
    pathname === "/" ||
    context.page === "articles" ||
    context.page === "cat_universe" ||
    (["colleges", "courses", "exams", "tools"].includes(context.page || "") && Boolean(context.itemSlug));

  return (
    <section className="container space-y-4 py-4 empty:hidden" aria-label="Sponsored content">
      {!hasEmbeddedMidPageSlot && <DynamicAdBanner position="mid-page" page={context.page} itemSlug={context.itemSlug} state={selectedState} city={selectedCity} />}
      <DynamicAdBanner position="bottom" page={context.page} itemSlug={context.itemSlug} state={selectedState} city={selectedCity} />
    </section>
  );
}
