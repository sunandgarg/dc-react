import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { auditHumanEditorialHtml } from "./content-batch-policy.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = JSON.parse(readFileSync(`${root}reports/pre-rollback-2026-07-29/courses-current.json`, "utf8"));
const original = source.find((course) => course.slug === "btech-computer-science");
if (!original) throw new Error("B.Tech Computer Science source row is missing");

const sources = {
  curriculum: "https://www.cse.iitd.ac.in/academics/btech_links/curriculum.shtml",
  jeeMain: "https://jeemain.nta.nic.in/information-bulletin/",
  josaa: "https://josaa.nic.in/document-category/business-rule/",
};

// One editorial pilot only. The generated JSON is an update proposal, never a database write.
export const coursePatch = {
  id: original.id,
  slug: original.slug,
  description: "B.Tech Computer Science is an undergraduate engineering degree built around programming, mathematics and the design of computing systems. Its name is familiar; the work behind it is less about memorising a language than learning to reason through a problem, test a solution and explain why it works.",
  short_description: "What B.Tech Computer Science actually involves, how admission routes differ and what to inspect in a college's curriculum and outcomes.",
  eligibility: "Eligibility is set by the admitting institution and route. JEE Main Paper 1 covers Mathematics, Physics and Chemistry for B.E./B.Tech admissions; IIT entry through JoSAA uses JEE Advanced, while the NIT+ route uses JEE Main. The applicable Class XII conditions belong to the current admission bulletin, not to this course title alone.",
  subjects: ["Programming", "Discrete Mathematics", "Data Structures", "Algorithms", "Computer Architecture", "Operating Systems", "Computer Networks", "Software Design", "Project Work"],
  top_exams: ["JEE Main", "JEE Advanced"],
  careers: ["Software Engineer", "Data Analyst", "Systems Engineer"],
  page_summary: "A grounded guide to B.Tech Computer Science: the work students do, an example curriculum, the main IIT and NIT+ admission routes, and how to compare college-specific costs and outcomes.",
  meta_title: "B.Tech Computer Science: Subjects, Admission & Careers",
  meta_description: "See what B.Tech Computer Science students study, how JEE routes differ, and what to compare in college fees, cutoffs and placements.",
  data_source_urls: Object.values(sources),
  about_content: `
<p>If you enjoy solving a puzzle but dislike finding out why your first answer failed, computer science may surprise you. A B.Tech in Computer Science asks for both: you write code, trace errors, use mathematics to understand what a program can do, and learn how software behaves when many people or machines rely on it.</p>
<p>That is why the degree is broader than “learning coding”. At IIT Delhi, for example, the <a href="${sources.curriculum}">published B.Tech CSE curriculum</a> includes Data Structures (CSL201), Analysis and Design of Algorithms (CSL356), Operating Systems (CSL373), Computer Networks (CSL374) and a major project. Artificial Intelligence appears in its departmental elective list. This is an example of one institute's curriculum, not a promise that every CSE degree has the same papers or elective choices.</p>
<h3>What the work feels like</h3>
<p>Imagine a college timetable tool that keeps showing two students the same lab seat. A quick patch might hide the error for one user. A stronger computer-science response asks how the data is stored, what happens when two requests arrive together, and how to test the fix. You may not build that exact tool, but the habit of breaking an untidy problem into smaller, testable pieces sits at the heart of the course.</p>
<p>Students who like maths, patient debugging and building things from incomplete instructions often find that satisfying. You do not need to arrive as an expert programmer; you do need to be willing to practise after the first attempt fails.</p>
<h3>CSE or an AI-labelled branch?</h3>
<p>Do not choose between B.Tech CSE and a CSE-AI variant by the title alone. Put the two semester plans side by side. If one replaces algorithms, systems or project time with fashionable topic names, ask what foundation those topics rest on. If it keeps the core and adds well-supported electives, the narrower label may make sense for your interests. The answer lies in the actual programme plan, faculty and work students produce, not in the suffix on the brochure.</p>`,
  subjects_content: `
<p>Core subjects commonly move from programming and mathematics toward data structures, algorithms, computer architecture, operating systems and networks. The exact order matters: an algorithms class is easier to use well when you already know how data is represented and manipulated.</p>
<p>IIT Delhi's published CSE plan makes the distinction visible. Data Structures (CSL201) and Operating Systems (CSL373) sit in its departmental core; Artificial Intelligence is listed among departmental electives. When another college advertises “AI from first year”, ask where the mathematical and systems foundations appear, and whether the AI work includes assessed projects rather than only a module title.</p>`,
  syllabus_content: `
<p>Read a college's syllabus as a sequence, not a bag of keywords. Look for the prerequisites to each advanced paper, the number of practical hours, and how projects are assessed. A final-year project is more informative when you can see what students built and what technical decisions they had to defend.</p>
<p>College curricula change by academic year. The IIT Delhi curriculum is a concrete example for comparison, while the selected college's current syllabus controls what you would actually study.</p>`,
  admission_process: `
<p>There is no single B.Tech CSE application form. The <a href="${sources.josaa}">JoSAA business rules</a> distinguish the IIT route through JEE Advanced from the participating NIT+ route through JEE Main. The <a href="${sources.jeeMain}">NTA JEE Main bulletin</a> lists Mathematics, Physics and Chemistry for Paper 1. Other universities can run their own entrance or admission process, so a student's first job is to identify the exact institution and branch they want.</p>
<p>After the exam comes a different decision: the order of choices. A CSE preference at one campus is not interchangeable with a similarly named branch at another. Read the programme name, seat category and quota shown in the counselling system before locking preferences. Keep the submitted choice list and allotment documents; they matter if a later round changes the offer.</p>
<p>The 2026 JEE Main bulletin and JoSAA rules are useful examples of how these routes work, but they are not a substitute for the rules published for the year in which you apply.</p>`,
  fees_content: `
<p>A national “average B.Tech CSE fee” tells you little about the bill you will pay. Compare the fee notices for the same academic year at the colleges you can actually attend. Put tuition, one-time charges, exam fees, hostel and mess costs in the same comparison; then read the refund and seat-acceptance terms before paying.</p>
<p>If a scholarship is central to your budget, work out the cost both with and without it. Check whether the award continues automatically or depends on grades, attendance or another condition. No single fee range applies to every college offering this course.</p>`,
  cutoff_content: `
<p>A single “CSE cutoff” is not a useful admission target. <a href="${sources.josaa}">JoSAA's allocation rules</a> make the institute and programme, rank, category, applicable quota and counselling round relevant. A closing rank from another year is a reference point, not a guaranteed seat.</p>
<p>When comparing two historical figures, keep the year, institute, branch, category, quota and round beside each rank. If any of those labels is missing, the number can look more precise than it really is. For a non-JoSAA college, use that college's own selection rules rather than importing an IIT or NIT closing rank.</p>`,
  scope_content: `
<p>Computer science can lead toward software engineering, data work, infrastructure, security, research or work that combines computing with another field. The degree does not assign one of those jobs automatically. A useful way to test your direction is to build one small project in each area that interests you and notice which problems you want to revisit after the novelty wears off.</p>
<p>For software roles, a public project can show how you handled a bug, tests and a change in requirements. For data work, explaining the limits of a dataset can be as important as producing a chart. Employers and postgraduate programmes may value different evidence, so choose projects that reveal your reasoning rather than collecting certificates alone.</p>`,
  placements_content: `
<p>Before treating a placement headline as a likely outcome, ask what it counts. Was it for CSE students, the whole engineering school or the entire university? Which graduating batch? How many students were eligible, and is the figure a median, average or exceptional offer?</p>
<p>A recruiter logo is not proof that the company hired from this branch in the latest batch. Where a college publishes branch-level reports, read those first. Where it does not, the honest answer is that a course-specific placement figure is unavailable, not that an institution-wide number applies to every CSE student.</p>`,
  specialization_content: `
<p>AI, cybersecurity and cloud computing may appear as electives, tracks or separately named degrees. Those are different commitments. Ask how many credits the track changes, whether the core CSE subjects remain, and who supervises the related labs or projects. A broad CSE programme with room to choose electives can be a better fit than a narrow label chosen before you have tried the subject.</p>`,
  recruiters_content: "",
};

const htmlFields = Object.entries(coursePatch).filter(([key]) => key.endsWith("_content") && key !== "recruiters_content");
const combinedHtml = htmlFields.map(([, value]) => value).join("\n");
const editorial = auditHumanEditorialHtml(combinedHtml, {
  evidence: [{ claim: "Data Structures (CSL201)", source_url: sources.curriculum }],
});
if (editorial.issues.length) throw new Error(`Course pilot failed editorial review: ${editorial.issues.join("; ")}`);
if (coursePatch.id !== original.id || coursePatch.slug !== original.slug) throw new Error("Course identity changed");
if (Object.values(coursePatch).some((value) => typeof value === "string" && /internal slug|AIO, AEO|LLM interpretation|Supabase|search-intent cluster/i.test(value))) {
  throw new Error("Internal editorial or database language leaked into student copy");
}

const proposal = {
  batch: "course-human-rewrite-pilot-001",
  scope: "Review artifact, not a live database update. Apply only after editorial approval and current-row comparison.",
  source_snapshot: "reports/pre-rollback-2026-07-29/courses-current.json",
  checked_on: "2026-10-06",
  source_notes: [
    { url: sources.curriculum, supports: "Named IIT Delhi CSE subjects, core/elective distinction and major project" },
    { url: sources.jeeMain, supports: "JEE Main Paper 1 subjects and the 2026 NIT+ admission context" },
    { url: sources.josaa, supports: "IIT/JEE Advanced versus NIT+/JEE Main seat routes and allocation context" },
  ],
  limitations: [
    "The canonical public course URL could not be fetched during this review; the July 2026 saved course row supplied the identity and original copy.",
    "No live course, fee, cutoff or placement record was changed or verified.",
    "The site currently adds generic highlights and a hard-coded cutoff table outside course content; those require a separate UI correction before publication.",
  ],
  quality_review: {
    scope: "Draft copy only; no live-page, author-profile or user-behaviour audit was possible.",
    content_quality_score: 80,
    eeat: {
      experience: 9,
      expertise: 19,
      authoritativeness: 15,
      trustworthiness: 19,
      total: 62,
    },
    ai_citation_readiness_score: 73,
    strengths: ["Named curriculum details", "Primary-source links inside the copy", "Distinctive practical example", "No invented outcomes"],
    gaps: ["No first-hand student or faculty evidence", "The author and publication date are not part of this draft", "Current generic UI widgets would undermine the rewrite if left unchanged"],
  },
  editorial_audit: editorial,
  update: coursePatch,
};

const output = `${root}reports/course-human-rewrite-pilot-001-2026-10-06.json`;
writeFileSync(output, `${JSON.stringify(proposal, null, 2)}\n`);
console.log(`Wrote ${output}`);

const asMarkdown = (html) => String(html || "")
  .replace(/<a href="([^"]+)">([^<]+)<\/a>/g, "[$2]($1)")
  .replace(/<h3>(.*?)<\/h3>/g, "\n### $1\n")
  .replace(/<p>([\s\S]*?)<\/p>/g, "\n$1\n")
  .replace(/<[^>]+>/g, "")
  .replace(/\n{3,}/g, "\n\n")
  .trim();
const sections = [
  ["About the course", "about_content"],
  ["Subjects", "subjects_content"],
  ["Syllabus", "syllabus_content"],
  ["Admission", "admission_process"],
  ["Fees", "fees_content"],
  ["Cutoffs", "cutoff_content"],
  ["Career scope", "scope_content"],
  ["Placements", "placements_content"],
  ["Specialisations", "specialization_content"],
];
const preview = [
  "# B.Tech Computer Science - one-course editorial pilot",
  "",
  "> Review draft only. Nothing here has been published or applied to the database.",
  "",
  `**Description:** ${coursePatch.description}`,
  "",
  `**Eligibility summary:** ${coursePatch.eligibility}`,
  "",
  ...sections.flatMap(([title, key]) => [`## ${title}`, "", asMarkdown(coursePatch[key]), ""]),
  "## Editorial and publication notes",
  "",
  "Draft-only quality review: **80/100 content quality**, **62/100 E-E-A-T** (experience 9, expertise 19, authoritativeness 15, trustworthiness 19, each out of 25), and **73/100 AI citation readiness**. These are editorial judgments, not measured search rankings or a live-page audit. The main gap is original student/faculty evidence and a verified author; publication should also correct the generic UI widgets.",
  "",
  "- The course identity is preserved. There are no guessed fees, salaries or closing ranks.",
  "- Named IIT Delhi modules are an example, not a national syllabus claim. The JEE and JoSAA references describe the 2026 route; current-year rules must be checked before publication.",
  "- The live page still contains a hard-coded generic cutoff table and generic highlight cards outside this course record. Remove or make those evidence-backed before publishing the rewrite.",
  "- The public canonical course page could not be fetched in this review. Compare the draft with the current database row before applying it.",
  "",
  "### Primary sources",
  "",
  ...proposal.source_notes.map((note) => `- [${note.supports}](${note.url})`),
  "",
].join("\n");
const previewOutput = `${root}reports/course-human-rewrite-pilot-001-2026-10-06.md`;
writeFileSync(previewOutput, preview);
console.log(`Wrote ${previewOutput}`);
