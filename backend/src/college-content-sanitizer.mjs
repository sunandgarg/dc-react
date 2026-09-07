export const COLLEGE_PUBLIC_CONTENT_FIELDS = [
  "description",
  "page_summary",
  "eligibility_criteria",
  "admission_process",
  "scholarship_details",
  "hostel_life",
  "cutoff",
  "course_fee_content",
  "placement_content",
  "rankings_content",
  "facilities_content",
];

export const COLLEGE_EDITORIAL_ARTIFACTS = [
  { label: "Answer First Overview", pattern: /answer\s+first\s+overview/i },
  { label: "Editorial Refresh Note", pattern: /editorial\s+refresh\s+note/i },
  { label: "AI-Friendly Entity Summary", pattern: /ai[-\s]+friendly\s+entity\s+summary/i },
  { label: "AIO/AEO process copy", pattern: /structured\s+for\s+AIO\s*,\s*AEO\s*,\s*SEO\s*,\s*GEO\s+and\s+LLMO/i },
  { label: "AI crawler process copy", pattern: /AI\s+crawlers?/i },
  { label: "batch process copy", pattern: /\b(?:this|the)\s+(?:college\s+)?batch\b/i },
  { label: "source-aware process copy", pattern: /\bsource-aware\b/i },
  { label: "official-source verification note", pattern: /\bofficial-source\s+verified\b/i },
  { label: "manual pass note", pattern: /\bnext\s+manual\s+pass\b/i },
  { label: "answer-first process copy", pattern: /\bhuman-readable\s*,\s*answer-first\s+modules?\b/i },
  { label: "public-page process copy", pattern: /\bpublic\s+page\s+should\b/i },
  { label: "internal editorial instruction", pattern: /\bDekhoCampus\s+should\b/i },
  { label: "unmapped-profile process copy", pattern: /no\s+official\s+course\s+and\s+fee\s+source\s+has\s+been\s+mapped\s+for\s+this\s+DekhoCampus\s+profile/i },
];

function text(value) {
  return String(value ?? "").trim();
}

export function escapeCollegeHtml(value) {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function artifactLabels(value) {
  const source = text(value);
  if (!source) return [];
  return COLLEGE_EDITORIAL_ARTIFACTS
    .filter(({ pattern }) => pattern.test(source))
    .map(({ label }) => label);
}

export function findCollegeEditorialArtifacts(row) {
  const matches = {};
  for (const field of COLLEGE_PUBLIC_CONTENT_FIELDS) {
    const labels = artifactLabels(row?.[field]);
    if (labels.length) matches[field] = labels;
  }
  return matches;
}

export function hasCollegeEditorialArtifacts(row) {
  return Object.keys(findCollegeEditorialArtifacts(row)).length > 0;
}

function inferCollegeName(row) {
  if (text(row?.name)) return text(row.name);
  const description = text(row?.description);
  const match = description.match(/<p\b[^>]*>\s*(?:<strong>)?([^<]{2,180}?)(?:<\/strong>)?\s+is\s+(?:an?\s+|located\s+)/i);
  return text(match?.[1]) || "This institution";
}

function collegeLocation(row) {
  const parts = [text(row?.city), text(row?.state)].filter(Boolean);
  if (parts.length) return [...new Set(parts)].join(", ");
  return text(row?.location);
}

function usefulCategory(row) {
  const category = text(row?.category);
  return category && !/^(general|college|university)$/i.test(category) ? category : "";
}

function cleanType(row) {
  const type = text(row?.type);
  if (!type) return "";
  if (/\b(university|college|institute|school|academy|institution)\b/i.test(type)) return type;
  return `${type} institution`;
}

function cleanIntroduction(row) {
  const name = escapeCollegeHtml(inferCollegeName(row));
  const location = escapeCollegeHtml(collegeLocation(row));
  const type = escapeCollegeHtml(cleanType(row));
  const facts = [];
  if (location) facts.push(`is located in ${location}`);
  if (type) facts.push(`is ${/^[aeiou]/i.test(type) ? "an" : "a"} ${type.toLowerCase()}`);
  const opening = facts.length
    ? `<strong>${name}</strong> ${facts.join(" and ")}.`
    : `<strong>${name}</strong> is a higher-education institution.`;
  return [
    `<p>${opening} This page brings together admissions, courses, fees, placements, facilities, scholarships and student-life information for applicants comparing their options.</p>`,
    "<p>Before applying, confirm the current programme name, eligibility, admission route, fees, approvals and important dates in the institution's latest official notice.</p>",
  ].join("\n");
}

function cleanHighlights(row) {
  const items = [`<li><strong>Institution:</strong> ${escapeCollegeHtml(inferCollegeName(row))}</li>`];
  const location = collegeLocation(row);
  const type = cleanType(row);
  const category = usefulCategory(row);
  if (location) items.push(`<li><strong>Location:</strong> ${escapeCollegeHtml(location)}</li>`);
  if (type) items.push(`<li><strong>Type:</strong> ${escapeCollegeHtml(type)}</li>`);
  if (category) items.push(`<li><strong>Academic area:</strong> ${escapeCollegeHtml(category)}</li>`);
  return `<h3>Quick Highlights</h3>\n<ul>${items.join("")}</ul>`;
}

function sectionPattern(title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<h([1-6])\\b[^>]*>\\s*${escaped}\\s*<\\/h\\1>[\\s\\S]*?(?=<h[1-6]\\b[^>]*>|$)`, "gi");
}

function replaceSection(html, title, replacement) {
  return html.replace(sectionPattern(title), replacement);
}

function replaceHeading(html, from, to) {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(new RegExp(`(<h[1-6]\\b[^>]*>)\\s*${escaped}\\s*(<\\/h[1-6]>)`, "gi"), `$1${to}$2`);
}

function replaceParagraphContaining(html, pattern, replacement) {
  return html.replace(/<p\b[^>]*>[\s\S]*?<\/p>/gi, (paragraph) => pattern.test(paragraph) ? replacement : paragraph);
}

function stripRemainingArtifactBlocks(html) {
  let cleaned = html.replace(/<(p|li)\b[^>]*>[\s\S]*?<\/\1>/gi, (block) => (
    artifactLabels(block).length ? "" : block
  ));
  cleaned = cleaned.replace(/<h([1-6])\b[^>]*>[\s\S]*?<\/h\1>/gi, (heading) => (
    artifactLabels(heading).length ? "" : heading
  ));
  return cleaned;
}

export function sanitizeCollegeDescription(value, row = {}) {
  let html = text(value);
  if (!html || !artifactLabels(html).length) return html;

  html = replaceSection(html, "Answer First Overview", cleanIntroduction(row));
  html = replaceSection(html, "Quick Highlights For Students", cleanHighlights(row));
  html = replaceSection(html, "AI-Friendly Entity Summary", "");
  html = replaceSection(html, "Editorial Refresh Note", "");
  html = replaceHeading(html, "Reviews, Questions And Human Decision Support", "Student Reviews And Decision Support");
  html = replaceHeading(html, "Courses And Fees Verification", "Courses And Fees");

  html = replaceParagraphContaining(
    html,
    /this\s+college\s+batch/i,
    "<p>Review programme information against a current institution, prospectus, regulator or affiliation source before relying on it.</p>",
  );
  html = replaceParagraphContaining(
    html,
    /public\s+page\s+should/i,
    "<p>If a current source lists broad programmes but not specialisations, do not assume unlisted specialisations are available. When current fee details are unavailable, confirm them with the admission office before applying.</p>",
  );
  html = replaceParagraphContaining(
    html,
    /DekhoCampus\s+should/i,
    "<p>Where current eligibility details are unavailable, refer to the institution's latest admission notice or contact its admission office before paying a fee.</p>",
  );
  html = stripRemainingArtifactBlocks(html);
  return html.replace(/\n{3,}/g, "\n\n").trim();
}

function cleanPageSummary(row) {
  const name = inferCollegeName(row);
  const location = [text(row?.city), text(row?.state)]
    .filter((part) => part && !name.toLowerCase().includes(part.toLowerCase()))
    .join(", ") || (!text(row?.city) && !text(row?.state) ? text(row?.location) : "");
  const place = location ? ` in ${location}` : "";
  return `${name}${place}: explore admissions, courses, fees, placements, facilities, hostel, scholarships, rankings and application guidance.`;
}

function cleanEligibility(value) {
  let html = text(value);
  html = replaceParagraphContaining(
    html,
    /(?:unsupported[\s\S]*added\s+in\s+this\s+batch|this\s+batch)/i,
    "<p>If current eligibility details are unavailable, confirm them with the institution before paying any registration or admission fee.</p>",
  );
  return stripRemainingArtifactBlocks(html).trim();
}

function cleanCourseFees(row) {
  const name = escapeCollegeHtml(inferCollegeName(row));
  return [
    "<h3>Courses And Fees</h3>",
    `<p>Programme availability and fees at ${name} can change by academic session, category and campus. Review the latest programme list, prospectus or fee notice for current details.</p>`,
    "<p>Confirm eligibility, intake, tuition, one-time charges, hostel fees and refund rules with the admission office before applying.</p>",
  ].join("\n");
}

function cleanGenericField(value) {
  const source = text(value);
  if (!artifactLabels(source).length) return source;
  const cleaned = stripRemainingArtifactBlocks(source).trim();
  return artifactLabels(cleaned).length ? "" : cleaned;
}

export function sanitizeCollegePublicContent(input) {
  const source = input && typeof input === "object" ? input : {};
  const row = { ...source };
  const detected = findCollegeEditorialArtifacts(source);
  const changedFields = [];

  for (const field of Object.keys(detected)) {
    const previous = text(source[field]);
    let next;
    if (field === "description") next = sanitizeCollegeDescription(previous, source);
    else if (field === "page_summary") next = cleanPageSummary(source);
    else if (field === "eligibility_criteria") next = cleanEligibility(previous);
    else if (field === "course_fee_content") next = cleanCourseFees(source);
    else next = cleanGenericField(previous);
    if (next !== previous) {
      row[field] = next;
      changedFields.push(field);
    }
  }

  return { row, changedFields, detected };
}
