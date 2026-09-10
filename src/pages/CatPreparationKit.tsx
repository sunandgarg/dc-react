import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BrainCircuit, Check, Clock3, Download, FileText, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { CatAccessGate } from "@/components/cat/CatAccessGate";
import { CatExperienceNav } from "@/components/cat/CatExperienceNav";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { useSEO } from "@/hooks/useSEO";
import { CAT_KIT_RESOURCES, catExperience, readCatAccess } from "@/lib/catExperience";
import { trackEvent } from "@/lib/analytics";
import { toast } from "sonner";

const faqItems = [
  { question: "Is the CAT 2026 preparation kit free?", answer: "Yes. The complete kit is available after a short access form so DekhoCampus can save your request and preparation interest." },
  { question: "What is included in the kit?", answer: "It includes nine actual CAT papers with solutions, a preparation roadmap, mock-test psychology, three practice banks, Quant short tricks and a VARC playbook." },
  { question: "Can I practise MBA interviews too?", answer: "Yes. The connected AI interview module gives one question at a time, evaluates each response and builds a readiness score." },
  { question: "Does the AI coach replace a CAT teacher?", answer: "No. It turns your available time, target and weak section into a structured practice plan. Important exam decisions should still be checked against official CAT notices." },
];

export default function CatPreparationKit() {
  const [gateOpen, setGateOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useSEO({
    title: "Free CAT 2026 Preparation Kit, AI Coach and Interview Practice",
    description: "Download the free DekhoCampus CAT 2026 kit with actual papers, solutions, practice banks and roadmaps. Continue with AI interview practice and a personalized CAT study plan.",
    keywords: "CAT 2026 preparation kit, CAT previous year papers, free CAT mock resources, CAT AI coach, IIM interview practice",
    canonical: "/cat-universe/cat-2026-preparation-kit",
    ogImage: "/cat-universe/cat-2026-study-hero.webp",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "LearningResource",
        name: "DekhoCampus CAT 2026 Preparation Kit",
        description: "A free CAT 2026 preparation collection with actual papers, solutions, practice banks and planning resources.",
        educationalLevel: "Graduate",
        learningResourceType: ["Practice problem", "Study guide", "Assessment"],
        isAccessibleForFree: true,
        url: "https://dekhocampus.com/cat-universe/cat-2026-preparation-kit",
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  });

  const beginDownload = async (leadId: string) => {
    setDownloading(true);
    try {
      const result = await catExperience<{ download_url: string }>("download-kit", leadId);
      trackEvent("cat_kit_download", { source: "cat_2026_kit", resource_count: CAT_KIT_RESOURCES.length });
      window.location.assign(result.download_url);
      toast.success("Your CAT 2026 kit is downloading");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The kit could not be downloaded");
    } finally {
      setDownloading(false);
    }
  };

  const requestDownload = () => {
    trackEvent("cta_click", { page: "cat_2026_kit", cta: "download_kit" });
    const access = readCatAccess();
    if (access) void beginDownload(access);
    else setGateOpen(true);
  };

  const resourceGroups = [...new Set(CAT_KIT_RESOURCES.map((item) => item.group))];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <CatExperienceNav />
      <main>
        <section className="relative min-h-[560px] overflow-hidden bg-slate-950 md:min-h-[620px]">
          <img
            src="/cat-universe/cat-2026-study-hero.webp"
            alt="Indian CAT 2026 aspirant practising with mock papers and performance analysis"
            className="absolute inset-0 h-full w-full object-cover object-[72%_center] sm:object-[65%_center]"
            width="1672"
            height="941"
            fetchpriority="high"
          />
          <div className="absolute inset-0 bg-slate-950/45" />
          <div className="container relative z-10 flex min-h-[560px] items-center py-12 md:min-h-[620px]">
            <div className="max-w-2xl text-white">
              <div className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-orange-200">
                <Sparkles className="h-4 w-4" />
                CAT 2026, organised around real practice
              </div>
              <h1 className="max-w-xl text-4xl font-extrabold leading-tight md:text-6xl">
                Free CAT 2026 Preparation Kit
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-100 md:text-xl">
                Nine actual papers with solutions, practice banks, short methods, a preparation roadmap and mock-test psychology in one download.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button size="lg" onClick={requestDownload} disabled={downloading} className="h-12 rounded-md bg-orange-500 px-6 text-white hover:bg-orange-600">
                  {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                  Download the free kit
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-md border-white/60 bg-white/10 px-6 text-white hover:bg-white hover:text-slate-950">
                  <Link to="/cat-universe/ai-coach">Build my study plan <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-100">
                <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-300" />16 resources</span>
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" />Private download link</span>
                <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-emerald-300" />Immediate access</span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-background py-14 md:py-16">
          <div className="container">
            <PageBreadcrumb items={[{ label: "CAT Universe", href: "/cat-universe" }, { label: "CAT 2026 Preparation Kit" }]} />
            <div className="mt-6 grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
              <div>
                <div className="text-sm font-bold uppercase text-primary">Inside the download</div>
                <h2 className="mt-2 text-3xl font-bold text-foreground md:text-4xl">A working preparation library</h2>
                <p className="mt-4 max-w-lg leading-7 text-muted-foreground">
                  The collection covers paper familiarity, timed practice, review discipline and section-specific repair work.
                </p>
                <Button onClick={requestDownload} disabled={downloading} variant="outline" className="mt-6 rounded-md">
                  <Download className="h-4 w-4" /> Get all 16 resources
                </Button>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {resourceGroups.map((group) => {
                  const resources = CAT_KIT_RESOURCES.filter((item) => item.group === group);
                  return (
                    <article key={group} className="rounded-lg border border-border bg-card p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-bold text-foreground">{group}</h3>
                        <span className="text-sm font-semibold text-primary">{resources.length}</span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {resources.map((resource) => (
                          <div key={resource.title} className="flex gap-3 border-t border-border pt-3 first:border-0 first:pt-0">
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                            <div>
                              <div className="text-sm font-semibold text-foreground">{resource.title}</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">{resource.detail}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-950 py-14 text-white">
          <div className="container grid gap-8 md:grid-cols-2">
            <div>
              <BrainCircuit className="h-8 w-8 text-orange-400" />
              <h2 className="mt-4 text-2xl font-bold">AI interview practice</h2>
              <p className="mt-3 max-w-xl leading-7 text-slate-300">Practise one answer at a time, receive score-based feedback and leave with a stronger answer structure.</p>
              <Link to="/cat-universe/ai-interview-practice" className="mt-5 inline-flex items-center gap-2 font-semibold text-orange-300 hover:text-orange-200">Open interview room <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="border-t border-slate-700 pt-8 md:border-l md:border-t-0 md:pl-8 md:pt-0">
              <Sparkles className="h-8 w-8 text-sky-300" />
              <h2 className="mt-4 text-2xl font-bold">AI-first CAT coaching</h2>
              <p className="mt-3 max-w-xl leading-7 text-slate-300">Turn your target, available time and weakest section into a practical daily plan with measurable checkpoints.</p>
              <Link to="/cat-universe/ai-coach" className="mt-5 inline-flex items-center gap-2 font-semibold text-sky-300 hover:text-sky-200">Create my plan <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </section>

        <section className="py-14">
          <div className="container max-w-4xl">
            <h2 className="text-3xl font-bold text-foreground">CAT 2026 kit questions</h2>
            <div className="mt-6 divide-y divide-border border-y border-border">
              {faqItems.map((item) => (
                <details key={item.question} className="group py-5">
                  <summary className="cursor-pointer list-none font-semibold text-foreground">{item.question}</summary>
                  <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <CatAccessGate
        open={gateOpen}
        onOpenChange={setGateOpen}
        source="cat_2026_kit_download"
        title="Unlock the free CAT 2026 kit"
        onGranted={(leadId) => void beginDownload(leadId)}
      />
    </div>
  );
}
