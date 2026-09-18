import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getInternalAdContext } from "@/components/GlobalInternalAds";
import { type Ad, useMatchingAds } from "@/hooks/useAds";
import { useSiteIntegration } from "@/hooks/useSiteIntegration";

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

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(ads.length - 1, 0)));
  }, [ads.length]);

  useEffect(() => {
    if (paused || ads.length < 2) return;
    const timer = window.setInterval(
      () => setActiveIndex((index) => (index + 1) % ads.length),
      rotationSeconds * 1000,
    );
    return () => window.clearInterval(timer);
  }, [ads.length, paused, rotationSeconds]);

  if (!context.isPublic || isLoading) return null;
  const activeAd = ads[activeIndex] || ads[0];
  const external = /^https?:\/\//i.test(activeAd.link_url) && !activeAd.link_url.includes("dekhocampus.com");
  const internalHref = activeAd.link_url.replace(/^https?:\/\/(?:www\.)?dekhocampus\.com/i, "") || "/";
  const ctaClassName = "shrink-0 bg-red-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-red-700 sm:px-4 sm:text-sm";
  const move = (direction: number) => {
    setActiveIndex((index) => (index + direction + ads.length) % ads.length);
  };
  return (
    <section
      className="relative z-[72] h-11 min-h-11 border-b border-neutral-800 bg-black text-white"
      aria-label="Featured announcements"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="container flex h-11 min-h-11 items-center gap-2 px-3 py-1 sm:gap-3">
        {ads.length > 1 && (
          <button
            type="button"
            onClick={() => move(-1)}
            className="flex h-7 w-7 shrink-0 items-center justify-center text-white/70 transition hover:text-white sm:h-8 sm:w-8"
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
                  <p className="hidden truncate text-xs text-white/65 md:block">{activeAd.subtitle}</p>
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
            className="flex h-7 w-7 shrink-0 items-center justify-center text-white/70 transition hover:text-white sm:h-8 sm:w-8"
            aria-label="Next announcement"
            title="Next announcement"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </section>
  );
}
