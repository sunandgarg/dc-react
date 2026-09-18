import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getInternalAdContext } from "@/components/GlobalInternalAds";
import { type Ad, useMatchingAds } from "@/hooks/useAds";
import { useSiteIntegration } from "@/hooks/useSiteIntegration";

const DISMISSED_KEY = "dc-announcement-bar-dismissed";
const DEFAULT_ANNOUNCEMENT: Ad = {
  id: "default-admissions-announcement",
  title: "Admissions are open: compare colleges, courses and upcoming exams",
  subtitle: "Shortlist verified options and plan your next application.",
  cta_text: "Explore Now",
  link_url: "/colleges",
  image_url: null,
  variant: "announcement",
  bg_gradient: "from-amber-500 to-orange-500",
  target_type: "universal",
  target_page: null,
  target_item_slug: null,
  target_city: null,
  target_state: null,
  position: "announcement-bar",
  priority: 0,
  is_active: true,
};

export function AnnouncementBar() {
  const { pathname, search } = useLocation();
  const context = getInternalAdContext(pathname);
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const { data: configuredAds = [], isLoading } = useMatchingAds({
    page: context.page,
    itemSlug: context.itemSlug,
    state: params.get("state") || undefined,
    city: params.get("city") || undefined,
    position: "announcement-bar",
    variant: "announcement",
  });
  const { data: rotationValue = "10" } = useSiteIntegration("announcement_rotation_seconds");
  const rotationSeconds = Math.min(60, Math.max(5, Number(rotationValue) || 10));
  const ads = configuredAds.length ? configuredAds : [DEFAULT_ANNOUNCEMENT];
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(DISMISSED_KEY) === "1";
  });

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(ads.length - 1, 0)));
  }, [ads.length]);

  useEffect(() => {
    if (paused || dismissed || ads.length < 2) return;
    const timer = window.setInterval(
      () => setActiveIndex((index) => (index + 1) % ads.length),
      rotationSeconds * 1000,
    );
    return () => window.clearInterval(timer);
  }, [ads.length, dismissed, paused, rotationSeconds]);

  if (!context.isPublic || dismissed || isLoading) return null;
  const activeAd = ads[activeIndex] || ads[0];
  const external = /^https?:\/\//i.test(activeAd.link_url) && !activeAd.link_url.includes("dekhocampus.com");
  const internalHref = activeAd.link_url.replace(/^https?:\/\/(?:www\.)?dekhocampus\.com/i, "") || "/";
  const ctaClassName = "shrink-0 bg-red-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-red-700 sm:px-4 sm:text-sm";
  const move = (direction: number) => {
    setActiveIndex((index) => (index + direction + ads.length) % ads.length);
  };
  const dismiss = () => {
    window.sessionStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  return (
    <section
      className="relative min-h-12 border-b border-orange-200 bg-orange-50 text-foreground"
      aria-label="Featured announcements"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="absolute inset-x-0 top-0 flex h-1" aria-hidden="true">
        <span className="flex-1 bg-orange-500" />
        <span className="w-1/4 bg-blue-600" />
        <span className="w-1/5 bg-red-500" />
      </div>
      <div className="container flex min-h-12 items-center gap-2 py-2 pl-3 pr-10 sm:gap-3">
        {ads.length > 1 && (
          <button
            type="button"
            onClick={() => move(-1)}
            className="flex h-7 w-7 shrink-0 items-center justify-center text-blue-700 transition hover:text-blue-900 sm:h-8 sm:w-8"
            aria-label="Previous announcement"
            title="Previous announcement"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        <div className="min-w-0 flex-1 overflow-hidden text-center" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeAd.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="flex min-w-0 items-center justify-center gap-2 sm:gap-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold sm:text-base">{activeAd.title}</p>
                {activeAd.subtitle && (
                  <p className="hidden truncate text-xs text-slate-600 md:block">{activeAd.subtitle}</p>
                )}
              </div>
              {external ? (
                <a href={activeAd.link_url} target="_blank" rel="noopener noreferrer" className={ctaClassName}>
                  {activeAd.cta_text || "Apply Now"}
                </a>
              ) : (
                <Link to={internalHref} className={ctaClassName}>
                  {activeAd.cta_text || "Apply Now"}
                </Link>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {ads.length > 1 && (
          <button
            type="button"
            onClick={() => move(1)}
            className="flex h-7 w-7 shrink-0 items-center justify-center text-blue-700 transition hover:text-blue-900 sm:h-8 sm:w-8"
            aria-label="Next announcement"
            title="Next announcement"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-slate-500 transition hover:text-foreground"
        aria-label="Close announcements"
        title="Close announcements"
      >
        <X className="h-4 w-4" />
      </button>
    </section>
  );
}
