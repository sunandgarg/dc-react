import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Index page layout (static source assertions)", () => {
  const indexSrc = readFileSync(resolve(process.cwd(), "src/pages/Index.tsx"), "utf8");
  const belowFoldSrc = readFileSync(resolve(process.cwd(), "src/components/HomeBelowFold.tsx"), "utf8");
  const homeToolsSrc = readFileSync(resolve(process.cwd(), "src/components/HomeToolsSection.tsx"), "utf8");
  const homeDiscoverySrc = readFileSync(resolve(process.cwd(), "src/components/HomeDiscoverySection.tsx"), "utf8");
  const homeNewsSrc = readFileSync(resolve(process.cwd(), "src/components/HomeNewsSection.tsx"), "utf8");
  const homeTrustSrc = readFileSync(resolve(process.cwd(), "src/components/HomeTrustBar.tsx"), "utf8");
  const topRankedSrc = readFileSync(resolve(process.cwd(), "src/components/TopRankedColleges.tsx"), "utf8");
  const faqSrc = readFileSync(resolve(process.cwd(), "src/components/FAQSection.tsx"), "utf8");
  const heroSrc = readFileSync(resolve(process.cwd(), "src/components/HeroSection.tsx"), "utf8");
  const footerSrc = readFileSync(resolve(process.cwd(), "src/components/Footer.tsx"), "utf8");
  const leadFormSrc = readFileSync(resolve(process.cwd(), "src/components/LeadCaptureForm.tsx"), "utf8");
  const cleanerSrc = readFileSync(resolve(process.cwd(), "src/pages/AdminDataCleaner.tsx"), "utf8");
  const navbarSrc = readFileSync(resolve(process.cwd(), "src/components/Navbar.tsx"), "utf8");
  const trustSrc = readFileSync(resolve(process.cwd(), "src/components/TrustedBySection.tsx"), "utf8");
  const adminPartnersSrc = readFileSync(resolve(process.cwd(), "src/pages/AdminPartners.tsx"), "utf8");
  const collegeCardSrc = readFileSync(resolve(process.cwd(), "src/components/CollegeCard.tsx"), "utf8");
  const allCollegesSrc = readFileSync(resolve(process.cwd(), "src/pages/AllColleges.tsx"), "utf8");
  const directoryHookSrc = readFileSync(resolve(process.cwd(), "src/hooks/useCollegeDirectory.ts"), "utf8");
  const examCalendarSrc = readFileSync(resolve(process.cwd(), "src/pages/ExamCalendar.tsx"), "utf8");
  const announcementSrc = readFileSync(resolve(process.cwd(), "src/components/AnnouncementBar.tsx"), "utf8");
  const adminAdsSrc = readFileSync(resolve(process.cwd(), "src/pages/AdminAds.tsx"), "utf8");
  const bootstrapSrc = readFileSync(resolve(process.cwd(), "src/lib/bootstrap.ts"), "utf8");
  const backendIndexSrc = readFileSync(resolve(process.cwd(), "backend/src/index.mjs"), "utf8");
  const globalAdsSrc = readFileSync(resolve(process.cwd(), "src/components/GlobalInternalAds.tsx"), "utf8");
  const adsenseLoaderSrc = readFileSync(resolve(process.cwd(), "src/components/ads/AdsenseLoader.tsx"), "utf8");
  const articleDetailSrc = readFileSync(resolve(process.cwd(), "src/pages/ArticleDetail.tsx"), "utf8");
  const sitemapGeneratorSrc = readFileSync(resolve(process.cwd(), "scripts/generate-sitemap.ts"), "utf8");
  const documentSrc = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
  const allExamsSrc = readFileSync(resolve(process.cwd(), "src/pages/AllExams.tsx"), "utf8");
  const allCoursesSrc = readFileSync(resolve(process.cwd(), "src/pages/AllCourses.tsx"), "utf8");
  const mobileFilterSheetSrc = readFileSync(resolve(process.cwd(), "src/components/MobileFilterSheet.tsx"), "utf8");
  const seoSlugsSrc = readFileSync(resolve(process.cwd(), "src/lib/seoSlugs.ts"), "utf8");
  const productionConfigSrc = readFileSync(resolve(process.cwd(), "backend/scripts/configure-production-site-integrations.mjs"), "utf8");
  const lockTargetPromoSrc = readFileSync(resolve(process.cwd(), "src/components/LockTargetFloatingPromo.tsx"), "utf8");

  it("does NOT import or render the LoanReferStrip below scholarships", () => {
    expect(indexSrc).not.toMatch(/LoanReferStrip/);
    expect(belowFoldSrc).not.toMatch(/LoanReferStrip/);
  });

  it("defers below-fold homepage content through HomeBelowFold", () => {
    expect(indexSrc).toMatch(/HomeBelowFold/);
    expect(indexSrc).toMatch(/OptionalSectionBoundary name="home-below-fold"/);
    expect(indexSrc.indexOf("<HeroSection")).toBeLessThan(indexSrc.indexOf("<OptionalSectionBoundary"));
    expect(belowFoldSrc).toMatch(/OptionalSectionBoundary name=\{name\}/);
  });

  it("keeps Study Material out of the homepage body because it now lives in the header mega-menu", () => {
    expect(belowFoldSrc).not.toMatch(/StudyMaterialStrip/);
    expect(belowFoldSrc).not.toMatch(/CollegeStudyStrip/);
  });

  it("keeps the homepage focused on a compact data-led discovery path", () => {
    expect(belowFoldSrc).toMatch(/TopRankedColleges/);
    expect(belowFoldSrc).toMatch(/CategorySection/);
    expect(belowFoldSrc).toMatch(/HomeDiscoverySection/);
    expect(belowFoldSrc).toMatch(/HomeToolsSection/);
    expect(belowFoldSrc).toMatch(/HomeNewsSection/);
    expect(belowFoldSrc).toMatch(/FAQSection page="homepage"[\s\S]*limit=\{5\}[\s\S]*compact/);
    expect(belowFoldSrc).toMatch(/HomeTrustBar/);
    expect(belowFoldSrc).not.toMatch(/FeaturesSection|ExamStrategiesSection|PeriodicLeadPopup|LeadCaptureForm/);
  });

  it("adds lightweight discovery, animated tools, live exam news, and compact FAQs", () => {
    expect(homeDiscoverySrc).toMatch(/IIT, IIM, Global Degrees/);
    expect(homeDiscoverySrc).toMatch(/Online degree/);
    expect(homeDiscoverySrc).toMatch(/Study abroad/);
    expect(homeDiscoverySrc).toMatch(/from\("promoted_programs"\)/);
    expect(homeDiscoverySrc).toMatch(/from\("popular_places"\)/);
    expect(homeDiscoverySrc).toMatch(/https:\/\/online\.dekhocampus\.com/);
    expect(homeDiscoverySrc).toMatch(/https:\/\/abroad\.dekhocampus\.com/);
    expect(homeDiscoverySrc).toMatch(/grid grid-cols-2/);
    expect(homeDiscoverySrc).toMatch(/GLA Online[\s\S]*Amity Online[\s\S]*Manipal Online[\s\S]*Shoolini Online[\s\S]*SRM Online[\s\S]*VIT Online/);
    expect(homeDiscoverySrc).toMatch(/CU Online[\s\S]*LPU Online[\s\S]*JAIN Online[\s\S]*DPU Online[\s\S]*SMU Online[\s\S]*Uttaranchal Online/);
    expect(homeDiscoverySrc).toMatch(/France[\s\S]*Norway[\s\S]*Ireland[\s\S]*Mexico[\s\S]*Russia[\s\S]*Kazakhstan[\s\S]*Georgia/);
    expect(homeDiscoverySrc.match(/https:\/\/aws-origin\.dekhocampus\.com\/storage\/v1\/object\/public\//g)).toHaveLength(12);
    expect(homeDiscoverySrc).not.toMatch(/university-logos\/v1/);
    expect(homeDiscoverySrc).toMatch(/VIT Online[\s\S]*fallback=/);
    expect(homeDiscoverySrc).toMatch(/bg-\[#fff9e8\]/);
    expect(homeDiscoverySrc).toMatch(/USA[\s\S]*Canada[\s\S]*Australia[\s\S]*UK[\s\S]*Europe[\s\S]*Singapore/);
    expect(homeDiscoverySrc).toMatch(/useSwipeRail/);
    expect(homeDiscoverySrc).toMatch(/scrollBy/);
    expect(homeDiscoverySrc).toMatch(/IndianMapMark/);
    expect(homeDiscoverySrc).toMatch(/india-tricolour-map-256\.png/);
    expect(homeDiscoverySrc).toMatch(/from\("program_categories"\)/);
    expect(homeDiscoverySrc).toMatch(/FALLBACK_PROGRAM_CATEGORIES/);
    expect(homeDiscoverySrc).toMatch(/FALLBACK_INSTITUTE_PROGRAMS/);
    expect(homeDiscoverySrc).toMatch(/premium-programs\?cat=/);
    expect(homeDiscoverySrc).toMatch(/Global degree/);
    expect(homeDiscoverySrc).toMatch(/ONLINE_UNIVERSITY_ORDER[\s\S]*GLA Online[\s\S]*Amity Online[\s\S]*VIT Online[\s\S]*SRM Online[\s\S]*CU Online[\s\S]*Manipal Online/);
    expect(homeDiscoverySrc).toMatch(/USA[\s\S]*Canada[\s\S]*Australia[\s\S]*UK[\s\S]*Germany/);
    expect(homeDiscoverySrc.match(/useSwipeRail\(reduceMotion, \d+, \d+, false\)/g)).toHaveLength(2);
    expect(homeDiscoverySrc).toMatch(/font-semibold italic[\s\S]*Swipe/);
    expect(belowFoldSrc).toMatch(/HomeToolsSection[\s\S]*HomeLocationSection[\s\S]*HomeNewsSection/);
    expect(homeDiscoverySrc).not.toMatch(/IndianFlagMark/);
    expect(homeDiscoverySrc).not.toMatch(/Laptop2|Globe2|State &amp; city/);
    expect(homeToolsSrc.match(/href: "\/tools\//g)).toHaveLength(5);
    expect(homeToolsSrc).toMatch(/href: "\/lock-target"/);
    expect(homeToolsSrc).toMatch(/useReducedMotion/);
    expect(homeToolsSrc).toMatch(/grid-flow-col/);
    expect(homeToolsSrc).toMatch(/carousel\.scrollBy/);
    expect(homeToolsSrc).toMatch(/Compare colleges[\s\S]*Predict my rank[\s\S]*Check eligibility/);
    expect(homeToolsSrc).not.toMatch(/LeadCaptureForm|CompareCollegesTool|RankPredictorTool/);
    expect(homeNewsSrc).toMatch(/useArticleSidebarArticles\(60\)/);
    expect(homeNewsSrc).toMatch(/NEWS_LIMIT = 6/);
    expect(homeNewsSrc).toMatch(/articles\s*\.slice\(0, NEWS_LIMIT\)/);
    expect(homeNewsSrc).toMatch(/Exam and admission updates/);
    expect(homeNewsSrc).not.toMatch(/Live news|animate-ping/);
    expect(homeNewsSrc).not.toMatch(/grid-cols|featured_image|formatDate/);
    expect(homeNewsSrc).not.toMatch(/LeadCaptureForm|DynamicAdBanner/);
    expect(homeTrustSrc).toMatch(/GoogleGLogo/);
    expect(homeTrustSrc).toMatch(/Students rate us 4\.9 on Google/);
    expect(homeTrustSrc).toMatch(/Working with leading institutions/);
    expect(topRankedSrc).toMatch(/displayName[\s\S]*showFullName[\s\S]*\{displayName\}/);
    expect(faqSrc).toMatch(/compact\?: boolean/);
    expect(lockTargetPromoSrc).toMatch(/pathname === "\/"/);
  });

  it("keeps the homepage completely free of Google ad slots", () => {
    expect(belowFoldSrc).not.toMatch(/GoogleAd|placement="homepage"/);
    expect(adsenseLoaderSrc).toMatch(/isHomepage \|\| !settings/);
    expect(adsenseLoaderSrc).toMatch(/google-auto-placed/);
    expect(adsenseLoaderSrc).toContain("script[src*='pagead2.googlesyndication.com/pagead/js']");
    expect(adsenseLoaderSrc).toMatch(/observer\.observe\(document\.documentElement/);
    expect(navbarSrc).toMatch(/pathname !== "\/" && <div id="global-internal-ad-top-anchor"/);
    expect(globalAdsSrc).toMatch(/if \(pathname === "\/"\) return null/);
    expect(readFileSync(resolve(process.cwd(), "src/components/ads/GoogleAd.tsx"), "utf8")).toMatch(/pathname === "\/" \|\| !allowed/);
  });

  it("does not expose source-verification or last-reviewed UI on article pages", () => {
    expect(articleDetailSrc).not.toMatch(/Reviewed under the|How often is this article updated\?|Updated \{dbArticle/);
  });

  it("does NOT render the removed LiveScholarshipsStrip", () => {
    expect(indexSrc).not.toMatch(/LiveScholarshipsStrip/);
    expect(belowFoldSrc).not.toMatch(/LiveScholarshipsStrip/);
  });

  it("keeps the complete quick links in the global footer without duplicating them on the homepage", () => {
    expect(belowFoldSrc).not.toMatch(/QuickLinksBar/);
    expect(footerSrc).toMatch(/QuickLinksBar/);
    expect(footerSrc).not.toMatch(/GlobalDiscoveryBar/);
  });

  it("keeps the original rotating hero and the complete global footer", () => {
    expect(heroSrc).toMatch(/College[\s\S]*Course[\s\S]*Career[\s\S]*Exam[\s\S]*Future/);
    expect(heroSrc).toMatch(/2200/);
    expect(heroSrc).toMatch(/HeroCounsellingCard/);
    expect(belowFoldSrc).toMatch(/<Footer \/>/);
    expect(belowFoldSrc).not.toMatch(/<Footer compact/);
    expect(footerSrc).not.toMatch(/AskDiyaBand|LeadCaptureForm/);
    expect(footerSrc).toMatch(/Engineering College Rankings/);
    expect(footerSrc).toMatch(/MBA College Rankings/);
    expect(footerSrc).toMatch(/Important Entrance Exams/);
  });

  it("uses a persistent black announcement bar without dismiss or multicolour controls", () => {
    expect(announcementSrc).toMatch(/bg-black/);
    expect(announcementSrc).toMatch(/text-white/);
    expect(announcementSrc).toMatch(/h-11 min-h-11/);
    expect(navbarSrc).toMatch(/sticky top-0 z-\[70\]/);
    expect(announcementSrc).not.toMatch(/DISMISSED_KEY|Close announcements|bg-blue-600|bg-orange-500/);
  });

  it("rotates announcements without side arrows or an invented CTA label", () => {
    expect(announcementSrc).not.toMatch(/ChevronLeft|ChevronRight|Previous announcement|Next announcement/);
    expect(announcementSrc).not.toMatch(/cta_text \|\| "Apply Now"/);
    expect(announcementSrc).toMatch(/ctaText = activeAd\.cta_text\?\.trim\(\)/);
    expect(announcementSrc).toMatch(/ctaText \|\| <ArrowRight/);
    expect(announcementSrc).toMatch(/AnimatedWords/);
    expect(announcementSrc).toMatch(/staggerChildren/);
    expect(announcementSrc).toMatch(/useReducedMotion/);
    expect(adminAdsSrc).toMatch(/const openAnnouncement[\s\S]*?cta_text: ""/);
    expect(adminAdsSrc).toMatch(/form\.variant === "announcement" \? form\.cta_text\.trim\(\) : form\.cta_text\.trim\(\) \|\| "Learn More"/);
    expect(adminAdsSrc).toMatch(/announcementCta \?[\s\S]*?<ArrowRight/);
    expect(productionConfigSrc).toMatch(/ANNOUNCEMENT_GENERIC_CTA_CLEANUP_MIGRATION_KEY/);
    expect(productionConfigSrc).toMatch(/\["apply now", "learn more"\]/);
  });

  it("makes the complete announcement bar one link target", () => {
    expect(announcementSrc).toMatch(/className="block h-11 min-h-11 w-full/);
    expect(announcementSrc).toMatch(/aria-label=\{`Open \$\{activeAd\.title\}`\}/);
    expect(announcementSrc).toMatch(/<span className=\{ctaClassName\}/);
    expect(announcementSrc).not.toMatch(/<a href=\{activeAd\.link_url\}[\s\S]*<a href=\{activeAd\.link_url\}/);
  });

  it("shows only Ad Manager announcements and refreshes managed content promptly", () => {
    expect(announcementSrc).not.toMatch(/DEFAULT_ANNOUNCEMENT|default-admissions-announcement/);
    expect(announcementSrc).toMatch(/const ads = configuredAds/);
    expect(announcementSrc).toMatch(/isLoading \|\| ads\.length === 0/);
    expect(bootstrapSrc).toMatch(/BOOTSTRAP_TTL = 30_000/);
    expect(bootstrapSrc).toMatch(/cache: "no-cache"/);
    expect(backendIndexSrc).toMatch(/bootstrap[\s\S]*?max-age=30, stale-while-revalidate=60/);
    expect(adminAdsSrc).toMatch(/border-neutral-800 bg-black/);
    expect(adminAdsSrc).not.toMatch(/absolute inset-x-0 top-0 flex h-1/);
  });

  it("reserves the top Google slot on public pages except the homepage", () => {
    expect(navbarSrc).toMatch(/global-internal-ad-top-anchor[\s\S]*GlobalSearchBar/);
    expect(globalAdsSrc).toMatch(/shouldShowTopGoogleAd\(pathname\)/);
    expect(globalAdsSrc).toMatch(/return pathname !== "\/"/);
    expect(globalAdsSrc).toMatch(/<GoogleAd/);
    expect(globalAdsSrc).toMatch(/placement="header"/);
    expect(globalAdsSrc).toMatch(/position="top"/);
    expect(globalAdsSrc).toMatch(/format="horizontal"/);
    expect(globalAdsSrc).toMatch(/fullWidthResponsive=\{false\}/);
    expect(globalAdsSrc).toMatch(/max-w-\[320px\][\s\S]*sm:max-w-\[728px\]/);
    expect(adsenseLoaderSrc).toMatch(/const isHomepage = pathname === "\/"/);
  });

  it("uses managed rectangular article ads and moves the sticky lead below Important Exams", () => {
    expect(articleDetailSrc).toMatch(/function ArticleLeaderboardAd[\s\S]*format="horizontal"/);
    expect(articleDetailSrc).toMatch(/<ArticleLeaderboardAd position="top" eager/);
    expect(articleDetailSrc).toMatch(/<ArticleLeaderboardAd position="middle"/);
    expect(articleDetailSrc).toMatch(/position="sidebar"[\s\S]*format="rectangle"/);
    expect(articleDetailSrc).toMatch(/max-w-\[320px\][\s\S]*sm:max-w-\[728px\]/);
    expect(articleDetailSrc.indexOf('title="Important Exams"')).toBeLessThan(
      articleDetailSrc.indexOf('className="sticky top-[7.5rem]"'),
    );
    expect(adsenseLoaderSrc).toMatch(/!pathname\.startsWith\("\/news\/"\)/);
  });

  it("keeps SEO fallback HTML singly headed and free of deprecated sitemap hints", () => {
    expect(documentSrc).toMatch(/"@type": "WebPage"/);
    expect(documentSrc).not.toMatch(/<noscript>[\s\S]*?<h1>/);
    const xmlBuilder = sitemapGeneratorSrc.slice(
      sitemapGeneratorSrc.indexOf("function xmlFor"),
      sitemapGeneratorSrc.indexOf("function sitemapIndexXml"),
    );
    expect(xmlBuilder).not.toMatch(/<changefreq>|<priority>/);
  });

  it("publishes 2027 ranking and exam labels in the footer", () => {
    const popularLinks = footerSrc.slice(
      footerSrc.indexOf("const popularFooterGroups"),
      footerSrc.indexOf("export function Footer"),
    );
    expect(popularLinks).toMatch(/Top Engineering Colleges in India 2027/);
    expect(popularLinks).toMatch(/CAT 2027/);
    expect(popularLinks).not.toMatch(/2026/);
  });

  it("removes result totals from college, course, and exam filters", () => {
    expect(allCollegesSrc).not.toMatch(/loaded colleges/i);
    expect(allCollegesSrc).not.toMatch(/resultCount/);
    expect(allCoursesSrc).not.toMatch(/Showing[\s\S]*?courses/);
    expect(allExamsSrc).not.toMatch(/Showing[\s\S]*?exams/);
    expect(mobileFilterSheetSrc).not.toMatch(/resultCount|Show \$\{.*\} results/);
    expect(mobileFilterSheetSrc).toMatch(/Apply Filters/);
  });

  it("canonicalizes Delhi filters to Delhi NCR", () => {
    expect(seoSlugsSrc).toMatch(/Colleges in Delhi NCR/);
    expect(seoSlugsSrc).not.toMatch(/\{ state: "Delhi" \}/);
  });

  it("uses a global 2.2-second announcement default with the full admin range", () => {
    expect(announcementSrc).toMatch(/normalizeAnnouncementRotation\(rotationValue\)/);
    expect(adminAdsSrc).toMatch(/max=\{MAX_ANNOUNCEMENT_ROTATION_SECONDS\}/);
    expect(adminAdsSrc).toMatch(/step=\{0\.1\}/);
    expect(adminAdsSrc).toMatch(/seconds \(0\.1-1000\)/);
    expect(productionConfigSrc).toMatch(/ANNOUNCEMENT_ROTATION_2_2_MIGRATION_KEY/);
    expect(productionConfigSrc).toMatch(/announcement_rotation_seconds: 2\.2/);
  });

  it("lets footer exam links prefill the live exam search", () => {
    expect(allExamsSrc).toMatch(/searchParams\.get\("search"\)/);
    expect(allExamsSrc).toMatch(/params\.set\("search", debouncedSearch\)/);
  });

  it("keeps rapid listing-filter changes ahead of stale URL hydration", () => {
    for (const source of [allCollegesSrc, allCoursesSrc, allExamsSrc]) {
      expect(source).toMatch(/pendingListingUrlRef/);
      expect(source).toMatch(/pendingListingUrlRef\.current !== currentUrl/);
      expect(source).toMatch(/skipNextListingSyncRef/);
      expect(source).toMatch(/navigate\(newPath, \{ replace: true \}\)/);
    }
  });

  it("keeps the homepage hero shortcuts focused on college, course, exam, and news", () => {
    expect(heroSrc).not.toMatch(/useHeroCategories|quickCategories/);
    expect(heroSrc).not.toMatch(/Application Form|catApplication|catReviews|\{ label: "Review"/);
    expect(footerSrc).not.toMatch(/GlobalDiscoveryBar/);
  });

  it("removes countdown and promotional-price urgency from shared lead forms", () => {
    expect(indexSrc).not.toMatch(/HomeUrgencyStrip/);
    expect(leadFormSrc).not.toMatch(/UrgencyHooks|FREE ₹999|Priority callback|Closes in/);
  });

  it("persists the Clean Data AI provider with UPDATE rather than an INSERT-requiring upsert", () => {
    const runtimeMutation = cleanerSrc.slice(cleanerSrc.indexOf("const updateRuntime"), cleanerSrc.indexOf("const start"));
    expect(runtimeMutation).toMatch(/from\("ai_runtime_controls"\)[\s\S]*?\.update\(payload\)/);
    expect(runtimeMutation).not.toMatch(/\.upsert\(/);
  });

  it("shows the shared fuzzy search at the top of every public page including the homepage", () => {
    expect(navbarSrc).toMatch(/<GlobalSearchBar variant="header"/);
    expect(navbarSrc).toMatch(/!pathname\.startsWith\("\/admin"\)[\s\S]*?<GlobalSearchBar variant="header"/);
  });

  it("does not publish unsupported trust-stat counters", () => {
    expect(trustSrc).not.toMatch(/1M\+|5,000\+|50K\+|Students Guided|Verified Colleges|Success Rate|Placements Assisted|Trusted by Millions|value:\s*"95%"/);
  });

  it("lets admins select homepage partners from the college directory and shows their linked short names", () => {
    expect(adminPartnersSrc).toMatch(/useAdminCollegeList/);
    expect(adminPartnersSrc).toMatch(/college\.short_name\?\.trim\(\) \|\| college\.name/);
    expect(adminPartnersSrc).toMatch(/college\.logo\?\.trim\(\) \|\| college\.image\?\.trim\(\)/);
    expect(trustSrc).toMatch(/buildCollegeHref\(\{ slug: partner\.college_slug \}\)/);
    expect(trustSrc).toMatch(/partner\.name/);
  });

  it("does not render a floating logo overlay on college cards", () => {
    expect(collegeCardSrc).not.toMatch(/LogoAvatar|logo-fallback|-bottom-5/);
  });

  it("does not render the removed global third-party disclaimer", () => {
    expect(navbarSrc).not.toMatch(/ThirdPartyNotice|third-party information platform|official documents and official websites/i);
  });

  it("keeps the college directory scroll path lightweight", () => {
    expect(directoryHookSrc).toMatch(/COLLEGE_DIRECTORY_PAGE_SIZE = 24/);
    expect(allCollegesSrc).not.toMatch(/new IntersectionObserver/);
    expect(collegeCardSrc).not.toMatch(/framer-motion|<motion\./);
    expect(collegeCardSrc).toMatch(/college-directory-card/);
  });

  it("uses a solid exam calendar with compact date circles and a targeted update CTA", () => {
    expect(examCalendarSrc).toMatch(/bg-primary p-5 text-primary-foreground/);
    expect(examCalendarSrc).toMatch(/rounded-full/);
    expect(examCalendarSrc).toMatch(/Register for exam updates/);
    expect(examCalendarSrc).toMatch(/interestLabel="Target exam"/);
    expect(examCalendarSrc).not.toMatch(/bg-gradient-to-br from-orange-100/);
  });
});
