import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, FileText, Search } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";

const groups = [
  { name: "Engineering entrances", exams: ["JEE Main", "JEE Advanced", "MHT CET", "BITSAT", "COMEDK", "WBJEE", "KCET", "VITEEE", "AP EAPCET", "TS EAMCET", "IISER IAT", "NEST", "MET"] },
  { name: "Medical entrances", exams: ["NEET UG", "AIIMS", "JIPMER"] },
  { name: "Graduate engineering", exams: ["GATE CSE", "GATE ECE", "GATE EE", "GATE ME", "GATE CE", "GATE DA"] },
  { name: "Government and defence", exams: ["UPSC Civil Services", "NDA", "SSC CGL"] },
  { name: "School boards", exams: ["CBSE Class 12", "CBSE Class 10"] },
];

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
          <p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">Find papers and preparation resources without digging through unrelated results. The JEE Main collection includes 171 downloadable papers from 2017 to 2026.</p>
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
              const href = jee ? "/ad/jee-main-2027#question-papers" : exam.startsWith("CBSE") ? `/study-material/class-${exam.endsWith("12") ? "12" : "10"}?board=cbse` : `/exams?search=${encodeURIComponent(exam.startsWith("GATE ") ? "GATE" : exam)}`;
              return <Link key={exam} to={href} className="group flex min-h-36 flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                <div className="flex items-start justify-between gap-2"><span className="rounded-xl bg-primary/10 p-2.5 text-primary">{jee ? <FileText className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}</span>{jee && <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-800">171 PDFs</span>}</div>
                <div><h3 className="mt-4 text-lg font-bold text-foreground">{exam}</h3><span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary">{jee ? "Browse question papers" : "Explore exam resources"}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></div>
              </Link>;
            })}
          </div>
        </section>) : <p className="rounded-2xl border bg-card p-8 text-muted-foreground">No exam matches your search. Try a shorter name or another category.</p>}
        <div className="rounded-2xl border bg-slate-50 p-6 text-sm text-muted-foreground"><strong className="text-foreground">Looking for chapter practice?</strong> Browse <Link className="font-semibold text-primary underline" to="/resources">study resources</Link> by class and subject. Paper availability varies by exam; use the exam page for its current resources.</div>
      </section>
    </main>
    <Footer />
  </div>;
}
