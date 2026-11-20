import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { LeadCaptureForm } from "@/components/LeadCaptureForm";
import { AuthorByline } from "@/components/AuthorByline";
import { Navbar } from "@/components/Navbar";
import { useSEO } from "@/hooks/useSEO";
import { trackEvent } from "@/lib/analytics";
import guides from "../../shared/exam-ad-guides.json";

type Guide = (typeof guides)[keyof typeof guides];

const IST_OFFSET_MS = 330 * 60 * 1000;
const sections = [["registration", "Registration status"], ["registration-form", "Application updates"], ["question-papers", "Question papers and practice"], ["guidance-form", "Preparation guidance"], ["important-dates", "Important dates"], ["next-steps", "Next steps"], ["official-resources", "Official resources"], ["questions", "Questions"]];
const portalButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#b63309] px-4 py-2 text-center text-sm font-bold text-white hover:bg-[#952907] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700";

function GuideForm({ guide, slug, id, heading }: { guide: Guide; slug: keyof typeof guides; id: string; heading: string }) {
  return <section id={id} aria-label={`${guide.name} DekhoCampus guidance form`} className="rounded border border-blue-100 bg-[#e9f3ff] p-4 sm:p-5">
    <div className="mx-auto max-w-xl [&>div>div:first-child>div]:w-full [&>div>div:first-child>div]:flex-col [&>div>div:first-child>div]:text-center">
      <h2 className="font-bold text-blue-950">{heading}</h2>
      <p className="mb-4 mt-2 text-sm leading-6 text-slate-700">Get {guide.name} updates and help understanding the official process. This DekhoCampus form does not submit an exam application.</p>
      <LeadCaptureForm variant="card" title="DekhoCampus guidance" subtitle="" brandLogoUrl={guide.logo} brandName={guide.issuer} brandLogoClassName={slug === "jee-advanced-2027" ? "h-16 w-16 shrink-0 rounded-full bg-[#c8102e] p-1.5 object-contain" : "h-14 w-40 shrink-0 rounded-lg bg-white object-contain"} source={`ad_${slug.replaceAll("-", "_")}`} interestedExamSlug={guide.examSlug} fixedCourse={guide.course} requireLocation simple contactOnly />
    </div>
  </section>;
}

export default function ExamAdGuide({ slug }: { slug: keyof typeof guides }) {
  const guide: Guide = guides[slug];
  const today = new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
  const closed = "closesOn" in guide && today > guide.closesOn;
  const status = closed ? "The announced application window has ended" : "opensOn" in guide && today < guide.opensOn ? "Applications have yet to open" : guide.status;
  const deadline = "nextDeadline" in guide && today > guide.keyDateISO
    ? guide.nextDeadline : { label: guide.keyLabel, date: guide.keyDate, iso: guide.keyDateISO };
  const evidence = "evidence" in guide ? guide.evidence : undefined;
  const trackPortal = () => trackEvent("cta_click", { page: slug, cta: "official_portal", exam_slug: guide.examSlug });
  useSEO({ title: `${guide.title} | DekhoCampus`, exactTitle: true, description: guide.description, canonical: `/ad/${slug}`, robots: "noindex, follow, noarchive" });

  return <div className="min-h-screen bg-[#f7f8fb] pb-16 text-slate-900 sm:pb-0" data-lead-link-handler="exam-guide">
    <Navbar scrollAway />
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-x-2 text-xs text-slate-600"><Link to="/" className="hover:underline">Home</Link><span aria-hidden="true">/</span><Link to="/exams" className="hover:underline">Exams</Link><span aria-hidden="true">/</span><span aria-current="page">{guide.name}</span></nav>
        <h1 className="mt-4 max-w-5xl text-[1.65rem] font-bold leading-snug sm:text-[2.1rem]">{guide.title}</h1>
        <AuthorByline authorId="43d5f8f3-192f-483e-9760-a96f04b94489" fallbackName="Geethika Reddy" className="mt-3" />
      </header>
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_260px]">
        <article className="min-w-0 space-y-7 rounded-lg border border-slate-200 bg-white p-4 text-[15px] leading-7 sm:p-7 [&_section]:scroll-mt-40 [&_section>h2]:text-[22px] [&_section>h2]:leading-snug">
          <section id="registration" aria-label={`${guide.name} registration status`}>
            <div className="flex items-start gap-4">
              <img src={guide.logo} alt={`${guide.issuer} logo`} width="220" height="100" className={`h-auto max-h-20 w-auto max-w-[130px] shrink-0 object-contain sm:max-w-[200px] ${slug === "jee-advanced-2027" ? "rounded-full bg-[#c8102e] p-1.5" : ""}`} />
              <div className="min-w-0"><p className="text-xs font-semibold text-slate-600">{guide.issuer}</p><p className="mt-1 text-base font-bold leading-snug sm:text-lg">{status}</p></div>
            </div>
            <p className="mt-4 text-sm leading-6"><mark className="box-decoration-clone bg-amber-100 px-1 py-0.5 text-slate-900"><strong>{deadline.label}:</strong> <time dateTime={deadline.iso}>{deadline.date}</time></mark></p>
            <p className="mt-4 text-sm leading-6 text-slate-700">{guide.description}</p>
            <p className="mt-5 text-sm leading-6 text-slate-700"><strong className="box-decoration-clone bg-amber-50 px-1 py-0.5 text-slate-900">{closed ? "Application window closed." : guide.decisionPrompt}</strong>{" "}{closed ? "Check the official site for any later notice before taking another step." : guide.decisionText}{" "}<a data-official-resource href={guide.portal} target="_blank" rel="noopener noreferrer" onClick={trackPortal} className="font-bold text-orange-700 underline hover:text-orange-800">{guide.portalLabel}</a>.</p>
            <h2 className="mt-5 border-t border-slate-200 pt-5 font-bold">{guide.name} official website</h2>
            <figure className="mt-4 overflow-hidden rounded border border-slate-200 bg-slate-50">
              <a data-official-resource href={guide.portalScreenshot.url} target="_blank" rel="noopener noreferrer" className="block focus-visible:outline-blue-600" onClick={trackPortal} aria-label={`Open ${guide.name} official website`}><img src={guide.portalScreenshot.image} alt={guide.portalScreenshot.alt} width={guide.portalScreenshot.width} height={guide.portalScreenshot.height} loading="eager" decoding="async" className="block h-auto w-full" /></a>
              <figcaption className="border-t border-slate-200 p-3 text-xs leading-5 text-slate-600">{guide.portalScreenshot.caption} <a data-official-resource href={guide.portalScreenshot.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-800 underline" onClick={trackPortal}>Open the live official website</a>.</figcaption>
            </figure>
          </section>

          <GuideForm guide={guide} slug={slug} id="registration-form" heading={`Get ${guide.name} application updates`} />

          <section id="question-papers" aria-label={`${guide.name} question papers and practice`} className="rounded-md border border-blue-100 border-t-[3px] border-t-blue-700 bg-[#f7fafc] p-3 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Official practice resources</p>
            <h2 className="mt-1 font-bold">{guide.name} question papers and practice</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">{guide.paperIntro}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">{guide.paperLinks.map(([label, url]) => <a key={label} data-official-resource href={url} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-900 hover:border-blue-500 hover:bg-blue-50 focus-visible:outline-blue-700">{label}<ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></a>)}</div>
          </section>

          <GuideForm guide={guide} slug={slug} id="guidance-form" heading={`Need help preparing for ${guide.name}?`} />

          <section id="important-dates">
            <h2 className="font-bold">Important dates and details</h2>
            <table className="mt-3 w-full overflow-hidden rounded border border-slate-200 text-left text-sm leading-6">
              <thead className="bg-slate-100"><tr><th scope="col" className="px-3 py-2">Stage</th><th scope="col" className="px-3 py-2">Official details</th></tr></thead>
              <tbody className="divide-y divide-slate-200">{guide.dates.map(([label, value]) => <tr key={label}><th scope="row" className="px-3 py-2 font-semibold align-top">{label}</th><td className="px-3 py-2 align-top">{value}</td></tr>)}</tbody>
            </table>
            {evidence && <figure className="mt-6 overflow-hidden rounded border border-slate-200 bg-slate-50">
              <a data-official-resource href={evidence.url} target="_blank" rel="noopener noreferrer" className="block focus-visible:outline-blue-600"><img src={evidence.image} alt={evidence.alt} width={evidence.width} height={evidence.height} loading="lazy" decoding="async" className="mx-auto block h-auto max-h-[440px] max-w-full bg-white object-contain" /></a>
              <figcaption className="border-t border-slate-200 p-3 text-xs leading-5 text-slate-600">{evidence.caption} <a data-official-resource href={evidence.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-800 underline">View the official source</a>.</figcaption>
            </figure>}
          </section>

          <section id="next-steps">
            <h2 className="font-bold">{guide.stepsTitle}</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-slate-700">{guide.steps.map(step => <li key={step}>{step}</li>)}</ol>
          </section>

          <section id="official-resources">
            <h2 className="font-bold">Official resources</h2>
            <ul className="mt-3 divide-y divide-slate-100 rounded border border-slate-200">
              {guide.resources.map(([label, url]) => <li key={url}><a data-official-resource href={url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 hover:underline">{label}<ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></a></li>)}
            </ul>
          </section>

          <section id="questions">
            <h2 className="font-bold">{guide.name} questions</h2>
            <div className="mt-3 space-y-2">{guide.faqs.map(([question, answer]) => <details key={question} className="rounded-lg border border-slate-200 px-3"><summary className="cursor-pointer py-2 font-semibold">{question}</summary><p className="pb-3 text-slate-700">{answer}</p></details>)}</div>
          </section>
        </article>

        <aside className="hidden space-y-5 lg:block" aria-label={`${guide.name} guide sidebar`}>
          <nav className="rounded border border-slate-200 bg-white p-4" aria-label="On this page"><h2 className="border-b border-slate-200 pb-2 text-base font-bold">On this page</h2><ul className="mt-2 divide-y divide-slate-100 text-sm leading-6">{sections.map(([id, label]) => <li key={id} className="py-2"><a href={`#${id}`} className="text-blue-800 hover:underline">{label}</a></li>)}</ul></nav>
          <div className="rounded border border-slate-200 bg-white p-4"><h2 className="text-base font-bold">Need help with the next step?</h2><a href="#guidance-form" className="mt-2 inline-block text-sm font-semibold text-blue-800 underline">Get DekhoCampus guidance</a></div>
        </aside>
      </div>
    </main>
    <Footer />
    <nav aria-label={`${guide.name} quick actions`} className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-slate-200 bg-white p-2 sm:hidden">
      <a data-official-resource href={guide.portal} target="_blank" rel="noopener noreferrer" onClick={trackPortal} className={`${portalButton} flex-1`}>Official website</a>
      <a href="#guidance-form" className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-blue-700 px-3 py-2 text-center text-sm font-bold text-blue-800">Get exam updates</a>
    </nav>
  </div>;
}
