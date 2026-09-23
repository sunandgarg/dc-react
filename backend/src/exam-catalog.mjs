import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const EXAM_LISTING_CATEGORIES = ["Entrance", "Board", "Sarkari", "Study Abroad"];

export const EXAM_LISTING_STREAMS = [
  "Engineering", "Medical", "Law", "Management", "Design", "Science",
  "Arts", "Hotel Management", "Nursing", "IT and Software", "Architecture",
  "Aviation", "Education", "Agriculture", "Pharmacy", "Commerce", "Defence",
  "Banking", "Railways", "Government", "General",
];

export const EXAM_LISTING_COURSE_GROUPS = [
  "B.E. / B.Tech", "MBA/PGDM", "LL.B.", "M.E./M.Tech", "MBBS", "MD/MS",
  "B.Des", "M.Des", "B.Arch", "B.Pharm", "M.Pharm", "B.Sc.", "M.Sc.",
  "B.Ed", "M.Ed", "BCA", "MCA", "BBA/BMS", "Diploma/Polytechnic", "Ph.D.",
  "D.El.Ed", "Nursing", "Law PG", "Agriculture", "Government Recruitment",
  "School Board", "Multiple Courses",
];

export const EXAM_LISTING_EDUCATION_LEVELS = ["UG", "PG", "12th", "10th"];
export const EXAM_FILTER_VERSION = 1;
export const EXAM_LOGO_THEME_PREFIX = "exam-logos-v3";

export const APPROVED_EXAM_THEME_LOGOS = Object.freeze({
  "anu-pgcet": "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v1/a2/a22b1056cbdbf8a7819dd93e08966da59edef387ad8c9c2fb56a9c9e9c66a6aa.webp",
  afcat: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v1/73/7316ee188718c21dbc07a28620ec53b92088a19e1a8f780514acf0d8c9619485.webp",
  apset: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v1/15/15295360a1f4df5c2bbb679f3ee2d40a70471f66b8b37319c915092392f39a5b.webp",
  bitsat: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v1/43/437df8f07a2deafb67860e7c61aaa179b109733d086b18cde1939d60e409da80.webp",
  clat: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v1/f1/f1a1cb32f8fd70ef8c9fe8f533ee7649acfcc3280e2a107a88647e2451d3847f.webp",
});

const unique = (values) => [...new Set(values.filter(Boolean))];
const has = (text, expression) => expression.test(text);

function examText(exam) {
  return [
    exam.slug, exam.name, exam.short_name, exam.full_name, exam.category, exam.level,
    exam.description, exam.eligibility, exam.exam_type, exam.conducting_authority,
  ].filter(Boolean).join(" ").toLowerCase();
}

export function classifyExamFilters(exam) {
  const text = examText(exam);
  const identityText = [exam.slug, exam.name, exam.short_name, exam.full_name, exam.category, exam.exam_type, exam.conducting_authority]
    .filter(Boolean).join(" ").toLowerCase();
  let listingCategory = "Entrance";
  if (has(identityText, /\b(ielts|toefl|pte academic|gre|gmat|sat exam|scholastic assessment|act exam|study abroad)\b/)) {
    listingCategory = "Study Abroad";
  } else if (has(identityText, /\b(board exam|class 10|class 12|secondary school certificate|higher secondary certificate|intermediate examination|matriculation|cbse|icse|isc|nios|state board)\b/)) {
    listingCategory = "Board";
  } else if (has(identityText, /\b(upsc|ssc |staff selection|civil services|public service commission|recruitment|railway|rrb|bank po|bank clerk|ibps|sbi po|sbi clerk|rbi grade|nda|cds|afcat|capf|constable|government job|sarkari|defence services|teacher eligibility test|tet|ctet)\b/)) {
    listingCategory = "Sarkari";
  }

  const streams = [];
  if (has(text, /\b(engineer|engineering|jee|gate|bitsat|viteee|srmjee|wbjee|mht.?cet|kcet|comedk|eapcet|eamcet|polytechnic|lateral entry)\b/)) streams.push("Engineering");
  if (has(text, /\b(medical|medicine|neet|aiims|mbbs|md\b|ms\b|dental|bds|ayush|pharmacy|paramedical|allied health)\b/)) streams.push("Medical");
  if (has(text, /\b(pharmacy|pharmacist|b\.pharm|m\.pharm|gpat)\b/)) streams.push("Pharmacy");
  if (has(text, /\b(nursing|nurse|bsc nursing|msc nursing|gnm|anm)\b/)) streams.push("Nursing");
  if (has(text, /\b(law|legal|clat|ailet|lsat|llb|ll\.b|llm|ll\.m|bar examination|aibe)\b/)) streams.push("Law");
  if (has(text, /\b(management|business administration|mba|pgdm|cat\b|xat|mat\b|cmat|nmat|snap|ibsat|atma|bba|bms)\b/)) streams.push("Management");
  if (has(text, /\b(design|nift|nid|uceed|ceed|fashion|fine arts)\b/)) streams.push("Design");
  if (has(text, /\b(science|research|iit jam|\bjam\b|csir net|ugc net|jrf|phd|ph\.d|physics|chemistry|mathematics|biology)\b/)) streams.push("Science");
  if (has(text, /\b(arts|humanities|social science|literature|language|history|political science|psychology|sociology)\b/)) streams.push("Arts");
  if (has(text, /\b(hotel|hospitality|catering|nchm)\b/)) streams.push("Hotel Management");
  if (has(text, /\b(computer|information technology|software|bca|mca|nielit)\b/)) streams.push("IT and Software");
  if (has(text, /\b(architecture|b\.arch|nata)\b/)) streams.push("Architecture");
  if (has(text, /\b(aviation|air force|afcat|aircraft maintenance|ame\b|pilot)\b/)) streams.push("Aviation");
  if (has(text, /\b(education|teaching|teacher|b\.ed|bed\b|m\.ed|deled|d\.el\.ed|tet\b|ctet)\b/)) streams.push("Education");
  if (has(text, /\b(agriculture|agricultural|horticulture|forestry|icar)\b/)) streams.push("Agriculture");
  if (has(text, /\b(commerce|accountancy|chartered accountant|company secretary|cost accountant|ca foundation|cseet)\b/)) streams.push("Commerce");
  if (has(text, /\b(nda|cds|afcat|capf|defence|army|navy|air force|coast guard)\b/)) streams.push("Defence");
  if (has(text, /\b(bank|banking|ibps|sbi|rbi|nabard)\b/)) streams.push("Banking");
  if (has(text, /\b(railway|rrb|rpf)\b/)) streams.push("Railways");
  if (listingCategory === "Sarkari") streams.push("Government");
  if (!streams.length) streams.push("General");

  const courseGroups = [];
  if (has(text, /\b(jee|engineering|b\.tech|btech|b\.e\b|be\b|bitsat|viteee|srmjee|wbjee|comedk|eapcet|eamcet)\b/)) courseGroups.push("B.E. / B.Tech");
  if (has(text, /\b(gate|m\.tech|mtech|me\b|postgraduate engineering)\b/)) courseGroups.push("M.E./M.Tech");
  if (has(text, /\b(mba|pgdm|cat\b|xat|cmat|nmat|snap|ibsat|management admission)\b/)) courseGroups.push("MBA/PGDM");
  if (has(text, /\b(bba|bms|undergraduate management)\b/)) courseGroups.push("BBA/BMS");
  if (has(text, /\b(mbbs|neet ug|medical undergraduate)\b/)) courseGroups.push("MBBS");
  if (has(text, /\b(neet pg|inicet|ini cet|md\b|ms\b|postgraduate medical)\b/)) courseGroups.push("MD/MS");
  if (has(text, /\b(uceed|b\.des|bdes|undergraduate design)\b/)) courseGroups.push("B.Des");
  if (has(text, /\b(ceed|m\.des|mdes|postgraduate design)\b/)) courseGroups.push("M.Des");
  if (has(text, /\b(nata|b\.arch|barch|architecture admission)\b/)) courseGroups.push("B.Arch");
  if (has(text, /\b(b\.pharm|bpharm|pharmacy undergraduate)\b/)) courseGroups.push("B.Pharm");
  if (has(text, /\b(gpat|m\.pharm|mpharm|pharmacy postgraduate)\b/)) courseGroups.push("M.Pharm");
  if (has(text, /\b(b\.sc|bsc|bachelor of science)\b/)) courseGroups.push("B.Sc.");
  if (has(text, /\b(m\.sc|msc|master of science|iit jam)\b/)) courseGroups.push("M.Sc.");
  if (has(text, /\b(b\.ed|bed\b|bachelor of education)\b/)) courseGroups.push("B.Ed");
  if (has(text, /\b(m\.ed|med\b|master of education)\b/)) courseGroups.push("M.Ed");
  if (has(text, /\b(d\.el\.ed|deled|elementary education diploma)\b/)) courseGroups.push("D.El.Ed");
  if (has(text, /\b(bca|bachelor of computer applications)\b/)) courseGroups.push("BCA");
  if (has(text, /\b(mca|master of computer applications|nimcet)\b/)) courseGroups.push("MCA");
  if (has(text, /\b(polytechnic|diploma|lateral entry)\b/)) courseGroups.push("Diploma/Polytechnic");
  if (has(text, /\b(phd|ph\.d|doctoral|research eligibility|jrf)\b/)) courseGroups.push("Ph.D.");
  if (has(text, /\b(nursing|gnm|anm)\b/)) courseGroups.push("Nursing");
  if (has(text, /\b(llm|ll\.m|postgraduate law)\b/)) courseGroups.push("Law PG");
  else if (has(text, /\b(law|clat|ailet|lsat|llb|ll\.b)\b/)) courseGroups.push("LL.B.");
  if (has(text, /\b(agriculture|agricultural|icar)\b/)) courseGroups.push("Agriculture");
  if (listingCategory === "Sarkari") courseGroups.push("Government Recruitment");
  if (listingCategory === "Board") courseGroups.push("School Board");
  if (!courseGroups.length) courseGroups.push("Multiple Courses");

  const educationLevels = [];
  if (has(text, /\b(undergraduate|bachelor|jee|neet ug|b\.tech|btech|b\.e\b|mbbs|b\.des|b\.arch|bba|bca|b\.sc|bsc|llb|ll\.b|class 12|12th|10\+2|higher secondary|intermediate)\b/)) educationLevels.push("UG");
  if (has(text, /\b(postgraduate|master|graduate aptitude|gate|neet pg|md\b|ms\b|m\.tech|mtech|m\.des|mdes|mba|pgdm|mca|m\.sc|msc|llm|ll\.m|phd|ph\.d|ugc net|csir net|jrf)\b/)) educationLevels.push("PG");
  if (has(text, /\b(class 12|12th|10\+2|higher secondary|intermediate|senior secondary)\b/) || (educationLevels.includes("UG") && listingCategory === "Entrance")) educationLevels.push("12th");
  if (has(text, /\b(class 10|10th|matric|secondary school)\b/)) educationLevels.push("10th");
  if (!educationLevels.length && listingCategory === "Study Abroad") educationLevels.push("UG", "PG");
  if (!educationLevels.length && listingCategory === "Sarkari") educationLevels.push("UG", "12th", "10th");
  if (!educationLevels.length) educationLevels.push("UG", "PG");

  return {
    listing_category: listingCategory,
    exam_streams: unique(streams),
    course_groups: unique(courseGroups),
    education_levels: unique(educationLevels),
    exam_filter_version: EXAM_FILTER_VERSION,
  };
}

export function validateExamFilters(filters) {
  const errors = [];
  if (!EXAM_LISTING_CATEGORIES.includes(filters.listing_category)) errors.push("invalid listing category");
  for (const [field, values, allowed] of [
    ["exam_streams", filters.exam_streams, EXAM_LISTING_STREAMS],
    ["course_groups", filters.course_groups, EXAM_LISTING_COURSE_GROUPS],
    ["education_levels", filters.education_levels, EXAM_LISTING_EDUCATION_LEVELS],
  ]) {
    if (!Array.isArray(values) || values.length === 0) errors.push(`${field} is empty`);
    else if (values.some((value) => !allowed.includes(value))) errors.push(`${field} contains an unsupported value`);
  }
  return errors;
}

export async function loadCanonicalExamCatalog(repositoryRoot) {
  const snapshotPath = path.join(repositoryRoot, "reports/pre-rollback-2026-07-29/exams-current.json");
  const dedupPath = path.join(repositoryRoot, "reports/exam-deduplication-batch-001-2026-09-21.json");
  const [snapshot, dedup, reportNames] = await Promise.all([
    readFile(snapshotPath, "utf8").then(JSON.parse),
    readFile(dedupPath, "utf8").then(JSON.parse),
    readdir(path.join(repositoryRoot, "reports")),
  ]);
  const deletedSlugs = new Set(dedup.deletions.map((item) => item.old_slug));
  const rows = new Map(snapshot
    .filter((row) => row.is_active !== false && !deletedSlugs.has(row.slug))
    .map((row) => [row.slug, { ...row }]));
  const refreshReports = reportNames
    .filter((name) => /^exam-refresh-batch-\d+-\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort();
  for (const name of refreshReports) {
    const report = JSON.parse(await readFile(path.join(repositoryRoot, "reports", name), "utf8"));
    for (const update of report.updates || []) {
      const slug = update.old_slug || update.slug;
      const current = rows.get(slug) || rows.get(update.slug);
      if (!current) continue;
      const merged = { ...current, ...update, slug: update.slug || current.slug };
      rows.delete(slug);
      rows.set(merged.slug, merged);
    }
  }
  const catalog = [...rows.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return { catalog, deletedSlugs: [...deletedSlugs], refreshReports };
}

const logoThemes = [
  ["#111827", "#ec4899"], ["#8a5b12", "#d9a441"], ["#a61b1b", "#15803d"],
  ["#b91c1c", "#1e3a8a"], ["#111827", "#4338ca"], ["#0f766e", "#f97316"],
  ["#7c2d12", "#2563eb"], ["#581c87", "#0891b2"],
];

const escapeSvg = (value) => String(value || "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&apos;");

function hashText(value) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function displayExamName(exam) {
  const source = String(exam.short_name || exam.name || "Exam").trim();
  return source.length <= 24 ? source : source.split(/\s+/).slice(0, 5).join(" ").slice(0, 32);
}

function wrapLogoText(value) {
  const words = value.split(/\s+/).filter(Boolean);
  if (value.length <= 15) return [value];
  const lines = [""];
  for (const word of words) {
    const current = lines.at(-1);
    if (current && `${current} ${word}`.length > 18 && lines.length < 2) lines.push(word);
    else lines[lines.length - 1] = current ? `${current} ${word}` : word;
  }
  return lines;
}

export function isThemedExamLogo(url) {
  return /\/exam-logos-v3\/[^/?]+\.webp(?:$|\?)/i.test(String(url || ""))
    || /\/sanitized\/bottom-12-v1\//i.test(String(url || ""));
}

export async function renderExamThemeLogo(exam, sourceBuffer) {
  const name = displayExamName(exam);
  const initials = name.split(/\s+/).slice(0, 4).map((word) => word[0]).join("").toUpperCase().slice(0, 5) || "EXAM";
  const [topColor, bottomColor] = logoThemes[hashText(exam.slug || name) % logoThemes.length];
  const lines = wrapLogoText(name);
  const fontSize = lines.join("").length > 26 ? 56 : lines.join("").length > 17 ? 66 : 78;
  const shell = Buffer.from(`
    <svg width="1080" height="950" viewBox="0 0 1080 950" xmlns="http://www.w3.org/2000/svg">
      <rect width="1080" height="950" fill="#ffffff"/>
      <path d="M 40 540 A 500 500 0 0 1 1040 540" fill="none" stroke="${topColor}" stroke-width="29"/>
      <path d="M 1040 540 A 500 500 0 0 1 40 540" fill="none" stroke="${bottomColor}" stroke-width="29"/>
      ${sourceBuffer ? "" : `<text x="540" y="430" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="132" font-weight="800" fill="${topColor}">${escapeSvg(initials)}</text>`}
      ${lines.map((line, index) => `<text x="540" y="${790 + index * 75}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="800" fill="#111827">${escapeSvg(line)}</text>`).join("")}
    </svg>`);
  const base = sharp(shell);
  if (!sourceBuffer) return base.webp({ quality: 95, smartSubsample: true }).toBuffer();
  const source = await sharp(sourceBuffer, { failOn: "none" })
    .resize(430, 360, { fit: "inside", withoutEnlargement: false })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  const metadata = await sharp(source).metadata();
  return base.composite([{
    input: source,
    left: Math.round((1080 - (metadata.width || 430)) / 2),
    top: Math.round(370 - (metadata.height || 360) / 2),
  }]).webp({ quality: 95, smartSubsample: true }).toBuffer();
}
