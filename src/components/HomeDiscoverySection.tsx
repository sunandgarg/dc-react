import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { InstitutionLogo } from "@/components/InstitutionLogo";
import { backendClient } from "@/integrations/backend/client";
import { getProgramCategoryIcon } from "@/lib/programCategoryImages";
import indiaTricolourMap from "@/assets/india-tricolour-map-256.png";

interface InstituteProgram {
  id: string;
  slug: string;
  tag: string;
  college_name: string;
  institute_logo: string;
  country: string;
}

interface PopularPlace {
  id: string;
  name: string;
  state: string;
  college_count: number;
  image_url: string;
}

interface ProgramCategory {
  id: string;
  slug: string;
  name: string;
  icon_emoji: string;
  icon_url: string;
}

const FALLBACK_PROGRAM_CATEGORIES: ProgramCategory[] = [
  { id: "agentic-ai", slug: "agentic-ai", name: "Agentic AI", icon_emoji: "", icon_url: "" },
  { id: "artificial-intelligence", slug: "artificial-intelligence", name: "Artificial Intelligence", icon_emoji: "", icon_url: "" },
  { id: "doctorate", slug: "doctorate", name: "Doctorate", icon_emoji: "", icon_url: "" },
  { id: "machine-learning", slug: "machine-learning", name: "Machine Learning", icon_emoji: "", icon_url: "" },
  { id: "data-science", slug: "data-science", name: "Data Science", icon_emoji: "", icon_url: "" },
  { id: "online-mba", slug: "online-mba", name: "Online MBA", icon_emoji: "", icon_url: "" },
  { id: "marketing", slug: "marketing", name: "Marketing", icon_emoji: "", icon_url: "" },
  { id: "management", slug: "management", name: "Management", icon_emoji: "", icon_url: "" },
  { id: "education", slug: "education", name: "Education", icon_emoji: "", icon_url: "" },
  { id: "project-management", slug: "project-management", name: "Project Management", icon_emoji: "", icon_url: "" },
];

const FALLBACK_INSTITUTE_PROGRAMS: InstituteProgram[] = [
  { id: "iiit-bangalore", slug: "executive-post-graduate-programme-in-applied-ai-and-agentic-ai-iiit-bangalore", tag: "IIT", college_name: "IIIT Bangalore", institute_logo: "https://d2o2utebsixu4k.cloudfront.net/upgrad/new-home/svg/IITB.svg", country: "India" },
  { id: "liverpool", slug: "master-of-science-in-machine-learning-and-ai-liverpool-john-moores-university", tag: "Global", college_name: "Liverpool John Moores University", institute_logo: "https://d2o2utebsixu4k.cloudfront.net/upgrad/new-home/svg/Liverpool+John+Moores.svg", country: "United Kingdom" },
  { id: "iim-kozhikode", slug: "professional-certificate-programme-in-ai-for-business-professionals-iim-kozhikode", tag: "IIM", college_name: "IIM Kozhikode", institute_logo: "https://d2o2utebsixu4k.cloudfront.net/upgrad/new-home/svg/Advt+Accrediation-09.svg", country: "India" },
  { id: "golden-gate", slug: "dba-in-emerging-technologies-with-a-concentration-in-generative-and-agentic-ai-golden-gate-university", tag: "Global", college_name: "Golden Gate University", institute_logo: "https://d2o2utebsixu4k.cloudfront.net/upgrad/new-home/svg/GGU.svg", country: "United States" },
  { id: "iit-kharagpur", slug: "executive-post-graduate-certificate-in-ai-native-software-engineering-iit-kharagpur-iit-kharagpur", tag: "IIT", college_name: "IIT Kharagpur", institute_logo: "https://d2o2utebsixu4k.cloudfront.net/Logo%20(6)%20(2)-db0b6f38da9c485faf76e366793c9b9e.webp", country: "India" },
  { id: "rushford", slug: "doctorate-of-business-administration-rushford-business-school", tag: "Dr.", college_name: "Rushford Business School", institute_logo: "https://d2o2utebsixu4k.cloudfront.net/Explore%20online%20Doctorate_Rushford_Dweb34733X140-18e98e9937b64d6499789007c004ddbd.svg", country: "Switzerland" },
  { id: "iiit-iim-udaipur", slug: "chief-technology-officer-and-ai-leadership-programme-iiit-b-and-iim-udaipur", tag: "IIM", college_name: "IIIT-B & IIM, Udaipur", institute_logo: "https://d2o2utebsixu4k.cloudfront.net/IIMUIIITBDualLogo-a584d4832cfe4bad8aadcc52d39db7bc.svg", country: "India" },
  { id: "esgci", slug: "doctorate-of-business-administration-dba-esgci-paris", tag: "Dr.", college_name: "ESGCI, Paris", institute_logo: "https://d2o2utebsixu4k.cloudfront.net/upgrad/new-home/svg/ESGCI.svg", country: "France" },
  { id: "edgewood", slug: "doctorate-in-business-administration-by-edgewood-university-edgewood-university", tag: "Dr.", college_name: "Edgewood University", institute_logo: "https://d2o2utebsixu4k.cloudfront.net/upgrad/new-home/svg/EdgewoodUnisvgFINAL.svg", country: "United States" },
  { id: "iim-bangalore", slug: "certificate-programme-in-general-management-for-young-leaders-ylp-from-iimb-iim-bangalore", tag: "IIM", college_name: "IIM Bangalore", institute_logo: "https://d2o2utebsixu4k.cloudfront.net/HRM%20EPGP%20-%20LIBA_WhomWillYouLearnFrom%20_IIMBLogo_Desktop-c4583c3894d04aebb58c5a3a92a09076.svg", country: "India" },
  { id: "ssbm", slug: "global-doctor-of-business-administration-from-ssbm-swiss-school-of-business-and-management", tag: "Dr.", college_name: "Swiss School of Business and Management", institute_logo: "https://d2o2utebsixu4k.cloudfront.net/Explore%20online%20Doctorate_SSBM_Dweb34733X140-cc4710797bea4804806ccf4b83679f9e.svg", country: "Switzerland" },
  { id: "waterloo", slug: "chief-technology-and-ai-officer-program-university-of-waterloo", tag: "Global", college_name: "University of Waterloo", institute_logo: "https://d2o2utebsixu4k.cloudfront.net/Untitled%20design%20(5)-d9bdeff6165f4eb1ba2adcebde78e961.svg", country: "Canada" },
];

const ONLINE_UNIVERSITIES = [
  {
    name: "GLA Online",
    initials: "GLA",
    region: "North India",
    slug: "gla-university-uttar-pradesh",
    logo: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v1/37/37c2cb86b013ff606c8142a98401285dc85c42f03571ab60330223c80cb8fda6.webp",
  },
  {
    name: "Amity Online",
    initials: "AU",
    region: "North India",
    slug: "amity-university-online",
    logo: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v1/2e/2e60a509c859543b6208223718a27a7cdfeace1866ba7bd785ca04122cacdb71.webp",
  },
  {
    name: "Manipal Online",
    initials: "MUJ",
    region: "South India",
    slug: "manipal-university-online",
    logo: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v1/0d/0dfef26663c4d00801927c9467c2706a649ea8e0008ea82fad6062f3979b94da.webp",
  },
  {
    name: "Shoolini Online",
    initials: "SU",
    region: "North India",
    slug: "shoolini-university-online",
    logo: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v1/5f/5ffde73f574a63bddeac228a897ccdef04323c6f6bc8cb98efaf2a50459678d6.webp",
  },
  {
    name: "SRM Online",
    initials: "SRM",
    region: "South India",
    slug: "srm-institute-of-science-and-technology-tamil-nadu",
    logo: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v1/3d/3d084f1237e68ae618daee33b4f9fb315836db82a3611bf2ae7f9ed6e134ad52.webp",
  },
  {
    name: "VIT Online",
    initials: "VIT",
    region: "South India",
    slug: "vellore-institute-of-technology-tamil-nadu",
    logo: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v1/69/696c8c9acc548095971417cef0f31028ee2ffeeaf717bfe23a34b02fb10da036.webp",
  },
  {
    name: "CU Online",
    initials: "CU",
    region: "North India",
    slug: "chandigarh-university-online",
    logo: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v1/57/57a68f0bef67e1722e7429a326c44351e9f0fe10b452bcaad4011a14001f7eb8.webp",
  },
  {
    name: "LPU Online",
    initials: "LPU",
    region: "North India",
    slug: "lpu-online",
    logo: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v1/ea/eaa5565056636a93d2e1c8fe856429dd3d691dc660dbfad6ca1ddd61dd225e23.webp",
  },
  {
    name: "JAIN Online",
    initials: "JAIN",
    region: "South India",
    slug: "jain-university-online",
    logo: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v1/d9/d9998442a706e7948e8c25e186f5fce02a96043a4a9c2a19efeea8c18586a72b.webp",
  },
  {
    name: "DPU Online",
    initials: "DPU",
    region: "West India",
    slug: "dy-patil-university-online",
    logo: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v1/b0/b0a51b24809d56cd30844aba881ea5fbf45b945420da29845262ffdc0714f2b4.webp",
  },
  {
    name: "SMU Online",
    initials: "SMU",
    region: "East India",
    slug: "sikkim-manipal-university-online",
    logo: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v1/9c/9c783c6e1df3b0813049fd5e36cb340f8d235c70cd229fcfa6bea4b7d93a0905.webp",
  },
  {
    name: "Uttaranchal Online",
    initials: "UU",
    region: "North India",
    slug: "uttaranchal-university-online",
    logo: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v1/08/089761eb91e9d509dca7890712a75dfd8023be0e52eb4441e7731ae6ff93a0a9.webp",
  },
] as const;

const ONLINE_UNIVERSITY_ORDER = [
  "GLA Online",
  "Amity Online",
  "VIT Online",
  "SRM Online",
  "CU Online",
  "Manipal Online",
] as const;

const ORDERED_ONLINE_UNIVERSITIES = [...ONLINE_UNIVERSITIES].sort((left, right) => {
  const leftIndex = ONLINE_UNIVERSITY_ORDER.indexOf(left.name as (typeof ONLINE_UNIVERSITY_ORDER)[number]);
  const rightIndex = ONLINE_UNIVERSITY_ORDER.indexOf(right.name as (typeof ONLINE_UNIVERSITY_ORDER)[number]);
  return (leftIndex < 0 ? ONLINE_UNIVERSITY_ORDER.length : leftIndex) - (rightIndex < 0 ? ONLINE_UNIVERSITY_ORDER.length : rightIndex);
});

const STUDY_DESTINATIONS = [
  { code: "us", name: "USA" },
  { code: "ca", name: "Canada" },
  { code: "au", name: "Australia" },
  { code: "gb", name: "UK" },
  { code: "de", name: "Germany" },
  { code: "eu", name: "Europe" },
  { code: "sg", name: "Singapore" },
  { code: "nz", name: "New Zealand" },
  { code: "fr", name: "France" },
  { code: "no", name: "Norway" },
  { code: "ie", name: "Ireland" },
  { code: "mx", name: "Mexico" },
  { code: "ru", name: "Russia" },
  { code: "kz", name: "Kazakhstan" },
  { code: "ge", name: "Georgia" },
] as const;

type InstituteKind = "iit" | "iim" | "world" | "other";

const WORLD_INSTITUTE_PATTERN = /\b(Liverpool|Golden Gate|Rushford|ESGCI|Edgewood|Swiss School|Waterloo|MIT Open Learning|Northeastern|Paris School)\b/i;

function instituteKind(program: InstituteProgram): InstituteKind {
  const marker = `${program.tag} ${program.college_name}`;
  if (/\bIIM\b/i.test(marker)) return "iim";
  if (/\bIIT\b|\bIIIT\b/i.test(marker)) return "iit";
  if ((program.country && program.country.toLowerCase() !== "india") || program.tag === "Dr." || WORLD_INSTITUTE_PATTERN.test(program.college_name)) return "world";
  return "other";
}

function arrangeInstitutes(programs: InstituteProgram[]) {
  const unique = new Map<string, InstituteProgram>();
  programs.forEach((program) => {
    if (!program.college_name?.trim()) return;
    const key = program.college_name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const existing = unique.get(key);
    if (!existing || (!existing.institute_logo && program.institute_logo)) unique.set(key, program);
  });

  const grouped = { iit: [] as InstituteProgram[], iim: [] as InstituteProgram[], world: [] as InstituteProgram[], other: [] as InstituteProgram[] };
  unique.forEach((program) => grouped[instituteKind(program)].push(program));
  grouped.world.sort((left, right) => Number(/Liverpool/i.test(right.college_name)) - Number(/Liverpool/i.test(left.college_name)));

  const arranged: InstituteProgram[] = [];
  let iitIndex = 0;
  let iimIndex = 0;
  let worldIndex = 0;
  while (worldIndex < grouped.world.length && (iitIndex < grouped.iit.length || iimIndex < grouped.iim.length)) {
    if (iitIndex < grouped.iit.length) arranged.push(grouped.iit[iitIndex++]);
    if (worldIndex < grouped.world.length) arranged.push(grouped.world[worldIndex++]);
    if (iimIndex < grouped.iim.length) arranged.push(grouped.iim[iimIndex++]);
    if (worldIndex < grouped.world.length) arranged.push(grouped.world[worldIndex++]);
  }
  return [
    ...arranged,
    ...grouped.world.slice(worldIndex),
    ...grouped.iit.slice(iitIndex),
    ...grouped.iim.slice(iimIndex),
    ...grouped.other,
  ];
}

function useSwipeRail(reduceMotion: boolean, step: number, intervalMs: number, autoScroll = true) {
  const ref = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const inView = useRef(false);

  useEffect(() => {
    if (reduceMotion || !autoScroll) return undefined;
    const rail = ref.current;
    if (!rail) return undefined;
    const observer = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => { inView.current = entry.isIntersecting; }, { rootMargin: "160px" });
    observer?.observe(rail);
    if (!observer) inView.current = true;
    const timer = window.setInterval(() => {
      if (!inView.current || document.visibilityState !== "visible" || paused.current || rail.scrollWidth <= rail.clientWidth + 4) return;
      const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 12;
      rail.scrollBy({ left: atEnd ? -rail.scrollLeft : step, behavior: "smooth" });
    }, intervalMs);
    return () => {
      observer?.disconnect();
      window.clearInterval(timer);
    };
  }, [autoScroll, intervalMs, reduceMotion, step]);

  return {
    ref,
    onPointerDown: () => { paused.current = true; },
    onPointerUp: () => { paused.current = false; },
    onPointerCancel: () => { paused.current = false; },
    onFocus: () => { paused.current = true; },
    onBlur: () => { paused.current = false; },
  };
}

function shortInstituteName(name: string) {
  const match = name.match(/\b(IIT|IIM)\b(?:\s+of)?\s+([A-Za-z]+)/i);
  if (match) return `${match[1].toUpperCase()} ${match[2]}`;
  return name;
}

function ProgramCategoryRail({ categories, loading }: { categories: ProgramCategory[]; loading: boolean }) {
  if (!loading && categories.length === 0) return null;

  return (
    <nav className="border-b border-amber-200/65 bg-white/45 px-4 py-2.5 sm:px-5" aria-label="Premium program categories">
      <div className="flex snap-x snap-mandatory items-start gap-2 overflow-x-auto overscroll-x-contain scrollbar-hide sm:gap-3">
        {loading && Array.from({ length: 8 }).map((_, index) => (
          <span key={index} className="h-[72px] w-[84px] shrink-0 animate-pulse rounded-xl bg-white/70" />
        ))}
        {!loading && categories.map((category) => {
          const icon = getProgramCategoryIcon(category.slug) || category.icon_url;
          return (
            <Link
              key={category.id}
              to={`/premium-programs?cat=${encodeURIComponent(category.slug)}`}
              className="group flex w-[84px] shrink-0 snap-start flex-col items-center gap-1.5 rounded-xl px-1.5 py-1.5 text-center transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:w-[96px]"
              aria-label={`Browse ${category.name} premium programs`}
            >
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-amber-100 transition-transform group-hover:scale-105 sm:h-10 sm:w-10">
                {icon ? (
                  <img src={icon} alt="" className="h-8 w-8 object-contain sm:h-9 sm:w-9" loading="lazy" decoding="async" />
                ) : (
                  <span className="text-xl" aria-hidden="true">{category.icon_emoji || "🎓"}</span>
                )}
              </span>
              <span className="line-clamp-2 text-[9px] font-bold leading-3 text-foreground group-hover:text-primary sm:text-[10px]">
                {category.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function HomeDiscoverySection() {
  const reduceMotion = useReducedMotion();
  const { data: programs = [], isLoading: programsLoading } = useQuery({
    queryKey: ["home-iit-iim-institutes"],
    queryFn: async (): Promise<InstituteProgram[]> => {
      const { data, error } = await backendClient
        .from("promoted_programs")
        .select("id,slug,tag,college_name,institute_logo,country")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as InstituteProgram[];
    },
    staleTime: 10 * 60 * 1000,
  });
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["home-program-categories"],
    queryFn: async (): Promise<ProgramCategory[]> => {
      const { data, error } = await (backendClient as any)
        .from("program_categories")
        .select("id,slug,name,icon_emoji,icon_url")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as ProgramCategory[];
    },
    staleTime: 10 * 60 * 1000,
  });
  const categoryOptions = categories.length > 0 ? categories : FALLBACK_PROGRAM_CATEGORIES;
  const institutePrograms = programs.length > 0 ? programs : FALLBACK_INSTITUTE_PROGRAMS;
  const institutes = useMemo(() => arrangeInstitutes(institutePrograms), [institutePrograms]);

  return (
    <section className="border-y border-border/60 bg-muted/20 py-8 md:py-10" aria-labelledby="home-discovery-heading">
      <div className="container">
        <div className="mb-7 flex flex-col justify-between gap-2 sm:flex-row sm:items-end sm:gap-5 md:mb-8">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">Explore your way</p>
            <h2 id="home-discovery-heading" className="mt-1 text-xl font-black tracking-tight text-foreground md:text-2xl">More ways to find your fit</h2>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">Start with an institute, a place or how you want to study.</p>
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          className="overflow-hidden rounded-2xl border border-amber-200/80 bg-[#fff9e8] shadow-sm"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-foreground sm:text-base">IIT, IIM, Global Degrees</h3>
              <p className="truncate text-[11px] text-muted-foreground sm:text-xs">India's leading institutes and global universities</p>
            </div>
            <Link to="/premium-programs" className="group inline-flex shrink-0 items-center gap-1 text-xs font-bold text-primary hover:underline">
              View all <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>

          <ProgramCategoryRail categories={categoryOptions} loading={categoriesLoading && categories.length === 0} />

          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-4 scrollbar-hide sm:px-5 sm:py-5" aria-label="IIT and IIM institutes">
            {programsLoading && programs.length === 0 && Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="h-[108px] w-[136px] shrink-0 animate-pulse rounded-xl bg-muted sm:h-[116px] sm:w-[148px]" />
            ))}
            {(!programsLoading || programs.length > 0) && institutes.map((institute) => {
              const isGlobal = instituteKind(institute) === "world";
              return (
                <Link
                  key={institute.id}
                  to={institute.slug ? `/premium-programs/${institute.slug}` : "/premium-programs"}
                  className="group relative flex h-[108px] w-[136px] shrink-0 snap-start flex-col items-center justify-center gap-2.5 rounded-xl border border-amber-200/70 bg-white px-3 py-3.5 text-center transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-[116px] sm:w-[148px]"
                  title={institute.college_name}
                >
                  {isGlobal && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-violet-50 px-1.5 py-0.5 text-[7px] font-extrabold uppercase tracking-wide text-violet-700 ring-1 ring-violet-100 sm:text-[8px]">
                      Global degree
                    </span>
                  )}
                  <InstitutionLogo src={institute.institute_logo} alt={`${institute.college_name} logo`} className={`h-12 w-full bg-white sm:h-14 ${isGlobal ? "mt-2" : ""}`} imageClassName="px-1.5" />
                  <span className="w-full truncate text-[11px] font-bold text-foreground">{shortInstituteName(institute.college_name)}</span>
                </Link>
              );
            })}
            {!programsLoading && institutes.length === 0 && (
              <Link to="/premium-programs" className="inline-flex min-h-[108px] items-center gap-2 text-sm font-semibold text-primary hover:underline">
                Browse IIT &amp; IIM programmes <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </div>
        </motion.div>

        <div className="mt-8 grid grid-cols-2 gap-3 md:mt-10 md:gap-6">
          <OnlineDegreeCard reduceMotion={Boolean(reduceMotion)} />
          <AbroadCard reduceMotion={Boolean(reduceMotion)} />
        </div>
      </div>
    </section>
  );
}

export function HomeLocationSection() {
  const reduceMotion = useReducedMotion();
  const { data: places = [], isLoading } = useQuery({
    queryKey: ["home-state-city-strip"],
    queryFn: async (): Promise<PopularPlace[]> => {
      const { data, error } = await backendClient
        .from("popular_places")
        .select("id,name,state,college_count,image_url")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .limit(12);
      if (error) throw error;
      return (data || []) as PopularPlace[];
    },
    staleTime: 10 * 60 * 1000,
  });
  const visiblePlaces = useMemo(() => {
    const unique = new Map<string, PopularPlace>();
    places.forEach((place) => {
      const state = place.state === "Delhi" ? "Delhi NCR" : place.state;
      const name = place.name === "Delhi" ? "Delhi NCR" : place.name;
      const normalized = { ...place, state, name };
      const key = `${state}|${name}`.toLowerCase();
      if (!unique.has(key)) unique.set(key, normalized);
    });
    return [...unique.values()];
  }, [places]);
  const placeRail = useSwipeRail(Boolean(reduceMotion), 132, 2400);

  return (
    <section className="bg-background pb-9 md:pb-12" aria-label="Explore colleges by location">
      <div className="container">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          className="flex items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card px-3.5 py-3.5 shadow-sm sm:px-4 sm:py-4"
        >
          <Link to="/colleges" className="group flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-border transition hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-16 sm:w-16" aria-label="Browse colleges across India">
            <IndianMapMark />
          </Link>
          <div className="h-9 w-px shrink-0 bg-border sm:h-10" aria-hidden="true" />
          <div
            ref={placeRail.ref}
            onPointerDown={placeRail.onPointerDown}
            onPointerUp={placeRail.onPointerUp}
            onPointerCancel={placeRail.onPointerCancel}
            onFocus={placeRail.onFocus}
            onBlur={placeRail.onBlur}
            className="flex min-w-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth overscroll-x-contain scrollbar-hide"
            aria-label="Popular college locations. Swipe to explore."
          >
            {isLoading && Array.from({ length: 5 }).map((_, index) => (
              <span key={index} className="h-12 w-28 shrink-0 animate-pulse rounded-full bg-muted sm:h-14" />
            ))}
            {!isLoading && visiblePlaces.map((place) => {
              const label = place.name?.trim() || place.state;
              const params = new URLSearchParams();
              if (place.state) params.set("state", place.state);
              if (place.name && place.name !== place.state) params.set("city", place.name);
              return (
                <Link
                  key={place.id}
                  to={`/colleges?${params.toString()}`}
                  className="inline-flex h-12 shrink-0 snap-start items-center gap-2.5 rounded-full border border-border bg-background py-1 pl-1 pr-4 text-xs font-bold text-foreground transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-14"
                >
                  <PlaceImage place={place} />
                  <span>{label}</span>
                  {place.college_count > 0 && <span className="text-[10px] font-semibold text-muted-foreground">{place.college_count}+</span>}
                </Link>
              );
            })}
            {!isLoading && places.length === 0 && (
              <Link to="/colleges" className="inline-flex h-12 items-center text-xs font-bold text-primary hover:underline">Browse all locations</Link>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function IndianMapMark({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src={indiaTricolourMap}
      alt=""
      className={compact ? "h-7 w-7 object-contain" : "h-12 w-12 object-contain sm:h-14 sm:w-14"}
      loading="lazy"
      decoding="async"
    />
  );
}

function PlaceImage({ place }: { place: PopularPlace }) {
  const [failed, setFailed] = useState(false);
  if (!place.image_url || failed) {
    return <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-border sm:h-12 sm:w-12"><IndianMapMark compact /></span>;
  }
  return (
    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border sm:h-12 sm:w-12">
      <img
        src={place.image_url}
        alt=""
        className="h-full w-full scale-[1.24] object-cover object-bottom"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

function OnlineDegreeCard({ reduceMotion }: { reduceMotion: boolean }) {
  const rail = useSwipeRail(reduceMotion, 96, 2300, false);
  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      className="group relative isolate min-h-[154px] overflow-hidden rounded-2xl border border-border bg-card p-2.5 shadow-sm transition-shadow hover:border-primary/25 hover:shadow-md sm:min-h-[196px] sm:p-4"
    >
      <a href="https://online.dekhocampus.com" className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" aria-label="Explore online degrees on DekhoCampus Online" />
      <div className="pointer-events-none relative z-10 flex items-center justify-between gap-1">
        <h3 className="whitespace-nowrap text-sm font-black leading-tight text-foreground sm:text-xl">Online degree</h3>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary sm:h-4 sm:w-4" aria-hidden="true" />
      </div>
      <UniversityRail rail={rail} />
      <p className="relative z-10 mt-1.5 flex items-center justify-end gap-1 pr-1 text-[10px] font-semibold italic text-muted-foreground sm:text-[11px]">
        Swipe <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </p>
    </motion.article>
  );
}

function UniversityRail({ rail }: { rail: ReturnType<typeof useSwipeRail> }) {
  return (
    <div
      ref={rail.ref}
      onPointerDown={rail.onPointerDown}
      onPointerUp={rail.onPointerUp}
      onPointerCancel={rail.onPointerCancel}
      onFocus={rail.onFocus}
      onBlur={rail.onBlur}
      className="relative z-10 mt-2.5 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth overscroll-x-contain scrollbar-hide sm:mt-3"
      aria-label="Featured online universities. Swipe to explore."
    >
      {ORDERED_ONLINE_UNIVERSITIES.map((university) => (
        <a
          key={university.slug}
          href={`https://online.dekhocampus.com/universities/${university.slug}`}
          className="flex h-[92px] w-[80px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-xl border border-border bg-background px-2 py-2 text-center transition hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-[110px] sm:w-[88px]"
          aria-label={`${university.name}, ${university.region}, profile`}
        >
          <InstitutionLogo
            src={university.logo}
            alt=""
            className="h-7 w-12 bg-transparent sm:h-9 sm:w-14"
            imageClassName="p-0.5"
            fallback={<span className="text-xs font-black tracking-tight text-slate-700">{university.initials}</span>}
          />
          <span className="line-clamp-2 text-[9px] font-extrabold leading-3 text-foreground sm:text-[10px]">{university.name}</span>
        </a>
      ))}
    </div>
  );
}

function AbroadCard({ reduceMotion }: { reduceMotion: boolean }) {
  const rail = useSwipeRail(reduceMotion, 88, 2500, false);
  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      className="group relative isolate min-h-[154px] overflow-hidden rounded-2xl border border-border bg-card p-2.5 shadow-sm transition-shadow hover:border-primary/25 hover:shadow-md sm:min-h-[196px] sm:p-4"
    >
      <a href="https://abroad.dekhocampus.com" className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" aria-label="Explore study abroad options" />
      <div className="pointer-events-none relative z-10 flex items-center justify-between gap-1">
        <h3 className="whitespace-nowrap text-sm font-black leading-tight text-foreground sm:text-xl">Study abroad</h3>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary sm:h-4 sm:w-4" aria-hidden="true" />
      </div>
      <div
        ref={rail.ref}
        onPointerDown={rail.onPointerDown}
        onPointerUp={rail.onPointerUp}
        onPointerCancel={rail.onPointerCancel}
        onFocus={rail.onFocus}
        onBlur={rail.onBlur}
        className="relative z-10 mt-2.5 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth overscroll-x-contain scrollbar-hide sm:mt-3"
        aria-label="Popular study destinations. Swipe to explore."
      >
        {STUDY_DESTINATIONS.map((destination) => (
          <a href="https://abroad.dekhocampus.com" key={destination.name} className="flex h-[92px] w-[80px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-xl border border-border bg-background px-2 text-center transition hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-[110px] sm:w-[90px]" aria-label={`Explore studying in ${destination.name}`}>
            <span className="flex h-7 w-11 items-center justify-center overflow-hidden rounded-[3px] bg-white ring-1 ring-black/10 sm:h-8 sm:w-12" aria-hidden="true">
              <img
                src={`https://flagcdn.com/w80/${destination.code}.png`}
                srcSet={`https://flagcdn.com/w80/${destination.code}.png 1x, https://flagcdn.com/w160/${destination.code}.png 2x`}
                alt=""
                className="h-full w-full object-contain"
                loading="lazy"
                decoding="async"
              />
            </span>
            <span className="text-[9px] font-extrabold leading-3 text-foreground sm:text-[10px]">{destination.name}</span>
          </a>
        ))}
      </div>
      <p className="relative z-10 mt-1.5 flex items-center justify-end gap-1 pr-1 text-[10px] font-semibold italic text-muted-foreground sm:text-[11px]">
        Swipe <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </p>
    </motion.article>
  );
}
