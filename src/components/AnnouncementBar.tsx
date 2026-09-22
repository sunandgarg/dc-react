import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getInternalAdContext } from "@/components/GlobalInternalAds";
import { useMatchingAds } from "@/hooks/useAds";
import { useSiteIntegration } from "@/hooks/useSiteIntegration";
import {
  circularAnnouncementIndex,
  normalizeAnnouncementRotation,
} from "@/lib/announcementRotation";

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
  const { data: rotationValue } = useSiteIntegration("announcement_rotation_seconds");
  const rotationSeconds = normalizeAnnouncementRotation(rotationValue);
  const transitionDuration = reduceMotion
    ? Math.min(0.08, rotationSeconds * 0.4)
    : Math.min(0.32, Math.max(0.04, rotationSeconds * 0.15));
  const ads = configuredAds;
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  const [timerRevision, setTimerRevision] = useState(0);
  const draggedRef = useRef(false);

  const move = useCallback((delta: number) => {
    if (ads.length < 2) return;
    setDirection(delta >= 0 ? 1 : -1);
    setActiveIndex((index) => circularAnnouncementIndex(index, delta, ads.length));
    setTimerRevision((revision) => revision + 1);
  }, [ads.length]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(ads.length - 1, 0)));
  }, [ads.length]);

  useEffect(() => {
    if (paused || ads.length < 2) return;
    const timer = window.setInterval(
      () => {
        setDirection(1);
        setActiveIndex((index) => circularAnnouncementIndex(index, 1, ads.length));
      },
      rotationSeconds * 1000,
    );
    return () => window.clearInterval(timer);
  }, [ads.length, paused, rotationSeconds, timerRevision]);

  if (!context.isPublic || isLoading || ads.length === 0) return null;
  const activeAd = ads[activeIndex] || ads[0];
  const external = /^https?:\/\//i.test(activeAd.link_url) && !activeAd.link_url.includes("dekhocampus.com");
  const internalHref = activeAd.link_url.replace(/^https?:\/\/(?:www\.)?dekhocampus\.com/i, "") || "/";
  const ctaText = activeAd.cta_text?.trim();
  const ctaClassName = ctaText
    ? "shrink-0 bg-red-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-red-700 sm:px-4 sm:text-sm"
    : "flex h-8 w-8 shrink-0 items-center justify-center text-red-500 transition hover:translate-x-0.5 hover:text-red-400";
  const ctaContent = ctaText || <ArrowRight className="h-5 w-5" aria-hidden="true" />;
  const announcementContent = (
    <motion.div
      key={activeAd.id}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * -18 }}
      transition={{ duration: transitionDuration, ease: "easeOut" }}
      drag={ads.length > 1 ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.18}
      dragMomentum={false}
      onDragStart={() => { draggedRef.current = true; }}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) >= 44 || Math.abs(info.velocity.x) >= 450) {
          move(info.offset.x < 0 ? 1 : -1);
        }
        window.setTimeout(() => { draggedRef.current = false; }, 150);
      }}
      onClick={(event) => {
        if (!draggedRef.current) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      whileDrag={{ cursor: "grabbing" }}
      className="flex min-w-0 touch-pan-y select-none items-center justify-center gap-2 cursor-grab sm:gap-3"
    >
      <div className="min-w-0">
        <AnimatedWords text={activeAd.title} reduceMotion={Boolean(reduceMotion) || rotationSeconds < 1} />
        {activeAd.subtitle && (
          <p className="hidden truncate text-xs text-white/65 md:block">{activeAd.subtitle}</p>
        )}
      </div>
      <span className={ctaClassName} aria-hidden={!ctaText}>
        {ctaContent}
      </span>
    </motion.div>
  );
  return (
    <section
      className="relative z-[72] h-11 min-h-11 border-b border-neutral-800 bg-black text-white"
      aria-label="Featured announcements"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {external ? (
        <a href={activeAd.link_url} target="_blank" rel="noopener noreferrer" className="block h-11 min-h-11 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400" aria-label={`Open ${activeAd.title}`}>
          <div className="container flex h-11 min-h-11 items-center px-3 py-1">
            <div className="min-w-0 flex-1 overflow-hidden text-center" aria-live="polite" aria-roledescription="carousel">
              <AnimatePresence mode="wait" initial={false}>{announcementContent}</AnimatePresence>
            </div>
          </div>
        </a>
      ) : (
        <Link to={internalHref} className="block h-11 min-h-11 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400" aria-label={`Open ${activeAd.title}`}>
          <div className="container flex h-11 min-h-11 items-center px-3 py-1">
            <div className="min-w-0 flex-1 overflow-hidden text-center" aria-live="polite" aria-roledescription="carousel">
              <AnimatePresence mode="wait" initial={false}>{announcementContent}</AnimatePresence>
            </div>
          </div>
        </Link>
      )}
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
