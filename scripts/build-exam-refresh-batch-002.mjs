import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const snapshot = JSON.parse(fs.readFileSync(path.join(root, "reports/pre-rollback-2026-07-29/exams-current.json"), "utf8"));
const checkedAt = "2026-09-21T00:00:00+05:30";

const internalByCategory = {
  Engineering: [
    ["All entrance exams", "/exams"],
    ["Top engineering entrance exams", "/exams/top-engineering-entrance-exams-in-india"],
    ["Engineering courses", "/courses"],
    ["Engineering colleges", "/colleges"],
  ],
  Management: [
    ["All entrance exams", "/exams"],
    ["Top management entrance exams", "/exams/top-management-entrance-exams-in-india"],
    ["Management courses", "/courses"],
    ["Management colleges", "/colleges"],
  ],
  Architecture: [
    ["All entrance exams", "/exams"],
    ["Top national entrance exams", "/exams/top-national-entrance-exams-in-india"],
    ["Architecture courses", "/courses"],
    ["Architecture colleges", "/colleges"],
  ],
  Academic: [
    ["All entrance exams", "/exams"],
    ["National entrance exams", "/exams/top-national-entrance-exams-in-india"],
    ["Postgraduate courses", "/courses"],
    ["Colleges and universities", "/colleges"],
  ],
};

const configs = [
  { match: "SRMJEEE UG", key: "SRMJEEE", fullName: "SRM Joint Engineering Entrance Examination (UG) 2027", status: "2027 official schedule not announced", category: "Engineering", level: "Undergraduate", mode: "Online proctored / computer-based mode as notified by SRMIST", examDate: "Not announced by SRMIST", appStart: "Not announced by SRMIST", appEnd: "Not announced by SRMIST", result: "Not announced by SRMIST", keyword: "SRMJEEE 2027", official: ["https://www.srmist.edu.in/admission-india/", "https://webstor.srmist.edu.in/web_assets/downloads/2026/instructional-manual-for-srmjeee-ug-2026-phase-i.pdf"], apply: "https://applications.srmist.edu.in/", notification: "https://www.srmist.edu.in/admission-india/", syllabus: ["Physics", "Chemistry", "Mathematics or Biology as applicable", "English and aptitude where specified"], pattern: "SRMIST publishes the phase-wise schedule, mode, slot and scoring rules for each cycle. The 2027 question count, duration, negative marking and phase dates must be taken from the next official handbook.", eligibility: "SRMIST will define the 2027 qualifying subjects, marks, passing-year rules and programme eligibility in its official admission notice. Check the B.Tech programme page before submitting an application." },
  { match: "MAT", key: "MAT", fullName: "Management Aptitude Test (MAT) 2027", status: "2027 official schedule not announced", category: "Management", level: "Postgraduate", mode: "Paper-based and computer-based modes as scheduled by AIMA", examDate: "Not announced by AIMA", appStart: "Not announced by AIMA", appEnd: "Not announced by AIMA", result: "Not announced by AIMA", keyword: "MAT 2027", official: ["https://aima.in/mat/test-dates/", "https://www.aima.in/content/testing-and-assessment/mat/mat"], apply: "https://mat.aima.in/", notification: "https://aima.in/mat/test-dates/", syllabus: ["Language Comprehension", "Mathematical Skills", "Data Analysis and Sufficiency", "Intelligence and Critical Reasoning", "Economic and Business Environment"], pattern: "AIMA may offer paper-based and computer-based MAT sessions. The 2027 sections, duration, fee, mode choices and score-reporting rules should be copied from the live AIMA schedule.", eligibility: "MAT eligibility is programme and institute linked. Applicants normally need a recognised bachelor's degree or may be in the final year, but the 2027 notice and the chosen B-school's rules are the final authority." },
  { match: "CMAT", key: "CMAT", fullName: "Common Management Admission Test (CMAT) 2027", status: "2027 official schedule not announced", category: "Management", level: "Postgraduate", mode: "Computer-based test", examDate: "Not announced by NTA", appStart: "Not announced by NTA", appEnd: "Not announced by NTA", result: "Not announced by NTA", keyword: "CMAT 2027", official: ["https://cmat.nta.nic.in/", "https://cmat.nta.nic.in/examination-schedule/"], apply: "https://cmat.nta.nic.in/", notification: "https://cmat.nta.nic.in/", syllabus: ["Quantitative Technique and Data Interpretation", "Logical Reasoning", "Language Comprehension", "General Awareness", "Innovation and Entrepreneurship"], pattern: "CMAT is conducted by NTA in computer-based mode. NTA must confirm the 2027 duration, question count, marking, shift and city details in the next information bulletin.", eligibility: "Candidates should use the CMAT 2027 bulletin for the recognised bachelor's degree, final-year status and category-document rules. Participating AICTE-approved institutions can set additional admission conditions." },
  { match: "UGC NET", key: "UGC-NET", fullName: "University Grants Commission National Eligibility Test 2027", status: "2027 official schedule not announced", category: "Academic", level: "Postgraduate", mode: "Computer-based test", examDate: "Not announced by NTA", appStart: "Not announced by NTA", appEnd: "Not announced by NTA", result: "Not announced by NTA", keyword: "UGC NET 2027", official: ["https://ugcnet.nta.nic.in/", "https://ugcnet.nta.nic.in/document/examination-schedule/"], apply: "https://ugcnet.nta.nic.in/", notification: "https://ugcnet.nta.nic.in/document/examination-schedule/", syllabus: ["Paper I: Teaching and Research Aptitude", "Paper II: Subject-specific syllabus", "Research, communication and reasoning skills"], pattern: "NTA will publish the 2027 cycle, subject list, shifts, duration, marking and qualifying categories in the information bulletin. UGC-NET results determine the notified eligibility categories, not automatic appointment or admission.", eligibility: "UGC-NET eligibility depends on the recognised master's degree, minimum marks, subject equivalence, category and JRF age rules in the current bulletin. Subject-specific eligibility should be checked before registration." },
  { match: "NATA", key: "NATA", fullName: "National Aptitude Test in Architecture (NATA) 2027", status: "2027 official schedule not announced", category: "Architecture", level: "Undergraduate", mode: "Centre-based aptitude test as notified by the Council of Architecture", examDate: "Not announced by CoA", appStart: "Not announced by CoA", appEnd: "Not announced by CoA", result: "Not announced by CoA", keyword: "NATA 2027", official: ["https://www.nata.in/", "https://www.nata.in/schedule.html"], apply: "https://www.nata.in/", notification: "https://www.nata.in/schedule.html", syllabus: ["Visual reasoning", "Mathematical ability", "General aptitude", "Drawing and composition", "Language and interpretation"], pattern: "NATA's session calendar, question format, duration, scoring and attempt rules are published by the Council of Architecture for each academic cycle. Do not reuse the 2026 Friday/Saturday timetable for 2027 until the new schedule is live.", eligibility: "Applicants should confirm the 2027 architecture qualification, subject combination, marks and attempt rules in the NATA brochure and the admission rules of the colleges they target." },
  { match: "SNAP", key: "SNAP", fullName: "Symbiosis National Aptitude Test (SNAP) 2027", status: "2027 official schedule not announced", category: "Management", level: "Postgraduate", mode: "Computer-based test", examDate: "Not announced by Symbiosis International", appStart: "Not announced", appEnd: "Not announced", result: "Not announced", keyword: "SNAP 2027", official: ["https://www.snaptest.org/"], apply: "https://www.snaptest.org/", notification: "https://www.snaptest.org/", syllabus: ["General English", "Analytical and Logical Reasoning", "Quantitative, Data Interpretation and Data Sufficiency", "Current Affairs"], pattern: "SNAP publishes its test count, duration, attempts, marking and programme-registration rules on the official portal. The 2027 pattern must be confirmed from the current notice before preparation begins.", eligibility: "Candidates need a recognised bachelor's degree or equivalent qualification, subject to the programme-specific requirements of Symbiosis institutes. Check the 2027 registration notice for final-year and category rules." },
  { match: "COMEDK UGET", key: "COMEDK UGET", fullName: "Consortium of Medical, Engineering and Dental Colleges of Karnataka Undergraduate Entrance Test 2027", status: "2027 official schedule not announced", category: "Engineering", level: "Undergraduate", mode: "Computer-based test", examDate: "Not announced by COMEDK", appStart: "Not announced by COMEDK", appEnd: "Not announced by COMEDK", result: "Not announced by COMEDK", keyword: "COMEDK UGET 2027", official: ["https://comedk.org/", "https://comedk.org/about-uget-and-notification-2026"], apply: "https://www.comedk.org/", notification: "https://comedk.org/", syllabus: ["Physics", "Chemistry", "Mathematics", "English and qualifying-examination subjects"], pattern: "COMEDK publishes the 2027 online-test duration, questions, marking, centres, answer-key challenge and rank-card dates in its notification. The official website remains the only safe place to submit the form or pay a fee.", eligibility: "COMEDK UGET eligibility is based on the qualifying examination, subject combination and minimum marks notified for the admission year. Engineering and architecture routes can have different rules, so read the relevant brochure." },
  { match: "WBJEE", key: "WBJEE", fullName: "West Bengal Joint Entrance Examination 2027", status: "2027 official schedule not announced", category: "Engineering", level: "Undergraduate", mode: "OMR-based examination", examDate: "Not announced by WBJEEB", appStart: "Not announced by WBJEEB", appEnd: "Not announced by WBJEEB", result: "Not announced by WBJEEB", keyword: "WBJEE 2027", official: ["https://wbjeeb.nic.in/wbjee/", "https://wbjeeb.nic.in/"], apply: "https://wbjeeb.nic.in/wbjee/", notification: "https://wbjeeb.nic.in/wbjee/", syllabus: ["Mathematics", "Physics", "Chemistry"], pattern: "WBJEEB will publish the 2027 paper dates, shifts, OMR instructions, question distribution, marking and counselling notice. Use the official board bulletin instead of a previous-year timetable.", eligibility: "WBJEE 2027 eligibility depends on the qualifying subjects, marks, domicile and programme rules notified by WBJEEB. Candidates must also check the participating institute's admission conditions." },
  { match: "MHT CET", key: "MHT-CET", fullName: "Maharashtra Common Entrance Test (MHT CET) 2027", status: "2027 official schedule not announced", category: "Engineering/Pharmacy", level: "Undergraduate", mode: "Computer-based test", examDate: "Not announced by Maharashtra State CET Cell", appStart: "Not announced by Maharashtra State CET Cell", appEnd: "Not announced by Maharashtra State CET Cell", result: "Not announced by Maharashtra State CET Cell", keyword: "MHT CET 2027", official: ["https://cetcell.mahacet.org/", "https://cetcell.mahacet.org/time-table/"], apply: "https://cetcell.mahacet.org/", notification: "https://cetcell.mahacet.org/time-table/", syllabus: ["Physics", "Chemistry", "Mathematics for PCM", "Biology for PCB", "State CET Cell subject rules"], pattern: "The Maharashtra State CET Cell will publish the 2027 groups, attempts, shifts, marking, normalisation and CAP process. Engineering, pharmacy and agriculture routes should not be mixed together on one generic page.", eligibility: "MHT CET eligibility is course and Maharashtra admission-rule specific. Check the current brochure for subjects, qualifying marks, candidature type, reservation and CAP documents." },
  { match: "KCET", key: "KCET", fullName: "Karnataka Common Entrance Test (KCET) 2027", status: "2027 official schedule not announced", category: "Engineering/Professional", level: "Undergraduate", mode: "Offline examination as notified by KEA", examDate: "Not announced by KEA", appStart: "Not announced by KEA", appEnd: "Not announced by KEA", result: "Not announced by KEA", keyword: "KCET 2027", official: ["https://cetonline.karnataka.gov.in/kea/"], apply: "https://cetonline.karnataka.gov.in/kea/", notification: "https://cetonline.karnataka.gov.in/kea/", syllabus: ["Physics", "Chemistry", "Mathematics", "Biology for applicable courses", "Kannada language test where required"], pattern: "KEA will publish the 2027 timetable, paper duration, subject combinations, marking, Kannada test and document rules in its information bulletin. Confirm the course route before choosing subjects.", eligibility: "KCET eligibility varies by course and Karnataka candidature clause. Applicants should read the KEA bulletin for qualifying examination, subject, domicile, category and document requirements." },
];

const duplicateCandidates = [{
  id: "914acdc7-befc-42c0-863e-c04cf9bde4db",
  name: "CUET UG",
  reason: "Likely duplicate of the earlier active CUET row (id f31d18ac-0e9c-4648-b979-856b3f24fbfa, slug cuet-2026, same NTA official website). Kept untouched; no deletion performed.",
}];

const escape = (v) => String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const cap = (v, max) => {
  const s = String(v).trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).replace(/\s+\S*$/, "").trim()}…`;
};
const datesTable = (dates) => `<h2>Important dates</h2><table><thead><tr><th>Event</th><th>Date or status</th></tr></thead><tbody>${dates.map((d) => `<tr><td>${escape(d.event)}</td><td>${escape(d.date)}</td></tr>`).join("")}</tbody></table>`;

function build(config) {
  const links = internalByCategory[config.category.split("/")[0]] || internalByCategory.Engineering;
  const dates = [
    { event: "2027 notification", date: "Not announced by the conducting authority" },
    { event: "Application window", date: config.appStart },
    { event: "Last date to apply", date: config.appEnd },
    { event: "Examination", date: config.examDate },
    { event: "Result / score card", date: config.result },
  ];
  const internalHtml = `<h2>Related DekhoCampus guides</h2><ul>${links.map(([label, href]) => `<li><a href="${href}">${escape(label)}</a></li>`).join("")}</ul>`;
  const linkNote = `<p><a href="${config.apply}" rel="noopener noreferrer">Apply on the official portal</a> · <a href="${config.notification}" rel="noopener noreferrer">Read the official notification page</a></p>`;
  const verification = /not announced/i.test(config.status)
    ? "The authority has not released the complete 2027 schedule yet. We show an explicit pending status instead of copying 2026 dates or publishing an estimate."
    : "Dates are copied from the authority's current notice and can change; verify the live portal before paying or travelling.";
  const description = `${config.keyword} is an Indian ${config.level.toLowerCase()} entrance examination. This guide brings eligibility, the official date status, application steps, syllabus, pattern, result handling and preparation advice into one readable page.`;
  const application = `<h2>How to apply</h2><ol><li>Open the official portal and confirm that the 2027 cycle is live.</li><li>Read the current bulletin, eligibility rules and document checklist.</li><li>Register with an accessible email address and mobile number.</li><li>Enter academic, category and identity details exactly as shown on your documents.</li><li>Upload the required files, pay through the authorised gateway and save the confirmation page.</li><li>Use the same login for corrections, admit card, answer key, result and counselling notices.</li></ol>${linkNote}<p>${verification}</p>`;
  const pattern = `<h2>Exam pattern</h2><p>${escape(config.pattern)}</p><p>Question counts, marking, shifts and accessibility rules can change. The latest official bulletin overrides every older coaching summary.</p>`;
  const preparation = `<h2>How to prepare</h2><ul><li>Start with the authority-published syllabus and make a topic checklist.</li><li>Practise in the same mode and time limits as the actual paper.</li><li>After each mock, separate concept gaps from reading, calculation and time-management mistakes.</li><li>Keep an error log and revise it weekly.</li><li>Track form, admit-card and counselling deadlines separately from study tasks.</li></ul><p>Thoda-thoda consistent work is easier to sustain than a last-week rush.</p>`;
  const counselling = `<h2>After the exam</h2><p>A score or rank is not an admission offer. Follow the counselling or institute portal named by the authority, check category and document rules, fill choices carefully and pay only through the authorised payment page.</p>`;
  const result = `<h2>Result and scorecard</h2><p>Download the scorecard only from the official candidate login. Save the PDF and note the score, rank, validity and next admission step. If a date is not published, it remains marked as pending.</p>`;
  const summary = `<h2>${escape(config.keyword)} at a glance</h2><p>${escape(description)}</p>${datesTable(dates)}<h2>Official verification</h2><p>${verification}</p>${internalHtml}`;
  return {
    id: null, old_slug: null, slug: null, name: null, full_name: config.fullName, status: config.status,
    exam_date: config.examDate, application_start_date: config.appStart, application_end_date: config.appEnd, result_date: config.result,
    category: config.category, level: config.level, mode: config.mode, frequency: "Once per admission cycle unless the authority publishes multiple sessions",
    eligibility: config.eligibility, important_dates: dates, syllabus: config.syllabus, description, application_process: application,
    exam_pattern: pattern, preparation_tips: preparation, counselling_content: counselling, result_content: result, dates_content: datesTable(dates),
    summary_content: summary, page_summary: `${config.keyword}: eligibility, application steps, syllabus, exam pattern, official dates, result and admission guidance.`,
    meta_title: cap(`${config.keyword}: Dates, Eligibility & Exam Pattern`, 60),
    meta_description: cap(`Check ${config.keyword} eligibility, application steps, syllabus, pattern and official date updates. Verify every deadline on the authority portal.`, 155),
    meta_keywords: `${config.keyword}, eligibility, application form, exam dates, syllabus, exam pattern, result, official website`,
    website: config.official[0], official_website: config.official[0], registration_url: config.apply,
    data_source_urls: config.official, data_verified_at: checkedAt, data_last_checked_at: checkedAt, data_clean_state: "verified_batch_002",
    internal_links: links.map(([, href]) => href), external_links: { apply: config.apply, official_notification: config.notification },
  };
}

const updates = configs.map((config) => {
  const row = snapshot.find((r) => r.name === config.match || r.short_name === config.match);
  if (!row) throw new Error(`Snapshot row missing: ${config.match}`);
  const update = build(config);
  update.id = row.id; update.old_slug = row.slug; update.slug = row.slug; update.name = row.name;
  if (update.meta_title.length > 60 || update.meta_description.length > 155) throw new Error(`Metadata limit failed: ${row.name}`);
  return update;
});

const payload = { batch: "exam-refresh-batch-002", checked_at: checkedAt, source_snapshot: "reports/pre-rollback-2026-07-29/exams-current.json", scope: "Ten unique records after the first batch; CUET UG duplicate is flagged separately", duplicate_candidates: duplicateCandidates, policy: "Official dates only; unpublished 2027 dates remain pending; 3-4 internal links plus one application link and one official-notification link per record; existing slugs preserved.", updates };
fs.writeFileSync(path.join(root, "reports/exam-refresh-batch-002-2026-09-21.json"), JSON.stringify(payload, null, 2) + "\n");

const lines = ["# Exam refresh batch 002", "", `Checked: ${checkedAt} (Asia/Kolkata)`, "", "This batch refreshes ten unique records after batch 001. Officially unpublished 2027 dates remain marked as pending. Each page includes four verified internal DekhoCampus links, one official application link and one official notification link.", "", "## Updated records", ""];
for (const row of updates) {
  lines.push(`- **${row.name}** → ${row.full_name}`);
  lines.push(`  - Status: ${row.status}`);
  lines.push(`  - Exam date: ${row.exam_date}`);
  lines.push(`  - Application: ${row.application_start_date} → ${row.application_end_date}`);
  lines.push(`  - Official source: ${row.website}`);
  lines.push(`  - Internal links: ${row.internal_links.join(", ")}`);
  lines.push(`  - Apply link: ${row.external_links.apply}`);
  lines.push(`  - Notification link: ${row.external_links.official_notification}`);
}
lines.push("", "## Duplicate flagged", "", "- **CUET UG** (id 914acdc7-befc-42c0-863e-c04cf9bde4db) appears to duplicate the earlier active CUET row. It was not deleted or changed. Please approve deletion after confirming the records represent the same exam.", "", "## Validation", "", "- All ten records have complete rewritten content fields.", "- Meta titles are capped at 60 characters and descriptions at 155 characters.", "- Each record contains four internal links and two external links with separate application and notification purposes.", "- No guessed 2027 dates were inserted.", "- External detector or SEO tools cannot honestly guarantee a fixed score; this batch uses deterministic structural checks.", "", "## Apply note", "", "This is a reviewable patch artifact, not a production database write. Production credentials are not present in this workspace. Existing slugs are preserved to avoid breaking indexed URLs.", "");
fs.writeFileSync(path.join(root, "reports/exam-refresh-batch-002-2026-09-21.md"), lines.join("\n"));
console.log(`Wrote ${updates.length} exam updates and flagged ${duplicateCandidates.length} duplicate candidate.`);
