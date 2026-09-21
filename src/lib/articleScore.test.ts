import { describe, expect, it } from "vitest";
import { scoreArticleForEditor } from "@/lib/articleScore";

const faqItems = [
  { question: "When should a student choose subjects?", answer: "Choose subjects after checking the target course rules and the current official notice." },
  { question: "Can a science student apply for humanities courses?", answer: "A science student can apply when the university lists the chosen subjects as acceptable." },
  { question: "Where should applicants verify the final rule?", answer: "Applicants should verify the final rule in the current university and exam notice." },
  { question: "What should a student keep after submitting the form?", answer: "Keep the confirmation page, payment receipt, and a copy of the submitted subjects." },
];

const articleHtml = `
<p>CUET UG 2027 subject selection starts with the course rules, not a guess based on a friend's combination. Check the required subjects, test paper choices, and university mapping before you pay, because one missing paper can close a preferred course even when your marks are strong.</p>
<h2>What should you check before choosing CUET UG 2027 subjects?</h2>
<p>CUET UG 2027 subject selection becomes safer when you write down each target course and match it with the exact subjects listed in its current notice. Read the eligibility line, check whether a language paper is required, and keep a screenshot of every rule you rely on while filling the form.</p>
<ul><li>Write the target university and course beside every subject.</li><li>Confirm the language and domain paper combination.</li><li>Save the official notice and the final application preview.</li></ul>
<h2>How can a student build a course and subject map?</h2>
<p>Start with three realistic course choices, then add the subjects each course accepts and mark any mismatch in plain language. This small map makes the trade-off visible: a paper that helps one programme may not count for another, so a student can change the plan before the correction window closes.</p>
<table><thead><tr><th>Student profile</th><th>Check</th><th>Safer move</th></tr></thead><tbody><tr><td>Science</td><td>Domain paper list</td><td>Match each BSc rule</td></tr><tr><td>Commerce</td><td>Mathematics requirement</td><td>Keep a second course</td></tr></tbody></table>
<h2>Which mistakes create avoidable admission trouble?</h2>
<p>The expensive mistakes are usually small: selecting a similar subject instead of the listed paper, relying on an old eligibility PDF, or assuming every university reads the score in the same way. Ask the admissions office when wording is unclear, and keep the written reply with your application records.</p>
<p>CUET UG 2027 subject selection is a planning task, not a popularity contest. A cousin's combination may work for Delhi University and fail for another university. Check the course page again after the bulletin is released, because the final mapping is what matters during counselling.</p>
<p>Keep a simple record as you work. Save the notification date, the page where the rule appears, and the question you sent to the help desk. When a correction window opens, compare the new notice with your saved copy instead of trusting a screenshot shared in a group. The <a href="/exams/cuet-ug">CUET exam page</a> can sit beside your notes, while a shortlisted <a href="/colleges">college page</a> and a relevant <a href="/courses">course page</a> help you check the next decision without losing the original source.</p>
<p>Parents can help without taking over the form. Ask the student to explain why each paper is selected, then read the eligibility line together. If the answer is vague, pause. A ten-minute call with the authority is cheaper than discovering a mismatch after counselling. Also check the application preview on a laptop or a second phone, because cramped screens can hide a selected paper, payment status, or an unchecked declaration.</p>
<p>Do not chase every rumour about cut-offs or preferred combinations. Rules change, and coaching groups often mix last year's advice with a new form. Use the date on the bulletin, note the university's wording, and treat an unofficial list as a lead rather than proof. This habit keeps the plan flexible while still giving the student a clear next action.</p>
<h2>Frequently asked questions</h2>
<h3>When should a student choose subjects?</h3>
<p>Choose subjects after checking the target course rules and the current official notice.</p>
<h3>Can a science student apply for humanities courses?</h3>
<p>A science student can apply when the university lists the chosen subjects as acceptable.</p>
<h3>Where should applicants verify the final rule?</h3>
<p>Applicants should verify the final rule in the current university and exam notice.</p>
<h3>What should a student keep after submitting the form?</h3>
<p>Keep the confirmation page, payment receipt, and a copy of the submitted subjects.</p>
<p>Before the form closes, compare the saved notice with the final preview and ask the authority about anything that still looks unclear.</p>
`;

describe("scoreArticleForEditor", () => {
  it("scores a complete semantic article without hiding unresolved checks", () => {
    const report = scoreArticleForEditor({
      title: "CUET UG 2027 Subject Selection: A Practical Course Map",
      slug: "cuet-ug-2027-subject-selection-course-map",
      description: "A practical CUET UG 2027 subject selection guide for Indian students: match papers to courses, avoid eligibility mistakes, and keep a safe application plan.",
      content: articleHtml,
      meta_title: "CUET UG 2027 Subject Selection Guide",
      meta_description: "CUET UG 2027 subject selection explained with course mapping, eligibility checks, paper choices, and practical steps for Indian students.",
      meta_keywords: "CUET UG 2027 subject selection, CUET eligibility",
      primary_keyword: "CUET UG 2027 subject selection",
      author: "DekhoCampus Editorial",
      updated_at: "2026-09-22T10:00:00.000Z",
      faqs: faqItems,
      faqsLoaded: true,
    });

    expect(report.targetKeywordSource).toBe("explicit");
    expect(report.wordCount).toBeGreaterThan(550);
    expect(report.seo.score).toBeGreaterThanOrEqual(90);
    expect(report.aeo.score).toBeGreaterThanOrEqual(90);
    expect(report.geo.score).toBeGreaterThanOrEqual(90);
    expect(report.seo.checks.some((check) => check.status === "fail")).toBe(false);
    expect(report.aeo.checks.some((check) => check.status === "fail")).toBe(false);
    expect(report.geo.checks.some((check) => check.status === "fail")).toBe(false);
  });

  it("flags missing metadata, raw markdown, prompt residue, and shallow content", () => {
    const report = scoreArticleForEditor({
      title: "A short post",
      slug: "Bad Slug",
      content: "Answer first: choose carefully.\n\n# Notes\n\nThis is too short.",
      faqsLoaded: false,
    });

    const failedKeys = [...report.seo.checks, ...report.aeo.checks, ...report.geo.checks]
      .filter((check) => check.status === "fail")
      .map((check) => check.key);
    expect(failedKeys).toEqual(expect.arrayContaining(["seo-meta-title", "seo-meta-description", "seo-slug", "seo-markdown", "aeo-prompt-residue", "geo-citation-ready"]));
    expect(report.overall).toBeLessThan(65);
  });
});
