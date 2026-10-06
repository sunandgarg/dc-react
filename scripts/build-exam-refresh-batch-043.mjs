import fs from "node:fs";
import path from "node:path";
import { assertBatchHumanEditorial, assertBatchStructuralVariation, assertBatchVariation, BATCH_CONTENT_VARIATION_TEXT } from "./content-batch-policy.mjs";

const root = process.cwd();
const checkedAt = "2026-10-06T12:30:00+05:30";
const snapshot = JSON.parse(fs.readFileSync(path.join(root, "reports/pre-rollback-2026-07-29/exams-current.json"), "utf8"));
const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const p = (value) => `<p>${esc(value)}</p>`;
const h2 = (value) => `<h2>${esc(value)}</h2>`;

// These are previous-session facts from the linked examining bodies. The
// articles deliberately do not turn a 2026 paper or timetable into a 2027 rule.
const configs = [
  {
    slug: "ca-foundation", name: "CA Foundation", authority: "The Institute of Chartered Accountants of India", category: "Commerce",
    source: "https://www.icai.org/post/24181",
    fact: "The Institute of Chartered Accountants of India published May 2026 Foundation MCQ keys for Paper 3, Quantitative Aptitude, and Paper 4, Business Economics.",
    opening: "CA Foundation revision can go wrong when every paper gets the same study method. A timed calculation set tells you something different from a written explanation of a business-law rule.",
    section1: ["Where the MCQ practice belongs", "Paper 3 brings business mathematics, logical reasoning and statistics together. Keep separate error counts for formulas, reading and time pressure; one total mock score hides the reason a mark was lost."],
    section2: ["Don't ignore the other papers", "The released MCQ keys cover only part of the Foundation workload. Read the current scheme before building a plan from old question papers, and give writing practice its own slot."],
    application: "Use ICAI's student examination page for the live session's form and eligibility instructions. Keep registration details beside the form rather than guessing them from a coaching calendar.",
    preparation: "Work ten quantitative questions under a timer, then write the mistaken step next to each wrong answer. On another day, explain one economics concept without looking at the options.",
    list: ["Separate calculation errors from concept gaps.", "Practise written answers where the paper asks for them.", "Compare the current study material with the session's announced syllabus."],
    close: "The choice is simple: practise the skill each paper actually tests, not one generic mock routine for all four.",
    faqs: [
      ["Which CA Foundation papers had ICAI MCQ keys in May 2026?", "ICAI published keys for Quantitative Aptitude and Business Economics in that session."],
      ["Does an MCQ key describe every Foundation paper?", "No. It describes the published MCQ papers, not the whole writing workload."],
      ["What should a Quantitative Aptitude error log separate?", "Keep concept, arithmetic and time-loss errors in different columns."],
      ["Where should a Foundation candidate get the live form rules?", "Use ICAI's examination notice for the session being entered."],
    ],
    layout: ["fact", "section1", "steps", "section2", "application", "preparation", "close"], listKind: "ul", related: "/courses",
  },
  {
    slug: "ca-intermediate", name: "CA Intermediate", authority: "The Institute of Chartered Accountants of India", category: "Commerce",
    source: "https://www.icai.org/post/intermediate-nset",
    fact: "The Institute of Chartered Accountants of India lists Intermediate Paper 3 as Taxation, with Income-tax Law in Section A and Goods and Services Tax in Section B under its new scheme.",
    opening: "CA Intermediate Taxation has two distinct legal systems inside one paper. Treating GST as a quick appendix to income tax is a poor revision bet.",
    section1: ["Keep the two tax lanes separate", "Make one revision sheet for income-tax computation and another for GST supply and credit decisions. The same word, such as exemption, may need a different legal test in each lane."],
    section2: ["Why a current supplement matters", "A remembered rule can become an outdated answer when the applicable law changes. Use the session-specific Board of Studies material to check which amendments are examinable before memorising rates or thresholds."],
    application: "Before selecting an Intermediate group in the ICAI form, match it to the papers you are ready to sit and the institute's current eligibility record. Save the submitted group selection.",
    preparation: "Solve a tax computation without notes, then write one sentence explaining every adjustment. For GST, use a short transaction and decide the treatment before reading the model answer.",
    list: ["Label each practice problem Income-tax or GST.", "Write the governing rule before calculating.", "Retest the questions that changed because of an amendment."],
    close: "A neat tax notebook is useful only if it distinguishes the law, the computation and the current session's applicable text.",
    faqs: [
      ["What sits inside CA Intermediate Paper 3?", "ICAI's new-scheme page separates Income-tax Law and Goods and Services Tax."],
      ["Can a prior tax rate be assumed for the next Intermediate session?", "No. Use the applicable ICAI study guideline and amendment supplement."],
      ["How should a GST practice question be reviewed?", "Write the supply or credit rule first, then revisit the calculation."],
      ["Why save the Intermediate group selection?", "It lets you compare the submitted form with the papers on the current admit card."],
    ],
    layout: ["section1", "fact", "application", "section2", "steps", "preparation", "close"], listKind: "ol", related: "/courses",
  },
  {
    slug: "ca-final", name: "CA Final", authority: "The Institute of Chartered Accountants of India", category: "Commerce",
    source: "https://www.icai.org/post/24181",
    fact: "The Institute of Chartered Accountants of India lists Final Paper 6 as Integrated Business Solutions, a multidisciplinary case study with Strategic Management, in its May 2026 paper set.",
    opening: "A CA Final case study rarely announces which chapter it belongs to. The harder move is choosing which financial, tax or governance issue changes the business decision.",
    section1: ["Read the case before reaching for a formula", "Mark the business objective, the constraint and the missing information. Then decide which rule is relevant; reciting every standard you remember will not answer the question asked."],
    section2: ["Build an answer the examiner can follow", "State a recommendation, cite the decisive fact and show the alternative you rejected. This is practice in judgement, not a shortcut around technical accuracy."],
    application: "For the live Final session, use the ICAI examination notice to confirm eligibility and paper selection. Keep the registration and required training evidence ready before the form opens.",
    preparation: "Take one multidisciplinary case and limit yourself to three minutes to map the decision. After writing the answer, underline each unsupported assumption and replace it with a fact from the case.",
    list: ["Identify the commercial decision.", "Name the technical rule that changes it.", "Explain why a plausible alternative fails."],
    close: "Case practice should make the reasoning visible; a correct-looking number without a defensible decision is incomplete.",
    faqs: [
      ["What is CA Final Paper 6 called in ICAI's May 2026 set?", "It is Integrated Business Solutions, described as a multidisciplinary case study with Strategic Management."],
      ["Should a case answer list every possible standard?", "No. Select the rule that bears on the decision and explain its effect."],
      ["What is worth underlining in a practice case?", "Mark unsupported assumptions so the next answer relies on the stated facts."],
      ["Where are the next Final session's form conditions published?", "ICAI's current examination notice controls those conditions."],
    ],
    layout: ["section1", "section2", "fact", "preparation", "application", "close"], listKind: "ul", related: "/courses",
  },
  {
    slug: "cma-foundation", name: "CMA Foundation", authority: "The Institute of Cost Accountants of India", category: "Commerce",
    source: "https://icmai.in/upload/Examination/FOUNDATION_June_2026.pdf",
    fact: "The Institute of Cost Accountants of India said its June 2026 Foundation examination would use centre-based OMR multiple-choice papers, with no negative marking.",
    opening: "CMA Foundation's OMR format changes how a student should practise, but a past term's marking rule is not a licence to ignore the next notice. First learn the paper, then refine the attempt strategy.",
    section1: ["Use the old format as a practice clue", "The June 2026 notice described 50 questions per paper. That makes short, timed blocks useful: fill the OMR-style response while practising, not five minutes after the set ends."],
    section2: ["Keep the attempt rule session-specific", "No negative marking was stated for June 2026. If the next term keeps it, unanswered items carry an avoidable cost; confirm the current instructions before adopting that tactic."],
    application: "Use ICMAI's live Foundation examination form and read the eligibility line before payment. Photograph, signature and registration data should match the student record exactly.",
    preparation: "Do two 25-question OMR blocks and count bubbling mistakes separately from content errors. Review the chapter only after you know which kind of miss occurred.",
    list: ["Mark answers as you go.", "Keep an OMR error tally.", "Read the live instruction sheet before deciding whether to guess."],
    close: "The practical gain is not more guesses; it is fewer answer-sheet errors under the actual rules of the session.",
    faqs: [
      ["Was CMA Foundation June 2026 centre-based?", "Yes. ICMAI described an offline, centre-based OMR examination."],
      ["Did the June 2026 Foundation notice state negative marking?", "It stated that there was no negative marking for that term."],
      ["What is an OMR error log for?", "It separates a wrong answer from a correct answer marked in the wrong bubble."],
      ["Can the June 2026 marking rule be copied to a later CMA term?", "No. Read the later term's own ICMAI instructions."],
    ],
    layout: ["fact", "steps", "section1", "preparation", "section2", "application", "close"], listKind: "ol", related: "/exams",
  },
  {
    slug: "cma-intermediate", name: "CMA Intermediate", authority: "The Institute of Cost Accountants of India", category: "Commerce",
    source: "https://icmai.in/upload/Examination/Inter_Final_June_2026.pdf",
    fact: "The Institute of Cost Accountants of India's June 2026 Intermediate timetable listed Paper 11 as Financial Management and Business Data Analytics under Syllabus 2022.",
    opening: "CMA Intermediate Paper 11 asks for more than finance formulas. A candidate also has to make sense of business data, and that needs its own practice time.",
    section1: ["Put the numbers into a decision", "A ratio is only the start. In a practice case, write what it says about liquidity or cost and which extra figure could reverse the conclusion."],
    section2: ["Choose the group deliberately", "The published June 2026 timetable separated Intermediate and Final, with different sessions. Do not use a Final timetable or an old group list to plan an Intermediate form."],
    application: "On ICMAI's current examination form, select the Intermediate group and centre that match your enrolment record. Save the final form and payment receipt together.",
    preparation: "Alternate a financial-management calculation with a small dataset interpretation. Record whether a wrong result came from the formula, the units or the conclusion drawn from it.",
    list: ["Calculate first.", "Interpret the number in one sentence.", "Ask what additional evidence would change the decision."],
    close: "That habit makes analytics a business explanation rather than a second pile of disconnected formulas.",
    faqs: [
      ["What is Paper 11 in ICMAI's June 2026 Intermediate timetable?", "It is Financial Management and Business Data Analytics under Syllabus 2022."],
      ["Should a CMA Intermediate data answer stop at the calculation?", "No. Explain the business meaning and the limitation of the number."],
      ["Why keep the Intermediate group receipt?", "It records the group and centre selected in the submitted form."],
      ["Is the CMA Final timetable interchangeable with Intermediate?", "No. ICMAI publishes the stages separately."],
    ],
    layout: ["section1", "steps", "fact", "section2", "application", "preparation", "close"], listKind: "ul", related: "/courses",
  },
  {
    slug: "cma-final", name: "CMA Final", authority: "The Institute of Cost Accountants of India", category: "Commerce",
    source: "https://icmai.in/upload/Examination/Inter_Final_June_2026.pdf",
    fact: "The Institute of Cost Accountants of India's June 2026 Final timetable offered Paper 20 electives including Strategic Performance Management and Business Valuation, Risk Management in Banking and Insurance, and Entrepreneurship and Start up.",
    opening: "A CMA Final elective is not just another date on the timetable. It changes the examples, laws and calculations a student will spend weeks practising.",
    section1: ["Pick the elective you can sustain", "Compare the current elective choices with your strongest work, not just their titles. A valuation problem and a banking-risk case demand different evidence and answer styles."],
    section2: ["Keep the timetable in context", "The three options above were published for June 2026 under Syllabus 2022. Check the live term's elective list before locking a group or buying material for a paper you may not sit."],
    application: "When using the ICMAI Final form, re-read the elective selection and group details on the preview screen. Keep a copy of that screen and the payment confirmation.",
    preparation: "For valuation, explain a changed assumption; for banking risk, identify the exposure before the control; for entrepreneurship, connect a funding choice to cash flow. Choose the lane matching your elected paper.",
    list: ["Name the elective on the form.", "Match study material to that elective.", "Practice one decision-based case, not three unrelated summaries."],
    close: "The wrong elective in a study plan costs time even if the rest of the Final timetable is copied correctly.",
    faqs: [
      ["Which Paper 20 electives appeared in the CMA Final June 2026 timetable?", "ICMAI listed valuation, banking and insurance risk, and entrepreneurship choices."],
      ["Can a candidate prepare all Paper 20 electives equally?", "The form selects an elective; focused preparation should follow that selected paper."],
      ["What should be checked on the CMA Final form preview?", "Check the group, centre and elective before submitting."],
      ["Does an old CMA elective list settle the current term?", "No. The current ICMAI timetable and form control the term."],
    ],
    layout: ["section1", "fact", "section2", "application", "preparation", "close"], listKind: "ol", related: "/courses",
  },
  {
    slug: "cseet-icsi", name: "CSEET", authority: "The Institute of Company Secretaries of India", category: "Commerce/Law",
    source: "https://www.icsi.edu/media/filer_public/25/b2/25b20bc7-3ff0-458b-89fc-cbc88f5d7731/2026_june_cseet_2.pdf",
    fact: "The Institute of Company Secretaries of India restructured CSEET from the June 2026 session, replacing the old January 2026 format.",
    opening: "The biggest CSEET preparation mistake now is using an old remote-proctored mock as if nothing changed. The entry test was restructured in 2026, so the syllabus version matters more than a familiar title.",
    section1: ["Start with the restructured papers", "ICSI's June 2026 question-paper list separated Business Communication, Fundamentals of Accounting, Economic and Business Environment, and Business Laws and Management. Read each paper's mode before copying an older practice timetable."],
    section2: ["What the old format cannot tell you", "An old pass-story may describe a different test. Use it for confidence, perhaps, but not for current paper order, answer mode or the subjects to prioritise."],
    application: "Register through ICSI's CSEET student route for the chosen session. The institute's current eligibility and cut-off notice, not a social-media screenshot, controls that application.",
    preparation: "Write one short Business Communication response, solve an accounting entry and then practise the objective law-and-management questions on separate days. Each reveals a different weakness.",
    list: ["Confirm the syllabus version.", "Separate written and objective practice.", "Track the session-specific registration notice."],
    close: "One test name can conceal two formats. Work from the format you will actually sit.",
    faqs: [
      ["When did ICSI restructure CSEET?", "ICSI said the restructured format began with the June 2026 session."],
      ["Can a January 2026 remote-proctored mock define later CSEET papers?", "No. That was the last session under the old structure."],
      ["Which skills should a new-format CSEET plan separate?", "Give communication writing, accounting and objective law practice distinct blocks."],
      ["Where should a CSEET applicant verify registration cut-offs?", "Use ICSI's current CSEET notice for the selected session."],
    ],
    layout: ["fact", "section1", "application", "steps", "section2", "preparation", "close"], listKind: "ul", related: "/exams",
  },
  {
    slug: "cs-executive", name: "CS Executive", authority: "The Institute of Company Secretaries of India", category: "Commerce/Law",
    source: "https://www.icsi.edu/examination/previous-sessions-qps/december-2025",
    fact: "The Institute of Company Secretaries of India's Syllabus 2022 Executive question-paper archive lists Company Law and Practice as paper code 522.",
    opening: "CS Executive Company Law answers need the right provision applied to the facts, not a long paragraph that merely sounds legal. The paper archive gives a better practice starting point than stock notes.",
    section1: ["Make an answer do legal work", "For one past question, mark the company action, the governing rule and the consequence. If the question changes one fact, your conclusion may need to change too."],
    section2: ["Don't study a code without its session", "The archive shows the paper under Syllabus 2022, but the current ICSI supplements can alter what must be read for an upcoming term. Keep the paper code and the applicable update together."],
    application: "When enrolling for the Executive examination, select the right syllabus and group in ICSI's portal. Check the preview against your registration before final submission.",
    preparation: "Take a Company Law and Practice question, write a two-line issue statement and a three-step application. Then compare the answer with the institute's guideline answer, not only a coaching summary.",
    list: ["Extract the issue.", "State the rule with its condition.", "Apply that condition to the given facts."],
    close: "This is the difference between a remembered section number and a defensible company-law answer.",
    faqs: [
      ["What is CS Executive paper 522?", "ICSI's Syllabus 2022 archive calls it Company Law and Practice."],
      ["What should come before a Company Law conclusion?", "State the issue, governing condition and relevant fact first."],
      ["Can an archived CS Executive paper replace current supplements?", "No. Use the session's applicable ICSI material as well."],
      ["Why check the Executive form preview?", "It confirms the group and syllabus selected before submission."],
    ],
    layout: ["section1", "fact", "steps", "section2", "preparation", "application", "close"], listKind: "ol", related: "/courses",
  },
  {
    slug: "cs-professional", name: "CS Professional", authority: "The Institute of Company Secretaries of India", category: "Commerce/Law",
    source: "https://www.icsi.edu/examination/previous-sessions-qps/december-2025",
    fact: "The Institute of Company Secretaries of India's Syllabus 2022 Professional archive names Environmental, Social and Governance (ESG) Principles and Practice as paper code 531.",
    opening: "ESG in CS Professional is not a slogan contest. An answer needs to connect a governance failure or environmental claim to an actual board, disclosure or compliance decision.",
    section1: ["Turn a broad theme into a case", "A company says its process is sustainable. Ask what evidence the board has, which metric could be checked and what would make the claim misleading. That is closer to a professional answer than repeating a definition."],
    section2: ["Use the right paper and update", "The ICSI archive identifies the ESG paper under Syllabus 2022. Session supplements matter because practice questions may turn on a newer compliance or disclosure rule."],
    application: "Use the ICSI Professional enrolment route and verify the selected group and elective, if applicable, before paying. Retain the form for admit-card comparison.",
    preparation: "Write a 150-word ESG case answer with a board action, a measurable signal and one limitation. Remove any line that could be copied into an unrelated corporate-governance question.",
    list: ["What decision did the board make?", "What evidence supports the claim?", "Which disclosure would let a reader test it?"],
    close: "A specific, testable governance answer is stronger than polished but empty sustainability language.",
    faqs: [
      ["What is ICSI Professional paper 531?", "It is Environmental, Social and Governance Principles and Practice under Syllabus 2022."],
      ["How can an ESG answer avoid vague claims?", "Name a board decision, a measurable signal and a limitation."],
      ["Should Professional candidates use current ICSI supplements?", "Yes. Match them to the session being attempted."],
      ["What form detail needs a final Professional check?", "Confirm the group and any elective selection in the enrolment preview."],
    ],
    layout: ["fact", "section1", "section2", "preparation", "steps", "application", "close"], listKind: "ul", related: "/courses",
  },
  {
    slug: "ctet", name: "CTET", authority: "The Central Board of Secondary Education", category: "Teaching",
    source: "https://ctet.nic.in/",
    fact: "The Central Board of Secondary Education conducts CTET, and its official site directs candidates to the information bulletin for the syllabus.",
    opening: "CTET preparation starts with a teaching level, not with a random pile of pedagogy questions. A candidate should know which paper and classroom age group they are preparing for before choosing a mock.",
    section1: ["Choose the classroom before the question bank", "Put the intended teaching stage beside the paper choice in the current bulletin. That narrows the child-development and subject work you need to review."],
    section2: ["Use a classroom explanation, not a slogan", "If a child misunderstands a fraction, write the first question you would ask and why. Pedagogy practice improves when the response has a learner and a misconception, not just a memorised term."],
    application: "Use the CTET portal's live bulletin and candidate login for the chosen edition. Read the correction-window rules before assuming a submitted paper choice can be changed later.",
    preparation: "Answer one child-development scenario and one subject-pedagogy question per session. Note the tempting distractor and the classroom evidence that rules it out.",
    list: ["Identify the learner's misconception.", "Pick a response that diagnoses it.", "Explain why the next teaching step fits."],
    close: "A good CTET mock review should tell you what you would do in a classroom, not only which option was correct.",
    faqs: [
      ["Who conducts CTET?", "The Central Board of Secondary Education conducts it."],
      ["Where is the CTET syllabus published?", "The official CTET site directs candidates to its information bulletin."],
      ["What should a pedagogy error log capture?", "Record the misconception, the tempting answer and the better classroom response."],
      ["Can a CTET paper choice be assumed editable after submission?", "No. Read the live edition's correction-window conditions first."],
    ],
    layout: ["section1", "steps", "section2", "fact", "application", "preparation", "close"], listKind: "ol", related: "/exams",
  },
];

function build(config) {
  const row = snapshot.find((candidate) => candidate.slug === config.slug);
  if (!row || row.is_active === false) throw new Error(`Missing active canonical exam row: ${config.slug}`);
  const portal = config.slug.startsWith("ca-") ? "https://www.icai.org/students.shtml"
    : config.slug.startsWith("cma-") ? "https://icmai.in/ClntStudents/UpdateandAnnouncements"
      : config.slug === "ctet" ? "https://ctet.nic.in/documents/" : "https://www.icsi.edu/";
  const linkedFact = esc(config.fact).replace(esc(config.authority), `<a href="${esc(config.source)}" rel="noopener noreferrer">${esc(config.authority)}</a>`);
  const blocks = {
    fact: `<p>${linkedFact}</p>`,
    section1: `${h2(config.section1[0])}${p(config.section1[1])}`,
    section2: `${h2(config.section2[0])}${p(config.section2[1])}`,
    steps: `<${config.listKind}>${config.list.map((item) => `<li>${esc(item)}</li>`).join("")}</${config.listKind}>`,
    application: p(config.application), preparation: p(config.preparation), close: p(config.close),
  };
  const articleHtml = p(config.opening) + config.layout.map((key) => blocks[key]).join("");
  const faqs = config.faqs.map(([question, answer]) => ({ question, answer }));
  return {
    id: row.id, old_slug: row.slug, slug: row.slug, name: row.name,
    conducting_authority: config.authority,
    description: `${config.name} explained through a verified previous-session detail, the live application route and preparation that matches the actual paper. Check the current authority notice for dates.`,
    application_process: `${h2("Application route")}${p(config.application)}`,
    preparation_tips: `${h2("Paper-specific practice")}${p(config.preparation)}`,
    exam_pattern: `${h2("Published session evidence")}${p(config.fact)}`,
    summary_content: `${h2(`${config.name} decision point`)}${p(config.opening)}${p(config.fact)}`,
    page_summary: `${config.name} paper choice, application route and subject-specific preparation.`,
    meta_title: `${config.name}: Papers and Application Route`.slice(0, 60),
    meta_description: `Understand the ${config.name} papers, form route and useful practice with a verified authority detail, without copying an old session date.`.slice(0, 155),
    meta_keywords: `${config.name}, exam papers, application, preparation, official notice`,
    tags: [config.name, config.category],
    data_source_urls: [config.source, portal], data_verified_at: checkedAt, data_last_checked_at: checkedAt, data_clean_state: "reviewed_batch_043",
    internal_links: [config.related], external_links: { authority: portal, evidence: config.source },
    evidence_examples: [{ claim: config.fact, source_url: config.source }], faqs, article_html: articleHtml,
    content_variation: { opening: config.opening, application: config.application, preparation: config.preparation, faq_questions: faqs.map((faq) => faq.question) },
  };
}

const updates = configs.map(build);
const variation = assertBatchVariation(updates, "exam-refresh-batch-043");
const humanEditorial = assertBatchHumanEditorial(updates, "exam-refresh-batch-043");
const structuralVariation = assertBatchStructuralVariation(updates, "exam-refresh-batch-043");
const payload = {
  batch: "exam-refresh-batch-043", checked_at: checkedAt,
  source_snapshot: "reports/pre-rollback-2026-07-29/exams-current.json",
  scope: "Ten active canonical professional and teaching exam rows; editorial review only, no production database update",
  policy: BATCH_CONTENT_VARIATION_TEXT,
  variation, human_editorial: humanEditorial, structural_variation: structuralVariation, updates,
};
fs.writeFileSync(path.join(root, "reports/exam-refresh-batch-043-2026-10-06.json"), `${JSON.stringify(payload, null, 2)}\n`);
const lines = [
  "# Exam refresh batch 043", "", "Checked: 2026-10-06 (Asia/Kolkata)", "",
  "Ten active canonical records are ready for editorial review only. This script does not update the production database. Previous-session facts are identified as such; the live authority notice controls every current timetable and eligibility condition.", "",
  "## Record-specific authority evidence", "",
  ...updates.map((row) => `- ${row.name} (${row.slug}): ${row.evidence_examples[0].claim}\n  - ${row.evidence_examples[0].source_url}`),
  "", "## Human editorial gate", "",
  `- ${variation.unique_openings} distinct openings, ${variation.unique_applications} distinct application explanations, ${variation.unique_preparations} distinct practice tasks and ${variation.unique_faq_questions} distinct FAQ questions.`,
  `- ${humanEditorial.unique_outlines} heading outlines, ${structuralVariation.unique_structures} actual HTML structures and ${humanEditorial.sourced_examples} explicit authority-backed details.`,
  "- No prompt labels, flattened Markdown tables, obligatory summary-to-checklist sequence or copied 2026 dates as future deadlines.",
  "- Before publication, an editor must confirm that each linked authority page still serves the cited document and that the current session rules have not superseded the previous-session fact.", "",
];
fs.writeFileSync(path.join(root, "reports/exam-refresh-batch-043-2026-10-06.md"), lines.join("\n"));
console.log(`Prepared ${updates.length} source-backed exam records for review.`);
