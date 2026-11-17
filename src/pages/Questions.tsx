import { useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowUpRight, BookOpen, FileText, GraduationCap, Search } from "lucide-react";
import { SEO } from "@/components/SEO";
import { ExamLogo } from "@/components/ExamLogo";
import { LeadGateDialog } from "@/components/LeadGateDialog";
import QUESTION_PAPERS from "@/data/jeeMainPapers.json";
import logo from "@/assets/dekhocampus-logo-small.webp";

const groups = [
  { id: "jee", name: "Engineering entrances", short: "JEE", exams: ["JEE Main", "JEE Advanced", "MHT CET", "BITSAT", "COMEDK", "WBJEE", "KCET", "VITEEE", "AP EAPCET", "TS EAMCET", "IISER IAT", "NEST", "MET"] },
  { id: "medical", name: "Medical", short: "Medical", exams: ["NEET UG"] },
  { id: "gate", name: "Graduate engineering", short: "GATE", exams: ["GATE CSE", "GATE ECE", "GATE EE", "GATE ME", "GATE CE", "GATE DA"] },
  { id: "civil-services", name: "Civil Services", short: "Civil Services", exams: ["UPSC Civil Services"] },
  { id: "defence", name: "Defence", short: "Defence", exams: ["NDA"] },
  { id: "ssc", name: "Staff Selection Commission", short: "SSC", exams: ["SSC CGL"] },
  { id: "cbse", name: "CBSE & School Boards", short: "CBSE", exams: ["CBSE Class 12", "CBSE Class 10"] },
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

const paperSlugs: Record<string, string> = {
  "JEE Main": "jee-main", "JEE Advanced": "jee-advanced", "MHT CET": "mht-cet", WBJEE: "wbjee", "AP EAPCET": "ap-eapcet", "TS EAMCET": "ts-eamcet", "IISER IAT": "iat", "NEET UG": "neet", "UPSC Civil Services": "upsc-prelims", "CBSE Class 12": "cbse-12", "CBSE Class 10": "cbse-10", "GATE DA": "gate-da",
};
const paperSlug = (exam: string) => paperSlugs[exam] || exam.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const collectionPath = (groupId: string, exam: string, mode: "chapter-wise" | "year-wise") => `/pyq-pdfs/past-years/${mode === "year-wise" ? "year-wise/" : ""}${groupId}/${paperSlug(exam)}`;
const dekhoExamsPractice = (exam: string) => `https://dekhoexams.com/questions/${paperSlug(exam)}/practice`;
const knownPractice = new Set(["JEE Main", "JEE Advanced", "MHT CET", "BITSAT", "COMEDK", "WBJEE", "KCET", "VITEEE", "AP EAPCET", "TS EAMCET", "IISER IAT", "NEET UG", "GATE CSE", "GATE ECE", "GATE EE", "GATE ME", "GATE CE", "GATE DA", "UPSC Civil Services", "NDA", "SSC CGL", "CBSE Class 12", "CBSE Class 10"]);
const pdfChapters = new Set(["JEE Main", "JEE Advanced", "MHT CET", "BITSAT", "COMEDK", "WBJEE", "VITEEE", "AP EAPCET"]);
const dekhoExamsChapter = (groupId: string, exam: string) => `https://dekhoexams.com/pyq-pdfs/past-years/${groupId}/${paperSlug(exam)}`;
const dekhoExamsYear = (groupId: string, exam: string) => `https://dekhoexams.com/pyq-pdfs/past-years/year-wise/${groupId}/${paperSlug(exam)}`;

function QuestionsHeader({ query, onQueryChange }: { query?: string; onQueryChange?: (value: string) => void }) {
  const [collectionQuery, setCollectionQuery] = useState("");
  const navigate = useNavigate();
  const inDirectory = !!onQueryChange;
  return <>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Skip to content</a>
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-[1240px] grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-6">
        <Link to="/" aria-label="DekhoCampus home" className="w-fit shrink-0">
          <img src={logo} alt="DekhoCampus" className="h-8 w-auto object-contain" />
          <span className="block pl-1 text-[10px] font-medium text-slate-500">Questions and papers</span>
        </Link>
        <form className="order-3 col-span-2 flex h-11 min-w-0 items-center gap-2 rounded-full border border-slate-300 bg-white pl-4 pr-1 shadow-sm focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 lg:order-none lg:col-span-1" onSubmit={(event) => { event.preventDefault(); if (!inDirectory) navigate(`/questions?q=${encodeURIComponent(collectionQuery.trim())}`); else document.getElementById("exams")?.scrollIntoView({ behavior: "smooth" }); }} role="search">
          <Search className="h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
          <label className="sr-only" htmlFor="question-exam-search">Search exams</label>
          <input id="question-exam-search" type="search" value={query ?? collectionQuery} onChange={(event) => inDirectory ? onQueryChange?.(event.target.value) : setCollectionQuery(event.target.value)} placeholder="Search exams and papers" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          <button type="submit" className="min-h-9 rounded-full bg-blue-700 px-4 text-xs font-bold text-white hover:bg-blue-800">Search</button>
        </form>
        <nav className="flex items-center gap-4 text-sm font-semibold" aria-label="Questions page navigation">
          {inDirectory ? <a href="#exams" className="hover:text-blue-700">Browse</a> : <Link to="/questions#exams" className="hover:text-blue-700">Browse</Link>}
          <Link to="/resources" className="hidden rounded-lg border px-3 py-2 text-blue-800 hover:border-blue-500 sm:inline-flex">Study resources</Link>
        </nav>
      </div>
    </header>
    <nav className="border-b border-slate-200 bg-slate-50" aria-label="Exam categories">
      <div className="mx-auto flex max-w-[1240px] gap-5 overflow-x-auto px-5 py-3 text-sm font-semibold whitespace-nowrap lg:justify-between">
        <Link to="/ad/jee-main-2027#question-papers" className="inline-flex shrink-0 items-center gap-2 hover:text-blue-700"><BookOpen className="h-4 w-4" />PDF library</Link>
        {groups.map((group) => inDirectory ? <a key={group.id} href={`#${group.id}`} className="inline-flex shrink-0 items-center gap-2 hover:text-blue-700"><GraduationCap className="h-4 w-4" />{group.short}</a> : <Link key={group.id} to={`/questions#${group.id}`} className="inline-flex shrink-0 items-center gap-2 hover:text-blue-700"><GraduationCap className="h-4 w-4" />{group.short}</Link>)}
      </div>
    </nav>
  </>;
}

function QuestionsFooter() {
  return <footer className="bg-[#1f2227] px-5 py-10 text-sm text-slate-300">
    <div className="mx-auto grid max-w-[1240px] gap-8 sm:grid-cols-3">
      <div><p className="text-xl font-extrabold text-white">Dekho<span className="text-orange-500">Campus</span></p><p className="mt-2 max-w-xs leading-6">Question papers, official archives and exam guides in one place.</p></div>
      <div><p className="mb-3 font-bold uppercase tracking-wide text-white">Explore</p><div className="grid gap-2"><Link to="/ad/jee-main-2027#question-papers" className="hover:text-white">JEE Main papers</Link><Link to="/exams" className="hover:text-white">Exams</Link><Link to="/resources" className="hover:text-white">Study resources</Link></div></div>
      <div><p className="mb-3 font-bold uppercase tracking-wide text-white">DekhoCampus</p><div className="grid gap-2"><Link to="/about-us" className="hover:text-white">About us</Link><Link to="/legal/privacy-policy" className="hover:text-white">Privacy</Link><Link to="/legal/editorial-policy" className="hover:text-white">Editorial policy <ArrowUpRight className="inline h-3 w-3" /></Link></div></div>
    </div>
  </footer>;
}

export default function Questions() {
  const { search } = useLocation();
  const [query, setQuery] = useState(() => new URLSearchParams(search).get("q") || "");
  const visible = useMemo(() => groups
    .map((group) => ({ ...group, exams: group.exams.filter((exam) => exam.toLowerCase().includes(query.trim().toLowerCase())) }))
    .filter((group) => group.exams.length), [query]);

  return <div className="min-h-screen bg-white text-[#202329]" style={{ zoom: 1.3 }}>
    <SEO title="Previous Year Question Papers by Exam | DekhoCampus" description="Find previous year question papers by exam. Browse the verified JEE Main PDF collection and explore exam resources for engineering, medical, government and board exams." canonical="/questions" />
    <QuestionsHeader query={query} onQueryChange={setQuery} />
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
          <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
            {group.exams.map((exam) => {
              const jee = exam === "JEE Main";
              const paper = officialPapers[exam.startsWith("GATE ") ? "GATE" : exam];
              const guide = `/exams?search=${encodeURIComponent(exam.startsWith("GATE ") ? "GATE" : exam)}`;
              const collection = pdfChapters.has(exam);
              const pdfHref = jee ? "/ad/jee-main-2027#question-papers" : paper?.url || (collection ? collectionPath(group.id, exam, "year-wise") : guide);
              const pill = "inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-3 text-center text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
              return <article key={exam} className="flex flex-col rounded-[28px] border-2 border-[#3450dc] border-t-[6px] bg-white p-5 shadow-[8px_8px_0_#8199ed] transition hover:-translate-y-1 hover:shadow-[8px_12px_0_#8199ed] sm:p-6">
                <div className="flex min-h-24 items-start gap-4">
                  <ExamLogo exam={{ slug: exam.startsWith("GATE ") ? "gate" : examSlugs[exam], logo: exam.startsWith("CBSE") ? cbseLogo : undefined, short_name: exam === "UPSC Civil Services" || exam === "NDA" ? "UPSC" : undefined, name: exam }} className="h-[72px] w-[72px] shrink-0 rounded-2xl border border-blue-200 bg-white p-2" />
                  <div className="min-w-0"><h3 className="text-xl font-extrabold leading-snug">{exam}</h3><p className="mt-1 text-base leading-6 text-slate-600">{jee ? "171 previous-year papers from 2017 to 2026" : collection ? "Chapter-wise PDFs and previous-year papers" : paper ? paper.label : "Exam guide and practice resources"}</p></div>
                </div>
                <div className="mt-5 flex gap-3">
                  <Link to={collectionPath(group.id, exam, "chapter-wise")} className={`${pill} bg-[#3450dc] text-white hover:bg-blue-800`} aria-label={`${exam}: Chapter-wise`}>Chapter-wise</Link>
                  <Link to={collectionPath(group.id, exam, "year-wise")} className={`${pill} border-2 border-slate-300 bg-white hover:border-blue-700 hover:text-blue-700`} aria-label={`${exam}: Year-wise papers`}>Year-wise</Link>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-x-2 gap-y-3 border-t border-slate-200 pt-4 text-sm font-semibold sm:grid-cols-3">
                  <a href={knownPractice.has(exam) ? dekhoExamsPractice(exam) : "https://dekhoexams.com/"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-700" aria-label={`${exam}: Timed practice on DekhoExams (opens new tab)`}>Timed practice <ArrowUpRight className="h-4 w-4 shrink-0" /></a>
                  {paper ? <a href={pdfHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#3450dc] hover:underline" aria-label={`${exam}: ${paper.label} (opens official website)`}><FileText className="h-4 w-4 shrink-0" />PYQ PDFs</a> : <Link to={pdfHref} className="inline-flex items-center gap-1 text-[#3450dc] hover:underline" aria-label={`${exam}: ${jee || collection ? "Browse question papers" : "Exam overview"}`}><FileText className="h-4 w-4 shrink-0" />{jee || collection ? "PYQ PDFs" : "Exam guide"}</Link>}
                  <a href="https://dekhoexams.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-700" aria-label={`${exam}: Mockers on DekhoExams (opens new tab)`}>Mockers <ArrowUpRight className="h-4 w-4 shrink-0" /></a>
                </div>
              </article>;
            })}
          </div>
        </section>) : <p className="rounded-xl border bg-white p-8 text-slate-600">No exam matches your search. Try a shorter name.</p>}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-600"><strong className="text-slate-950">Need chapter practice?</strong> Browse <Link className="font-semibold text-blue-700 underline" to="/resources">study resources</Link> by class and subject. AIIMS and JIPMER MBBS admission now uses NEET UG, so use its papers above. Official marks are shown where a verified source is available.</div>
      </section>
    </main>
    <QuestionsFooter />
  </div>;
}

export function QuestionCollection() {
  const { category, exam: slug } = useParams();
  const { pathname } = useLocation();
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);
  const group = groups.find((item) => item.id === category);
  const exam = group?.exams.find((item) => paperSlug(item) === slug);
  if (!group || !exam) return <Navigate to="/questions" replace />;

  const yearWise = pathname.includes("/year-wise/");
  const jee = exam === "JEE Main";
  const pdfCollection = pdfChapters.has(exam);
  const official = officialPapers[exam.startsWith("GATE ") ? "GATE" : exam];
  const external = pdfCollection
    ? yearWise ? dekhoExamsYear(group.id, exam) : dekhoExamsChapter(group.id, exam)
    : official?.url || (knownPractice.has(exam) ? `https://dekhoexams.com/questions/${paperSlug(exam)}${yearWise ? "/papers" : ""}` : null);
  const externalLabel = pdfCollection ? `Open ${yearWise ? "year-wise" : "chapter-wise"} PDFs on DekhoExams` : official ? `Open ${official.label.toLowerCase()}` : external ? `Explore ${exam} on DekhoExams` : null;
  const title = `${exam} ${yearWise ? "year-wise question papers" : "chapter-wise questions"}`;

  return <div className="min-h-screen bg-[#f6f8fc] text-[#202329]" style={{ zoom: 1.3 }}>
    <SEO title={`${title} | DekhoCampus`} description={jee && yearWise ? "Browse 171 JEE Main papers from 2017 to 2026 by year, date and shift, then choose an individual PDF." : `Find ${exam} ${yearWise ? "previous-year papers" : "chapter resources"} and follow the available verified collection.`} canonical={pathname} robots={jee && yearWise ? undefined : "noindex, follow"} />
    <QuestionsHeader />
    <main id="main-content" className="mx-auto max-w-[1000px] px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-5 text-xs text-slate-600"><Link to="/questions" className="hover:underline">Questions</Link> / {exam}</nav>
      <section className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-widest text-blue-700">{exam} paper library</p>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{jee && yearWise ? "Choose a year, then select the date and shift of the paper you need. The individual PDFs in this collection open after the DekhoCampus contact form." : pdfCollection ? "Browse the available collection by subject or year. Chapter PDF downloads are currently provided through DekhoExams." : "Use the available official papers or practice resources below. A chapter PDF collection is not currently hosted on DekhoCampus for this exam."}</p>
        <div className="mt-6 flex flex-wrap gap-2"><Link to={collectionPath(group.id, exam, "chapter-wise")} aria-current={!yearWise ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm font-bold ${!yearWise ? "bg-blue-700 text-white" : "border border-slate-300 hover:border-blue-700"}`}>Chapter-wise</Link><Link to={collectionPath(group.id, exam, "year-wise")} aria-current={yearWise ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm font-bold ${yearWise ? "bg-blue-700 text-white" : "border border-slate-300 hover:border-blue-700"}`}>Year-wise</Link></div>
      </section>

      {jee && yearWise ? <section className="mt-7" aria-label="JEE Main papers by year">
        <h2 className="mb-4 text-xl font-extrabold">2017 to 2026 papers</h2>
        <div className="grid gap-3">{QUESTION_PAPERS.map(({ year, dates }) => <details key={year} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><summary className="flex cursor-pointer items-center justify-between gap-2 px-5 py-4 font-bold text-blue-900"><span>{year}</span><span className="text-xs font-medium text-slate-600">{dates.reduce((count, date) => count + Number(!!date.morning) + Number(!!date.evening) + Number("offline" in date && !!date.offline), 0)} papers</span></summary><div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">{dates.map((date) => <article key={date.date} className="rounded-xl border border-slate-200 p-4"><h3 className="font-bold">{date.date} {year}</h3><div className="mt-3 flex flex-wrap gap-2">{("offline" in date && date.offline ? [["Offline paper", date.offline]] : [["Morning shift", date.morning], ["Evening shift", date.evening]]).filter((entry): entry is [string, string] => Boolean(entry[1])).map(([label, url]) => <button key={label} type="button" onClick={() => setSelectedPdf(url)} className="rounded-full border border-blue-200 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-50">{label} PDF</button>)}</div></article>)}</div></details>)}</div>
        <p className="mt-4 text-xs leading-5 text-slate-600">For the complete 171-paper ZIP, use the <Link className="font-bold text-blue-700 underline" to="/ad/jee-main-2027#question-papers">DekhoCampus download page</Link>. The ZIP requires mobile OTP verification.</p>
      </section> : <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-extrabold">{pdfCollection && !yearWise && jee ? "Choose a subject" : "Available collection"}</h2>
        {pdfCollection && !yearWise && jee ? <div className="mt-4 grid gap-3 sm:grid-cols-3">{["Physics", "Chemistry", "Mathematics"].map((subject) => <a key={subject} href={`${dekhoExamsChapter(group.id, exam)}#group-${subject.toLowerCase()}`} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-blue-200 p-4 font-bold text-blue-800 hover:bg-blue-50">{subject} chapters <ArrowUpRight className="ml-1 inline h-4 w-4" /></a>)}</div> : external && externalLabel ? <a href={external} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-blue-700 px-5 text-sm font-bold text-white hover:bg-blue-800">{externalLabel} <ArrowUpRight className="h-4 w-4" /></a> : <p className="mt-3 text-sm text-slate-600">No dedicated collection is available yet. Check the exam guide for preparation resources.</p>}
        <p className="mt-5 text-sm text-slate-600">Also see the <Link to={`/exams?search=${encodeURIComponent(exam.startsWith("GATE ") ? "GATE" : exam)}`} className="font-semibold text-blue-700 underline">{exam} exam guide</Link>.</p>
      </section>}
    </main>
    <LeadGateDialog open={!!selectedPdf} onOpenChange={(open) => { if (!open) setSelectedPdf(null); }} onSuccess={() => { if (selectedPdf) window.location.assign(selectedPdf); setSelectedPdf(null); }} title="Download JEE Main question paper" subtitle="" source="JEE-questions" interestedExamSlug="jee-main" fixedCourse="JEE" requireLocation contactOnly simple forceShow unbrandedConsent />
    <QuestionsFooter />
  </div>;
}
