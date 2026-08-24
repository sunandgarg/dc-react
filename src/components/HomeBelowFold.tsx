import { TopRankedColleges } from "@/components/TopRankedColleges";
import { QuickLinksBar } from "@/components/QuickLinksBar";
import { DeferredRender } from "@/components/DeferredRender";
import { Suspense, type ReactNode } from "react";
import { lazyRetry } from "@/lib/lazyRetry";

const AlsoCheckSection = lazyRetry(() => import("@/components/AlsoCheckSection").then(module => ({ default: module.AlsoCheckSection })), "AlsoCheckSection");
const HeroBannerCarousel = lazyRetry(() => import("@/components/HeroBannerCarousel").then(module => ({ default: module.HeroBannerCarousel })), "HeroBannerCarousel");
const CategorySection = lazyRetry(() => import("@/components/CategorySection").then(module => ({ default: module.CategorySection })), "CategorySection");
const TrendingPrograms = lazyRetry(() => import("@/components/TrendingPrograms").then(module => ({ default: module.TrendingPrograms })), "TrendingPrograms");
const ExploreCTACards = lazyRetry(() => import("@/components/ExploreCTACards").then(module => ({ default: module.ExploreCTACards })), "ExploreCTACards");
const CitySearch = lazyRetry(() => import("@/components/CitySearch").then(module => ({ default: module.CitySearch })), "CitySearch");
const OnlineEducationSection = lazyRetry(() => import("@/components/OnlineEducationSection").then(module => ({ default: module.OnlineEducationSection })), "OnlineEducationSection");
const CareerScopeSection = lazyRetry(() => import("@/components/CareerScopeSection").then(module => ({ default: module.CareerScopeSection })), "CareerScopeSection");
const ToolsSection = lazyRetry(() => import("@/components/ToolsSection").then(module => ({ default: module.ToolsSection })), "ToolsSection");
const NewsSection = lazyRetry(() => import("@/components/NewsSection").then(module => ({ default: module.NewsSection })), "NewsSection");
const ExamStrategiesSection = lazyRetry(() => import("@/components/ExamStrategiesSection").then(module => ({ default: module.ExamStrategiesSection })), "ExamStrategiesSection");
const FeaturesSection = lazyRetry(() => import("@/components/FeaturesSection").then(module => ({ default: module.FeaturesSection })), "FeaturesSection");
const GoogleAd = lazyRetry(() => import("@/components/ads/GoogleAd").then(module => ({ default: module.GoogleAd })), "GoogleAd");
const FAQSection = lazyRetry(() => import("@/components/FAQSection").then(module => ({ default: module.FAQSection })), "FAQSection");
const TrustedBySection = lazyRetry(() => import("@/components/TrustedBySection").then(module => ({ default: module.TrustedBySection })), "TrustedBySection");
const Footer = lazyRetry(() => import("@/components/Footer").then(module => ({ default: module.Footer })), "Footer");
const PeriodicLeadPopup = lazyRetry(() => import("@/components/PeriodicLeadPopup").then(module => ({ default: module.PeriodicLeadPopup })), "PeriodicLeadPopup");

const section = (content: ReactNode, minHeight: number) => (
  <DeferredRender minHeight={minHeight}><Suspense fallback={<div style={{ minHeight }} aria-hidden="true" />}>{content}</Suspense></DeferredRender>
);

export default function HomeBelowFold() {
  return <div className="dc-home-below-fold">
    <QuickLinksBar compact />
    <div className="container"><TopRankedColleges /></div>
    {section(<div className="container"><AlsoCheckSection variant="strip" /></div>, 220)}
    {section(<div className="container"><HeroBannerCarousel /></div>, 420)}
    {section(<div className="container"><CategorySection /></div>, 520)}
    {section(<div className="container">
      <div id="explore-cta-heading"><ExploreCTACards /></div>
      <div id="city-search-heading"><CitySearch /></div>
    </div>, 720)}
    {section(<div id="online-education-heading"><OnlineEducationSection /></div>, 620)}
    {section(<div className="container">
      <div id="career-scope-heading"><CareerScopeSection /></div>
      <div id="tools-heading"><ToolsSection /></div>
    </div>, 650)}
    {section(<div className="container"><div id="news-heading"><NewsSection /></div></div>, 720)}
    {section(<div className="container">
      <div id="exam-strategies-heading"><ExamStrategiesSection /></div>
      <FeaturesSection />
      <GoogleAd placement="homepage" position="middle" pageKey="homepage" className="my-4" />
    </div>, 700)}
    {section(<div className="container">
      <div id="faq-heading"><FAQSection page="homepage" title="Frequently Asked Questions" /></div>
      <div id="trending-programs-heading"><TrendingPrograms /></div>
      <div id="trusted-heading"><TrustedBySection /></div>
    </div>, 700)}
    {section(<><Footer /><PeriodicLeadPopup /></>, 480)}
  </div>;
}
