import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface ScrollSection {
  id: string;
  label: string;
}

interface ScrollSpyProps {
  sections: ScrollSection[];
  className?: string;
  baseUrl?: string;
  updateUrlOnScroll?: boolean;
}

export function ScrollSpy({ sections, className, baseUrl, updateUrlOnScroll = false }: ScrollSpyProps) {
  const { tab } = useParams<{ tab?: string }>();
  const initialTab = tab || sections[0]?.id || "";
  const [activeId, setActiveId] = useState(initialTab);
  const [headerHeight, setHeaderHeight] = useState(56);
  const navRef = useRef<HTMLElement>(null);
  const activeIdRef = useRef(initialTab);
  const lastRouteTabRef = useRef<string | undefined>(tab);
  const initialScrollPendingRef = useRef<string | null>(tab || null);
  const sectionsKey = sections.map(({ id }) => id).join("|");

  useEffect(() => {
    const header = document.getElementById("site-header");
    if (!header) return;
    const measure = () => setHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(header);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const scrollOffset = useCallback(() =>
    (document.getElementById("site-header")?.getBoundingClientRect().height || headerHeight)
    + (navRef.current?.getBoundingClientRect().height || 52) + 12, [headerHeight]);

  const updateUrl = useCallback((id: string) => {
    if (!baseUrl || !id) return;
    const target = `${baseUrl}/${id}`;
    if (window.location.pathname !== target) {
      window.history.replaceState(null, "", target);
    }
  }, [baseUrl]);

  // `sections` is often rebuilt by the detail page while its data loads. Only
  // honour a real route change here; resetting on every rebuilt array made the
  // active tab jump back to Overview during normal scrolling.
  useEffect(() => {
    if (tab === lastRouteTabRef.current) return;
    lastRouteTabRef.current = tab;
    const nextId = tab || sections[0]?.id || "";
    activeIdRef.current = nextId;
    setActiveId(nextId);
  }, [tab, sectionsKey, sections]);

  // Scroll to the initial tab route ONCE on mount, with header-safe offset.
  // Cancel if the user starts scrolling before the timer fires, otherwise the
  // delayed programmatic scroll yanks the page back and feels like "scroll
  // jumps up" on detail pages.
  useEffect(() => {
    const initial = tab;
    if (!initial) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => {
      cancelled = true;
      initialScrollPendingRef.current = null;
    };
    window.addEventListener("wheel", cancel, { passive: true, once: true });
    window.addEventListener("touchstart", cancel, { passive: true, once: true });
    window.addEventListener("keydown", cancel, { once: true });
    const startedAt = Date.now();
    const scrollWhenReady = () => {
      if (cancelled) return;
      const el = document.getElementById(initial);
      if (el) {
        const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - scrollOffset());
        window.scrollTo({ top: y, behavior: "smooth" });
      } else if (Date.now() - startedAt < 4000) {
        retryTimer = setTimeout(scrollWhenReady, 100);
      } else {
        initialScrollPendingRef.current = null;
      }
    };
    const timer = setTimeout(scrollWhenReady, 300);
    return () => {
      clearTimeout(timer);
      clearTimeout(retryTimer);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", cancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setActiveSection = useCallback((id: string, replaceUrl = updateUrlOnScroll) => {
    if (!id || activeIdRef.current === id) return;
    activeIdRef.current = id;
    setActiveId(id);
    if (replaceUrl) updateUrl(id);
  }, [updateUrl, updateUrlOnScroll]);

  // IntersectionObserver only reports when an intersection boundary changes.
  // That leaves stale tabs after reverse scrolls, layout shifts and long
  // sections. Measure every animation frame requested by a scroll instead, so
  // the tab always reflects the section immediately below the sticky bars.
  const syncActiveSection = useCallback(() => {
    const marker = scrollOffset() + 16;
    const pending = initialScrollPendingRef.current;
    if (pending) {
      const target = document.getElementById(pending);
      if (!target) return;
      const reachedTarget = Math.abs(target.getBoundingClientRect().top - marker) < 32;
      const reachedPageEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (!reachedTarget && !reachedPageEnd) return;
      initialScrollPendingRef.current = null;
      setActiveSection(pending);
      return;
    }
    const positioned = sections
      .map(({ id }) => {
        const element = document.getElementById(id);
        return element ? { id, top: element.getBoundingClientRect().top } : null;
      })
      .filter((item): item is { id: string; top: number } => item !== null);

    if (!positioned.length) return;
    const passed = positioned
      .filter(({ top }) => top <= marker)
      .sort((a, b) => b.top - a.top);
    setActiveSection(passed[0]?.id || positioned[0].id);
  }, [scrollOffset, sections, setActiveSection]);

  useEffect(() => {
    let frame: number | null = null;
    const requestSync = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        syncActiveSection();
      });
    };

    requestSync();
    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(requestSync) : null;
    sections.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer?.observe(element);
    });
    return () => {
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
      observer?.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [sectionsKey, sections, syncActiveSection]);

  const scrollTo = useCallback((id: string) => {
    initialScrollPendingRef.current = null;
    setActiveSection(id, false);
    updateUrl(id);
    const el = document.getElementById(id);
    if (el) {
      const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - scrollOffset());
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }, [setActiveSection, updateUrl, scrollOffset]);

  // Keep the selected tab in view as the reader moves through sections. This
  // is particularly important on mobile, where the tabs overflow horizontally.
  useEffect(() => {
    if (!navRef.current) return;
    const activeBtn = navRef.current.querySelector(`[data-id="${activeId}"]`);
    if (activeBtn) {
      const nav = navRef.current;
      const btn = activeBtn as HTMLElement;
      const nextLeft = btn.offsetLeft - nav.clientWidth / 2 + btn.clientWidth / 2;
      nav.scrollTo({ left: Math.max(0, nextLeft), behavior: "smooth" });
    }
  }, [activeId, sectionsKey]);

  return (
    <nav
      ref={navRef}
      aria-label="Page sections"
      style={{ top: headerHeight }}
      className={cn(
        "sticky z-30 flex overflow-x-auto overscroll-x-contain whitespace-nowrap border-b border-[#d2ddf5] bg-[#e9f1ff] scrollbar-hide",
        "gap-1 px-1",
        className
      )}
    >
      {sections.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          data-id={id}
          onClick={() => scrollTo(id)}
          aria-current={activeId === id ? "location" : undefined}
          className={cn(
            "shrink-0 border-b-[3px] px-4 pb-2.5 pt-3 text-sm font-medium transition-colors md:text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
            activeId === id
              ? "border-primary text-[#17233d]"
              : "border-transparent text-[#647da8] hover:text-[#17233d]"
          )}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
