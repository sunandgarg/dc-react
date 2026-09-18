import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getInternalAdContext } from "@/components/GlobalInternalAds";
import { useMatchingAds } from "@/hooks/useAds";
import { useSiteIntegration } from "@/hooks/useSiteIntegration";

export function AnnouncementBar() {
  const reduceMotion = useReducedMotion();
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
  const ads = configuredAds;
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

  if (!context.isPublic || isLoading || ads.length === 0) return null;
  const activeAd = ads[activeIndex] || ads[0];
  const external = /^https?:\/\//i.test(activeAd.link_url) && !activeAd.link_url.includes("dekhocampus.com");
  const internalHref = activeAd.link_url.replace(/^https?:\/\/(?:www\.)?dekhocampus\.com/i, "") || "/";
  const ctaText = activeAd.cta_text?.trim();
  const ctaClassName = ctaText
    ? "shrink-0 bg-red-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-red-700 sm:px-4 sm:text-sm"
    : "flex h-8 w-8 shrink-0 items-center justify-center text-red-500 transition hover:translate-x-0.5 hover:text-red-400";
  const ctaContent = ctaText || <ArrowRight className="h-5 w-5" aria-hidden="true" />;
  return (
    <section
      className="relative z-[72] h-11 min-h-11 border-b border-neutral-800 bg-black text-white"
      aria-label="Featured announcements"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="container flex h-11 min-h-11 items-center px-3 py-1">
        <div className="min-w-0 flex-1 overflow-hidden text-center" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeAd.id}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -18 }}
              transition={{ duration: reduceMotion ? 0.12 : 0.32, ease: "easeOut" }}
              className="flex min-w-0 items-center justify-center gap-2 sm:gap-3"
            >
              <div className="min-w-0">
                <AnimatedWords text={activeAd.title} reduceMotion={Boolean(reduceMotion)} />
                {activeAd.subtitle && (
                  <p className="hidden truncate text-xs text-white/65 md:block">{activeAd.subtitle}</p>
                )}
              </div>
              {external ? (
                <a href={activeAd.link_url} target="_blank" rel="noopener noreferrer" className={ctaClassName} aria-label={ctaText || `Open ${activeAd.title}`}>
                  {ctaContent}
                </a>
              ) : (
                <Link to={internalHref} className={ctaClassName} aria-label={ctaText || `Open ${activeAd.title}`}>
                  {ctaContent}
                </Link>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function AnimatedWords({ text, reduceMotion }: { text: string; reduceMotion: boolean }) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (reduceMotion || words.length === 0) {
    return <p className="truncate text-sm font-extrabold sm:text-base">{text}</p>;
  }

  return (
    <p className="truncate text-sm font-extrabold sm:text-base" aria-label={text}>
      <motion.span
        aria-hidden="true"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { delayChildren: 0.06, staggerChildren: Math.min(0.055, 0.42 / words.length) } },
        }}
      >
        {words.map((word, index) => (
          <motion.span
            key={`${word}-${index}`}
            className="inline-block"
            variants={{ hidden: { opacity: 0, x: 12 }, visible: { opacity: 1, x: 0 } }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {word}{index < words.length - 1 ? "\u00a0" : ""}
          </motion.span>
        ))}
      </motion.span>
    </p>
  );
}
