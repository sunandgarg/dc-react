import { Suspense, type ReactNode } from "react";
import { TopRankedColleges } from "@/components/TopRankedColleges";
import { DeferredRender } from "@/components/DeferredRender";
import { OptionalSectionBoundary } from "@/components/OptionalSectionBoundary";
import { lazyRetry } from "@/lib/lazyRetry";

const CategorySection = lazyRetry(() => import("@/components/CategorySection").then((module) => ({ default: module.CategorySection })), "CategorySection");
const HomeDiscoverySection = lazyRetry(() => import("@/components/HomeDiscoverySection").then((module) => ({ default: module.HomeDiscoverySection })), "HomeDiscoverySection");
const HomeLocationSection = lazyRetry(() => import("@/components/HomeDiscoverySection").then((module) => ({ default: module.HomeLocationSection })), "HomeLocationSection");
const HomeToolsSection = lazyRetry(() => import("@/components/HomeToolsSection").then((module) => ({ default: module.HomeToolsSection })), "HomeToolsSection");
const HomeNewsSection = lazyRetry(() => import("@/components/HomeNewsSection").then((module) => ({ default: module.HomeNewsSection })), "HomeNewsSection");
const FAQSection = lazyRetry(() => import("@/components/FAQSection").then((module) => ({ default: module.FAQSection })), "FAQSection");
const HomeTrustBar = lazyRetry(() => import("@/components/HomeTrustBar").then((module) => ({ default: module.HomeTrustBar })), "HomeTrustBar");
const Footer = lazyRetry(() => import("@/components/Footer").then((module) => ({ default: module.Footer })), "Footer");

const section = (name: string, content: ReactNode, minHeight: number) => (
  <OptionalSectionBoundary name={name} minHeight={minHeight}>
    <DeferredRender minHeight={minHeight}>
      <Suspense fallback={<div style={{ minHeight }} aria-hidden="true" />}>{content}</Suspense>
    </DeferredRender>
  </OptionalSectionBoundary>
);

export default function HomeBelowFold() {
  return (
    <div className="dc-home-below-fold">
      <div className="container"><TopRankedColleges /></div>
      {section("categories", <CategorySection />, 520)}
      {section("discovery", <HomeDiscoverySection />, 190)}
      {section("tools", <HomeToolsSection />, 330)}
      {section("locations", <HomeLocationSection />, 100)}
      {section("news", <HomeNewsSection />, 330)}
      {section("faqs", <FAQSection page="homepage" title="Questions students ask first" limit={5} compact />, 360)}
      {section("trust", <HomeTrustBar />, 100)}
      {section("footer", <Footer />, 480)}
    </div>
  );
}
