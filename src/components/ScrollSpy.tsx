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
  const observerRef = useRef<IntersectionObserver | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const isUserClick = useRef(false);
  const lastUserScrollAt = useRef(0);

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

  useEffect(() => {
    setActiveId(tab || sections[0]?.id || "");
  }, [tab, sections]);

  // Scroll to the initial tab route ONCE on mount, with header-safe offset.
  // Cancel if the user starts scrolling before the timer fires, otherwise the
  // delayed programmatic scroll yanks the page back and feels like "scroll
  // jumps up" on detail pages.
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (didInitialScroll.current) return;
    didInitialScroll.current = true;
    const initial = tab;
    if (!initial) return;
    let cancelled = false;
    const cancel = () => { cancelled = true; };
    window.addEventListener("wheel", cancel, { passive: true, once: true });
    window.addEventListener("touchstart", cancel, { passive: true, once: true });
    window.addEventListener("keydown", cancel, { once: true });
    const timer = setTimeout(() => {
      if (cancelled) return;
      const el = document.getElementById(initial);
      if (el) {
        const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - scrollOffset());
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", cancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const markUserScroll = () => {
      lastUserScrollAt.current = Date.now();
    };
    window.addEventListener("wheel", markUserScroll, { passive: true });
    window.addEventListener("touchmove", markUserScroll, { passive: true });
    window.addEventListener("keydown", markUserScroll);
    return () => {
      window.removeEventListener("wheel", markUserScroll);
      window.removeEventListener("touchmove", markUserScroll);
      window.removeEventListener("keydown", markUserScroll);
    };
  }, []);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (isUserClick.current) return;
        const visible = sections
          .map(({ id }) => document.getElementById(id))
          .filter((el): el is HTMLElement => !!el)
          .map((el) => ({ id: el.id, top: el.getBoundingClientRect().top }))
          .filter((item) => item.top <= scrollOffset() + 16)
          .sort((a, b) => b.top - a.top);
        const newId = visible[0]?.id || entries.find((e) => e.isIntersecting)?.target.id;
        if (newId) {
          setActiveId(newId);
          // Keep scrollspy visual-only during passive scrolling. Updating the
          // browser path automatically made detail pages look like they were
          // refreshing themselves.
          if (updateUrlOnScroll) updateUrl(newId);
        }
      },
      { rootMargin: `-${Math.ceil(scrollOffset())}px 0px -60% 0px`, threshold: 0.05 }
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [sections, updateUrl, updateUrlOnScroll, scrollOffset]);

  const scrollTo = useCallback((id: string) => {
    isUserClick.current = true;
    setActiveId(id);
    
    // Only explicit user clicks update the URL.
    updateUrl(id);
    
    const el = document.getElementById(id);
    if (el) {
      const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - scrollOffset());
      window.scrollTo({ top: y, behavior: "smooth" });
    }
    setTimeout(() => {
      isUserClick.current = false;
    }, 1200);
  }, [updateUrl, scrollOffset]);

  // Auto-scroll active tab into view in nav bar
  useEffect(() => {
    if (!navRef.current) return;
    if (Date.now() - lastUserScrollAt.current < 250) return;
    const activeBtn = navRef.current.querySelector(`[data-id="${activeId}"]`);
    if (activeBtn) {
      const nav = navRef.current;
      const btn = activeBtn as HTMLElement;
      const nextLeft = btn.offsetLeft - nav.clientWidth / 2 + btn.clientWidth / 2;
      nav.scrollTo({ left: Math.max(0, nextLeft), behavior: "smooth" });
    }
  }, [activeId]);

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
