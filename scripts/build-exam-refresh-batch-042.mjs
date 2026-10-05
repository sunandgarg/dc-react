import fs from "node:fs";
import path from "node:path";
import { assertBatchHumanEditorial, assertBatchVariation, BATCH_CONTENT_VARIATION_TEXT } from "./content-batch-policy.mjs";

const root = process.cwd();
const checkedAt = "2026-10-06T00:00:00+05:30";
const snapshot = JSON.parse(fs.readFileSync(path.join(root, "reports/pre-rollback-2026-07-29/exams-current.json"), "utf8"));
const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const paragraph = (value) => `<p>${esc(value)}</p>`;
const heading = (value) => `<h2>${esc(value)}</h2>`;

// Each fact below is limited to what the linked authority published for the
// 2026-27 cycle. No 2027 application window or score rule is inferred from it.
const configs = [
  {
    slug: "wbjee-jelet", name: "JELET", category: "Engineering/Pharmacy", authority: "West Bengal Joint Entrance Examinations Board",
    sources: ["https://wbjeeb.nic.in/jelet/", "https://wbjeeb.nic.in/current-events-jelet/"],
    opening: "A diploma can open a second-year engineering seat through JELET, but not every degree or branch sits on that route. Start with the branch you want, not a borrowed exam timetable.",
    fact: "The 2026 JELET route covered second-year (third-semester) entry to engineering, technology and pharmacy degrees, but not architecture.",
    sections: [
      ["Which seat are you actually trying to enter?", "Put your diploma discipline next to the intended engineering, technology or pharmacy branch. Lateral entry is different from applying for a first-year seat, so the college preference list needs a separate eligibility check."],
      ["What does the last cycle establish?", "The published 2026 route is a useful boundary, not a promise that the 2027 paper, branch list or seat matrix will be identical."],
      ["The choice-filling mistake to avoid", "A rank becomes useful only when the programme appears in the current seat matrix and your documents match the route. Save the option list before locking it; the order can matter more than a generic college ranking."],
    ],
    application: "When WBJEEB opens JELET 2027, compare the diploma details with the bulletin and seat matrix before registering. Keep the diploma marksheet and category documents beside the form, then save the submitted choices.",
    preparation: "Work one timed applied-mathematics set, then revisit the diploma subject that produced the most errors. Separate calculation errors from branch-concept gaps; they need different practice.",
    next_heading: "Before a diploma holder locks choices", related: ["/courses", "engineering course options", "Name the branch first, then use the engineering course options to refine your college list."],
    faq: ["Does JELET place diploma students into the first year?", "Is architecture part of the published JELET lateral-entry route?", "What should I compare before JELET option entry?", "Are JELET 2027 dates published yet?"],
    faq_answers: ["No. The published 2026 JELET route was for second-year, third-semester entry.", "No. The 2026 WBJEEB description excluded architecture from this lateral-entry route.", "Compare your diploma discipline, the current branch list and the live seat matrix before locking preferences.", "The checked WBJEEB material did not establish 2027 dates. Use its next JELET notice for the new cycle."],
  },
  {
    slug: "wbjee-jeca", name: "JECA", category: "Computer Applications", authority: "West Bengal Joint Entrance Examinations Board",
    sources: ["https://wbjeeb.nic.in/jeca/", "https://wbjeeb.nic.in/current-events-jeca/"],
    opening: "JECA is the MCA route in West Bengal, so a student choosing an institute should look past the test score and read the counselling list as closely as the question paper.",
    fact: "WBJEEB described JECA 2026 as its entrance test and counselling route for MCA admission in participating West Bengal institutions.",
    sections: [
      ["What does a JECA score lead to?", "The test produces a rank, while counselling connects that rank to a listed MCA seat. An institute outside the participating list cannot be assumed available just because it teaches computer applications."],
      ["Read the 2026 page as context", "WBJEEB separated the 2026 application, rank card, seat matrix and counselling notices. That sequence is useful for planning; it does not establish a 2027 date."],
      ["A practical MCA shortlist", "Compare the institute's MCA programme, fee and location before you order choices. Record what you would accept rather than copying someone else's preference list."],
    ],
    application: "Use the JECA candidate dashboard only after the new bulletin identifies the qualifying degree and mathematics conditions. Download the confirmation, then track rank and counselling notices as separate steps.",
    preparation: "Practise a mixed mathematics and reasoning block under a timer. After each set, write down whether the lost mark came from a concept, a calculation or the time spent reading the question.",
    next_heading: "Turn the MCA shortlist into a plan", related: ["/colleges", "college profiles", "Use college profiles to compare location and fees only after the JECA seat list confirms a participating MCA programme."],
    faq: ["Does JECA admission end when the rank card appears?", "Where is the participating MCA institute list published?", "How should I build a JECA MCA preference order?", "Can the JECA 2026 calendar be used for 2027?"],
    faq_answers: ["No. The published JECA process also has counselling and seat allotment.", "WBJEEB's JECA page links the current seat matrix and counselling material.", "List MCA institutes you would actually accept after comparing programme, fee and location.", "No. The 2026 calendar is previous-cycle context, not a 2027 announcement."],
  },
  {
    slug: "jemscn", name: "JEMScN", category: "Nursing/Postgraduate", authority: "West Bengal Joint Entrance Examinations Board",
    sources: ["https://wbjeeb.nic.in/jemscn/", "https://wbjeeb.nic.in/current-events-jemscn/"],
    opening: "For a nurse considering an MSc, JEMScN is not simply another test date. The qualifying nursing record and the later seat choice have to line up with the same application.",
    fact: "The JEMScN 2026 page identified an OMR-based entrance test for MSc Nursing seats in West Bengal colleges and institutes.",
    sections: [
      ["Map the nursing qualification first", "Read the programme's degree, registration and category conditions beside your certificates. A strong entrance result does not repair a missing eligibility document at admission."],
      ["What can the previous cycle tell you?", "The 2026 page distinguishes the test from the later counselling and seat-allotment stages. Use that sequence to organise documents, not to guess 2027 deadlines."],
      ["Plan beyond the rank card", "Compare clinical specialisation, seat availability and travel before entering college choices. Keep the current seat matrix open while making the list."],
    ],
    application: "Once WBJEEB releases JEMScN 2027, match your BSc Nursing and registration evidence to its bulletin, upload the requested files and retain the confirmation for counselling.",
    preparation: "Take one clinical case at a time: assessment, priority intervention, contraindication and reason. This exposes a shaky nursing decision more clearly than rereading a summary page.",
    next_heading: "Keep the clinical route and paperwork together", related: ["/courses", "postgraduate course options", "Compare postgraduate course options with the MSc Nursing route before committing to a specialisation."],
    faq: ["Is JEMScN the route for Post Basic BSc Nursing?", "Which nursing documents matter before JEMScN registration?", "What follows the JEMScN rank card?", "Can I rely on the JEMScN 2026 exam date for 2027?"],
    faq_answers: ["No. JEMScN was the MSc Nursing route; JEPBN covered Post Basic BSc Nursing in the published 2026 cycle.", "Keep the qualifying nursing degree, registration proof and category records required by the new bulletin ready.", "The published 2026 sequence continued into counselling and seat allotment.", "No. A 2026 test date does not establish the 2027 schedule."],
  },
  {
    slug: "jepbn", name: "JEPBN", category: "Nursing/Undergraduate", authority: "West Bengal Joint Entrance Examinations Board",
    sources: ["https://wbjeeb.nic.in/jepbn/", "https://wbjeeb.nic.in/current-events-jepbn/"],
    opening: "JEPBN serves a different nursing decision from JEMScN: it leads towards Post Basic BSc Nursing, not an MSc seat. Mixing the two routes wastes both preparation and form fees.",
    fact: "WBJEEB described JEPBN 2026 as the OMR-based route to Post Basic BSc Nursing admission in West Bengal.",
    sections: [
      ["Do you need the post-basic route?", "Start with the exact nursing qualification and registration listed in the current bulletin. The course name is the first filter; a generic nursing entrance guide is not enough."],
      ["How the seat stage changes the plan", "WBJEEB's 2026 page carried counselling notices, a seat matrix and a rank-card route separately. Prepare the documents for those stages before the test result arrives."],
      ["Use the right nursing practice", "Revise practical nursing priorities and the science behind them. If a question asks for the first action, explain why it is safer than the plausible second choice."],
    ],
    application: "Read the JEPBN 2027 notice against your GNM and registration records before using the WBJEEB form. Retain the uploaded files and payment proof for the later seat process.",
    preparation: "Build short patient-care scenarios from community, medical-surgical and maternal nursing topics. Answer the priority question before looking at the explanation.",
    next_heading: "What a post-basic applicant can do now", related: ["/exams", "other nursing entrance routes", "If the qualification does not fit JEPBN, compare other nursing entrance routes instead of submitting the wrong form."],
    faq: ["Which nursing course does JEPBN lead to?", "Is JEPBN the same exam as JEMScN?", "Why keep registration proof after JEPBN submission?", "Where will JEPBN 2027 dates appear?"],
    faq_answers: ["The published 2026 JEPBN route led to Post Basic BSc Nursing.", "No. WBJEEB listed JEMScN separately for MSc Nursing.", "Counselling and document verification can require the same registration evidence after the form is submitted.", "The next WBJEEB JEPBN notice should establish the new-cycle calendar; the checked 2026 page did not."],
  },
  {
    slug: "mah-bdesign-cet", name: "MAH B.Design CET", category: "Design", authority: "Maharashtra State Common Entrance Test Cell",
    sources: ["https://cetcell.mahacet.org/cms-download/information-brochure-for-b-design-cet-a-y-2026-27/", "https://cetcell.mahacet.org/wp-content/uploads/2023/12/CET-Registration-Notice_B-Design_-CET-2026-1.pdf"],
    fact_source: 1,
    opening: "A design entrance form can be derailed by identity details before a portfolio is even considered. MAH B.Design CET applicants should treat registration and practical preparation as two separate jobs.",
    fact: "The Maharashtra CET Cell's 2026 B.Design registration notice required an APAAR ID and Aadhaar ID and described the test as offline.",
    sections: [
      ["What the 2026 notice actually says", "The identity requirements and offline mode belong to the published 2026 cycle. They are concrete preparation clues, not an announcement of the 2027 rules or dates."],
      ["Prepare work you can explain", "Sketch an everyday object from observation, then explain the user's problem it solves. Compare two versions and note what changed after feedback; a decorative drawing alone says less about design judgement."],
      ["Before paying for the next cycle", "Compare the latest brochure's eligibility, test mode, centre rules and document list with the programme you want. Keep a local copy of the application confirmation."],
    ],
    application: "Wait for the CET Cell's MAH B.Design CET 2027 notice, then confirm the identity fields and uploaded files before payment. Do not carry a 2026 edit-window date into a new application.",
    preparation: "Use timed observation sketches, visual-comparison questions and a short written explanation of each design choice. Mark whether you lost time on ideation, drawing or interpretation.",
    next_heading: "From an observation sketch to the form", related: ["/courses", "design courses", "Compare design courses by their actual studio work while the next CET Cell notice is pending."],
    faq: ["Was the MAH B.Design CET 2026 test online?", "Which IDs did the 2026 design registration notice require?", "How should I practise design observation?", "Is a 2027 MAH B.Design CET date confirmed?"],
    faq_answers: ["No. The Maharashtra CET Cell's 2026 notice described it as an offline test.", "The 2026 registration notice required APAAR ID and Aadhaar ID.", "Sketch an object from observation, explain its user problem and revise one design choice after feedback.", "The checked official material did not establish a 2027 date."],
  },
  {
    slug: "ipmat-indore", name: "IPMAT Indore", category: "Management", authority: "Indian Institute of Management Indore",
    sources: ["https://iimidr.ac.in/programmes/academic-programmes/five-year-integrated-programme-in-management-ipm/ipm-admissions-details/", "https://iimidr.ac.in/wp-content/uploads/2026/01/AdmissionProcedure_IPM-2026-31_-Domestic-Applicants.pdf"],
    fact_source: 1,
    opening: "IPMAT Indore is a route into IIM Indore's five-year IPM, but a test score by itself was not the whole 2026 selection. That distinction matters when you build a preparation plan.",
    fact: "IIM Indore's 2026 domestic procedure listed quantitative ability in MCQ and short-answer sections, verbal ability in MCQs, and a personal interview for shortlisted candidates.",
    sections: [
      ["Why two quantitative formats matter", "A short-answer problem removes the comfort of eliminating options. Practise writing the result cleanly, then switch to MCQs and measure whether speed changes your accuracy."],
      ["The interview is a separate gate", "IIM Indore's published 2026 process considered aptitude-test and personal-interview performance. Build the habit of explaining a choice aloud; memorised headlines will not replace clear reasoning."],
      ["What remains open for 2027", "The next admission procedure must confirm eligibility, section timing, marking and interview stages. Avoid converting the 2026 PDF into a 2027 promise."],
    ],
    application: "When IIM Indore posts its 2027 IPM procedure, compare your Class 10 and 12 details with the eligibility paragraph before creating the application. Save the submitted form and monitor the institute's shortlist page.",
    preparation: "Alternate quantitative short-answer and MCQ sets, then review verbal passages for the inference you missed. Once a week, explain a recent academic choice in two minutes without a script.",
    next_heading: "Separate test practice from interview practice", related: ["/exams", "management entrance options", "Compare management entrance options only after separating IIM Indore's own IPM procedure from other institutes' tests."],
    faq: ["Does IPMAT Indore use only multiple-choice quantitative questions?", "Did the 2026 IIM Indore process include an interview?", "Which school records should an IPM applicant keep ready?", "Are IPMAT Indore 2027 sections final?"],
    faq_answers: ["No. The 2026 domestic procedure also listed a quantitative short-answer section.", "Yes. Shortlisted domestic applicants went through a personal interview in the published 2026 procedure.", "Keep the Class 10 and 12 records and category evidence required by the new procedure ready.", "No. The checked 2026 procedure cannot establish the 2027 section or marking rules."],
  },
  {
    slug: "ipmat-rohtak", name: "IPMAT Rohtak", category: "Management", authority: "Indian Institute of Management Rohtak",
    sources: ["https://iimrohtak.ac.in/ipm-admission.php", "https://www.iimrohtak.ac.in/ipm-admission.php"],
    opening: "IIM Rohtak's IPM selection is not the same paper as IIM Indore's. Copying another institute's section plan can leave a logical-reasoning gap on test day.",
    fact: "IIM Rohtak's 2026 IPM aptitude test listed quantitative ability, logical reasoning and verbal ability as its three sections.",
    sections: [
      ["Keep the two IPMAT routes separate", "Rohtak's published 2026 route also used a personal interview after shortlisting. Compare each institute's own procedure before choosing practice papers or assuming the same score formula."],
      ["Where school marks enter", "The 2026 IIM Rohtak page included past academics in its composite selection. A test-preparation calendar should therefore leave time to assemble the school marksheets and category proof."],
      ["A useful practice split", "Give logical reasoning its own timed set rather than hiding it inside quantitative practice. Review the step where the argument failed, not only the final option."],
    ],
    application: "Use IIM Rohtak's 2027 IPM admission page when it opens. Enter the school-mark details exactly as certified, keep the form receipt and watch for the separate interview shortlist.",
    preparation: "Run three short timed blocks for quantitative, logical and verbal questions. Log which block consumes the most minutes and why, then revise that question type next.",
    next_heading: "Build a Rohtak-specific practice week", related: ["/courses", "management programmes", "Review management programmes alongside the institute's own eligibility and selection stages."],
    faq: ["Is IIM Rohtak IPM AT identical to IIM Indore IPMAT?", "Did Rohtak's 2026 paper include logical reasoning?", "How did the 2026 Rohtak selection treat school academics?", "Can I use the Rohtak 2026 eligibility percentages for 2027?"],
    faq_answers: ["No. The institutes publish separate admission procedures and section plans.", "Yes. IIM Rohtak's 2026 page listed logical reasoning with quantitative and verbal ability.", "The 2026 composite selection included past academic performance alongside test and interview stages.", "No. The next Rohtak notice controls 2027 eligibility; do not carry a past-cycle percentage forward as a rule."],
  },
  {
    slug: "jmi-ba-llb", name: "JMI BA LLB Entrance", category: "Law", authority: "Jamia Millia Islamia",
    sources: ["https://admission.jmi.ac.in/Prospectus", "https://admission.jmi.ac.in/application/assets/pdfFile/prospectus/UniversityProspectus/University_Prospectus_2026_2027.pdf"],
    fact_source: 1,
    opening: "A BA LLB applicant at Jamia should not treat a law entrance score as the entire admission file. The programme, test centre and later document stage belong to the same decision.",
    fact: "Jamia Millia Islamia's 2026-27 university prospectus listed BA LLB among programmes with multiple entrance-test centres.",
    sections: [
      ["Read the programme row, not a generic law page", "Jamia's prospectus separates programme codes, test schedules and eligibility. Find the BA LLB row for the cycle you are applying to before selecting the test route."],
      ["The centre choice is practical", "A multi-centre test is easier to plan when you consider travel, identity documents and the reporting window together. Save the admit card and application number before the entrance day."],
      ["After the result", "A shortlist can still lead to document verification or another stated admission step. Prepare Class 12, category and identity records in the format Jamia requests for the current cycle."],
    ],
    application: "For the next JMI BA LLB cycle, open the university prospectus first, identify the programme code and entrance route, then complete the admission portal form using matching school records.",
    preparation: "Practise legal reasoning by stating the rule, applying it to a changed fact and explaining why the tempting alternative fails. Pair this with timed reading comprehension.",
    next_heading: "Prepare the correct Jamia file", related: ["/courses", "law courses", "Look at law courses with the BA LLB programme row in hand, not a generic entrance checklist."],
    faq: ["Where is the JMI BA LLB entrance route listed?", "Did Jamia offer more than one test centre in 2026-27?", "Which records should a BA LLB applicant keep together?", "Has Jamia issued a JMI BA LLB 2027 test schedule?"],
    faq_answers: ["The JMI university prospectus lists programme codes, eligibility and entrance-test scheduling.", "Yes. Its 2026-27 prospectus included BA LLB among multi-centre entrance programmes.", "Keep Class 12, identity, category, admit-card and application records available for the stated stages.", "The checked prospectus was for 2026-27 and did not establish a separate 2027 test schedule."],
  },
  {
    slug: "amu-ba-llb", name: "AMU BA LLB Admission Test", category: "Law", authority: "Aligarh Muslim University",
    sources: ["https://www.amucontrollerexams.com/", "https://mail.amucontrollerexams.com/uploads/files/e97cf6112508c8e79149275de5ae1cb3.pdf"],
    fact_source: 1,
    opening: "AMU BA LLB candidates have two calendars to track: the admission test and the counselling call. A rank on its own is not a seat offer.",
    fact: "Aligarh Muslim University's 2026-27 guide to admissions published the BA LLB route under the university's own admission process.",
    sections: [
      ["Start from the AMU guide", "Find the BA LLB programme row and note the qualification, test and document instructions together. A recycled cutoff list is not a substitute for the current guide."],
      ["Why the post-test stage matters", "AMU's controller issued separate 2026 BA LLB counselling notices after the test. Put the controller's notice page on your follow-up list rather than waiting for an individual message."],
      ["Use a legal problem, not a slogan", "Read a short fact pattern, identify the governing rule and change one fact to see whether the conclusion still holds. This makes preparation less dependent on memorised answer keys."],
    ],
    application: "Read AMU's next BA LLB guide before submitting. Match your Class 12 and category evidence to its programme conditions, and keep the form and later counselling notice together.",
    preparation: "Alternate comprehension passages with legal-principle questions. Write one sentence explaining the incorrect option that looked most convincing.",
    next_heading: "After the AMU form is submitted", related: ["/colleges", "college information", "Keep AMU's controller notices next to the college information you use to compare the programme."],
    faq: ["Does an AMU BA LLB test rank guarantee admission?", "Where did AMU publish BA LLB counselling notices in 2026?", "Which guide controls the AMU BA LLB application?", "Should I reuse an AMU BA LLB 2026 cutoff for 2027?"],
    faq_answers: ["No. A rank is followed by the university's counselling and document stages.", "AMU's Office of the Controller of Examinations published separate BA LLB counselling notices.", "The current AMU guide to admissions and controller notices control the programme route.", "No. A 2026 cutoff belongs to that cycle and is not a 2027 admission rule."],
  },
  {
    slug: "jmi-mba", name: "JMI MBA Entrance", category: "Management", authority: "Jamia Millia Islamia",
    sources: ["https://admission.jmi.ac.in/Prospectus", "https://admission.jmi.ac.in/application/assets/pdfFile/prospectus/UniversityProspectus/University_Prospectus_2026_2027.pdf"],
    fact_source: 1,
    opening: "Jamia's MBA choices are not one interchangeable form. The regular MBA and named variants need to be mapped to the programme row before an applicant studies for the wrong route.",
    fact: "The JMI 2026-27 university prospectus listed MBA, MBA International Business and MBA Entrepreneurship and Family Business among its multi-centre entrance programmes.",
    sections: [
      ["Which MBA are you applying for?", "Write the exact programme name and code beside your intended career direction. The admission portal and prospectus, not a generic MBA article, decide which entrance record you need."],
      ["Compare the selection stages", "Before paying, read the current row for test, eligibility and any later selection component. Do not assume a CAT score or another university's MBA rule automatically applies."],
      ["Make practice decision-based", "Use a short business case and a timed quantitative set, then explain which information changed your decision. That review is more useful than collecting unrelated mock scores."],
    ],
    application: "Wait for the next Jamia university prospectus, select the exact MBA programme in its code list, then complete the JMI portal form and retain the submitted acknowledgement.",
    preparation: "Review one data-interpretation set and one management case together. Record where a calculation error changed the business conclusion rather than only marking the answer wrong.",
    next_heading: "Apply to the MBA you actually mean", related: ["/courses", "MBA course options", "Use MBA course options to compare specialisations, then return to the exact JMI programme code before applying."],
    faq: ["Are all JMI MBA variants the same programme?", "Which JMI document lists MBA entrance codes?", "Can a generic CAT rule replace Jamia's MBA prospectus?", "Has JMI released MBA 2027 entrance dates?"],
    faq_answers: ["No. The 2026-27 prospectus named regular MBA, International Business and Entrepreneurship and Family Business separately.", "The JMI university prospectus lists programme codes and entrance details.", "No. The selected JMI programme's own eligibility and test route control the application.", "The checked 2026-27 prospectus did not establish a separate MBA 2027 schedule."],
  },
];

function build(config) {
  const row = snapshot.find((candidate) => candidate.slug === config.slug);
  if (!row || row.is_active === false) throw new Error(`Missing active canonical exam row: ${config.slug}`);
  const status = "2027 schedule not established by the checked official material";
  const [relatedPath, relatedLabel, relatedCopy] = config.related;
  const articleHtml = [
    paragraph(config.opening),
    heading(config.sections[0][0]), paragraph(config.sections[0][1]),
    `<p>${esc(config.fact)} <a href="${config.sources[config.fact_source || 0]}" rel="noopener noreferrer">See the published authority material</a>.</p>`,
    ...config.sections.slice(1).flatMap(([title, copy]) => [heading(title), paragraph(copy)]),
    paragraph(`The ${config.name} 2027 application, test and result dates were not established by the official material checked on 6 October 2026. Use the next ${config.authority} notice for the new cycle.`),
    heading(config.next_heading), paragraph(config.application), paragraph(config.preparation),
    `<p>${esc(relatedCopy).replace(esc(relatedLabel), `<a href="${relatedPath}">${esc(relatedLabel)}</a>`)}</p>`,
  ].join("");
  const faqs = config.faq.map((question, index) => ({ question, answer: config.faq_answers[index] }));
  const update = {
    id: row.id, old_slug: row.slug, slug: row.slug, name: row.name,
    title: `${config.name} 2027: Eligibility, Route and Next Steps`,
    full_name: `${config.name} 2027: Eligibility, Route and Next Steps`,
    conducting_authority: config.authority,
    status, exam_date: "Not announced", application_start_date: "Not announced", application_end_date: "Not announced", result_date: "Not announced",
    category: config.category, description: `${config.name} 2027: a source-checked explanation of the admission route, previous-cycle context, eligibility decisions and what applicants can prepare now.`,
    eligibility: config.sections[0][1], application_process: `${heading("Application route")}${paragraph(config.application)}`,
    preparation_tips: `${heading("Preparation that fits this test")}${paragraph(config.preparation)}`,
    exam_pattern: `${heading("Exam pattern status")}${paragraph(`The ${config.name} 2027 pattern needs confirmation in the next ${config.authority} notice. ${config.fact}`)}`,
    dates_content: `${heading("2027 dates")}${paragraph(`The ${config.name} 2027 application, exam and result dates were not established by the official material checked on 6 October 2026.`)}`,
    summary_content: `${heading(`${config.name} at a glance`)}${paragraph(config.fact)}${paragraph(status)}`,
    page_summary: `${config.name} 2027 eligibility, previous-cycle evidence, application route and preparation decisions.`,
    meta_title: `${config.name} 2027: Eligibility and Exam Route`.slice(0, 60),
    meta_description: `Understand the ${config.name} route, source-checked 2026 context and what to prepare for 2027 without relying on guessed dates.`.slice(0, 155),
    meta_keywords: `${config.name}, 2027 eligibility, exam route, admission, official notice`,
    tags: [config.name, config.category, "2027"], website: config.sources[0], official_website: config.sources[0], registration_url: config.sources[0],
    data_source_urls: config.sources, data_verified_at: checkedAt, data_last_checked_at: checkedAt, data_clean_state: "reviewed_batch_042",
    internal_links: [relatedPath], external_links: { authority: config.sources[0], evidence: config.sources[config.fact_source || 0] },
    evidence_examples: [{ claim: config.fact, source_url: config.sources[config.fact_source || 0] }],
    faqs, article_html: articleHtml,
    content_variation: { opening: config.opening, application: config.application, preparation: config.preparation, faq_questions: config.faq },
  };
  if (update.meta_title.length > 60 || update.meta_description.length > 155 || update.faqs.length !== 4 || !/^<p>/.test(articleHtml) || /<h1\b|[\u2012\u2013\u2014]/i.test(articleHtml)) throw new Error(`Invalid article shape: ${config.slug}`);
  return update;
}

const updates = configs.map(build);
const variation = assertBatchVariation(updates, "exam-refresh-batch-042");
const humanEditorial = assertBatchHumanEditorial(updates, "exam-refresh-batch-042");
const payload = {
  batch: "exam-refresh-batch-042", checked_at: checkedAt,
  source_snapshot: "reports/pre-rollback-2026-07-29/exams-current.json",
  scope: "Ten active canonical rows after batch 041; this is a review artifact, not a live database update",
  policy: BATCH_CONTENT_VARIATION_TEXT,
  variation, human_editorial: humanEditorial, updates,
};
fs.writeFileSync(path.join(root, "reports/exam-refresh-batch-042-2026-10-06.json"), `${JSON.stringify(payload, null, 2)}\n`);
const lines = [
  "# Exam refresh batch 042", "", "Checked: 2026-10-06 (Asia/Kolkata)", "",
  "Ten active canonical exam records are prepared for editorial review. This file does not update the production database. Every 2027 date remains unannounced until a new authority notice establishes it.", "",
  "## Records and authority evidence", "",
  ...updates.map((row) => `- ${row.name} (${row.slug}): ${row.evidence_examples[0].claim}\n  - ${row.evidence_examples[0].source_url}`),
  "", "## Human editorial gate", "",
  `- ${variation.unique_openings} distinct openings, ${variation.unique_applications} distinct application explanations and ${variation.unique_preparations} distinct preparation tasks.`,
  `- ${humanEditorial.unique_outlines} section outlines and ${humanEditorial.sourced_examples} explicit source-backed details.`,
  "- No prompt labels, flattened tables, repeated generic cautions, invented 2027 dates or mandatory comparison matrices.",
  "- 2026 facts are explicitly labelled as previous-cycle evidence. Confirm them again before any production database apply.", "",
];
fs.writeFileSync(path.join(root, "reports/exam-refresh-batch-042-2026-10-06.md"), lines.join("\n"));
console.log(`Prepared ${updates.length} source-backed exam records for review.`);
