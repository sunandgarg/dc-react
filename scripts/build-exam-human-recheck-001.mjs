import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checkedAt = "2026-09-21T00:00:00+05:30";
const sourceFile = path.join(root, "reports/exam-refresh-batch-001-2026-09-21.json");
const outputFile = path.join(root, "reports/exam-human-editorial-recheck-001-2026-09-21.json");
const markdownFile = path.join(root, "reports/exam-human-editorial-recheck-001-2026-09-21.md");
const source = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
const existing = source.updates.find((row) => row.slug === "jee-main-2026");
if (!existing) throw new Error("JEE Main row is missing from exam refresh batch 001");

const internalLinks = [
  ["All entrance exams", "/exams"],
  ["Engineering entrance exams", "/exams/top-engineering-entrance-exams-in-india"],
  ["Engineering courses", "/courses"],
  ["Engineering colleges", "/colleges"],
];
const officialApply = "https://jeemain.nta.nic.in/";
const officialNotice = "https://jeemain.nta.nic.in/information-bulletin/";
const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const dates = [
  ["2027 information bulletin", "Not published by NTA"],
  ["Application window", "Not published by NTA"],
  ["Session 1 examination", "Not published by NTA"],
  ["Session 2 examination", "Not published by NTA"],
  ["Result or NTA score", "Not published by NTA"],
];

const dateTable = `<table><thead><tr><th>Event</th><th>2027 status</th></tr></thead><tbody>${dates.map(([event, status]) => `<tr><td>${escapeHtml(event)}</td><td>${escapeHtml(status)}</td></tr>`).join("")}</tbody></table>`;
const relatedLinks = `<ul>${internalLinks.map(([label, href]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`).join("")}</ul>`;

const faqs = [
  {
    question: "When will JEE Main 2027 dates be released?",
    answer: "NTA has not published the JEE Main 2027 bulletin in the official material checked on 21 September 2026. Treat the date as pending and check the NTA examination site before planning travel or paying a fee.",
  },
  {
    question: "Which papers are available in JEE Main?",
    answer: "Paper 1 is the B.E. and B.Tech route. Paper 2A is for B.Arch and Paper 2B is for B.Planning. The 2027 bulletin will confirm the final paper rules and subject details.",
  },
  {
    question: "Can I use the 2026 eligibility rules for JEE Main 2027?",
    answer: "Use them only as preparation context. NTA may change the qualifying-examination year, subject combination or attempt wording, so the 2027 bulletin must decide whether you can apply.",
  },
  {
    question: "Does a JEE Main score guarantee a seat?",
    answer: "No. A score or rank still has to pass the relevant institute, category, document and counselling rules. Seat allocation is handled through the notified counselling or institute process.",
  },
];

const faqHtml = `<h2>FAQs students actually ask</h2>${faqs.map(({ question, answer }) => `<h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p>`).join("")}`;
const articleHtml = [
  `<p>JEE Main 2027 dates are not out yet. NTA's official site currently lists the 2026 bulletin and 2026 notices, so do not copy a coaching calendar into your form, travel plan or study timetable. Keep preparing, but wait for the 2027 bulletin before treating a date or eligibility rule as final.</p>`,
  `<h2>Key facts for JEE Main 2027</h2><p>There is no published 2027 information bulletin in the NTA material checked on 21 September 2026. That means the application window, two session dates and result day stay pending. This is less exciting than a confident-looking date, but it is safer for a student making real decisions.</p>${dateTable}<p>When NTA opens the cycle, use the notice on the official site as the source of truth. Old dates are useful for rough planning only.</p>`,
  `<h2>Check the paper before you check the timetable</h2><p>Paper 1 is the B.E. and B.Tech route. Paper 2A is for B.Arch and Paper 2B is for B.Planning. The subject mix, qualifying-examination year, attempt wording and institute conditions must come from the 2027 bulletin, not from a screenshot forwarded in a group.</p><ul><li>Match your Class 12 subjects with the programme you want.</li><li>Read the qualifying-year and attempt clauses when NTA publishes them.</li><li>Keep category, identity and marks documents consistent before registration opens.</li></ul>`,
  `<h2>What to study while NTA is still silent</h2><p>Use the published syllabus as a working checklist, then leave room for changes in the final bulletin. Physics, Chemistry and Mathematics anchor Paper 1. Architecture applicants also need the Paper 2A aptitude and drawing components, while planning applicants should track the Paper 2B requirements.</p><p>Do not spend every evening chasing rumours. Pick a small set of timed questions, review the mistakes and keep an error log. Short, honest practice beats a dramatic plan that collapses after one week.</p>`,
  `<h2>How to apply without creating a preventable problem</h2><ol><li>Open the NTA JEE Main site and confirm the 2027 cycle is live.</li><li>Read the information bulletin and document instructions before entering details.</li><li>Use an email address and mobile number you can access for the entire cycle.</li><li>Copy academic, category and identity details exactly from your documents.</li><li>Upload files, pay only on the authorised portal and save the confirmation page.</li><li>Use the same candidate login for corrections, admit card, answer key and result updates.</li></ol><p>If a field is unclear, stop and read the notice again. Guessing in a form is a small shortcut with a very long tail.</p>`,
  `<h2>After the score</h2><p>A JEE Main score is not an admission offer. Check the counselling or institute process named in the official notice, compare the category and document rules, and fill choices only after you understand the order of preference. Save the scorecard and every payment or allotment receipt.</p>`,
  faqHtml,
  `<h2>Useful DekhoCampus guides</h2>${relatedLinks}`,
].join("");

const updated = {
  ...existing,
  title: "JEE Main 2027: Dates, Eligibility and Exam Pattern",
  full_name: "Joint Entrance Examination (Main) 2027",
  description: "JEE Main 2027 dates are pending. Check the NTA bulletin, paper choice, eligibility, preparation and application steps without carrying stale 2026 claims forward.",
  hero_hook: "JEE Main 2027 dates are pending, so prepare from the syllabus and wait for the NTA bulletin before applying.",
  meta_title: "JEE Main 2027: Dates, Eligibility & Pattern",
  meta_description: "Check JEE Main 2027 date status, paper choice, eligibility and application steps. Verify every deadline on the NTA bulletin.",
  article_html: articleHtml,
  faqs,
  internal_links: internalLinks.map(([, href]) => href),
  external_links: { apply: officialApply, official_notification: officialNotice },
  data_source_urls: [officialApply, officialNotice],
  data_verified_at: checkedAt,
  data_last_checked_at: checkedAt,
  data_clean_state: "human_editorial_recheck_001",
  verification_note: "NTA's official site lists 2026 material and no JEE Main 2027 bulletin in the source check on 2026-09-21; all 2027 dates remain explicitly pending.",
  editorial_policy: "DekhoCampus human editorial policy v1: direct Indian admissions voice, no raw Markdown, no invented dates, semantic HTML for the site contract, four visible FAQs, four internal links and two official external links.",
};

const payload = {
  batch: "exam-human-editorial-recheck-001",
  checked_at: checkedAt,
  source_batch: "reports/exam-refresh-batch-001-2026-09-21.json",
  scope: "One exam, processed individually as the first recheck after the DekhoCampus human editorial policy update",
  policy: updated.editorial_policy,
  source_urls: [officialApply, officialNotice],
  updates: [updated],
};
fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync(markdownFile, [
  "# JEE Main 2027 human editorial recheck",
  "",
  `Checked: ${checkedAt} (Asia/Kolkata)`,
  "",
  "The first exam is rewritten one-by-one under the DekhoCampus human editorial policy. NTA's official site currently exposes 2026 material; no JEE Main 2027 bulletin was visible in the checked source, so future dates remain pending.",
  "",
  "## Record",
  "",
  `- **Title:** ${updated.title}`,
  `- **Slug:** ${updated.slug}`,
  `- **Official application site:** ${officialApply}`,
  `- **Official bulletin page:** ${officialNotice}`,
  `- **Internal links:** ${updated.internal_links.join(", ")}`,
  `- **FAQs:** ${updated.faqs.length}`,
  "- **Production write:** not performed; this is a reviewable patch artifact.",
  "",
].join("\n"));
console.log(`Wrote ${outputFile}`);
