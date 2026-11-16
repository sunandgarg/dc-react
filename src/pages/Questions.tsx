import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { ExamLogo } from "@/components/ExamLogo";

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
  const [category, setCategory] = useState("All");
  const visible = useMemo(() => groups
    .filter((group) => category === "All" || group.name === category)
    .map((group) => ({ ...group, exams: group.exams.filter((exam) => exam.toLowerCase().includes(query.trim().toLowerCase())) }))
    .filter((group) => group.exams.length), [category, query]);

  return <div className="min-h-screen bg-background">
    <SEO title="Previous Year Question Papers by Exam | DekhoCampus" description="Find previous year question papers by exam. Browse the verified JEE Main PDF collection and explore exam resources for engineering, medical, government and board exams." canonical="/questions" />
    <Navbar />
    <main>
      <section className="border-b bg-gradient-to-br from-orange-50 via-white to-blue-50">
        <div className="container py-12 md:py-20">
          <p className="text-sm font-bold uppercase tracking-widest text-primary">DekhoCampus questions</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight text-foreground md:text-6xl">Previous year question papers, organised by exam.</h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">Browse our 171 JEE Main papers from 2017 to 2026, official paper archives, and exam guides. Paper availability varies by exam.</p>
          <label className="mt-8 flex max-w-xl items-center gap-3 rounded-2xl border bg-white px-4 shadow-sm focus-within:ring-2 focus-within:ring-primary" htmlFor="question-exam-search">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input id="question-exam-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search an exam, for example JEE Main" className="h-14 w-full bg-transparent text-base outline-none" />
          </label>
        </div>
      </section>
      <section id="exams" className="container py-10 md:py-14" aria-label="Browse exams">
        <div className="mb-6 flex flex-wrap gap-2" aria-label="Exam categories">
          {["All", ...groups.map((group) => group.name)].map((name) => <button key={name} type="button" onClick={() => setCategory(name)} aria-pressed={category === name} className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${category === name ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:border-primary"}`}>{name}</button>)}
        </div>
        {visible.length ? visible.map((group) => <section key={group.name} className="mb-10" aria-labelledby={`group-${group.name.replaceAll(" ", "-")}`}>
          <h2 id={`group-${group.name.replaceAll(" ", "-")}`} className="mb-4 text-2xl font-bold">{group.name}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.exams.map((exam) => {
              const jee = exam === "JEE Main";
              const paper = officialPapers[exam.startsWith("GATE ") ? "GATE" : exam];
              const href = jee ? "/ad/jee-main-2027#question-papers" : paper?.url || `/exams?search=${encodeURIComponent(exam.startsWith("GATE ") ? "GATE" : exam)}`;
              const label = jee ? "Browse question papers" : paper?.label || "Explore exam guide";
              const content = <><div className="flex items-start justify-between gap-2"><ExamLogo exam={{ slug: exam === "UPSC Civil Services" || exam === "NDA" ? undefined : exam.startsWith("GATE ") ? "gate" : examSlugs[exam], logo: exam.startsWith("CBSE") ? cbseLogo : undefined, name: exam }} className="h-12 w-12 border p-1" />{jee && <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-800">171 PDFs</span>}</div><div><h3 className="mt-4 text-lg font-bold text-foreground">{exam}</h3><span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary">{label}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></div></>;
              const className = "group flex min-h-36 flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
              return paper ? <a key={exam} href={href} target="_blank" rel="noopener noreferrer" className={className} aria-label={`${exam}: ${label} (opens official website)`}>{content}</a> : <Link key={exam} to={href} className={className} aria-label={`${exam}: ${label}`}>{content}</Link>;
            })}
          </div>
        </section>) : <p className="rounded-2xl border bg-card p-8 text-muted-foreground">No exam matches your search. Try a shorter name or another category.</p>}
        <div className="rounded-2xl border bg-slate-50 p-6 text-sm text-muted-foreground"><strong className="text-foreground">Looking for chapter practice?</strong> Browse <Link className="font-semibold text-primary underline" to="/resources">study resources</Link> by class and subject. AIIMS and JIPMER MBBS admission uses NEET UG, so use its papers above. Official marks are shown where a verified source is available.</div>
      </section>
    </main>
    <Footer />
  </div>;
}
