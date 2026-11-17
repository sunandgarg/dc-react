import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen, ChevronRight, GraduationCap, Search } from "lucide-react";
import { SEO } from "@/components/SEO";
import { ExamLogo } from "@/components/ExamLogo";
import logo from "@/assets/dekhocampus-logo-small.webp";

const groups = [
  { id: "jee", name: "Engineering entrances", short: "JEE", color: "#0754bf", exams: ["JEE Main", "JEE Advanced", "MHT CET", "BITSAT", "COMEDK", "WBJEE", "KCET", "VITEEE", "AP EAPCET", "TS EAMCET", "IISER IAT", "NEST", "MET"] },
  { id: "medical", name: "Medical", short: "Medical", color: "#098866", exams: ["NEET UG"] },
  { id: "gate", name: "Graduate engineering", short: "GATE", color: "#7453a9", exams: ["GATE CSE", "GATE ECE", "GATE EE", "GATE ME", "GATE CE", "GATE DA"] },
  { id: "civil-services", name: "Civil Services", short: "Civil Services", color: "#b65a25", exams: ["UPSC Civil Services"] },
  { id: "defence", name: "Defence", short: "Defence", color: "#266d76", exams: ["NDA"] },
  { id: "ssc", name: "Staff Selection Commission", short: "SSC", color: "#85499a", exams: ["SSC CGL"] },
  { id: "cbse", name: "CBSE & School Boards", short: "CBSE", color: "#245dbc", exams: ["CBSE Class 12", "CBSE Class 10"] },
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

  return <div className="min-h-screen bg-white text-[#202329]" style={{ zoom: 1.3 }}>
    <SEO title="Previous Year Question Papers by Exam | DekhoCampus" description="Find previous year question papers by exam. Browse the verified JEE Main PDF collection and explore exam resources for engineering, medical, government and board exams." canonical="/questions" />
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Skip to content</a>
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-[1240px] grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-6">
        <Link to="/" aria-label="DekhoCampus home" className="w-fit shrink-0">
          <img src={logo} alt="DekhoCampus" className="h-8 w-auto object-contain" />
          <span className="block pl-1 text-[10px] font-medium text-slate-500">Questions and papers</span>
        </Link>
        <form className="order-3 col-span-2 flex h-11 min-w-0 items-center gap-2 rounded-full border border-slate-300 bg-white pl-4 pr-1 shadow-sm focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 lg:order-none lg:col-span-1" onSubmit={(event) => { event.preventDefault(); document.getElementById("exams")?.scrollIntoView({ behavior: "smooth" }); }} role="search">
          <Search className="h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
          <label className="sr-only" htmlFor="question-exam-search">Search exams</label>
          <input id="question-exam-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exams and papers" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          <button type="submit" className="min-h-9 rounded-full bg-blue-700 px-4 text-xs font-bold text-white hover:bg-blue-800">Search</button>
        </form>
        <nav className="flex items-center gap-4 text-sm font-semibold" aria-label="Questions page navigation">
          <a href="#exams" className="hover:text-blue-700">Browse</a>
          <Link to="/resources" className="hidden rounded-lg border px-3 py-2 text-blue-800 hover:border-blue-500 sm:inline-flex">Study resources</Link>
        </nav>
      </div>
    </header>
    <nav className="border-b border-slate-200 bg-slate-50" aria-label="Exam categories">
      <div className="mx-auto flex max-w-[1240px] gap-5 overflow-x-auto px-5 py-3 text-sm font-semibold whitespace-nowrap lg:justify-between">
        <Link to="/ad/jee-main-2027#question-papers" className="inline-flex shrink-0 items-center gap-2 hover:text-blue-700"><BookOpen className="h-4 w-4" />PDF library</Link>
        {groups.map((group) => <a key={group.id} href={`#${group.id}`} className="inline-flex shrink-0 items-center gap-2 hover:text-blue-700"><GraduationCap className="h-4 w-4" />{group.short}</a>)}
      </div>
    </nav>
    <main id="main-content" className="mx-auto max-w-[1280px] px-4 pb-12 pt-7 sm:px-5">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_89%_28%,#a9c3f3_0%,transparent_30%),radial-gradient(circle_at_80%_85%,#fce5ee_0%,transparent_30%),white] px-6 py-10 sm:px-8 md:min-h-[300px] md:py-12">
        <p className="inline-flex rounded-full border-2 border-slate-800 bg-white px-3 py-1 text-xs font-extrabold shadow-[2px_3px_0_#202329]">✦ DekhoCampus Questions</p>
        <h1 className="mt-5 max-w-[740px] text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Choose your exam. Find the right paper.</h1>
        <p className="mt-5 max-w-[700px] text-sm leading-7 text-slate-600 sm:text-base">Explore 171 JEE Main PDFs from 2017-2026, official paper archives and guides across engineering, medical, government and board exams. Availability varies by exam.</p>
      </section>
      <div className="mt-7 flex flex-wrap gap-2" aria-label="Jump to an exam category">
        {groups.map((group) => <a key={group.id} href={`#${group.id}`} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-sm font-bold shadow-sm hover:border-blue-600 hover:text-blue-700">{group.short}<span className="rounded-full bg-slate-100 px-1.5 text-xs">{group.exams.length}</span></a>)}
        <Link to="/ad/jee-main-2027#question-papers" className="inline-flex min-h-9 items-center rounded-full border border-slate-300 px-4 text-sm font-bold shadow-sm hover:border-blue-600 hover:text-blue-700">PDF library</Link>
      </div>
      <section id="exams" className="scroll-mt-36 pt-10" aria-label="Browse exams">
        {visible.length ? visible.map((group) => <section key={group.id} id={group.id} className="mb-11 scroll-mt-36" aria-labelledby={`${group.id}-heading`}>
          <h2 id={`${group.id}-heading`} className="mb-5 flex items-baseline gap-2 text-xl font-extrabold">{group.name}<span className="text-sm font-normal text-slate-500">{group.exams.length} {group.exams.length === 1 ? "exam" : "exams"}</span></h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.exams.map((exam) => {
              const jee = exam === "JEE Main";
              const paper = officialPapers[exam.startsWith("GATE ") ? "GATE" : exam];
              const href = jee ? "/ad/jee-main-2027#question-papers" : paper?.url || `/exams?search=${encodeURIComponent(exam.startsWith("GATE ") ? "GATE" : exam)}`;
              const label = jee ? "Browse question papers" : paper?.label || "Exam overview";
              const guide = (!jee && !paper) || exam.startsWith("CBSE") ? "/resources" : `/exams?search=${encodeURIComponent(exam.startsWith("GATE ") ? "GATE" : exam)}`;
              const guideLabel = guide === "/resources" ? "Study resources" : "Exam overview";
              const firstAction = jee ? "View papers" : exam.startsWith("CBSE") ? "Sample papers" : exam === "SSC CGL" ? "Response sheets" : exam === "IISER IAT" ? "Past questions" : paper ? "Paper archive" : "Exam overview";
              const secondAction = guide === "/resources" ? "Study resources" : "Exam guide";
              const pill = "inline-flex min-h-10 flex-1 items-center justify-center rounded-full px-3 text-center text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
              return <article key={exam} className="rounded-[20px] border border-slate-300 border-t-4 bg-white p-5 shadow-sm transition hover:border-blue-600 hover:shadow-md" style={{ borderTopColor: group.color }}>
                <div className="flex min-h-20 items-center gap-3">
                  <ExamLogo exam={{ slug: exam.startsWith("GATE ") ? "gate" : examSlugs[exam], logo: exam.startsWith("CBSE") ? cbseLogo : undefined, short_name: exam === "UPSC Civil Services" || exam === "NDA" ? "UPSC" : undefined, name: exam }} className="h-14 w-14 border border-slate-200 p-1" />
                  <div className="min-w-0"><h3 className="font-extrabold leading-snug">{exam}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{jee ? "171 PDFs from 2017-2026" : paper ? paper.label : "Exam guide and study resources"}</p></div>
                </div>
                <div className="mt-3 flex gap-2">
                  {paper ? <a href={href} target="_blank" rel="noopener noreferrer" className={`${pill} bg-blue-700 text-white hover:bg-blue-800`} aria-label={`${exam}: ${label} (opens official website)`}>{firstAction}</a> : <Link to={href} className={`${pill} bg-blue-700 text-white hover:bg-blue-800`} aria-label={`${exam}: ${label}`}>{firstAction}</Link>}
                  <Link to={guide} className={`${pill} border border-slate-300 bg-white hover:border-blue-700 hover:text-blue-700`} aria-label={`${exam}: ${guideLabel}`}>{secondAction}</Link>
                </div>
                <div className="mt-4 flex min-h-9 items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs text-slate-600">
                  {jee ? <span>171 PDFs on DekhoCampus</span> : paper ? <span>Official source linked above</span> : <span>Paper collection unverified</span>}
                  <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </div>
              </article>;
            })}
          </div>
        </section>) : <p className="rounded-xl border bg-white p-8 text-slate-600">No exam matches your search. Try a shorter name.</p>}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-600"><strong className="text-slate-950">Need chapter practice?</strong> Browse <Link className="font-semibold text-blue-700 underline" to="/resources">study resources</Link> by class and subject. AIIMS and JIPMER MBBS admission now uses NEET UG, so use its papers above. Official marks are shown where a verified source is available.</div>
      </section>
    </main>
    <footer className="bg-[#1f2227] px-5 py-10 text-sm text-slate-300">
      <div className="mx-auto grid max-w-[1240px] gap-8 sm:grid-cols-3">
        <div><p className="text-xl font-extrabold text-white">Dekho<span className="text-orange-500">Campus</span></p><p className="mt-2 max-w-xs leading-6">Question papers, official archives and exam guides in one place.</p></div>
        <div><p className="mb-3 font-bold uppercase tracking-wide text-white">Explore</p><div className="grid gap-2"><Link to="/ad/jee-main-2027#question-papers" className="hover:text-white">JEE Main papers</Link><Link to="/exams" className="hover:text-white">Exams</Link><Link to="/resources" className="hover:text-white">Study resources</Link></div></div>
        <div><p className="mb-3 font-bold uppercase tracking-wide text-white">DekhoCampus</p><div className="grid gap-2"><Link to="/about-us" className="hover:text-white">About us</Link><Link to="/legal/privacy-policy" className="hover:text-white">Privacy</Link><Link to="/legal/editorial-policy" className="hover:text-white">Editorial policy <ArrowUpRight className="inline h-3 w-3" /></Link></div></div>
      </div>
    </footer>
  </div>;
}
