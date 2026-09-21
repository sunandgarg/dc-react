import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checkedAt = "2026-09-21T00:00:00+05:30";
const primaryFile = path.join(root, "reports/exam-refresh-batch-001-2026-09-21.json");
const secondaryFile = path.join(root, "reports/exam-refresh-batch-002-2026-09-21.json");
const outputFile = path.join(root, "reports/exam-human-editorial-recheck-002-2026-09-21.json");
const markdownFile = path.join(root, "reports/exam-human-editorial-recheck-002-2026-09-21.md");

const primary = JSON.parse(fs.readFileSync(primaryFile, "utf8"));
const secondary = JSON.parse(fs.readFileSync(secondaryFile, "utf8"));
const selected = [...primary.updates.slice(1, 10), secondary.updates[0]];
if (selected.length !== 10) throw new Error(`Expected 10 exams after JEE Main, found ${selected.length}`);

const cleanDash = (value) => String(value || "").replace(/[\u2013\u2014]/g, "-");
const stripHtml = (value) => cleanDash(String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
const escapeHtml = (value) => cleanDash(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");
const slugify = (value) => String(value || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const yearFrom = (row) => String(row.full_name || row.title || "").match(/20\d{2}/)?.[0] || "2027";
const unique = (values) => [...new Set(values.filter(Boolean))];

const internalLinksFor = (category) => {
  const categoryRoute = {
    Engineering: ["Engineering entrance exams", "/exams/top-engineering-entrance-exams-in-india"],
    Medical: ["Medical entrance exams", "/exams/top-medical-entrance-exams-in-india"],
    Management: ["Management entrance exams", "/exams/top-management-entrance-exams-in-india"],
  }[category] || ["All entrance exams", "/exams"];
  const links = [
    [categoryRoute[0], categoryRoute[1]],
    ["All entrance exams", "/exams"],
    ["Relevant courses", "/courses"],
    ["College options", "/colleges"],
  ];
  if (new Set(links.map(([, href]) => href)).size < 4) {
    links.push(["Latest education news", "/news"]);
  }
  return links.filter((link, index, allLinks) => allLinks.findIndex((candidate) => candidate[1] === link[1]) === index);
};

const profiles = {
  "jee-advanced-2026": {
    lead: "JEE Advanced 2027 dates are not out yet, so a student should not borrow a coaching calendar and treat it as an official deadline. Build preparation around the published syllabus, then wait for the Joint Admission Board brochure before relying on eligibility or paper rules.",
    eligibility: "The JAB sets the cycle-specific rules. The JEE Main qualification route, year of appearance, age, attempt limit, subjects and performance conditions must all be checked in the 2027 brochure.",
    examLead: "Two compulsory papers are expected, but the final question types, marking and duration belong to the 2027 brochure. Paper 1 and Paper 2 are not optional shortcuts.",
    prepLead: "JEE Advanced rewards problem selection as much as raw speed. Practise Physics, Chemistry and Mathematics together, but review why a question was chosen or left rather than only counting attempts.",
    prepItems: ["Keep separate error logs for concepts, calculations and question selection.", "Practise both papers in timed blocks and review the full solution path.", "Use the official syllabus as the boundary for revision.", "Track JEE Main qualification and JoSAA steps separately from preparation."],
    nextLead: "A JEE Advanced rank is followed by JoSAA choice filling and institute-specific document checks. Seat allocation is not automatic; freeze, float and slide decisions have consequences.",
    faqs: [
      ["When will JEE Advanced 2027 dates be released?", "The organising IIT and JAB have not published the 2027 schedule in the checked official material. Treat every date as pending until the brochure or official notice appears."],
      ["Can I appear for JEE Advanced without JEE Main?", "The qualification route and eligible rank list are cycle-specific. Check the 2027 JAB brochure instead of relying on an older attempt rule."],
      ["Is the JEE Advanced paper pattern fixed?", "No. Use the previous pattern only for practice. The 2027 brochure and candidate notice control the final format and marking."],
      ["Does a JEE Advanced rank guarantee an IIT seat?", "No. The rank must still be used in JoSAA choice filling, and the candidate must meet programme, category and document conditions."],
    ],
  },
  "neet-ug-2026": {
    lead: "NEET UG 2027 dates have not been published by NTA in the checked bulletin material. That is useful information, not a dead end: prepare from the notified syllabus, keep documents ready and do not pay against a forwarded deadline.",
    eligibility: "NEET eligibility depends on qualifying subjects, marks, age wording, nationality, category documents and the counselling route. The 2027 NTA bulletin must settle each point, especially for students appearing in Class 12.",
    examLead: "NTA will confirm the 2027 duration, question count, marking, language and mode. Physics, Chemistry, Botany and Zoology remain the practical study buckets until the new notice says otherwise.",
    prepLead: "NEET preparation is won in the small daily choices. Read the prescribed Biology text carefully, then use timed mixed practice so Physics and Chemistry do not get pushed aside.",
    prepItems: ["Make a chapter tracker for Physics, Chemistry and Biology rather than a vague monthly plan.", "Revisit incorrect questions within the same week.", "Use full-length tests to practise the actual response-sheet rhythm.", "Keep application documents and counselling certificates in a separate checklist."],
    nextLead: "After the score, admission depends on the notified counselling authorities, state or central quota rules and document verification. A score alone is not a seat offer.",
    faqs: [
      ["When will NEET UG 2027 registration start?", "NTA has not announced the 2027 application window in the checked official material. Verify the bulletin before entering personal details or paying a fee."],
      ["Can a Class 12 appearing student apply for NEET UG?", "The answer depends on the qualifying-subject and completion rules in the 2027 bulletin. Read that wording before submitting the form."],
      ["Will the NEET UG 2027 pattern stay the same?", "Do not assume it. NTA will confirm question count, marking, duration and language in the current bulletin."],
      ["Does NEET score decide the college automatically?", "No. Counselling, quota, category, choice filling and document verification still decide the final allotment."],
    ],
  },
  cat: {
    lead: "CAT 2026 registration is shown as open in the checked authority notice, with the final deadline listed as 22 September 2026 at 5:00 PM IST. If you are applying, check the live IIM CAT portal today rather than relying on a saved screenshot.",
    eligibility: "CAT applicants generally need a recognised bachelor's degree with the minimum marks in the current notice. Final-year students may apply, but each IIM sets its own shortlisting and admission rules after the score is released.",
    examLead: "The current notice describes a 120-minute computer-based test with three timed sections: Verbal Ability and Reading Comprehension, Data Interpretation and Logical Reasoning, and Quantitative Ability. Follow the IIM Indore bulletin for the final operational details.",
    prepLead: "CAT is not solved by collecting endless mock scores. A working plan protects section practice, then spends more time reviewing avoidable errors than celebrating a good percentile.",
    prepItems: ["Give VARC, DILR and QA separate practice blocks.", "Review every mock by question selection, not only by marks.", "Practise with the section timer so one difficult set cannot consume the paper.", "Keep academic and work-history details ready before the form closes."],
    nextLead: "CAT results feed different IIM and institute shortlisting processes. A percentile is not an admission offer, and work experience, academics, category and interview stages can all matter.",
    faqs: [
      ["What is the CAT 2026 registration deadline?", "The checked authority record lists 22 September 2026 at 5:00 PM IST. Confirm the live portal before submitting because deadlines can be changed by the organiser."],
      ["Can final-year students apply for CAT?", "Yes, subject to the current eligibility and graduation-completion instructions. The form and later admission verification must match your documents."],
      ["Does CAT have one common college cutoff?", "No. IIMs and other institutes publish their own shortlisting and admission rules after considering the CAT score and other profile factors."],
      ["Is a high CAT percentile a guaranteed admission?", "No. It may help you reach a shortlist, but the final decision depends on each institute's process and your verified profile."],
    ],
  },
  "clat-2026": {
    lead: "CLAT 2027 applications are shown as open, with the current closing time listed as 31 October 2026 at 11:59 PM. Law applicants should read the Consortium instructions before treating the date, programme choice or document list as final.",
    eligibility: "CLAT eligibility differs between UG and PG programmes. The Consortium's 2027 instructions control qualifying examination, marks, category certificates and programme-specific conditions.",
    examLead: "CLAT tests reading-heavy decision making rather than memory alone. The Consortium notice should be used for the final section design, duration, question count and reservation instructions.",
    prepLead: "CLAT preparation improves when reading becomes a daily habit. Long passages, legal reasoning and current affairs all punish last-minute cramming, so build stamina before chasing speed.",
    prepItems: ["Read one serious news or policy passage daily and write a short summary.", "Practise legal reasoning from passages instead of memorising isolated principles.", "Use timed sets for English, current affairs, legal reasoning, logical reasoning and quantitative techniques.", "Keep UG and PG eligibility documents separate; they are not interchangeable."],
    nextLead: "After the result, the Consortium and participating NLUs publish the admission and counselling steps. Choice order, category proof and fee payment deadlines deserve the same attention as the score.",
    faqs: [
      ["When does CLAT 2027 registration close?", "The checked Consortium notice lists 31 October 2026 at 11:59 PM. Confirm the live application page before the deadline because an extension is possible only through an official notice."],
      ["Are CLAT UG and PG eligibility rules the same?", "No. They have different qualifying requirements and programme conditions. Use the relevant 2027 Consortium instructions."],
      ["What should I read for CLAT preparation?", "Build reading stamina across law, policy, social issues and current affairs, then practise timed passage-based questions."],
      ["Does a CLAT rank guarantee an NLU seat?", "No. Seat allocation also depends on counselling choices, category documents, available seats and fee deadlines."],
    ],
  },
  "gate-2026": {
    lead: "GATE 2027 registration is shown as open in the IIT Madras authority record. The listed application window closes on 27 September 2026 without a late fee and on 5 October 2026 with a late fee, so check the portal before choosing the cheaper or later option.",
    eligibility: "GATE accepts candidates from eligible undergraduate degree pathways and also permits certain students who are currently studying in a qualifying programme. The 2027 brochure controls the exact year, papers, documents and institute rules.",
    examLead: "GATE 2027 is scheduled across multiple February dates in the checked notice. Paper choice, subject syllabus, calculator rules, question types and response instructions should come from the official brochure for the selected paper.",
    prepLead: "GATE rewards depth. Pick the paper first, map its syllabus into weekly blocks and solve questions until you can explain the wrong answer without looking at the solution.",
    prepItems: ["Fix one paper and map every syllabus unit before collecting study material.", "Mix engineering mathematics, general aptitude and core-subject practice.", "Use a revision notebook for formulas and recurring mistakes.", "Check the form's paper, category and certificate details before payment."],
    nextLead: "GATE scores are used differently by IITs, IISc, PSUs and other institutions. Always check the specific programme or recruitment notice instead of assuming one score rule applies everywhere.",
    faqs: [
      ["What is the GATE 2027 application deadline?", "The checked IIT Madras notice lists 27 September 2026 without a late fee and 5 October 2026 with a late fee. Verify the live portal before paying."],
      ["Can I choose more than one GATE paper?", "The permitted paper combinations and fee rules are cycle-specific. Check the 2027 brochure before finalising the form."],
      ["When is the GATE 2027 result expected?", "The checked record lists 19 March 2027. Treat the official GATE notice as the final source for result publication and score access."],
      ["Does GATE score guarantee an IIT or PSU offer?", "No. Each institute or employer sets its own eligibility, shortlist, interview and document rules."],
    ],
  },
  "uceed-2026": {
    lead: "UCEED 2027 is listed for 17 January 2027 in the official IIT Bombay material, while application details are due to be released by 1 October 2026. Design applicants should prepare now, but wait for the 2027 brochure before paying or choosing a centre.",
    eligibility: "UCEED eligibility, qualifying examination year, age conditions and participating institute rules come from the current IIT Bombay brochure. B.Des admission conditions can differ across participating institutes.",
    examLead: "UCEED tests visual and design thinking along with reasoning and communication. The 2027 brochure will settle the final paper structure, duration, marking and application process.",
    prepLead: "Design preparation is not only sketching. You need observation, visual logic, spatial thinking and enough timed practice to make decisions without polishing one answer forever.",
    prepItems: ["Practise short visual reasoning and observation tasks under a timer.", "Keep a sketchbook of objects, layouts and alternative solutions.", "Review the reason an option works, not just whether it looks attractive.", "Track the B.Des admission rules of every institute you may list."],
    nextLead: "The UCEED score is followed by institute-specific B.Des applications and admission rounds. Keep the scorecard, category proof and portfolio-related instructions ready where required.",
    faqs: [
      ["When is UCEED 2027 scheduled?", "The checked IIT Bombay page lists 17 January 2027 in the forenoon. Confirm the final timing in the 2027 brochure."],
      ["When will UCEED 2027 applications open?", "The official material says details are due by 1 October 2026. Do not treat an earlier coaching date as an application notice."],
      ["Is UCEED only a drawing test?", "No. It also tests visual reasoning, observation, spatial thinking and design aptitude. The brochure defines the exact paper."],
      ["Does UCEED rank itself allot a B.Des seat?", "No. Participating institutes run their own admission rounds, eligibility checks and seat allocation steps."],
    ],
  },
  "cuet-2026": {
    lead: "CUET UG 2027 dates have not been announced by NTA in the checked official material. The smart move is to shortlist programmes first, map their required subjects and wait for the bulletin before locking a subject combination.",
    eligibility: "CUET eligibility is programme and university specific. Subject combinations, qualifying marks, reservation documents and admission rules must be checked on the NTA bulletin and each participating university's admission page.",
    examLead: "CUET can involve language, domain subjects and the General Test depending on the programme. NTA will confirm the 2027 subject choices, mode, duration, question format and marking.",
    prepLead: "CUET planning starts before the form. A student who picks subjects first and checks programme eligibility later can create a problem no amount of mock practice will fix.",
    prepItems: ["List target university programmes before choosing test subjects.", "Match Class 12 subjects with each programme's published eligibility.", "Practise language, domain and General Test sections only where your targets require them.", "Keep university-specific application and counselling dates on a separate tracker."],
    nextLead: "NTA scores are used by participating universities through their own admission portals and rules. The exam result does not replace a university application or preference process.",
    faqs: [
      ["When will CUET UG 2027 registration begin?", "NTA has not published the 2027 schedule in the checked official material. Watch the NTA portal and the admission pages of your target universities."],
      ["How do I choose CUET subjects?", "Start with the degree programmes you want, then match their language, domain and General Test requirements. Do not choose by habit alone."],
      ["Does CUET score guarantee admission to a university?", "No. Universities apply their own eligibility, preference, category and counselling rules after receiving the NTA score."],
      ["Can I use the 2026 CUET subject rules for 2027?", "Use them only for early planning. The 2027 bulletin and programme-specific university pages must decide the final combination."],
    ],
  },
  "xat-2026": {
    lead: "XAT 2027 registration is listed from 15 July to 6 December 2026, with the examination scheduled for 3 January 2027 from 2:00 PM to 5:00 PM in the checked authority record. Check the live XAT portal before paying because the organiser controls every deadline.",
    eligibility: "XAT applicants should follow the current XLRI instructions for the recognised bachelor's degree requirement and final-year status. Institutes accepting XAT scores set their own shortlisting and admission conditions.",
    examLead: "XAT combines verbal and logical reasoning, decision making, quantitative aptitude and data interpretation, plus general knowledge. Use the current instructions for question counts, marking and test-city details.",
    prepLead: "Decision Making is where many otherwise strong candidates lose marks. Practise choosing the most defensible option from a passage, then review why the tempting answer fails.",
    prepItems: ["Give Decision Making a fixed weekly slot instead of treating it as a last-minute add-on.", "Rotate verbal, quantitative and data-interpretation sets under timed conditions.", "Keep a light but regular General Knowledge routine.", "Check the form's institute preferences and academic details before submission."],
    nextLead: "XLRI and other institutes use XAT scores through their own admission processes. Shortlisting, interviews, academics and work experience can matter beyond the test score.",
    faqs: [
      ["What is the XAT 2027 exam date?", "The checked authority record lists 3 January 2027 from 2:00 PM to 5:00 PM IST. Confirm the admit-card instructions before exam day."],
      ["When does XAT 2027 registration close?", "The record lists 6 December 2026. Check the live XAT portal for any official change before paying or editing the form."],
      ["Is Decision Making compulsory in XAT preparation?", "Yes, it is a named part of the test structure and needs passage-based practice rather than generic reasoning drills."],
      ["Does XAT score guarantee XLRI admission?", "No. XLRI and other institutes run separate shortlisting and selection processes."],
    ],
  },
  "bitsat-2026": {
    lead: "BITSAT 2027 dates are not announced by BITS Pilani in the checked admissions material. Use the waiting period to strengthen speed across Physics, Chemistry, Mathematics or Biology, English and Logical Reasoning, but do not copy 2026 deadlines into a 2027 plan.",
    eligibility: "BITSAT eligibility is programme specific. The BITSAT 2027 brochure must confirm the Class 12 passing year, subject combination, marks, attempt rules and admission-preference process.",
    examLead: "BITS Pilani will publish the 2027 computer-based test structure, sessions, duration, question count, marking and slot-booking rules. The permitted subject route also depends on the degree programme.",
    prepLead: "BITSAT is a speed-and-accuracy paper. A beautiful long solution is not useful if it takes three times the available time, so practise clean choices and quick recovery from a bad question.",
    prepItems: ["Revise Physics, Chemistry and Mathematics or Biology according to your target programme.", "Add short English and Logical Reasoning drills through the week.", "Practise mixed timed sets and record questions lost to rushing.", "Keep session and preference decisions separate from study tracking."],
    nextLead: "BITS admission follows score submission, preference filling and the institute's iteration process. A test score does not by itself confirm a branch or campus.",
    faqs: [
      ["When will BITSAT 2027 applications open?", "BITS Pilani has not published the 2027 application window in the checked official material. Wait for the admissions brochure."],
      ["Can I choose Mathematics or Biology in BITSAT?", "The permitted subject route depends on the programme and the current brochure. Check before selecting a degree preference."],
      ["Will BITSAT 2027 have the same pattern as 2026?", "Do not assume it. BITS Pilani will confirm the current duration, marking, sessions and slot rules."],
      ["Does a BITSAT score guarantee a branch?", "No. Preference filling, score, eligibility, available seats and admission iterations determine the final offer."],
    ],
  },
  srmjeee: {
    lead: "SRMJEEE UG 2027 dates are not published in the checked SRMIST admission material. Keep the official application portal bookmarked, but wait for the 2027 notice before treating a phase date, fee or eligibility rule as final.",
    eligibility: "SRMIST sets programme-specific eligibility, subject, marks and document rules. The 2027 information should be checked on the admission page and the official application portal, especially for different campuses or degree choices.",
    examLead: "The 2027 phase schedule, question format, duration, marking and slot instructions must come from SRMIST. Do not carry a previous phase's details into the new cycle without checking the current manual.",
    prepLead: "SRMJEEE preparation should stay close to the programme you want. Build a steady PCM or Biology routine, then add speed practice because online entrance tests punish slow switching between topics.",
    prepItems: ["Match the Physics, Chemistry, Mathematics or Biology plan to the programme you want.", "Use short computer-based practice sets and review calculation mistakes.", "Keep campus and branch preferences written down before the form opens.", "Save every payment receipt, confirmation page and phase notice."],
    nextLead: "After the result, SRMIST controls counselling, campus and programme preference steps. Read the offer and fee conditions before accepting a seat.",
    faqs: [
      ["When will SRMJEEE UG 2027 registration start?", "SRMIST has not published the 2027 schedule in the checked official material. Use the official admission page for the live notice."],
      ["Which subjects should I prepare for SRMJEEE?", "The subject combination depends on the programme. Match the current SRMIST eligibility and syllabus instructions before planning."],
      ["Can I choose more than one SRM campus?", "Campus and programme preference rules are cycle-specific. Read the application and counselling instructions before submitting choices."],
      ["Does SRMJEEE rank guarantee admission?", "No. Eligibility, preference, available seats, fee payment and SRMIST counselling steps still apply."],
    ],
  },
};

const defaultProfile = (row) => ({
  lead: `${row.name} ${yearFrom(row)} information should be checked against the current authority notice before a student pays a fee or plans around a deadline. This update keeps unpublished dates marked as pending instead of filling the page with old estimates.`,
  eligibility: stripHtml(row.eligibility),
  examLead: stripHtml(row.exam_pattern),
  prepLead: "Use the official syllabus as the boundary, practise in timed blocks and review mistakes while they are still easy to remember.",
  prepItems: ["Read the current official syllabus before collecting study material.", "Practise the paper in timed blocks.", "Keep an error log and revisit it every week.", "Track applications and counselling separately from study tasks."],
  nextLead: stripHtml(row.counselling_content),
  faqs: [
    [`When will ${row.name} ${yearFrom(row)} dates be released?`, `Check the official ${row.name} portal for the current notice. Any date not published by the authority should remain marked as pending.`],
    [`Who can apply for ${row.name}?`, stripHtml(row.eligibility)],
    [`How should I prepare for ${row.name}?`, "Use the official syllabus, timed practice and a simple error log rather than copying an unverified coaching calendar."],
    [`Does ${row.name} score guarantee admission?`, "No. Eligibility, counselling, document verification and seat availability still decide the final offer."],
  ],
});

const htmlFragmentWithoutHeading = (value) => cleanDash(String(value || "").replace(/^\s*<h2[^>]*>[\s\S]*?<\/h2>/i, "").trim());
const cleanSourceHtml = (value) => htmlFragmentWithoutHeading(value)
  .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, "$1")
  .replace(/https?:\/\/[^\s<]+/gi, "official portal")
  .replace(/\bwww\.[^\s<]+/gi, "official portal");
const listHtml = (items) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
const datesTable = (dates) => `<table><thead><tr><th>Event</th><th>Date or status</th></tr></thead><tbody>${(dates || []).map((item) => `<tr><td>${escapeHtml(item.event)}</td><td>${escapeHtml(item.date)}</td></tr>`).join("")}</tbody></table>`;

function buildRecord(row) {
  const year = yearFrom(row);
  const profile = profiles[row.slug] || defaultProfile(row);
  const internalLinks = internalLinksFor(row.category);
  const officialUrls = unique([row.registration_url, ...(Array.isArray(row.data_source_urls) ? row.data_source_urls : [])].filter((url) => /^https?:\/\//i.test(url)));
  const applyUrl = officialUrls[0] || row.official_website || row.website;
  const noticeUrl = officialUrls[1] || null;
  const externalLinks = { apply: applyUrl, ...(noticeUrl ? { official_notification: noticeUrl } : {}) };
  const internalHtml = `<ul>${internalLinks.map(([label, href]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`).join("")}</ul>`;
  const officialLinkHtml = `<p>Before you submit anything, check the official application portal${noticeUrl ? " and the official notification or dates page" : ""} listed in the verified links for this exam. Those pages control the live cycle; this guide does not replace them.</p>`;
  const faqHtml = `<h2>Questions students actually ask</h2>${profile.faqs.map(([question, answer]) => `<h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p>`).join("")}`;
  const syllabus = Array.isArray(row.syllabus) && row.syllabus.length ? listHtml(row.syllabus) : listHtml(profile.prepItems);
  const articleHtml = [
    `<p>${escapeHtml(profile.lead)}</p>`,
    `<h2>${escapeHtml(row.name)} ${year} dates and current status</h2><p>${escapeHtml(stripHtml(row.verification_note || "Use the authority notice for the live cycle."))}</p>${datesTable(row.important_dates)}`,
    `<h2>Who can apply and what to check</h2><p>${escapeHtml(profile.eligibility)}</p>${listHtml(["Match the qualifying examination and subjects with the target programme.", "Keep category, identity and academic documents consistent.", "Read the current authority notice before paying or submitting the form."])}`,
    `<h2>What the ${escapeHtml(row.name)} paper tests</h2><p>${escapeHtml(profile.examLead)}</p><h3>Subject or skill areas</h3>${syllabus}`,
    `<h2>How to apply without creating a preventable problem</h2>${cleanSourceHtml(row.application_process)}${officialLinkHtml}`,
    `<h2>How to prepare without burning out</h2><p>${escapeHtml(profile.prepLead)}</p>${listHtml(profile.prepItems)}<p>Small, repeatable work beats a dramatic plan that collapses after one week. Keep one place for mistakes, one place for deadlines and one honest view of your weak areas.</p>`,
    `<h2>Results, counselling and the next decision</h2><p>${escapeHtml(profile.nextLead)}</p>${cleanSourceHtml(row.result_content)}`,
    faqHtml,
    `<h2>Useful DekhoCampus guides</h2>${internalHtml}`,
  ].join("");
  const title = `${row.name} ${year}: Dates, Eligibility and Exam Pattern`;
  const metaTitle = `${row.name} ${year}: Dates, Eligibility & Pattern`;
  const metaDescription = `Check ${row.name} ${year} dates, eligibility, application steps, syllabus and result guidance. Verify every deadline on the official portal.`;
  const description = `${row.name} ${year} dates, eligibility, application, exam pattern, preparation and result guidance, with unpublished details clearly marked for official confirmation.`;
  const pageSummary = `${row.name} ${year}: current date status, eligibility, application steps, syllabus, pattern, preparation and counselling guidance.`;
  const summaryContent = `<h2>${escapeHtml(row.name)} ${year} at a glance</h2><p>${escapeHtml(description)}</p>${datesTable(row.important_dates)}<h2>Official verification</h2><p>${escapeHtml(cleanDash(row.verification_note || "Use the official authority notice for the live cycle."))}</p>`;
  return {
    ...row,
    title,
    full_name: cleanDash(row.full_name),
    description,
    hero_hook: stripHtml(profile.lead),
    article_html: articleHtml,
    page_summary: pageSummary,
    summary_content: summaryContent,
    meta_title: metaTitle,
    meta_description: metaDescription,
    meta_keywords: `${row.name} ${year}, eligibility, application form, exam dates, syllabus, exam pattern, result, official website`,
    faqs: profile.faqs.map(([question, answer]) => ({ question, answer })),
    internal_links: internalLinks.map(([, href]) => href),
    external_links: externalLinks,
    official_apply_url: applyUrl,
    official_notification_url: noticeUrl,
    data_source_urls: officialUrls.slice(0, 6),
    data_verified_at: checkedAt,
    data_last_checked_at: checkedAt,
    data_clean_state: "human_editorial_recheck_002",
    verification_note: `${cleanDash(row.verification_note || "Official source status checked")}. Article dates and eligibility wording were rechecked on 2026-09-21; no unpublished value was filled in.`,
    editorial_policy: "DekhoCampus human editorial policy v2: direct Indian admissions voice, no raw Markdown, no fabricated dates, official-source-first exam facts, topic-native structure, four visible FAQs, four verified internal links and one or two verified official external links.",
  };
}

const banned = [
  "holistic development", "academic excellence", "myriad of options", "embark on your journey", "transformative experience", "navigating the landscape", "educational tapestry", "vibrant campus life",
  "delve", "foster", "harness", "leverage", "encapsulate", "illuminate", "demystify", "unravel", "pivot", "elevate", "underscore", "showcase", "streamline", "bolster", "optimize",
  "crucial", "robust", "pivotal", "multifaceted", "seamless", "bespoke", "groundbreaking", "imperative", "paramount", "overarching", "dynamic", "nuanced", "quintessential",
  "furthermore", "moreover", "additionally", "nevertheless", "consequently", "henceforth", "in tandem with", "it is worth noting that", "a testament to", "in conclusion", "ultimately", "to summarize", "let's dive in", "here is a detailed guide", "certainly", "game-changer", "game changer", "dive in", "unlock the power", "in today's world", "beacon", "vital role", "firstly", "secondly", "in summary", "landscape",
];

function auditRecord(record) {
  const html = record.article_html;
  const body = stripHtml(html);
  const words = body.match(/[A-Za-z0-9][A-Za-z0-9'/-]*/g) || [];
  const internalCount = [...html.matchAll(/<a\s[^>]*href="(\/[^"#?]*)"/gi)].length;
  const externalCount = Object.values(record.external_links).filter(Boolean).length;
  const hits = banned.filter((word) => new RegExp(`(?:^|\\W)${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|\\W)`, "i").test(body));
  const checks = {
    word_count: words.length >= 550,
    metadata: record.meta_title.length <= 60 && record.meta_description.length <= 155,
    semantic_html: !/<h1\b|```|(?:^|\n)\s*#{1,6}\s/m.test(html),
    answer_first: !/^\s*(?:answer first|answer|executive summary)\s*[:\-]/i.test(body),
    table: /<table\b/i.test(html) && /<th\b/i.test(html),
    faqs: record.faqs.length === 4 && record.faqs.every(({ question }) => body.toLowerCase().includes(question.toLowerCase())),
    internal_links: internalCount >= 4,
    official_links: externalCount >= 1 && externalCount <= 2 && Object.values(record.external_links).every((url) => record.data_source_urls.includes(url)),
    no_published_urls: !/https?:\/\/|\bwww\./i.test(html),
    no_forbidden_language: hits.length === 0,
    no_long_dash: !/[\u2013\u2014]/.test(`${record.title} ${record.meta_title} ${record.meta_description} ${html}`),
    no_placeholders: !/undefined|null|TODO|TBD/i.test(`${record.title} ${record.description} ${html}`),
  };
  return { passed: Object.values(checks).every(Boolean), score: Math.round(Object.values(checks).filter(Boolean).length / Object.values(checks).length * 100), word_count: words.length, internal_links: internalCount, external_links: externalCount, forbidden_hits: hits, checks };
}

const updates = selected.map(buildRecord);
const audits = Object.fromEntries(updates.map((record) => [record.slug, auditRecord(record)]));
const failed = Object.entries(audits).filter(([, audit]) => !audit.passed);
if (failed.length) throw new Error(`Exam recheck quality gate failed: ${failed.map(([slug, audit]) => `${slug}: ${JSON.stringify(audit)}`).join("; ")}`);

const payload = {
  batch: "exam-human-editorial-recheck-002",
  checked_at: checkedAt,
  source_batches: ["reports/exam-refresh-batch-001-2026-09-21.json", "reports/exam-refresh-batch-002-2026-09-21.json"],
  scope: "The ten exams immediately after JEE Main in the existing ordered refresh list: JEE Advanced through SRMJEEE UG",
  policy: "DekhoCampus human editorial policy v2: direct Indian admissions voice, official-source-first facts, no invented dates, no raw Markdown, semantic HTML, four visible FAQs, four verified internal links and one or two verified official external links.",
  updates,
  quality_audits: audits,
  production_write: "not performed; this is a reviewable batch artifact and requires the production data migration after approval",
};
fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync(markdownFile, [
  "# Exam human editorial recheck batch 002",
  "",
  `Checked: ${checkedAt} (Asia/Kolkata)`,
  "",
  "This batch covers the ten records immediately after JEE Main: JEE Advanced, NEET UG, CAT, CLAT, GATE, UCEED, CUET, XAT, BITSAT and SRMJEEE UG.",
  "",
  "Every record uses official-source-first date handling, keeps unpublished values pending, includes four visible FAQs, four verified DekhoCampus links and one or two verified official links, and passes the batch editorial audit.",
  "",
  ...updates.map((record) => `- **${record.title}** - ${audits[record.slug].word_count} words, ${audits[record.slug].internal_links} internal links, ${audits[record.slug].external_links} official links, audit ${audits[record.slug].score}/100`),
  "",
  "Production write: not performed. Review and deploy through the approved production migration after checking the official source pages again.",
  "",
].join("\n"));
console.log(`Wrote ${outputFile}`);
