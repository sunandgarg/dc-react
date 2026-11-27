import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Compass, MapPin, Plane, Sparkles } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { LeadCaptureForm } from "@/components/LeadCaptureForm";
import { useSEO } from "@/hooks/useSEO";
import { trackEvent } from "@/lib/analytics";

const paths = [
  { title: "Cabin crew", description: "Explore passenger service and in-flight safety roles. Check each employer's eligibility and training requirements before applying." },
  { title: "Airport ground services", description: "Consider check-in, passenger assistance and airport operations if you prefer working at the terminal." },
  { title: "Hospitality and travel", description: "Look at guest experience, travel support and customer-facing roles that use similar service skills." },
];

const questions = [
  ["Can I explore aviation careers after Class 12?", "Yes. Start by comparing the entry requirements of the course and role you want. Requirements vary by institute and employer."],
  ["Do I need to choose cabin crew now?", "No. You can compare cabin crew, airport services and travel or hospitality routes before choosing training."],
  ["Does this form apply for an airline job?", "No. It sends your enquiry to DekhoCampus for course guidance. Apply for jobs or admissions through the relevant employer or institute."],
];

const leadSource = "aviation_paid";

export default function AviationAdPage() {
  useSEO({
    title: "Aviation Careers After Class 12 | Explore Courses | DekhoCampus",
    exactTitle: true,
    description: "Compare cabin crew, airport ground services and travel career paths after Class 12. Explore aviation courses and ask DekhoCampus for guidance.",
    canonical: "/ad/aviation-after-12",
    robots: "noindex, follow, noarchive",
  });

  useEffect(() => { trackEvent("ad_landing_view", { page: "aviation-after-12" }); }, []);
  const trackCta = (cta: string) => trackEvent("cta_click", { page: "aviation-after-12", cta });

  return <div className="min-h-screen bg-[#f8f9fc] pb-16 text-slate-900 sm:pb-0">
    <Navbar scrollAway />
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-9">
      <nav aria-label="Breadcrumb" className="text-xs text-slate-500"><Link to="/" className="hover:underline">Home</Link> / Aviation careers after Class 12</nav>
      <div className="mt-5 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
        <article className="min-w-0 space-y-7">
          <header>
            <p className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-800"><Plane className="h-4 w-4" /> Explore your next step</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight sm:text-4xl">Aviation careers after Class 12</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-700">Interested in life around airports? Compare cabin crew, ground services and travel roles, then choose a course that fits the work you actually want to do.</p>
            <a href="#aviation-guidance-form" onClick={() => trackCta("hero_guidance")} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#f4510b] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#d83f05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700">Explore aviation courses <ArrowRight className="h-4 w-4" /></a>
          </header>

          <figure className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
            <a href="#aviation-guidance-form" onClick={() => trackCta("creative_guidance")} aria-label="Explore aviation courses and get guidance"><img src="/assets/aviation-careers-after-12.webp" alt="DekhoCampus aviation careers creative showing a cabin crew member welcoming a student aboard an aircraft" width="1200" height="1200" className="block h-auto w-full" loading="eager" /></a>
          </figure>

          <section className="rounded-2xl border border-orange-100 bg-white p-5 sm:p-7" aria-labelledby="aviation-paths">
            <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Find your fit</p>
            <h2 id="aviation-paths" className="mt-1 text-2xl font-bold">Which aviation path interests you?</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">{paths.map((path) => <div key={path.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><CheckCircle2 className="h-5 w-5 text-orange-600" /><h3 className="mt-3 text-base font-bold">{path.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{path.description}</p></div>)}</div>
            <p className="mt-5 text-sm leading-6 text-slate-600">Course names and job titles can sound similar. Compare what the training covers, who provides it, the total fee and the role it prepares you for.</p>
          </section>

          <section className="rounded-2xl border border-blue-100 bg-[#edf5ff] p-5 sm:p-7" aria-labelledby="aviation-next-step">
            <Compass className="h-6 w-6 text-blue-700" /><h2 id="aviation-next-step" className="mt-2 text-2xl font-bold">Choose a course with a clear destination</h2>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-700"><li><strong>1. Pick the role.</strong> Decide whether you prefer in-flight service, terminal operations or travel support.</li><li><strong>2. Check the course.</strong> Ask about practical training, eligibility, fees and any placement support in writing.</li><li><strong>3. Compare options.</strong> Shortlist institutes and confirm the current admission process directly with each one.</li></ol>
            <Link to="/courses?stream=Aviation" onClick={() => trackCta("course_directory")} className="mt-5 inline-flex min-h-11 items-center gap-2 font-bold text-blue-800 underline">Browse aviation courses <ArrowRight className="h-4 w-4" /></Link>
          </section>

          <section id="aviation-guidance-form" className="scroll-mt-8 rounded-2xl border border-blue-100 bg-[#e9f3ff] p-4 sm:p-6" aria-label="Aviation course guidance form">
            <div className="mx-auto max-w-xl">
              <div className="mb-4 flex items-center gap-3"><Sparkles className="h-6 w-6 text-orange-600" /><div><h2 className="text-xl font-bold">Not sure where to start?</h2><p className="text-sm text-slate-700">Tell us what you are exploring. We can help you compare course options.</p></div></div>
              <LeadCaptureForm variant="card" title="Get aviation course guidance" subtitle="DekhoCampus will contact you about your course enquiry." source={leadSource} fixedCourse="Aviation" requireLocation simple contactOnly />
              <p className="mt-3 text-xs leading-5 text-slate-600">This is a DekhoCampus course enquiry, not an airline job application or a college admission form.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7" aria-labelledby="aviation-faqs"><h2 id="aviation-faqs" className="text-2xl font-bold">Questions students ask</h2><div className="mt-4 space-y-2">{questions.map(([question, answer]) => <details key={question} className="rounded-lg border border-slate-200 px-4"><summary className="cursor-pointer py-3 font-semibold">{question}</summary><p className="pb-4 text-sm leading-6 text-slate-700">{answer}</p></details>)}</div></section>
        </article>

        <aside className="hidden space-y-4 lg:block" aria-label="Aviation course guide sidebar"><div className="rounded-2xl border border-orange-100 bg-[#e9f3ff] p-3 shadow-sm"><LeadCaptureForm variant="card" title="Explore aviation courses" subtitle="Ask DekhoCampus to help you compare options." source={leadSource} fixedCourse="Aviation" requireLocation simple contactOnly /></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Your aviation starting point</h2><a href="#aviation-paths" className="mt-4 flex items-center gap-2 text-sm font-semibold text-blue-800 hover:underline"><Plane className="h-4 w-4" /> Compare career paths</a><a href="#aviation-next-step" className="mt-4 flex items-center gap-2 text-sm font-semibold text-blue-800 hover:underline"><Compass className="h-4 w-4" /> Check course options</a><a href="#aviation-guidance-form" className="mt-4 flex items-center gap-2 text-sm font-semibold text-blue-800 hover:underline"><MapPin className="h-4 w-4" /> Ask for guidance</a></div></aside>
      </div>
    </main>
    <Footer />
    <nav aria-label="Aviation quick action" className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-100 bg-white p-2 shadow-lg sm:hidden"><a href="#aviation-guidance-form" onClick={() => trackCta("mobile_guidance")} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#f4510b] px-4 py-2 text-sm font-bold text-white">Explore aviation courses <ArrowRight className="h-4 w-4" /></a></nav>
  </div>;
}
