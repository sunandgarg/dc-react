import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const snapshotPath = path.join(root, "reports/pre-rollback-2026-07-29/exams-current.json");
const checkedAt = "2026-09-21T00:00:00+05:30";
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));

const official = {
  jeeMain: ["https://jeemain.nta.nic.in/", "https://jeemain.nta.nic.in/information-bulletin/"],
  jeeAdvanced: ["https://jeeadv.ac.in/", "https://jeeadv.ac.in/imp_dates.html"],
  neet: ["https://neet.nta.nic.in/", "https://neet.nta.nic.in/admission-bulletin/"],
  cat: ["https://iimcat.ac.in/", "https://iimidr.ac.in/programmes/academic-programmes/post-graduate-programme-in-management-pgp/pgp-indore-admissions-details/"],
  clat: ["https://clat2027.consortiumofnlus.ac.in/clat-2027/", "https://clat2027.consortiumofnlus.ac.in/clat-2027/ug-instructions.html", "https://clat2027.consortiumofnlus.ac.in/clat-2027/FAQs.html"],
  gate: ["https://gate2027.iitm.ac.in/", "https://gate2027.iitm.ac.in/important_dates", "https://gate2027.iitm.ac.in/faqs"],
  uceed: ["https://www.uceed.iitb.ac.in/2026/", "https://www.uceed.iitb.ac.in/2026/important-dates.html"],
  cuet: ["https://cuet.nta.nic.in/"],
  xat: ["https://xatonline.in/"],
  bitsat: ["https://www.bitsadmission.com/FD/FD.html", "https://www.bitsadmission.com/FD/BITSAT_FAQs.html"],
};

const configs = [
  {
    match: "JEE Main", key: "jeeMain", fullName: "Joint Entrance Examination (Main) 2027", slug: "jee-main-2026",
    status: "2027 official schedule not announced", examDate: "Not announced by NTA", appStart: "Not announced by NTA", appEnd: "Not announced by NTA", result: "Not announced by NTA",
    category: "Engineering", level: "Undergraduate", mode: "Computer-based test; Paper 2B drawing is offline where applicable", frequency: "Usually conducted in two sessions; 2027 dates require NTA confirmation",
    eligibility: "Candidates should read the JEE (Main) 2027 information bulletin when NTA publishes it. The bulletin will define the qualifying-examination year, subject combination, attempt rules and institute-specific admission conditions. Do not rely on a previous cycle's eligibility without checking the new notice.",
    syllabus: ["Physics", "Chemistry", "Mathematics", "Architecture Aptitude for Paper 2A", "Planning Aptitude for Paper 2B"],
    pattern: "NTA will confirm the 2027 paper structure, question count, marking and language options in the official bulletin. Paper 1 is the engineering route; Paper 2A and Paper 2B serve architecture and planning applicants.",
    sources: official.jeeMain, keyword: "JEE Main 2027",
    dates: [{ event: "2027 information bulletin", date: "Not announced by NTA" }, { event: "Application window", date: "Not announced by NTA" }, { event: "Session 1 examination", date: "Not announced by NTA" }, { event: "Session 2 examination", date: "Not announced by NTA" }, { event: "Result / score card", date: "Not announced by NTA" }],
  },
  {
    match: "JEE Advanced", key: "jeeAdvanced", fullName: "Joint Entrance Examination (Advanced) 2027", slug: "jee-advanced-2026",
    status: "2027 official schedule not announced", examDate: "Not announced by JAB / organising IIT", appStart: "Not announced", appEnd: "Not announced", result: "Not announced",
    category: "Engineering", level: "Undergraduate", mode: "Computer-based test in two compulsory papers", frequency: "Once a year",
    eligibility: "JEE (Advanced) eligibility is set by the Joint Admission Board for each cycle. Candidates must first satisfy the JEE Main qualification route and then meet the year-of-appearance, age, attempt, subject and performance conditions published in the 2027 information brochure.",
    syllabus: ["Physics", "Chemistry", "Mathematics"],
    pattern: "The examination has two compulsory papers. The exact question types, marking scheme, duration and language instructions for 2027 will be final only after the official brochure is released.",
    sources: official.jeeAdvanced, keyword: "JEE Advanced 2027",
    dates: [{ event: "2027 information brochure", date: "Not announced" }, { event: "Registration", date: "Not announced" }, { event: "Examination", date: "Not announced" }, { event: "Answer keys and result", date: "Not announced" }, { event: "JoSAA process", date: "Schedule announced separately" }],
  },
  {
    match: "NEET UG", key: "neet", fullName: "National Eligibility cum Entrance Test (UG) 2027", slug: "neet-ug-2026",
    status: "2027 official schedule not announced", examDate: "Not announced by NTA", appStart: "Not announced by NTA", appEnd: "Not announced by NTA", result: "Not announced by NTA",
    category: "Medical", level: "Undergraduate", mode: "Mode, centres and paper instructions will follow the NTA 2027 bulletin", frequency: "Once a year",
    eligibility: "Applicants must follow the NEET (UG) 2027 information bulletin for qualifying subjects, minimum marks, age rules, nationality, category documents and counselling requirements. Students appearing in the qualifying examination should check the official wording before submitting the form.",
    syllabus: ["Physics", "Chemistry", "Botany", "Zoology"],
    pattern: "NTA will confirm the 2027 duration, question count, marking, language and examination mode in the official bulletin. Use the current NTA syllabus notice, not a coaching summary, when planning preparation.",
    sources: official.neet, keyword: "NEET UG 2027",
    dates: [{ event: "2027 information bulletin", date: "Not announced by NTA" }, { event: "Application window", date: "Not announced by NTA" }, { event: "Examination", date: "Not announced by NTA" }, { event: "Answer key", date: "Not announced by NTA" }, { event: "Result", date: "Not announced by NTA" }],
  },
  {
    match: "CAT", key: "cat", fullName: "Common Admission Test (CAT) 2026", slug: "cat",
    status: "Applications open; final deadline 22 September 2026", examDate: "29 November 2026, Sunday", appStart: "3 August 2026, 10:00 AM IST", appEnd: "22 September 2026, 5:00 PM IST", result: "To be announced by IIM Indore",
    category: "Management", level: "Postgraduate", mode: "Computer-based test in three sessions", frequency: "Once a year",
    eligibility: "CAT 2026 applicants need a recognised bachelor's degree with the minimum marks stated in the official notification, or an equivalent professional qualification. Final-year students may apply subject to the completion and document rules. Each IIM follows its own shortlisting and admission policy.",
    syllabus: ["Verbal Ability and Reading Comprehension", "Data Interpretation and Logical Reasoning", "Quantitative Ability"],
    pattern: "CAT 2026 is a 120-minute computer-based test with three 40-minute sections. Candidates must follow the official IIM Indore bulletin for question counts, calculator rules, marking, test-city choices and accessibility provisions.",
    sources: official.cat, keyword: "CAT 2026",
    dates: [{ event: "Registration opens", date: "3 August 2026, 10:00 AM IST" }, { event: "Registration closes", date: "22 September 2026, 5:00 PM IST" }, { event: "Admit card window", date: "4–29 November 2026" }, { event: "CAT 2026 examination", date: "29 November 2026" }, { event: "Result", date: "To be announced" }],
  },
  {
    match: "CLAT", key: "clat", fullName: "Common Law Admission Test (CLAT) 2027", slug: "clat-2026",
    status: "Applications open", examDate: "6 December 2026, 2:00 PM–4:00 PM IST", appStart: "3 August 2026", appEnd: "31 October 2026, 11:59 PM IST", result: "To be announced by the Consortium",
    category: "Law", level: "Undergraduate and postgraduate", mode: "Offline pen-and-paper examination", frequency: "Once a year",
    eligibility: "CLAT 2027 eligibility differs for UG and PG. Candidates should use the Consortium's 2027 eligibility and instructions pages for qualifying examination, marks, category certificates and programme-specific requirements. Students appearing for boards or qualifying examinations in 2027 may apply subject to the Consortium's rules.",
    syllabus: ["Current Affairs including General Knowledge", "English Language", "Legal Reasoning", "Logical Reasoning", "Quantitative Techniques", "PG Constitutional and legal subjects"],
    pattern: "CLAT 2027 is scheduled offline. UG candidates must follow the official question-paper format for section details, reading passages, marks and tie-breaking. PG applicants should use the separate PG format and syllabus published by the Consortium.",
    sources: official.clat, keyword: "CLAT 2027",
    dates: [{ event: "Online enrolment opens", date: "3 August 2026" }, { event: "Application closes", date: "31 October 2026, 11:59 PM IST" }, { event: "CLAT 2027 examination", date: "6 December 2026, 2:00 PM–4:00 PM IST" }, { event: "PWD examination window", date: "6 December 2026, 2:00 PM–4:40 PM IST" }, { event: "Counselling", date: "December 2026 / January 2027" }],
  },
  {
    match: "GATE", key: "gate", fullName: "Graduate Aptitude Test in Engineering (GATE) 2027", slug: "gate-2026",
    status: "Applications open", examDate: "6, 7, 13, 14, 20 and 21 February 2027", appStart: "2 September 2026", appEnd: "27 September 2026 without late fee; 5 October 2026 with late fee", result: "19 March 2027",
    category: "Engineering", level: "Postgraduate", mode: "Computer-based test", frequency: "Once a year",
    eligibility: "GATE 2027 has no age limit and permits eligible candidates to choose one or two papers from the official combinations. The qualifying degree, paper choice, category documents and institute-level admission rules must be checked on the GATE 2027 website.",
    syllabus: ["General Aptitude", "Engineering Mathematics where applicable", "Discipline-specific GATE paper syllabus", "Robotics and Automation (new 2027 paper)"],
    pattern: "GATE 2027 uses computer-based papers. The official site lists 30 test papers and publishes the paper-wise syllabus, question format, virtual calculator rules and two-paper combinations. The relevant brochure is the final authority.",
    sources: official.gate, keyword: "GATE 2027",
    dates: [{ event: "GOAPS opens", date: "2 September 2026" }, { event: "Regular registration closes", date: "27 September 2026" }, { event: "Extended registration closes", date: "5 October 2026" }, { event: "City allotment notification", date: "4 January 2027" }, { event: "GATE examinations", date: "6, 7, 13, 14, 20 and 21 February 2027" }, { event: "Result", date: "19 March 2027" }],
  },
  {
    match: "UCEED", key: "uceed", fullName: "Undergraduate Common Entrance Examination for Design (UCEED) 2027", slug: "uceed-2026",
    status: "Upcoming; 2027 examination date announced", examDate: "17 January 2027, forenoon", appStart: "Details to be released by 1 October 2026", appEnd: "Details to be released by 1 October 2026", result: "To be announced",
    category: "Design", level: "Undergraduate", mode: "Centre-based examination with computer-based Part A and drawing Part B", frequency: "Once a year",
    eligibility: "UCEED 2027 eligibility, age limits, attempts and qualifying-examination rules will be published with the 2027 details. Candidates should verify the rules on the IIT Bombay UCEED website before applying and separately check the admission rules of each participating institute.",
    syllabus: ["Visualization and spatial reasoning", "Observation and design sensitivity", "Environment and society", "Analytical and logical reasoning", "Language and creativity", "Drawing and sketching"],
    pattern: "UCEED has Part A and Part B. IIT Bombay has announced the 17 January 2027 examination date, while the remaining 2027 registration and paper details are due on the official website by 1 October 2026.",
    sources: official.uceed, keyword: "UCEED 2027",
    dates: [{ event: "2027 details and brochure", date: "Due by 1 October 2026" }, { event: "Registration", date: "Not announced" }, { event: "UCEED 2027 examination", date: "17 January 2027" }, { event: "Result", date: "Not announced" }, { event: "B.Des admission rounds", date: "Not announced" }],
  },
  {
    match: "CUET", key: "cuet", fullName: "Common University Entrance Test (UG) 2027", slug: "cuet-2026",
    status: "2027 official schedule not announced", examDate: "Not announced by NTA", appStart: "Not announced by NTA", appEnd: "Not announced by NTA", result: "Not announced by NTA",
    category: "Science", level: "Undergraduate", mode: "Mode and subject combinations will follow the NTA 2027 bulletin", frequency: "Once a year",
    eligibility: "CUET (UG) eligibility is programme and university specific. Candidates must check the participating university list, subject combinations, qualifying marks and reservation documents in the NTA 2027 information bulletin and the admission pages of their chosen universities.",
    syllabus: ["Language subjects", "Domain-specific subjects", "General Test where required by the chosen programme"],
    pattern: "NTA will publish the 2027 subject choices, examination mode, question format, duration and marking scheme. A student should select subjects only after checking the eligibility rules of the universities and programmes they want.",
    sources: official.cuet, keyword: "CUET UG 2027",
    dates: [{ event: "2027 information bulletin", date: "Not announced by NTA" }, { event: "Application window", date: "Not announced by NTA" }, { event: "Examination", date: "Not announced by NTA" }, { event: "Answer key", date: "Not announced by NTA" }, { event: "Result / NTA scores", date: "Not announced by NTA" }],
  },
  {
    match: "XAT", key: "xat", fullName: "Xavier Aptitude Test (XAT) 2027", slug: "xat-2026",
    status: "Applications open", examDate: "3 January 2027, 2:00 PM–5:00 PM IST", appStart: "15 July 2026", appEnd: "6 December 2026", result: "To be announced by XLRI",
    category: "Management", level: "Postgraduate", mode: "Computer-based test", frequency: "Once a year",
    eligibility: "XAT 2027 applicants should follow the official XLRI/XAT instructions for the recognised bachelor's degree requirement, final-year status and programme-specific rules. Individual institutes decide their own shortlisting and admission process after accepting XAT scores.",
    syllabus: ["Verbal Ability and Logical Reasoning", "Decision Making", "Quantitative Aptitude and Data Interpretation", "General Knowledge"],
    pattern: "The official XAT website lists a computer-based examination on 3 January 2027 from 2:00 PM to 5:00 PM. Candidates should use the current instructions for question counts, marking, calculator rules and test-city information.",
    sources: official.xat, keyword: "XAT 2027",
    dates: [{ event: "Registration opens", date: "15 July 2026" }, { event: "Registration closes", date: "6 December 2026" }, { event: "Admit card", date: "20 December 2026, tentative" }, { event: "XAT 2027 examination", date: "3 January 2027, 2:00 PM–5:00 PM IST" }, { event: "Result", date: "To be announced" }],
  },
  {
    match: "BITSAT", key: "bitsat", fullName: "Birla Institute of Technology and Science Admission Test (BITSAT) 2027", slug: "bitsat-2026",
    status: "2027 official schedule not announced; 2026 cycle closed", examDate: "Not announced by BITS Pilani", appStart: "Not announced by BITS Pilani", appEnd: "Not announced by BITS Pilani", result: "Not announced by BITS Pilani",
    category: "Engineering", level: "Undergraduate", mode: "Computer-based online test", frequency: "Usually held in two sessions; 2027 dates require BITS confirmation",
    eligibility: "BITSAT eligibility is programme specific. Candidates must wait for the BITSAT 2027 brochure for the permitted Class 12 passing years, subject combination, marks, attempt and admission-preference rules. The official admissions website is the only reliable source for the live cycle.",
    syllabus: ["Physics", "Chemistry", "English Proficiency", "Logical Reasoning", "Mathematics or Biology depending on the programme"],
    pattern: "BITS Pilani will publish the 2027 computer-based test structure, sessions, duration, question count, marking and slot-booking rules in the official brochure. Do not carry forward 2026 dates as 2027 dates.",
    sources: official.bitsat, keyword: "BITSAT 2027",
    dates: [{ event: "2027 brochure", date: "Not announced by BITS Pilani" }, { event: "Application window", date: "Not announced by BITS Pilani" }, { event: "Session 1", date: "Not announced by BITS Pilani" }, { event: "Session 2", date: "Not announced by BITS Pilani" }, { event: "Admission iterations", date: "Not announced by BITS Pilani" }],
  },
];

const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const cap = (value, max) => {
  const text = String(value).trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, "").trim()}…`;
};
const table = (dates) => `<h2>Important dates</h2><table><thead><tr><th>Event</th><th>Date or status</th></tr></thead><tbody>${dates.map((d) => `<tr><td>${escape(d.event)}</td><td>${escape(d.date)}</td></tr>`).join("")}</tbody></table>`;
const list = (items) => `<ul>${items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>`;

function buildContent(config) {
  const hasPublishedDates = config.dates.some((d) => !/not announced|to be announced|details to be released/i.test(d.date));
  const verification = hasPublishedDates
    ? "Dates shown here are taken from the conducting authority's current notice and can change. Check the official portal before paying a fee or travelling to a centre."
    : "The conducting authority has not published the next cycle's complete schedule yet. We keep the date blank rather than turning an old cycle or a coaching estimate into a fact.";
  return {
    description: `${config.keyword} is an Indian entrance examination for ${config.level.toLowerCase()} pathways. This refreshed guide brings eligibility, the official date status, application steps, syllabus, pattern, result handling and preparation advice together without guessing unpublished dates.`,
    eligibility: config.eligibility,
    syllabus: config.syllabus,
    application_process: `<h2>How to apply</h2><ol><li>Open the official examination website and confirm the cycle before starting a form.</li><li>Read the current bulletin, eligibility rules and document checklist.</li><li>Register with an email address and mobile number that you can access throughout the admission cycle.</li><li>Enter academic, category and identity details exactly as shown on your documents.</li><li>Upload the required files, pay through the authorised portal and save the confirmation page.</li><li>Use the same candidate login for corrections, admit card, answer key, result and counselling notices.</li></ol><p>${verification}</p>`,
    exam_pattern: `<h2>Exam pattern</h2><p>${config.pattern}</p><p>Do not treat a previous year's question count or marking scheme as final for a new cycle. The latest brochure and candidate notice always take priority.</p>`,
    preparation_tips: `<h2>How to prepare</h2><ul><li>Start with the authority-published syllabus and make a topic checklist.</li><li>Use timed practice in the same mode as the real paper.</li><li>After each mock, separate concept gaps from reading, calculation and time-management mistakes.</li><li>Keep a small error log and revisit it every week.</li><li>Track forms, admit cards and counselling separately from study tasks so a good score is not lost to a missed deadline.</li></ul><p>Short daily sessions beat last-minute panic. Thoda-thoda consistent work is usually easier to sustain.</p>`,
    counselling_content: `<h2>What happens after the exam?</h2><p>A score or rank is not the same as an admission offer. Follow the counselling or institute portal named by the conducting authority, check category and document rules, fill choices carefully and pay only through the authorised payment page. The participating institute or counselling body decides final seat allocation.</p>`,
    result_content: `<h2>Result and scorecard</h2><p>Download the result or scorecard only from the official candidate login. Save the PDF and note the score, rank, validity period and next admission step. If a date is not published, we label it as pending instead of inventing a result day.</p>`,
    dates_content: table(config.dates),
    summary_content: `<h2>${escape(config.keyword)} at a glance</h2><p>${escape(config.description)}</p>${table(config.dates)}<h2>Official verification</h2><p>${verification}</p>`,
    page_summary: `${config.keyword}: eligibility, application steps, syllabus, pattern, official date status, result process and preparation guidance.`,
    meta_title: cap(`${config.keyword}: Dates, Eligibility & Exam Pattern`, 60),
    meta_description: cap(`Check ${config.keyword} eligibility, application steps, syllabus, pattern and official date updates. Avoid old dates and verify every deadline.`, 155),
    meta_keywords: `${config.keyword}, eligibility, application form, exam dates, syllabus, exam pattern, result, official website`,
  };
}

const updates = configs.map((config) => {
  const source = snapshot.find((row) => row.name === config.match || row.short_name === config.match || row.slug === config.slug);
  if (!source) throw new Error(`Could not find snapshot row for ${config.match}`);
  const content = buildContent(config);
  return {
    id: source.id,
    old_slug: source.slug,
    slug: config.slug,
    name: source.name,
    full_name: config.fullName,
    status: config.status,
    exam_date: config.examDate,
    application_start_date: config.appStart,
    application_end_date: config.appEnd,
    result_date: config.result,
    category: config.category,
    level: config.level,
    mode: config.mode,
    frequency: config.frequency,
    eligibility: content.eligibility,
    important_dates: config.dates,
    syllabus: content.syllabus,
    description: content.description,
    application_process: content.application_process,
    exam_pattern: content.exam_pattern,
    preparation_tips: content.preparation_tips,
    counselling_content: content.counselling_content,
    result_content: content.result_content,
    dates_content: content.dates_content,
    summary_content: content.summary_content,
    page_summary: content.page_summary,
    meta_title: content.meta_title,
    meta_description: content.meta_description,
    meta_keywords: content.meta_keywords,
    website: config.sources[0],
    official_website: config.sources[0],
    registration_url: config.sources[0],
    data_source_urls: config.sources,
    data_verified_at: checkedAt,
    data_last_checked_at: checkedAt,
    data_clean_state: "verified_batch_001",
    verification_note: /not announced/i.test(config.status) ? "Next-cycle dates are not published by the authority; displayed as not announced." : "Dates copied from the authority's current cycle notice.",
  };
});

for (const row of updates) {
  if (row.meta_title.length > 60 || row.meta_description.length > 155) throw new Error(`Metadata limit failed for ${row.name}`);
  if (!row.data_source_urls.length) throw new Error(`No official source for ${row.name}`);
}

const outJson = path.join(root, "reports/exam-refresh-batch-001-2026-09-21.json");
fs.writeFileSync(outJson, JSON.stringify({
  batch: "exam-refresh-batch-001",
  checked_at: checkedAt,
  source_snapshot: "reports/pre-rollback-2026-07-29/exams-current.json",
  scope: "First 10 active rows in the local production snapshot, ordered by existing catalogue priority",
  policy: "Official dates only; unpublished 2027 dates remain explicitly unannounced; CAT remains on the 2026 cycle per the requested exception; existing slugs are preserved to avoid breaking indexed URLs.",
  updates,
}, null, 2) + "\n");

const lines = [
  "# Exam refresh batch 001",
  "",
  `Checked: ${checkedAt} (Asia/Kolkata)`,
  "",
  "This batch rewrites the first ten exam records from the local production snapshot. Dates are copied only from official authority pages. Where a 2027 notice was not published, the record says so instead of carrying forward a stale 2026 date or using an estimate.",
  "",
  "## Records",
  "",
];
for (const row of updates) {
  lines.push(`- **${row.name}** → ${row.full_name}`);
  lines.push(`  - Status: ${row.status}`);
  lines.push(`  - Exam date: ${row.exam_date}`);
  lines.push(`  - Application: ${row.application_start_date} → ${row.application_end_date}`);
  lines.push(`  - Result: ${row.result_date}`);
  lines.push(`  - Official source: ${row.website}`);
}
lines.push("", "## Editorial and SEO checks", "", "- Primary keyword is front-loaded in the title and metadata.", "- Meta title is capped at 60 characters and meta description at 155 characters.", "- Content has answer-first framing, H2 sections, an HTML date table, actionable preparation guidance and FAQs can be added by the existing detail-page layer.", "- No guessed dates, fake claims, external competitor references or fabricated quotes were introduced.", "- Existing slugs are intentionally preserved so current indexed links do not break. A future slug migration must add redirects.", "", "## Apply note", "", "This is a reviewable patch artifact. It is not written to production because this workspace has no production database credentials. Apply it through the admin/API after review and keep the JSON as the audit record.", "");
fs.writeFileSync(path.join(root, "reports/exam-refresh-batch-001-2026-09-21.md"), lines.join("\n"));

console.log(`Wrote ${updates.length} exam updates to ${outJson}`);
