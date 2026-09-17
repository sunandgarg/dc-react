import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Index page layout (static source assertions)", () => {
  const indexSrc = readFileSync(resolve(process.cwd(), "src/pages/Index.tsx"), "utf8");
  const belowFoldSrc = readFileSync(resolve(process.cwd(), "src/components/HomeBelowFold.tsx"), "utf8");
  const heroSrc = readFileSync(resolve(process.cwd(), "src/components/HeroSection.tsx"), "utf8");
  const footerSrc = readFileSync(resolve(process.cwd(), "src/components/Footer.tsx"), "utf8");
  const leadFormSrc = readFileSync(resolve(process.cwd(), "src/components/LeadCaptureForm.tsx"), "utf8");
  const cleanerSrc = readFileSync(resolve(process.cwd(), "src/pages/AdminDataCleaner.tsx"), "utf8");
  const navbarSrc = readFileSync(resolve(process.cwd(), "src/components/Navbar.tsx"), "utf8");
  const trustSrc = readFileSync(resolve(process.cwd(), "src/components/TrustedBySection.tsx"), "utf8");
  const collegeCardSrc = readFileSync(resolve(process.cwd(), "src/components/CollegeCard.tsx"), "utf8");
  const allCollegesSrc = readFileSync(resolve(process.cwd(), "src/pages/AllColleges.tsx"), "utf8");
  const directoryHookSrc = readFileSync(resolve(process.cwd(), "src/hooks/useCollegeDirectory.ts"), "utf8");
  const examCalendarSrc = readFileSync(resolve(process.cwd(), "src/pages/ExamCalendar.tsx"), "utf8");

  it("does NOT import or render the LoanReferStrip below scholarships", () => {
    expect(indexSrc).not.toMatch(/LoanReferStrip/);
    expect(belowFoldSrc).not.toMatch(/LoanReferStrip/);
  });

  it("defers below-fold homepage content through HomeBelowFold", () => {
    expect(indexSrc).toMatch(/HomeBelowFold/);
  });

  it("keeps Study Material out of the homepage body because it now lives in the header mega-menu", () => {
    expect(belowFoldSrc).not.toMatch(/StudyMaterialStrip/);
    expect(belowFoldSrc).not.toMatch(/CollegeStudyStrip/);
  });

  it("renders the NewsSection", () => {
    expect(belowFoldSrc).toMatch(/NewsSection/);
  });

  it("keeps the single homepage AdSense slot at the bottom", () => {
    expect(belowFoldSrc.match(/<GoogleAd/g)).toHaveLength(1);
    expect(belowFoldSrc).toMatch(/placement="homepage" position="bottom"/);
    expect(belowFoldSrc).not.toMatch(/placement="homepage" position="middle"/);
    expect(belowFoldSrc.indexOf('position="bottom"')).toBeLessThan(belowFoldSrc.indexOf("<Footer />"));
  });

  it("does NOT render the removed LiveScholarshipsStrip", () => {
    expect(indexSrc).not.toMatch(/LiveScholarshipsStrip/);
    expect(belowFoldSrc).not.toMatch(/LiveScholarshipsStrip/);
  });

  it("renders the complete quick links near the homepage top and above the global footer", () => {
    expect(belowFoldSrc).toMatch(/QuickLinksBar compact/);
    expect(footerSrc).toMatch(/QuickLinksBar/);
    expect(footerSrc).not.toMatch(/GlobalDiscoveryBar/);
  });

  it("keeps the legacy rotating hero promise and adds a site-wide Ask Diya footer hand-off", () => {
    expect(heroSrc).toMatch(/College[\s\S]*Course[\s\S]*Career[\s\S]*Exam[\s\S]*Future/);
    expect(heroSrc).toMatch(/2200/);
    expect(footerSrc).toMatch(/AskDiyaBand/);
  });

  it("does not render the six college, course, exam, application, review, and news cards", () => {
    expect(heroSrc).not.toMatch(/useHeroCategories|quickCategories/);
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
    expect(navbarSrc).not.toMatch(/pathname !== "\/"/);
    expect(navbarSrc).toMatch(/!pathname\.startsWith\("\/admin"\)/);
  });

  it("does not publish unsupported trust-stat counters", () => {
    expect(trustSrc).not.toMatch(/1M\+|5,000\+|50K\+|Students Guided|Verified Colleges|Success Rate|Placements Assisted|Trusted by Millions|value:\s*"95%"/);
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
