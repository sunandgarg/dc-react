import { AlsoCheckSection } from "@/components/AlsoCheckSection";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { Fragment, useEffect, useMemo } from "react";
import { buildCollegeHref, parseSlugWithId } from "@/lib/entityUrls";
import { useSEO } from "@/hooks/useSEO";
import { motion } from "framer-motion";
import { Star, MapPin, Calendar, GraduationCap, TrendingUp, Building, CheckCircle, Briefcase, BookOpen, Image as ImageIcon, Users, Award, Scale, Newspaper, HelpCircle, DollarSign, ExternalLink, Download, Phone, Shield, Globe, Landmark, Search, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { LeadCaptureForm } from "@/components/LeadCaptureForm";
import { DynamicAdBanner } from "@/components/DynamicAdBanner";
import { ScrollSpy, type ScrollSection } from "@/components/ScrollSpy";
import { FAQSection } from "@/components/FAQSection";
import { buildDefaultFaqs } from "@/lib/defaultFaqs";
import { CollegeHeroCard } from "@/components/CollegeHeroCard";
import { CollegeAffiliationCard } from "@/components/detail/CollegeAffiliationCard";
import { CollegeTrustBento } from "@/components/detail/CollegeTrustBento";
import { CollegeAIInsight } from "@/components/detail/CollegeAIInsight";
import { CollegeDecisionRail } from "@/components/detail/CollegeDecisionRail";
import { CollegeQuickFacts } from "@/components/detail/CollegeQuickFacts";
import { AuthorByline } from "@/components/AuthorByline";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useDbCollege, useCollegesByState, useCollegesByCategory } from "@/hooks/useCollegesData";
import { useApprovalBodies } from "@/hooks/useApprovalBodies";
import { WhatsNewSection } from "@/components/WhatsNewSection";
import { UsefulLinks } from "@/components/UsefulLinks";
import { YouTubeVideoButton } from "@/components/YouTubeVideoButton";
import { ApplyButton } from "@/components/ApplyButton";
import { FacultySection } from "@/components/detail/FacultySection";
import { GalleryCarousel } from "@/components/detail/GalleryCarousel";
import { currentYear } from "@/lib/currentYear";
import { PlacementCompaniesSection } from "@/components/detail/PlacementCompaniesSection";
import { CollegeContactSection } from "@/components/detail/CollegeContactSection";
import { CollegeReviews } from "@/components/detail/CollegeReviews";
import { LatestNewsSection } from "@/components/detail/LatestNewsSection";
import { RelatedCoursesExamsStrip } from "@/components/detail/RelatedCoursesExamsStrip";
import { PartnerCollegeStrip } from "@/components/detail/PartnerCollegeStrip";
import { backendClient } from "@/integrations/backend/client";
import { useQuery } from "@tanstack/react-query";
import { RichSection } from "@/components/detail/RichSection";
import { RichText } from "@/components/detail/RichText";
import { PageSummary } from "@/components/detail/PageSummary";
import { absoluteSiteUrl } from "@/lib/constant";
import { formatFeeRange, formatIndianFee, groupCollegeFees, inferCourseSpecialization } from "@/lib/courseFeeGroups";

const COLLEGE_SECTIONS: ScrollSection[] = [
  { id: "overview", label: "College Info" },
  { id: "highlights", label: "Highlights" },
  { id: "courses", label: "Courses & Fees" },
  { id: "admissions", label: "Admissions" },
  { id: "placements", label: "Placements" },
  { id: "cutoff", label: "Cut-Offs" },
  { id: "rankings", label: "Rankings" },
  { id: "reviews", label: "Reviews" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "gallery", label: "Gallery" },
  { id: "scholarships", label: "Scholarships" },
  { id: "hostel", label: "Hostel" },
  { id: "compare", label: "Compare" },
  { id: "faculty", label: "Faculty" },
  { id: "recruiters", label: "Recruiters" },
  { id: "contact", label: "Contact" },
  { id: "news", label: "News" },
  { id: "faq", label: "Q&A" },
];

export default function CollegeDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: college, isLoading } = useDbCollege(slug);
  // Relational tables store the base database slug, while canonical public
  // URLs append the numeric short ID (for example, iit-delhi-10001).
  const collegeRelationSlug = college?.slug || parseSlugWithId(slug).slug;
  const [visibleCourseGroupCount, setVisibleCourseGroupCount] = useState(5);
  const [courseSearch, setCourseSearch] = useState("");
  const [expandedCourseGroups, setExpandedCourseGroups] = useState<Set<string>>(new Set());
  // Canonicalize URL to slug-with-id once the college resolves
  useEffect(() => {
    if (!college?.slug || !(college as any).short_id) return;
    const canonical = buildCollegeHref(college as any);
    const tabMatch = location.pathname.match(/\/colleges\/[^/]+(\/[^/?#]+)?/);
    const tail = tabMatch?.[1] || "";
    const desired = `${canonical}${tail}`;
    if (location.pathname !== desired) {
      navigate(`${desired}${location.search}${location.hash}`, { replace: true });
    }
  }, [college, location.pathname, location.search, location.hash, navigate]);
  const { data: sameStateColleges } = useCollegesByState(college?.state, collegeRelationSlug);
  const { data: similarColleges } = useCollegesByCategory(college?.category, collegeRelationSlug);
  const { data: approvalBodies = [] } = useApprovalBodies();
  const [counsellingOpen, setCounsellingOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryStart, setGalleryStart] = useState(0);


  const { data: collegeFees = [] } = useQuery({
    queryKey: ["college_fees", collegeRelationSlug],
    queryFn: async () => {
      const { data, error } = await (backendClient as any)
        .from("course_fees")
        .select("id,course_slug,course_name,course_group,specialization,fee_amount,fee_type,year")
        .eq("college_slug", collegeRelationSlug)
        .order("course_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!collegeRelationSlug,
    staleTime: 30 * 60 * 1000,
  });

  const groupedCollegeFees = useMemo(() => groupCollegeFees(collegeFees, courseSearch), [collegeFees, courseSearch]);
  const visibleCourseGroups = useMemo(
    () => groupedCollegeFees.slice(0, visibleCourseGroupCount),
    [groupedCollegeFees, visibleCourseGroupCount],
  );
  const visibleFeeCourseSlugs = useMemo(() => Array.from(new Set(
    visibleCourseGroups
      .flatMap((group) => group.entries)
      .map((fee) => fee.course_slug)
      .filter((courseSlug): courseSlug is string => typeof courseSlug === "string" && courseSlug.length > 0),
  )), [visibleCourseGroups]);
  const { data: feeCourseMetadata = [] } = useQuery({
    queryKey: ["college-fee-course-metadata", collegeRelationSlug, visibleFeeCourseSlugs],
    queryFn: async () => {
      const { data, error } = await (backendClient as any)
        .from("courses")
        .select("slug,name,duration,avg_fees")
        .eq("is_active", true)
        .in("slug", visibleFeeCourseSlugs);
      if (error) throw error;
      return data || [];
    },
    enabled: visibleFeeCourseSlugs.length > 0,
    staleTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    setVisibleCourseGroupCount(5);
    setExpandedCourseGroups(new Set());
  }, [collegeRelationSlug, courseSearch]);

  const toggleCourseGroup = (key: string) => {
    setExpandedCourseGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  useSEO({
    title: college ? (college.meta_title || `${college.name} - Admissions, Fees, Placements ${currentYear()}`) : undefined,
    description: college ? (college.meta_description || `${college.name} - admissions, fees, placements, courses, ranking details for ${currentYear()}`) : undefined,
    keywords: college?.meta_keywords || undefined,
    canonical: college ? buildCollegeHref(college as any) : undefined,
    ogImage: college?.image || undefined,
    jsonLd: college ? {
      "@context": "https://schema.org",
      "@type": "CollegeOrUniversity",
      name: college.name,
      alternateName: college.short_name || undefined,
      description: (college as any).page_summary || college.description || undefined,
      url: absoluteSiteUrl(buildCollegeHref(college as any)),
      image: college.image || undefined,
      logo: college.logo || undefined,
      foundingDate: college.established ? String(college.established) : undefined,
      address: {
        "@type": "PostalAddress",
        addressLocality: college.city || undefined,
        addressRegion: college.state || undefined,
        streetAddress: college.location || undefined,
        addressCountry: "IN",
      },
      sameAs: (college as any).official_website ? [(college as any).official_website] : undefined,
    } : undefined,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-20 text-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!college) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-20 text-center">
          <GraduationCap className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">College Not Found</h1>
          <p className="text-muted-foreground mb-6">The college you're looking for doesn't exist.</p>
          <Link to="/colleges"><Button className="gradient-primary text-primary-foreground rounded-xl">Browse All Colleges</Button></Link>
        </div>
        <Footer />
      </div>
    );
  }

  const availableSections = (() => {
    const has = {
      highlights: college.highlights?.length > 0,
      cutoff: Boolean(college.cutoff?.trim()),
      infrastructure: college.facilities?.length > 0 || Boolean(college.facilities_content?.trim()),
      gallery: Boolean(college.gallery_images?.length),
      scholarships: Boolean(college.scholarship_details?.trim()),
      hostel: Boolean(college.hostel_life?.trim()),
    } as Record<string, boolean>;

    return COLLEGE_SECTIONS.filter((section) => has[section.id] ?? true);
  })();
  const courseGroupCount = groupedCollegeFees.length;
  const nextCourseBatchSize = Math.min(5, Math.max(0, courseGroupCount - visibleCourseGroupCount));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container px-3 md:px-6 py-3 md:py-6 max-w-full" style={{ overflowX: "clip" }}>
        <PageBreadcrumb items={[{ label: "Colleges", href: "/colleges" }, { label: college.name }]} />

        {/* Cinematic hero - 2026 redesign */}
        <CollegeHeroCard college={college} onCounselling={() => setCounsellingOpen(true)} />
        <CollegeQuickFacts college={college} />
        <div className="mt-3"><CollegeAffiliationCard college={college} /></div>
        <div className="mt-2"><AuthorByline authorId={(college as any).author_id} /></div>

        {/* Trust bento + AI insight - answer "is this credible? is it for me?" upfront */}
        <div className="mt-5 space-y-4 md:space-y-5">
          <CollegeTrustBento college={college} />
          <CollegeAIInsight college={college} />
        </div>


        <Dialog open={counsellingOpen} onOpenChange={setCounsellingOpen}>
          <DialogContent className="max-w-md p-0 overflow-hidden">
            <DialogHeader className="px-5 pt-5">
              <DialogTitle>Get free counselling for {college.name}</DialogTitle>
            </DialogHeader>
            <div className="p-5 pt-3">
              <LeadCaptureForm
                variant="inline"
                title=""
                subtitle="Our counselor will call you back shortly"
                source={`college_counselling_${college.slug}`}
                interestedCollegeSlug={college.slug}
                onSuccess={() => setCounsellingOpen(false)}
              />
            </div>
          </DialogContent>
        </Dialog>

        <ScrollSpy sections={availableSections} baseUrl={`/colleges/${slug}`} updateUrlOnScroll className="mb-6 -mx-4 px-4 md:mx-0 md:px-0 rounded-none md:rounded-xl" />

        <div className="mb-6">
          <WhatsNewSection entityName={college.short_name || college.name} entityType="college" entitySlug={college.slug} category={college.category} />
        </div>


        {/* Mobile decision rail - surfaces Apply, Counselor, Brochure, Campus Tour on small screens */}
        <div className="lg:hidden mb-6">
          <CollegeDecisionRail college={college} />
        </div>

        <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Summary (admin-written page summary) */}
            <PageSummary html={(college as any).page_summary} entityName={college.short_name || college.name} kind="college" />
            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Star, label: "Rating", value: `${college.rating}/5`, color: "text-golden" },
                { icon: GraduationCap, label: "Courses", value: `${college.courses_count}+`, color: "text-primary" },
                { icon: TrendingUp, label: "Avg Package", value: college.placement, color: "text-success" },
                { icon: Building, label: "Type", value: college.type, color: "text-accent" },
              ].map((stat) => (
                <div key={stat.label} className="bg-card rounded-xl border border-border p-3 text-center">
                  <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                  <p className="text-sm font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Approval logos strip - merges library bodies (selected via codes) + per-college custom logos */}
            {(() => {
              const codes: string[] = (college as any).approvals || [];
              const libMatches = approvalBodies.filter((b) => codes.includes(b.code) && b.logo_url);
              const customLogos: string[] = (college as any).approval_logos || [];
              const customNames: string[] = (college as any).approval_logo_names || [];
              const items = [
                ...libMatches.map((b) => ({ url: b.logo_url, name: b.name, code: b.code })),
                ...customLogos.map((url, i) => ({ url, name: customNames[i] || `Approval ${i + 1}`, code: "" })),
              ];
              if (items.length === 0) return null;
              return (
                <section className="bg-card rounded-2xl border border-border p-5">
                  <h3 data-h className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Approvals & Accreditations</h3>
                  <TooltipProvider delayDuration={150}>
                    <div className="flex flex-wrap items-center gap-3">
                      {items.map((it, i) => (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <div className="bg-muted/40 rounded-lg p-2 flex flex-col items-center justify-center h-20 w-28 border border-border hover:border-primary/40 transition cursor-help">
                              <img src={it.url} alt={it.name} loading="lazy" className="max-h-10 max-w-full object-contain" />
                              <span className="mt-1 text-[10px] font-medium text-muted-foreground line-clamp-1 text-center">{it.code || it.name}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{it.name}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </TooltipProvider>
                </section>
              );
            })()}

            {/* Overview */}
            <section id="overview" className="bg-card rounded-2xl border border-border p-5 md:p-6 scroll-mt-32">
              <h2 data-h className="text-xl md:text-[22px] font-extrabold text-foreground leading-tight tracking-tight">
                About
              </h2>
              <div className="mt-3">
                <RichText html={college.description} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-5">
                {[
                  { label: "Type", value: college.type },
                  { label: "Established", value: String(college.established) },
                  { label: "NAAC Grade", value: college.naac_grade },
                  { label: "Courses", value: `${college.courses_count}+` },
                  { label: "Fees", value: college.fees },
                  { label: "Avg. Package", value: college.placement },
                ].map((info) => (
                  <div key={info.label} className="rounded-xl bg-muted/40 border border-border/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{info.label}</p>
                    <p className="text-sm font-bold text-foreground line-clamp-1 mt-0.5">{info.value || "-"}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Contact details - gated, shown right above Highlights */}
            <CollegeContactSection collegeSlug={college.slug} collegeName={college.name} />

            {/* College Details card - moved here, just above Highlights */}
            <section className="bg-card rounded-2xl border border-border p-5">
              <h3 data-h className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><Building className="w-4 h-4 text-primary" /> College Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div><p className="text-muted-foreground">Location</p><p className="font-medium text-foreground">{college.location || "-"}</p></div>
                <div><p className="text-muted-foreground">State</p><p className="font-medium text-foreground">{college.state || "-"}</p></div>
                <div><p className="text-muted-foreground">City</p><p className="font-medium text-foreground">{college.city || "-"}</p></div>
                <div><p className="text-muted-foreground">Established</p><p className="font-medium text-foreground">{college.established || "-"}</p></div>
                <div><p className="text-muted-foreground">Type</p><p className="font-medium text-foreground">{college.type || "-"}</p></div>
                <div><p className="text-muted-foreground">NAAC</p><p className="font-medium text-foreground">{college.naac_grade || "-"}</p></div>
              </div>
            </section>

            {/* Highlights - only render when there are items so empty cards don't break alignment */}
            {college.highlights?.length > 0 && (
              <RichSection
                id="highlights"
                title={<>Key Highlights</>}
              >
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {college.highlights.map((h, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/40 p-3">
                      <span className="mt-0.5 inline-flex w-6 h-6 rounded-full bg-primary/10 text-primary items-center justify-center text-[11px] font-bold shrink-0">{i + 1}</span>
                      <span className="text-sm text-foreground leading-snug">{h}</span>
                    </div>
                  ))}
                </div>
              </RichSection>
            )}

            {/* Courses & Fees - open by default so students see fees immediately */}
            <RichSection
              id="courses"
              title={<>Courses & Fees</>}
              defaultOpen
            >
              {college.course_fee_content && (
                <div className="mb-4"><RichText html={college.course_fee_content} /></div>
              )}
              {collegeFees.length > 0 && (
                <label className="relative mb-3 block max-w-xs">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={courseSearch}
                    onChange={(event) => setCourseSearch(event.target.value)}
                    placeholder="Search courses"
                    aria-label={`Search courses at ${college.name}`}
                    className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                  />
                </label>
              )}
              <div className="dc-scroll-table">
                <table id="college-course-fee-table" className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-3 py-3 text-left font-medium text-muted-foreground">Broad course</th>
                      <th className="px-3 py-3 text-left font-medium text-muted-foreground">Specializations</th>
                      <th className="px-3 py-3 text-left font-medium text-muted-foreground">Fee range</th>
                      <th className="w-24 px-3 py-3 text-right font-medium text-muted-foreground">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCourseGroups.length > 0 ? (
                      visibleCourseGroups.map((group) => {
                        const expanded = expandedCourseGroups.has(group.key);
                        const feeType = group.feeTypes.length === 1 ? group.feeTypes[0] : null;
                        return (
                          <Fragment key={group.key}>
                            <tr className="border-b border-border last:border-0">
                              <td className="px-3 py-4">
                                <button type="button" onClick={() => toggleCourseGroup(group.key)} className="text-left font-semibold text-primary hover:underline">
                                  {group.label}
                                </button>
                              </td>
                              <td className="px-3 py-4 text-muted-foreground">
                                {group.specializationCount} specialization{group.specializationCount === 1 ? "" : "s"}
                              </td>
                              <td className="px-3 py-4">
                                <div className="font-semibold text-foreground">{formatFeeRange(group)}</div>
                                <div className="mt-0.5 text-[11px] text-muted-foreground">
                                  {feeType ? feeType : group.feeTypes.length > 1 ? "Multiple fee types" : "Published fee"}
                                </div>
                              </td>
                              <td className="px-3 py-4 text-right">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 gap-1 px-2 text-xs"
                                  aria-expanded={expanded}
                                  aria-label={`${expanded ? "Hide" : "Show"} ${group.label} specializations`}
                                  onClick={() => toggleCourseGroup(group.key)}
                                >
                                  {expanded ? "Hide" : "View"}
                                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                                </Button>
                              </td>
                            </tr>
                            {expanded && (
                              <tr className="border-b border-border bg-muted/20">
                                <td colSpan={4} className="p-0">
                                  <div className="divide-y divide-border/70 px-3 py-1">
                                    {group.entries.map((entry, index) => {
                                      const linked = feeCourseMetadata.find((course: any) => course.slug === entry.course_slug);
                                      const amount = entry.fee_amount === null || entry.fee_amount === undefined || entry.fee_amount === ""
                                        ? null
                                        : Number(entry.fee_amount);
                                      return (
                                        <div key={entry.id || `${entry.course_slug}-${index}`} className="grid grid-cols-[minmax(0,1fr)_8rem_9rem_2rem] items-center gap-3 py-3">
                                          <div className="min-w-0">
                                            {linked ? (
                                              <Link to={`/courses/${linked.slug}`} className="font-medium text-foreground hover:text-primary hover:underline">
                                                {inferCourseSpecialization(entry)}
                                              </Link>
                                            ) : (
                                              <span className="font-medium text-foreground">{inferCourseSpecialization(entry)}</span>
                                            )}
                                            {entry.year && <div className="text-[11px] text-muted-foreground">Fee year: {entry.year}</div>}
                                          </div>
                                          <span className="text-xs text-muted-foreground">{linked?.duration || "Duration varies"}</span>
                                          <span className="text-xs font-medium text-foreground">
                                            {formatIndianFee(amount !== null && Number.isFinite(amount) ? amount : null)}
                                            {entry.fee_type && <span className="block font-normal text-muted-foreground">{entry.fee_type}</span>}
                                          </span>
                                          {linked ? (
                                            <Link to={`/courses/${linked.slug}`} aria-label={`Open ${entry.course_name || inferCourseSpecialization(entry)}`}>
                                              <ExternalLink className="h-3.5 w-3.5 text-primary" />
                                            </Link>
                                          ) : <span />}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-4 text-sm text-muted-foreground">
                          {courseSearch.trim() ? "No degree or specialization matches your search." : "Check the official college website for current courses and fees."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {courseGroupCount > visibleCourseGroupCount && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs"
                    data-testid="show-more-college-courses"
                    aria-controls="college-course-fee-table"
                    onClick={() => setVisibleCourseGroupCount((count) => count + 5)}
                  >
                    Show {nextCourseBatchSize} more degree{nextCourseBatchSize === 1 ? "" : "s"}
                  </Button>
                )}
                {courseGroupCount > 5 && (
                  <span className="text-xs text-muted-foreground" aria-live="polite">
                    Showing {Math.min(visibleCourseGroupCount, courseGroupCount)} of {courseGroupCount} degrees
                  </span>
                )}
                <Link to="/courses">
                  <Button variant="ghost" size="sm" className="rounded-xl text-xs">Browse course directory →</Button>
                </Link>
              </div>
            </RichSection>

            <LeadCaptureForm variant="inline" title="📞 Get admission guidance for this college" source={`college_inline_${college.slug}`} interestedCollegeSlug={college.slug} />

            {/* Admissions */}
            <RichSection
              id="admissions"
              title={<>Admission Process {currentYear()}</>}
              defaultOpen
            >
              {/*
                Single source of truth - exactly ONE block renders:
                1. Admin rich-text `admission_process` (highest priority), OR
                2. Admin-curated `admission_criteria_points` cards, OR
                3. Built-in 5-step fallback timeline.
                This kills the duplicate that was showing both cards + timeline.
              */}
              {(() => {
                const adminPoints: string[] = Array.isArray((college as any).admission_criteria_points)
                  ? ((college as any).admission_criteria_points as string[]).filter((s) => s && s.trim())
                  : [];
                if (college.admission_process && college.admission_process.trim()) {
                  return <div><RichText html={college.admission_process} /></div>;
                }
                if (adminPoints.length > 0) {
                  return (
                    <ol className="relative space-y-4 pl-6 border-l-2 border-primary/30">
                      {adminPoints.slice(0, 8).map((p, i) => (
                        <li key={i} className="relative">
                          <span className="absolute -left-[31px] top-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-extrabold ring-4 ring-background">{i + 1}</span>
                          <p className="text-[15px] text-foreground/90 leading-relaxed">{p}</p>
                        </li>
                      ))}
                    </ol>
                  );
                }
                return (
                  <ol className="relative space-y-4 pl-6 border-l-2 border-primary/30">
                    {[
                      { title: "Check Eligibility", text: college.eligibility_criteria || "Confirm you meet the academic and entrance score requirements before applying." },
                      { title: "Apply Online", text: "Register on the official website and complete the application form with required documents." },
                      { title: "Entrance Exam", text: "Appear for the relevant entrance exam (JEE / NEET / CAT / CUET, as applicable)." },
                      { title: "Counselling", text: "Attend counselling rounds for document verification, choice filling and interviews where applicable." },
                      { title: "Admission", text: "Pay the admission fee and complete formalities to secure your seat." },
                    ].map((s, i) => (
                      <li key={i} className="relative">
                        <span className="absolute -left-[31px] top-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-extrabold ring-4 ring-background">{i + 1}</span>
                        <p className="text-[15px] font-bold text-foreground">{s.title}</p>
                        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{s.text}</p>
                      </li>
                    ))}
                  </ol>
                );
              })()}
            </RichSection>

            {/* Placements */}
            <RichSection
              id="placements"
              title={<>Placements {currentYear()}</>}
            >
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center">
                  <p className="text-lg md:text-xl font-extrabold text-primary">{college.placement}</p>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mt-0.5">Avg Package</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/40 p-3 text-center">
                  <p className="text-lg md:text-xl font-extrabold text-foreground">95%+</p>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mt-0.5">Placed</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/40 p-3 text-center">
                  <p className="text-lg md:text-xl font-extrabold text-foreground">{college.top_recruiters.length > 0 ? `${college.top_recruiters.length}+` : "200+"}</p>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mt-0.5">Recruiters</p>
                </div>
              </div>
              {college.placement_content && (
                <div className="mb-4"><RichText html={college.placement_content} /></div>
              )}
              {college.top_recruiters?.length > 0 && (
                <>
                  <h3 data-h className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                    <span className="inline-block w-1 h-4 bg-primary rounded-full" /> Top Recruiters
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {college.top_recruiters.map((r) => (
                      <Badge key={r} variant="secondary" className="text-xs py-1.5 px-3 rounded-full">{r}</Badge>
                    ))}
                  </div>
                </>
              )}
            </RichSection>

            {/* Cut-Offs - only render when admin has provided real content */}
            {college.cutoff && college.cutoff.trim() && (
              <RichSection
                id="cutoff"
                title={<>Cut-Off {currentYear()}</>}
              >
                <RichText html={college.cutoff} />
              </RichSection>
            )}
            <DynamicAdBanner variant="horizontal" position="mid-page" page="colleges" itemSlug={college.slug} />

            {/* Rankings */}
            <RichSection
              id="rankings"
              title={<>Rankings</>}
            >
              <div className="flex items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <Award className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-foreground leading-tight">{college.ranking}</p>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Overall Ranking</p>
                </div>
              </div>
              {college.rankings_content && (
                <div className="mt-4"><RichText html={college.rankings_content} /></div>
              )}
            </RichSection>

            {/* Reviews - verified user-submitted */}
            <CollegeReviews
              collegeSlug={college.slug}
              collegeName={college.short_name || college.name}
              fallbackRating={college.rating}
              fallbackReviewsCount={college.reviews}
            />

            {/* Infrastructure - only render when admin filled facilities or rich content */}
            {(college.facilities?.length > 0 || (college.facilities_content && college.facilities_content.trim())) && (
              <RichSection id="infrastructure" title={<>Infrastructure & Facilities</>}>
                {college.facilities?.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
                    {college.facilities.map((f) => (
                      <div key={f} className="flex items-center gap-2 p-2.5 rounded-xl border border-border/60 bg-muted/40">
                        <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm text-foreground leading-snug">{f}</span>
                      </div>
                    ))}
                  </div>
                )}
                {college.facilities_content && <RichText html={college.facilities_content} />}
              </RichSection>
            )}

            {/* Gallery - only when there are images */}
            {college.gallery_images && college.gallery_images.length > 0 && (
              <RichSection id="gallery" title={<>Campus Gallery</>} defaultOpen>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {college.gallery_images.slice(0, 4).map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setGalleryStart(i); setGalleryOpen(true); }}
                      className="group relative overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      aria-label={`Open photo ${i + 1}`}
                    >
                      <img src={img} alt={`${college.name} gallery ${i + 1}`} className="h-32 w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                    </button>
                  ))}
                </div>
                {college.gallery_images.length > 4 && (
                  <div className="mt-3 flex justify-center">
                    <Button variant="outline" size="sm" onClick={() => { setGalleryStart(0); setGalleryOpen(true); }}>
                      View all {college.gallery_images.length} photos
                    </Button>
                  </div>
                )}
                <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
                  <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden p-0">
                    <DialogHeader className="px-5 pt-5"><DialogTitle>{college.name} - Campus Gallery</DialogTitle></DialogHeader>
                    <GalleryCarousel images={college.gallery_images} name={college.name} startIndex={galleryStart} />
                  </DialogContent>
                </Dialog>

              </RichSection>
            )}

            <FacultySection collegeSlug={college.slug} />
            <PlacementCompaniesSection collegeSlug={college.slug} />
            <LeadCaptureForm variant="inline" title="Need help with admission?" source={`college_mid_${college.slug}`} interestedCollegeSlug={college.slug} />

            {/* Scholarships - admin content only */}
            {college.scholarship_details && college.scholarship_details.trim() && (
              <RichSection id="scholarships" title={<>Scholarships</>}>
                <RichText html={college.scholarship_details} />
              </RichSection>
            )}

            {/* Hostel - admin content only */}
            {college.hostel_life && college.hostel_life.trim() && (
              <RichSection id="hostel" title={<>Hostel Life</>}>
                <RichText html={college.hostel_life} />
              </RichSection>
            )}


            {/* Compare */}
            <section id="compare" className="bg-card rounded-2xl border border-border p-5 scroll-mt-32">
              <h2 data-h className="text-lg font-bold text-foreground mb-3">Compare with Similar Colleges</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {(similarColleges ?? []).slice(0, 4).map((c) => (
                  <Link key={c.slug} to={`/colleges/${c.slug}`} className="bg-muted rounded-xl p-3 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                      {(c.logo || c.image) ? (
                        <img
                          src={c.logo || c.image}
                          alt={`${c.name} logo`}
                          className="w-12 h-12 flex-none aspect-square rounded-lg border border-border bg-card p-1 object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-12 h-12 flex-none aspect-square rounded-lg border border-border bg-card" aria-hidden="true" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.location}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">{c.ranking}</Badge>
                          <span className="text-xs text-success font-medium">{c.placement}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {(sameStateColleges ?? []).length > 0 && (
                <div className="mt-4">
                  <h3 data-h className="text-sm font-semibold text-foreground mb-2">More colleges in {college.state}</h3>
                  <div className="flex flex-wrap gap-2">
                    {(sameStateColleges ?? []).slice(0, 6).map((c) => (
                      <Link key={c.slug} to={`/colleges/${c.slug}`}>
                        <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-primary/10">{c.short_name || c.name}</Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>

              <PartnerCollegeStrip
                title={`Partner colleges near ${college.state || "India"}`}
                subtitle="Priority partner options you can compare with this college."
                excludeSlug={college.slug}
                limit={4}
                frame
              />

            {/* News (dynamic from articles) - show only 4 with View All */}

            {/* FAQ */}
            <section id="faq" className="scroll-mt-32">
              <FAQSection
                page="colleges"
                itemSlug={college.slug}
                title={`FAQs`}
                fallback={buildDefaultFaqs("college", {
                  name: college.name,
                  location: college.location,
                  fees: college.fees,
                  placement: college.placement,
                  established: college.established,
                })}
              />
            </section>

            <RelatedCoursesExamsStrip
              courseSlugs={(college as any).related_courses || []}
              examSlugs={(college as any).related_exams || []}
              collegeName={college.short_name || college.name}
            />

            <LatestNewsSection entityType="college" entitySlug={college.slug} entityName={college.short_name || college.name} />

            {(() => {
              const sourceLinks = Array.from(new Set([
                (college as any).official_website,
                (college as any).official_source_url,
              ].filter((value): value is string => typeof value === "string" && /^https?:\/\//i.test(value))));
              if (!sourceLinks.length) return null;
              return (
                <section id="official-sources" className="scroll-mt-32 rounded-2xl border border-border bg-card p-5 md:p-6">
                  <h2 className="text-xl font-extrabold tracking-tight text-foreground">Official sources</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Verify programmes, fees, admission dates and notices directly with the institution before applying or paying.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sourceLinks.map((url, index) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
                      >
                        {index === 0 ? "Institution website" : "Official reference"}
                      </a>
                    ))}
                  </div>
                </section>
              );
            })()}

            {/* Useful Links */}
            <UsefulLinks
              type="college"
              name={college.name}
              shortName={college.short_name}
              slug={college.slug}
              state={college.state}
              city={college.city}
              category={college.category}
              sections={COLLEGE_SECTIONS}
              topCourses={feeCourseMetadata.map((c: any) => ({ name: c.name, slug: c.slug }))}
            />
          </div>

          {/* Sidebar - sticky decision rail leads, then lead form, then context */}
          <aside className="hidden lg:block">
            <div className="space-y-4 pb-4">
              {/* Primary decision rail - single confident next step */}
              <CollegeDecisionRail college={college} />

              <LeadCaptureForm variant="card" title={`Apply to ${college.name}`} subtitle="Get free counseling and application support" source={`college_detail_sidebar_${college.slug}`} interestedCollegeSlug={college.slug} />


              {/* Contact Info */}
              <div className="bg-card rounded-2xl border border-border p-4">
                <h3 data-h className="text-sm font-bold text-foreground mb-3">📍 Contact Information</h3>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p><span className="font-medium text-foreground">Location:</span> {college.location}</p>
                  <p><span className="font-medium text-foreground">State:</span> {college.state}</p>
                  <p><span className="font-medium text-foreground">City:</span> {college.city}</p>
                  <p><span className="font-medium text-foreground">Established:</span> {college.established}</p>
                </div>
              </div>

              {/* Top Courses */}
              {feeCourseMetadata.length > 0 && (
                <div className="bg-card rounded-2xl border border-border p-4">
                  <h3 data-h className="text-sm font-bold text-foreground mb-3">📚 Top Courses</h3>
                  <div className="space-y-2">
                    {feeCourseMetadata.slice(0, 5).map((c: any) => (
                      <Link key={c.slug} to={`/courses/${c.slug}`} className="block text-xs text-primary hover:underline py-1 border-b border-border last:border-0">{c.name}</Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Similar Colleges */}
              {(similarColleges ?? []).length > 0 && (
                <div className="bg-card rounded-2xl border border-border p-4">
                  <h3 data-h className="text-sm font-bold text-foreground mb-3">🏛️ Similar Colleges</h3>
                  <div className="space-y-2">
                    {(similarColleges ?? []).slice(0, 5).map((c) => (
                      <Link key={c.slug} to={`/colleges/${c.slug}`} className="block text-xs text-primary hover:underline py-1 border-b border-border last:border-0">{c.short_name || c.name}</Link>
                    ))}
                  </div>
                </div>
              )}

              <PartnerCollegeStrip title="Partner Colleges" excludeSlug={college.slug} limit={5} compact />

              <DynamicAdBanner variant="vertical" position="sidebar" page="colleges" itemSlug={college.slug} />
            </div>
          </aside>
        </div>

        <div className="mt-10">
          <LeadCaptureForm variant="banner" title={`🎓 Want to get into ${college.name}? Get expert guidance!`} subtitle="Our counselors have helped thousands of students with admissions" source={`college_detail_bottom_${college.slug}`} interestedCollegeSlug={college.slug} />
        </div>
      </main>

      <AlsoCheckSection />
      <Footer />
      <MobileBottomBar type="college" slug={college.slug} collegeName={college.short_name || college.name} brochureUrl={college.brochure_url || undefined} sections={COLLEGE_SECTIONS} />
    </div>
  );
}
