import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";
import { backendClient } from "@/integrations/backend/client";
import { useAds } from "@/hooks/useAds";
import { buildHeaderNavigation, type HeaderCatalog, type HeaderLink, type HeaderSection } from "@/lib/headerNavigation";
import diyaLogo from "@/assets/diya-ai-logo-small.webp";

function useHeaderNavigation(enabled: boolean) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["mega-menu-data-v3"], enabled, staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<HeaderCatalog> => {
      const [colleges, courses, exams] = await Promise.all([
        backendClient.from("colleges").select("name,slug,short_id,logo,category,state").eq("is_active", true).order("rating", { ascending: false }).limit(100),
        backendClient.from("courses").select("name,slug,short_id,category").eq("is_active", true).order("priority", { ascending: true, nullsFirst: false }).order("name").limit(100),
        backendClient.from("exams").select("name,slug,short_id,logo,category,is_top_exam").eq("is_active", true).order("is_top_exam", { ascending: false }).limit(100),
      ]);
      const error = colleges.error || courses.error || exams.error;
      if (error) throw error;
      return { colleges: colleges.data || [], courses: courses.data || [], exams: exams.data || [] };
    },
  });
  return { sections: buildHeaderNavigation(data), isLoading, isError };
}

function NavigationLink({ item, onNavigate, className, arrow = false }: { item: HeaderLink; onNavigate: () => void; className?: string; arrow?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const content = <>
    {item.image && <img src={item.image} alt="" loading="lazy" className="h-7 w-7 shrink-0 rounded border border-slate-100 object-contain" onError={(event) => { event.currentTarget.hidden = true; }} />}
    <span className="min-w-0 flex-1 truncate" title={item.label}>{item.label}</span>
    {arrow && <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0" />}
  </>;
  if (item.href === "#ask-diya") return <button type="button" className={className} onClick={() => {
    onNavigate();
    if (/^\/(news|articles|premium-programs|admin|auth)/.test(location.pathname)) {
      sessionStorage.setItem("dc:open-diya-after-navigation", "footer"); navigate("/");
    } else window.dispatchEvent(new CustomEvent("dc:open-diya"));
  }}>{content}</button>;
  return <Link to={item.href} className={className} onClick={onNavigate}>{content}</Link>;
}

export function HeaderPromotionCard({ title, subtitle, image, cta, href, onNavigate = () => {}, sponsored = false }: {
  title: string; subtitle?: string | null; image?: string | null; cta: string; href: string; onNavigate?: () => void; sponsored?: boolean;
}) {
  return <aside className="relative flex min-h-64 flex-col overflow-hidden rounded-2xl bg-[#fbefdf] px-6 pb-6 pt-12" aria-label="Featured in this menu">
    <p className="absolute left-6 top-0 rounded-b-lg bg-[#aa4314] px-7 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">{sponsored ? "Sponsored" : "Explore"}</p>
    {image && <img src={image} alt="" className="mb-3 h-14 w-full object-contain object-left" onError={(event) => { event.currentTarget.hidden = true; }} />}
    <p className="text-[22px] font-bold leading-tight text-[#a84416]">{title}</p>
    {subtitle && <p className="mt-3 text-sm leading-snug text-slate-700">{subtitle}</p>}
    <div className="pt-5">
      {href === "#ask-diya" ? <NavigationLink item={{ label: cta, href }} arrow onNavigate={onNavigate} className="inline-flex items-center gap-5 rounded-xl border border-primary bg-white px-4 py-3 text-left text-sm font-semibold text-primary transition-colors hover:bg-blue-50 focus-visible:outline-primary" />
        : <Link to={href} onClick={onNavigate} className="inline-flex items-center gap-5 rounded-xl border border-primary bg-white px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-blue-50 focus-visible:outline-primary">{cta}<ChevronRight className="h-5 w-5" aria-hidden="true" /></Link>}
    </div>
  </aside>;
}

function MenuPromotion({ section, onNavigate }: { section: string; onNavigate: () => void }) {
  const { data: ad } = useAds({ position: "header-menu", page: section });
  return ad ? <HeaderPromotionCard title={ad.title} subtitle={ad.subtitle} image={ad.image_url} cta={ad.cta_text || "Explore"} href={ad.link_url} sponsored onNavigate={onNavigate} />
    : <HeaderPromotionCard title="Your next step, made clearer." subtitle="Ask Diya AI about colleges, courses, fees and admissions. Start with the question on your mind." image={diyaLogo} cta="Ask Diya AI" href="#ask-diya" onNavigate={onNavigate} />;
}

// Keep the visual exit transition, but immediately remove closing links from keyboard navigation.
function MenuSurface({ children }: { children: ReactNode }) {
  const present = useIsPresent();
  const reducedMotion = useReducedMotion();
  return <motion.div ref={(node) => { if (node) node.inert = !present; }} aria-hidden={!present || undefined}
    initial="closed" animate="open" exit="closed" variants={{ closed: { opacity: 0 }, open: { opacity: 1 } }}
    transition={{ duration: reducedMotion ? 0 : 0.18 }}>{children}</motion.div>;
}

export function MegaMenu() {
  const reducedMotion = useReducedMotion();
  const [requested, setRequested] = useState(false);
  const { sections, isLoading, isError } = useHeaderNavigation(requested);
  const [open, setOpen] = useState<string | null>(null);
  const [groupIndex, setGroupIndex] = useState(0);
  const [panelTop, setPanelTop] = useState(64);
  const ref = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();
  const focusPanel = useRef(false);
  const openedByHover = useRef(false);
  const location = useLocation();
  const active = sections.find((section) => section.key === open);
  const group = active?.groups?.[groupIndex] || active?.groups?.[0];
  const clearHover = () => clearTimeout(hoverTimer.current);
  const close = useCallback(() => { clearTimeout(hoverTimer.current); openedByHover.current = false; setOpen(null); }, []);
  const scheduleClose = () => { clearHover(); hoverTimer.current = setTimeout(close, 180); };
  const show = (key: string, fromHover = false) => {
    openedByHover.current = fromHover;
    clearHover(); setRequested(true);
    if (key !== open) setGroupIndex(0);
    setOpen(key);
  };

  useEffect(() => { close(); }, [location.pathname, location.search, close]);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  useEffect(() => {
    if (!open) return;
    const header = ref.current?.closest("header");
    const position = () => {
      if (window.innerWidth < 1280) { close(); return; }
      setPanelTop(Math.max(0, header?.getBoundingClientRect().bottom || 64));
    };
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) close(); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      ref.current?.querySelector<HTMLButtonElement>(`[data-menu="${open}"]`)?.focus(); close();
    };
    position();
    const observer = new ResizeObserver(position);
    if (header) observer.observe(header);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, { passive: true });
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    if (focusPanel.current) { panelRef.current?.querySelector<HTMLButtonElement>("[role=tab]")?.focus(); focusPanel.current = false; }
    return () => {
      observer.disconnect(); window.removeEventListener("resize", position); window.removeEventListener("scroll", position);
      document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape);
    };
  }, [open, close]);

  return <nav ref={ref} aria-label="Main navigation" className="hidden h-full items-center gap-5 xl:flex 2xl:gap-7"
    onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) close(); }}
    onPointerLeave={scheduleClose} onPointerEnter={clearHover}>
    {sections.map((section) => section.groups ? <button key={section.key} type="button" data-menu={section.key}
      aria-expanded={open === section.key} aria-controls="header-mega-panel"
      onPointerEnter={(event) => { if (event.pointerType === "mouse" && open !== section.key) { clearHover(); hoverTimer.current = setTimeout(() => show(section.key, true), 140); } }}
      onFocus={() => setRequested(true)}
      onClick={() => { clearHover(); if (open === section.key && !openedByHover.current) close(); else show(section.key); }}
      onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); if (open === section.key) panelRef.current?.querySelector<HTMLButtonElement>("[role=tab]")?.focus(); else { focusPanel.current = true; show(section.key); } } }}
      className={`relative inline-flex h-10 items-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-primary ${open === section.key ? "text-primary" : "text-slate-700 hover:text-primary"}`}>
      {section.label}<span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary/50 transition-transform duration-200 motion-reduce:transition-none ${open === section.key ? "scale-x-100" : "scale-x-0"}`} />
    </button> : <Link key={section.key} to={section.href!} onClick={close} onPointerEnter={() => { clearHover(); close(); }}
      className={`group relative inline-flex h-10 items-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-primary ${!open && location.pathname.startsWith(section.href!) ? "text-primary" : "text-slate-700 hover:text-primary"}`}>{section.label}<span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary/50 transition-transform duration-200 motion-reduce:transition-none group-hover:scale-x-100 ${!open && location.pathname.startsWith(section.href!) ? "scale-x-100" : "scale-x-0"}`} /></Link>)}
    <AnimatePresence>
    {active?.groups && group && <MenuSurface key="menu-surface">
      <div aria-hidden="true" className="fixed inset-x-0 bottom-0 z-[75] bg-slate-950/35 backdrop-blur-[3px]" style={{ top: panelTop }} onPointerEnter={scheduleClose} onClick={close} />
      <motion.div ref={panelRef} id="header-mega-panel" role="region" aria-label={`${active.label} navigation`} style={{ top: panelTop, maxHeight: `calc(100dvh - ${panelTop}px - 24px)` }}
        variants={{ closed: { opacity: 0, y: reducedMotion ? 0 : -8 }, open: { opacity: 1, y: 0 } }} transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }}
        className="fixed inset-x-0 z-[80] overflow-y-auto rounded-b-2xl bg-white shadow-[0_8px_16px_rgba(13,0,87,0.08)]" onPointerEnter={clearHover}>
        <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)_260px] gap-10 px-8 py-5 2xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <div className="mb-5 flex items-center justify-between gap-4">
              <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[.14em] text-primary"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary ring-[6px] ring-blue-50" /><span className="border-b-2 border-primary pb-1.5">{active.label === "More" ? "Explore DekhoCampus" : active.label}</span></p>
              {active.href && <Link to={active.href} onClick={close} className="inline-flex items-center gap-2 text-xs font-semibold text-primary">View all {active.label.toLowerCase()}<ArrowRight className="h-3.5 w-3.5" /></Link>}
            </div>
          <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-8 2xl:grid-cols-[210px_minmax(0,1fr)]">
            <div role="tablist" aria-label={`${active.label} categories`} aria-orientation="vertical" className="max-h-72 space-y-1 overflow-y-auto overscroll-contain">
              {active.groups.map((entry, index) => <button key={entry.title} id={`header-group-${index}`} role="tab" type="button" aria-selected={group === entry} aria-controls="header-group-content" tabIndex={group === entry ? 0 : -1}
                onClick={() => setGroupIndex(index)}
                onPointerEnter={(event) => { if (event.pointerType === "mouse") setGroupIndex(index); }}
                onKeyDown={(event) => {
                  const count = active.groups!.length;
                  const next = event.key === "ArrowDown" ? (index + 1) % count : event.key === "ArrowUp" ? (index - 1 + count) % count : event.key === "Home" ? 0 : event.key === "End" ? count - 1 : -1;
                  if (next < 0) return;
                  event.preventDefault(); setGroupIndex(next); document.getElementById(`header-group-${next}`)?.focus();
                }}
                className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors duration-150 ${group === entry ? "bg-[#fcf0e2] text-[#a84416]" : "text-slate-600 hover:bg-slate-50"}`}>{entry.title}<ChevronRight className={`h-4 w-4 shrink-0 ${group === entry ? "text-[#a84416]" : "text-slate-300"}`} aria-hidden="true" /></button>)}
            </div>
            <motion.div key={`${active.key}-${group.title}`} id="header-group-content" role="tabpanel" aria-labelledby={`header-group-${groupIndex}`} initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.16 }} className="h-72 overflow-y-auto overscroll-contain pr-2">
              {group.title.startsWith("Popular") && isLoading && <p className="mb-3 text-sm text-slate-500" role="status">Loading the latest listings…</p>}
              {group.title.startsWith("Popular") && isError && <p className="mb-3 text-sm text-slate-500">Listings are temporarily unavailable. Use the browse link below.</p>}
              <div className="grid grid-cols-2 content-start gap-x-5 gap-y-1">
                {group.items.map((item) => <NavigationLink key={item.href + item.label} item={item} onNavigate={close} className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded px-2 py-2.5 text-left text-sm leading-5 text-slate-700 transition-colors hover:bg-blue-50/60 hover:text-primary focus-visible:outline-primary" />)}
              </div>
            </motion.div>
          </div>
          </div>
          <MenuPromotion section={active.key} onNavigate={close} />
        </div>
      </motion.div>
    </MenuSurface>}
    </AnimatePresence>
  </nav>;
}

export function MobileMegaMenu({ onNavigate }: { onNavigate: () => void }) {
  const { sections } = useHeaderNavigation(true);
  return <nav aria-label="Mobile navigation">{sections.map((section) => <MobileSection key={section.key} section={section} onNavigate={onNavigate} />)}</nav>;
}

function MobileSection({ section, onNavigate }: { section: HeaderSection; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  if (!section.groups) return <Link to={section.href!} onClick={onNavigate} className="block border-b border-slate-100 px-3 py-3.5 text-sm font-medium">{section.label}</Link>;
  return <div className="border-b border-slate-100">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={`mobile-${section.key}`} className="flex w-full items-center justify-between px-3 py-3.5 text-sm font-semibold">
      {section.label}<ChevronDown className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
    </button>
    <AnimatePresence initial={false}>{open && <motion.div id={`mobile-${section.key}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }} className="overflow-hidden">
    <div className="space-y-1 bg-slate-50 px-3 pb-3">
      {section.href && <Link to={section.href} onClick={onNavigate} className="block px-3 py-3 text-sm font-semibold text-primary">View all {section.label.toLowerCase()} →</Link>}
      {section.groups.map((group) => <details key={group.title} className="border-t border-slate-200">
        <summary className="cursor-pointer py-3 text-sm font-medium text-slate-700">{group.title}</summary>
        {group.items.map((item) => <NavigationLink key={item.href + item.label} item={item} onNavigate={onNavigate} className="flex min-h-11 w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-slate-600 hover:bg-blue-50" />)}
      </details>)}
      <MenuPromotion section={section.key} onNavigate={onNavigate} />
    </div></motion.div>}</AnimatePresence>
  </div>;
}
