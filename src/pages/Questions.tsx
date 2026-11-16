import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ChevronRight, FileText, Search } from "lucide-react";
import { SEO } from "@/components/SEO";
import { ExamLogo } from "@/components/ExamLogo";
import logo from "@/assets/dekhocampus-logo-small.webp";

const groups = [
  { name: "Engineering entrances", exams: ["JEE Main", "JEE Advanced", "MHT CET", "BITSAT", "COMEDK", "WBJEE", "KCET", "VITEEE", "AP EAPCET", "TS EAMCET", "IISER IAT", "NEST", "MET"] },
  { name: "Medical entrances", exams: ["NEET UG"] },
  { name: "Graduate engineering", exams: ["GATE CSE", "GATE ECE", "GATE EE", "GATE ME", "GATE CE", "GATE DA"] },
  { name: "Government and defence", exams: ["UPSC Civil Services", "NDA", "SSC CGL"] },
  { name: "School boards", exams: ["CBSE Class 12", "CBSE Class 10"] },
];

const examSlugs: Record<string, string> = {
  "JEE Main": "jee-mains", "JEE Advanced": "jee-advanced", "MHT CET": "mht-cet", BITSAT: "bitsat", COMEDK: "comedk", WBJEE: "wbjee", KCET: "kcet", VITEEE: "viteee", "AP EAPCET": "ap-eamcet", "TS EAMCET": "ts-eamcet", "IISER IAT": "iiser-iat", NEST: "nest", MET: "met", "NEET UG": "national-eligibility-cum-entrance-test-neet", "UPSC Civil Services": "upsc-civil-services", NDA: "upsc-nda-na", "SSC CGL": "ssc-cgl", GATE: "gate",
};
// Board emblem from the CBSE main website: https://www.cbse.gov.in/images//logo.png
const cbseLogo = "/exam-logos/official-v1/e87b6e234f2120e27c79719b.webp";

const officialPapers: Record<string, { url: string; label: string }> = {
  "JEE Advanced": { url: "https://jeeadv.ac.in/archive.html", label: "Official paper archive" },
  WBJEE: { url: "https://wbjeeb.nic.in/old-question-paper-wbjee/", label: "Official paper archive" },
  "AP EAPCET": { url: "https://cets.apsche.ap.gov.in/EAPCET/EAPCET/EAPCET_ExamPapers.aspx", label: "Official 2026 papers" },
  "IISER IAT": { url: "https://info.iiseradmission.in/pages/faq.html", label: "Official past questions" },
  NEST: { url: "https://www.nestexam.in/", label: "Official question archive" },
  "NEET UG": { url: "https://neet.nta.nic.in/archive/", label: "Official paper archive" },
  GATE: { url: "https://gate2026.iitg.ac.in/download.html", label: "Official paper archive" },
  "UPSC Civil Services": { url: "https://www.upsc.gov.in/examinations/previous-question-papers", label: "Official paper archive" },
  NDA: { url: "https://www.upsc.gov.in/examinations/previous-question-papers", label: "Official paper archive" },
  "SSC CGL": { url: "https://ssc.gov.in/home/answer-key", label: "Official response sheets" },
  "CBSE Class 12": { url: "https://cbseacademic.nic.in/SQP_CLASSXII_2026-27.html", label: "Official sample papers" },
  "CBSE Class 10": { url: "https://cbseacademic.nic.in/SQP_CLASSX_2026-27.html", label: "Official sample papers" },
};

export default function Questions() {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => groups
    .map((group) => ({ ...group, exams: group.exams.filter((exam) => exam.toLowerCase().includes(query.trim().toLowerCase())) }))
    .filter((group) => group.exams.length), [query]);

  return <div className="min-h-screen bg-[#f6f3ee] text-slate-950">
    <SEO title="Previous Year Question Papers by Exam | DekhoCampus" description="Find previous year question papers by exam. Browse the verified JEE Main PDF collection and explore exam resources for engineering, medical, government and board exams." canonical="/questions" />
    <header className="border-b border-[#e5e0d8] bg-[#f6f3ee]">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link to="/" aria-label="DekhoCampus home" className="inline-flex items-center gap-2">
          <img src={logo} alt="DekhoCampus" className="h-9 w-auto object-contain" />
          <span className="hidden border-l border-slate-300 pl-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 sm:inline">Question papers</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm font-semibold text-slate-700" aria-label="Questions page navigation">
          <a href="#exams" className="hover:text-primary">Exams</a>
          <Link to="/resources" className="hover:text-primary">Study resources</Link>
        </nav>
      </div>
    </header>
    <main>
      <section className="overflow-hidden border-b-[8px] border-slate-950 bg-[radial-gradient(circle_at_85%_35%,#173b75_0%,#101d39_34%,#0d172c_72%)] text-white">
        <div className="container grid gap-10 py-14 md:grid-cols-[minmax(0,1fr)_18rem] md:items-center md:py-20 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div>
            <p className="inline-flex rounded-full border border-white/20 px-3 py-1 text-xs font-semibold tracking-wide text-blue-100">171 JEE Main papers · 2017-2026</p>
            <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-5xl lg:text-6xl">Find the paper. <span className="text-orange-400">Start practicing.</span></h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 md:text-lg">Browse our JEE Main collection, official paper archives and exam guides. Choose an exam to see what is available.</p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-slate-200">
              <span>25 exam routes</span><span>Official archive links</span><span>Search by exam</span>
            </div>
            <a href="#exams" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-orange-500 px-6 font-bold text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Choose an exam <ArrowDown className="h-4 w-4" /></a>
          </div>
          <div className="relative mx-auto hidden h-64 w-56 rotate-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[14px_18px_0_#29446e] md:block" aria-hidden="true">
            <div className="h-2 w-20 rounded-full bg-blue-600" />
            <div className="mt-3 h-2 w-36 rounded-full bg-slate-200" />
            <div className="mt-8 grid grid-cols-[1rem_1fr] gap-x-3 gap-y-4">
              {[0, 1, 2].map((item) => <div key={item} className="contents"><span className="h-3 rounded bg-slate-900" /><span className="h-2 self-center rounded-full bg-slate-300" /></div>)}
            </div>
            <div className="mt-7 grid grid-cols-4 gap-2 border-t pt-5">{Array.from({ length: 12 }, (_, item) => <span key={item} className={`h-2 rounded-full ${item < 3 ? "bg-orange-400" : "bg-slate-200"}`} />)}</div>
            <span className="absolute -bottom-4 -right-5 flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg"><FileText className="h-6 w-6" /></span>
          </div>
        </div>
      </section>
      <section id="exams" className="container py-10 md:py-14" aria-label="Browse exams">
        <div className="mb-9 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm font-medium text-slate-600">Browse by exam. Papers are linked only where a verified collection is available.</p>
          <label className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 shadow-sm focus-within:ring-2 focus-within:ring-primary sm:w-72" htmlFor="question-exam-search">
            <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <input id="question-exam-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exams" className="w-full bg-transparent text-sm outline-none" />
          </label>
        </div>
        {visible.length ? visible.map((group) => <section key={group.name} className="mb-11" aria-labelledby={`group-${group.name.replaceAll(" ", "-")}`}>
          <h2 id={`group-${group.name.replaceAll(" ", "-")}`} className="mb-5 flex items-center gap-3 text-xl font-extrabold tracking-tight"><span className="h-1 w-5 rounded-full bg-orange-500" />{group.name}<span className="text-sm font-medium text-slate-500">{group.exams.length} {group.exams.length === 1 ? "exam" : "exams"}</span></h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.exams.map((exam) => {
              const jee = exam === "JEE Main";
              const paper = officialPapers[exam.startsWith("GATE ") ? "GATE" : exam];
              const href = jee ? "/ad/jee-main-2027#question-papers" : paper?.url || `/exams?search=${encodeURIComponent(exam.startsWith("GATE ") ? "GATE" : exam)}`;
              const label = jee ? "Browse question papers" : paper?.label || "Exam overview";
              const guide = (!jee && !paper) || exam.startsWith("CBSE") ? "/resources" : `/exams?search=${encodeURIComponent(exam.startsWith("GATE ") ? "GATE" : exam)}`;
              const guideLabel = guide === "/resources" ? "Study resources" : "Exam overview";
              const actionClass = "flex min-h-11 items-center justify-between gap-2 border-t border-slate-200 px-4 text-sm font-semibold text-slate-800 transition hover:bg-orange-50 hover:text-orange-700 focus-visible:bg-orange-50 focus-visible:outline-none";
              return <article key={exam} className="relative overflow-hidden rounded-xl border border-[#e4dfd7] bg-white shadow-[0_4px_14px_rgba(25,31,44,0.06)] transition hover:-translate-y-0.5 hover:shadow-lg">
                <span className="absolute right-0 top-0 h-0 w-0 border-l-[18px] border-t-[18px] border-l-[#e8e4dc] border-t-[#f6f3ee]" aria-hidden="true" />
                <div className="flex min-h-20 items-center gap-3 px-4 py-3">
                  <ExamLogo exam={{ slug: exam.startsWith("GATE ") ? "gate" : examSlugs[exam], logo: exam.startsWith("CBSE") ? cbseLogo : undefined, short_name: exam === "UPSC Civil Services" || exam === "NDA" ? "UPSC" : undefined, name: exam }} className="h-11 w-11 border border-slate-100 p-1" />
                  <h3 className="text-base font-bold leading-tight">{exam}</h3>
                  {jee && <span className="ml-auto shrink-0 rounded-full bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700">171 PDFs</span>}
                </div>
                {paper ? <a href={href} target="_blank" rel="noopener noreferrer" className={actionClass} aria-label={`${exam}: ${label} (opens official website)`}>{label}<ChevronRight className="h-4 w-4 shrink-0" /></a> : <Link to={href} className={actionClass} aria-label={`${exam}: ${label}`}>{label}<ChevronRight className="h-4 w-4 shrink-0" /></Link>}
                <Link to={guide} className={actionClass} aria-label={`${exam}: ${guideLabel}`}>{guideLabel}<ChevronRight className="h-4 w-4 shrink-0" /></Link>
              </article>;
            })}
          </div>
        </section>) : <p className="rounded-xl border bg-white p-8 text-slate-600">No exam matches your search. Try a shorter name.</p>}
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-600"><strong className="text-slate-950">Need chapter practice?</strong> Browse <Link className="font-semibold text-primary underline" to="/resources">study resources</Link> by class and subject. AIIMS and JIPMER MBBS admission now uses NEET UG, so use its papers above. Official marks are shown where a verified source is available.</div>
      </section>
    </main>
    <footer className="bg-slate-950 py-8 text-sm text-slate-300">
      <div className="container flex flex-wrap items-center justify-between gap-4"><span className="font-semibold text-white">DekhoCampus · Question papers</span><div className="flex flex-wrap gap-5"><Link to="/exams" className="hover:text-white">Exams</Link><Link to="/resources" className="hover:text-white">Study resources</Link><Link to="/legal/privacy-policy" className="hover:text-white">Privacy</Link></div></div>
    </footer>
  </div>;
}
