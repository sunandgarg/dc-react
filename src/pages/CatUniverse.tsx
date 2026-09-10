import { Link } from "react-router-dom";
import { ArrowRight, BrainCircuit, Download, GraduationCap } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { FixedCounsellingCTA } from "@/components/FixedCounsellingCTA";
import { DynamicAdBanner } from "@/components/DynamicAdBanner";
import { LeadCaptureForm } from "@/components/LeadCaptureForm";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { useSEO } from "@/hooks/useSEO";
import { useCatUniverseData } from "@/hooks/useCatUniverse";
import { CatUniverseSectionCards, CatUniverseSpotlight } from "@/components/cat/CatUniverseBlocks";

export default function CatUniverse() {
  const { data } = useCatUniverseData();

  const settings = data?.settings;
  const sections = (data?.sections || []).filter((item) => item.is_active);
  const modules = (data?.modules || []).filter((item) => item.is_active);

  useSEO({
    title: settings?.seo_title || "CAT Universe",
    description: settings?.seo_description,
    keywords: "CAT calculator, IIM predictor, MBA cutoffs, XAT calculator, CMAT calculator",
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-4 md:py-6">
        <PageBreadcrumb items={[{ label: "CAT Universe" }]} />
        {settings ? <CatUniverseSpotlight settings={settings} sections={sections} modules={modules} /> : null}

        <section className="my-6 overflow-hidden rounded-lg bg-slate-950 px-5 py-7 text-white md:px-8" aria-labelledby="cat-2026-launchpad">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-700 pb-6 md:flex-row md:items-end">
            <div>
              <div className="text-sm font-semibold text-orange-300">Free CAT 2026 launchpad</div>
              <h2 id="cat-2026-launchpad" className="mt-2 text-2xl font-bold md:text-3xl">Start with resources. Improve with practice.</h2>
            </div>
            <Link to="/cat-universe/cat-2026-preparation-kit" className="inline-flex items-center gap-2 text-sm font-semibold text-orange-300 hover:text-orange-200">
              Explore the complete kit <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid divide-y divide-slate-800 md:grid-cols-3 md:divide-x md:divide-y-0">
            {[
              { icon: Download, title: "16-resource preparation kit", copy: "Actual papers, practice banks, roadmaps and revision playbooks.", href: "/cat-universe/cat-2026-preparation-kit" },
              { icon: BrainCircuit, title: "AI interview practice", copy: "Five focused questions with actionable answer feedback.", href: "/cat-universe/ai-interview-practice" },
              { icon: GraduationCap, title: "AI-first CAT coach", copy: "A daily plan built around your target, time and weakest section.", href: "/cat-universe/ai-coach" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} to={item.href} className="group py-6 md:px-6 md:first:pl-0 md:last:pr-0">
                  <Icon className="h-6 w-6 text-orange-400" />
                  <h3 className="mt-4 font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.copy}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white">Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="my-6">
          <LeadCaptureForm
            variant="banner"
            title={settings?.lead_title || "Talk to an MBA admission expert"}
            subtitle={settings?.lead_subtitle || "Get your shortlist, score interpretation, and next-step plan for free."}
            source="cat_universe_landing_banner"
          />
        </div>

        <div className="space-y-6">
          {sections.map((section, index) => {
            const sectionModules = modules.filter((item) => item.section_slug === section.slug);
            if (!sectionModules.length) return null;

            return (
              <div key={section.slug} className="space-y-5">
                <CatUniverseSectionCards section={section} modules={sectionModules} />

                {index < sections.length - 1 ? (
                  <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                    <DynamicAdBanner variant="horizontal" position="mid-page" page="cat_universe" itemSlug={section.slug} />
                    <div className="rounded-3xl border border-border bg-card p-5">
                      <div className="text-lg font-bold text-foreground">Need a quick MBA plan?</div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Tell us your score target, city preference and budget. We will help you shortlist the right route.
                      </div>
                      <Link to="/auth" className="mt-4 inline-flex text-sm font-semibold text-primary">
                        Start guided flow
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </main>
      <Footer />
      <FixedCounsellingCTA />
    </div>
  );
}
