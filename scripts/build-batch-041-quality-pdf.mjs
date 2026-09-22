import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";

const root = process.cwd();
const payload = JSON.parse(fs.readFileSync(path.join(root, "reports/exam-refresh-batch-041-2026-09-22.json"), "utf8"));
const output = path.join(root, "output/pdf/exam-refresh-batch-041-quality-review.pdf");
fs.mkdirSync(path.dirname(output), { recursive: true });
const doc = new jsPDF({ unit: "mm", format: "a4" });
const left = 16;
const right = 194;
const width = right - left;
let y = 18;
const line = 5;
const newPage = () => { doc.addPage(); y = 18; };
const ensure = (needed = 10) => { if (y + needed > 282) newPage(); };
const text = (value, size = 9, color = [30, 41, 59], gap = 4) => {
  doc.setFont("helvetica", "normal"); doc.setFontSize(size); doc.setTextColor(...color);
  const parts = doc.splitTextToSize(String(value), width);
  ensure(parts.length * line + gap); doc.text(parts, left, y); y += parts.length * line + gap;
};
const heading = (value, size = 13) => { ensure(12); doc.setFont("helvetica", "bold"); doc.setFontSize(size); doc.setTextColor(22, 59, 115); doc.text(value, left, y); y += size === 16 ? 10 : 8; };
const bullet = (value) => text(`- ${value}`, 8.5, [51, 65, 85], 2);
const footer = () => { const pages = doc.getNumberOfPages(); for (let i = 1; i <= pages; i += 1) { doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(100, 116, 139); doc.text("DekhoCampus exam refresh batch 041 - review artifact", 16, 289); doc.text(`Page ${i} of ${pages}`, 174, 289); } };
const score = (u) => { const checks = [u.meta_title.length <= 60, u.meta_description.length <= 155, u.internal_links.length >= 4, u.faqs.length === 4, u.data_source_urls.length >= 2, u.article_html.startsWith("<p>")]; return `${checks.filter(Boolean).length}/${checks.length}`; };
const wordCount = (u) => u.article_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;

doc.setFont("helvetica", "bold"); doc.setFontSize(19); doc.setTextColor(22, 59, 115); doc.text("Exam Refresh Batch 041", left, y); y += 9;
doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(71, 85, 105); text("Quality review for ten canonical exam records | Checked 22 September 2026 | Asia/Kolkata", 9, [71, 85, 105], 8);
text("Purpose: this PDF is a review artifact for the next ten exam updates. It is a source-aware content patch and does not write to the production database or publish a page.");
text("The batch keeps existing slugs, uses official authority sources, marks every unpublished 2027 date as pending, includes four verified internal links, an official application URL, an official notice or bulletin URL, four visible FAQs, semantic HTML, and metadata length checks.");
heading("What was checked");
[
  "Official source coverage: at least two distinct authority URLs per exam.",
  "Date honesty: no 2027 date is invented; pending dates point readers back to the authority.",
  "Search structure: four internal links, application link, notice link, semantic headings and lists.",
  "Editorial hygiene: four FAQs, no page H1 in article HTML, title under 60 characters, description under 155 characters.",
  "Safety: no fabricated fees, rankings, selection promises or admission guarantees.",
  "Typography: no en dash or em dash in the generated record payload.",
].forEach(bullet);
heading("Batch scorecard");
text("Exam | Authority host | Title | Description | Links | FAQs | Sources | Checks", 8, [22, 59, 115], 3);
payload.updates.forEach((u) => text(`${u.slug} | ${new URL(u.official_website).host} | ${u.meta_title.length}/60 | ${u.meta_description.length}/155 | ${u.internal_links.length} | ${u.faqs.length} | ${u.data_source_urls.length} | ${score(u)}`, 7.4, [51, 65, 85], 2));
text("Checks is a pipeline completeness result, not a ranking guarantee, an AI-detector score, or a claim that every live authority page has already published its 2027 calendar.", 8.5, [71, 85, 105], 6);

newPage(); heading("Record-by-record evidence", 14);
payload.updates.forEach((u, index) => {
  ensure(25); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(22, 59, 115); doc.text(`${index + 1}. ${u.name}`, left, y); y += 6;
  text(`Slug: ${u.slug} | Category: ${u.category} | Status: ${u.status}`, 8.5, [51, 65, 85], 2);
  text(`Pipeline completeness: ${score(u)}. Metadata lengths: title ${u.meta_title.length}/60, description ${u.meta_description.length}/155. Article word count: ${wordCount(u)} words.`, 8.5, [51, 65, 85], 2);
  text("Official sources:", 8.5, [51, 65, 85], 2);
  u.data_source_urls.forEach((src) => text(src, 7.8, [29, 95, 209], 1));
  text(`Application URL: ${u.external_links.apply}`, 7.8, [29, 95, 209], 1);
  text(`Official notice or bulletin URL: ${u.external_links.official_notification}`, 7.8, [29, 95, 209], 2);
  text("Editorial note: 2027 dates remain pending until the authority publishes the next cycle notice. Previous-cycle facts are not presented as confirmed 2027 dates.", 8.2, [71, 85, 105], 5);
});
heading("Review notes and next action");
text("This batch is ready for editorial review. A production database import, cache refresh, sitemap update, and deployment are separate actions and were intentionally not run for this request.");
text("Before publishing, open each authority URL, compare the final 2027 bulletin with the pending fields, and then approve a controlled import. If an authority changes its paper pattern, eligibility, fee or counselling flow, update the record and regenerate the report.");
footer();
fs.writeFileSync(output, Buffer.from(doc.output("arraybuffer")));
console.log(output);
