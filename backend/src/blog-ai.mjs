import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { prisma, schemaMetadata } from "./db.mjs";
import { uploadStorageObject } from "./storage.mjs";
import { toPublicMediaUrls, toStoredMediaKeys } from "./media-values.mjs";

const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
const DEFAULT_OPENAI_TEXT_MODEL = "gpt-5.4-mini";
const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1";
const RECOMMENDED_DAILY_POSTS = 8;
const MAX_POSTS_PER_RUN = 3;
const MAX_DAILY_POSTS = 24;
const MIN_INTERVAL_MINUTES = 60;
const GEMINI_MAX_RETRIES = 4;
const GEMINI_MAX_RETRY_DELAY_MS = 30_000;
const MAX_COVER_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_GEMINI_OUTPUT_TOKENS = 12_000;
const MAX_OPENAI_OUTPUT_TOKENS = 12_000;
const MAX_RESEARCH_SOURCES = 6;
const MAX_RESEARCH_SIGNAL_CHARACTERS = 1_500;
const MAX_TOPIC_PROMPT_FINGERPRINTS = 160;
export const STRICT_ARTICLE_DUPLICATE_THRESHOLD = 0.72;
export const ARTICLE_WRITE_LOCK_SCOPES = Object.freeze(["dekhocampus", "sarkari"]);
const DEFAULT_CONTENT_GOALS = ["SEO", "AEO", "GEO", "LLMO"];
const DEFAULT_REQUIRED_SECTIONS = ["Answer first", "Key facts", "Decision guidance", "FAQs"];
const SARKARI_ARTICLE_CATEGORIES = new Set(["Latest Jobs", "Results", "Admit Card", "Answer Key", "Admissions", "Syllabus", "Scholarships"]);
const OPENAI_TEXT_PRICING_PER_MILLION = {
  "gpt-5.4-mini": { input: 0.75, cachedInput: 0.075, output: 4.5 },
  "gpt-5-nano": { input: 0.05, cachedInput: 0.005, output: 0.4 },
};
export const DEFAULT_BLOG_COVER_TEMPLATE_KEY = "admin-uploads/blog-templates/dekhocampus-blog-cover-template-v1.png";
const BLOG_COVER_FONT_FILE = fileURLToPath(new URL("../assets/Inter.ttf", import.meta.url));
const BLOG_COVER_LOGO_FILE = new URL("../assets/dekhocampus-blog-logo.png", import.meta.url);
const BLOG_COVER_REFERENCE_FILE = new URL("../assets/dekhocampus-blog-cover-reference-v2.png", import.meta.url);

export const BLOG_COVER_TEMPLATE_COUNT = 24;
export const BLOG_COVER_TITLE_MAX_CHARACTERS = 88;
const BLOG_COVER_THEMES = [
  ["#f97316", "#16a34a", "#fff7ed"], ["#ea580c", "#2563eb", "#fff7ed"],
  ["#fb923c", "#0f766e", "#fffbeb"], ["#f59e0b", "#15803d", "#fffbeb"],
  ["#ef4444", "#0369a1", "#fff7ed"], ["#f97316", "#7c3aed", "#fff7ed"],
  ["#c2410c", "#0891b2", "#fefce8"], ["#ea580c", "#4f46e5", "#fff7ed"],
  ["#f97316", "#0d9488", "#f0fdf4"], ["#dc2626", "#15803d", "#fff7ed"],
  ["#fb923c", "#1d4ed8", "#fffbeb"], ["#f59e0b", "#0f766e", "#fefce8"],
  ["#ea580c", "#4338ca", "#fff7ed"], ["#f97316", "#047857", "#f0fdf4"],
  ["#e11d48", "#0284c7", "#fff7ed"], ["#f97316", "#6d28d9", "#faf5ff"],
  ["#d97706", "#0369a1", "#fffbeb"], ["#ea580c", "#0f766e", "#ecfeff"],
  ["#f97316", "#1e40af", "#eff6ff"], ["#be123c", "#15803d", "#fff7ed"],
  ["#fb923c", "#4338ca", "#f5f3ff"], ["#f59e0b", "#047857", "#ecfdf5"],
  ["#ea580c", "#0369a1", "#f0f9ff"], ["#f97316", "#166534", "#f7fee7"],
];

const COVER_DIMENSIONS = {
  "16:9": { web: [1600, 900], "2k": [2560, 1440], "4k": [3840, 2160] },
  "1:1": { web: [1200, 1200], "2k": [2048, 2048], "4k": [3840, 3840] },
  "4:5": { web: [1280, 1600], "2k": [2048, 2560], "4k": [3072, 3840] },
};

const cleanJson = (value) => String(value || "").replace(/^```json\s*|\s*```$/gi, "").trim();
const slugify = (value) => String(value || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
const stripHtml = (value) => String(value || "").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const LEGACY_GEMINI_MODELS = new Set(["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro", "gemini-3.5-flash"]);
const normalizeGeminiModel = (value) => {
  const model = String(value || "").trim();
  if (!model.startsWith("gemini-")) return DEFAULT_GEMINI_MODEL;
  return LEGACY_GEMINI_MODELS.has(model) ? DEFAULT_GEMINI_MODEL : model;
};
export const normalizeBlogTextModel = (value) => {
  const model = String(value || "").trim();
  if (model.startsWith("gemini-")) return normalizeGeminiModel(model);
  if (model.startsWith("gpt-")) return model;
  return DEFAULT_OPENAI_TEXT_MODEL;
};
export const blogTextProvider = (model) => normalizeBlogTextModel(model).startsWith("gemini-") ? "gemini" : "openai";
const normalizeStringList = (value, fallback, maximum = 12) => {
  if (!Array.isArray(value)) return [...fallback];
  const normalized = [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, maximum);
  return normalized.length ? normalized : [...fallback];
};

export function normalizeBlogAgentSettings(value = {}) {
  const textModel = normalizeBlogTextModel(value.text_model || DEFAULT_OPENAI_TEXT_MODEL);
  const authorMode = ["none", "single", "round_robin"].includes(value.author_mode) ? value.author_mode : "none";
  const configuredWordLimit = Math.trunc(Number(value.word_limit));
  const configuredSections = normalizeStringList(value.required_sections, [], 8);
  return {
    ...value,
    enabled: Boolean(value.enabled),
    interval_minutes: Math.min(24 * 60, Math.max(MIN_INTERVAL_MINUTES, Math.trunc(Number(value.interval_minutes) || 180))),
    posts_per_run: Math.min(MAX_POSTS_PER_RUN, Math.max(1, Math.trunc(Number(value.posts_per_run) || 1))),
    daily_post_cap: Math.min(MAX_DAILY_POSTS, Math.max(1, Math.trunc(Number(value.daily_post_cap) || RECOMMENDED_DAILY_POSTS))),
    publish_status: value.publish_status === "Draft" ? "Draft" : "Published",
    model_provider: blogTextProvider(textModel),
    text_model: textModel,
    word_limit: configuredWordLimit === 0 ? 0 : Math.min(2_200, Math.max(700, configuredWordLimit || 0)),
    author_mode: authorMode,
    author_ids: normalizeStringList(value.author_ids, [], 20),
    language: String(value.language || "English").trim().slice(0, 80) || "English",
    audience: String(value.audience || "Indian students and parents").trim().slice(0, 240) || "Indian students and parents",
    tone: String(value.tone || "Clear, practical, trustworthy").trim().slice(0, 240) || "Clear, practical, trustworthy",
    content_goals: [...DEFAULT_CONTENT_GOALS],
    required_sections: [...new Set([...DEFAULT_REQUIRED_SECTIONS, ...configuredSections])].slice(0, 12),
    minimum_sources: Math.min(MAX_RESEARCH_SOURCES, Math.max(2, Math.trunc(Number(value.minimum_sources) || 2))),
    editorial_quality_target: Math.min(98, Math.max(75, Math.trunc(Number(value.editorial_quality_target) || 90))),
    human_review_required: Boolean(value.human_review_required),
    image_mode: ["generated", "template", "none"].includes(value.image_mode) ? value.image_mode : "template",
    image_provider: "openai",
    image_model: DEFAULT_OPENAI_IMAGE_MODEL,
    image_template_url: String(value.image_template_url || DEFAULT_BLOG_COVER_TEMPLATE_KEY).trim(),
    image_prompt_style: String(value.image_prompt_style || "Premium editorial, clean, credible, student-focused").trim().slice(0, 600),
    include_logo: Boolean(value.include_logo),
    logo_url: String(value.logo_url || "").trim(),
    logo_position: "top-center",
    image_aspect_ratio: ["16:9", "1:1", "4:5"].includes(value.image_aspect_ratio) ? value.image_aspect_ratio : "16:9",
    output_resolution: ["web", "2k", "4k"].includes(String(value.output_resolution || "").toLowerCase())
      ? String(value.output_resolution).toLowerCase()
      : "web",
    google_trends_daily_enabled: value.google_trends_daily_enabled !== false,
    google_trends_daily_posts: Math.min(3, Math.max(1, Math.trunc(Number(value.google_trends_daily_posts) || 3))),
  };
}
export const stripPublishedSourceReferences = (value) => String(value || "")
  .replace(/<h[1-6][^>]*>\s*(sources?|references?|citations?)[\s\S]*$/i, "")
  .replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*(collegedunia|collegedekho|shiksha|careers360|kollegeapply|getmyuni|pagalguy)(?:(?!<\/p>)[\s\S])*<\/p>/gi, "")
  .replace(/<a\b[^>]*href=["']https?:\/\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi, "$1")
  .replace(/\s*\[(?:source|citation)?\s*\d+\]/gi, "")
  .replace(/\s*\((?:source|citation|reference)\s*:[^)]+\)/gi, "")
  .replace(/[\u2013\u2014]/g, "-")
  .trim();
const stripCompetitorCredits = stripPublishedSourceReferences;

export function normalizeBlogCoverOptions(options = {}) {
  const mode = ["generated", "template", "none"].includes(options.imageMode) ? options.imageMode : "none";
  const aspectRatio = COVER_DIMENSIONS[options.aspectRatio] ? options.aspectRatio : "16:9";
  const resolution = ["web", "2k", "4k"].includes(String(options.resolution).toLowerCase())
    ? String(options.resolution).toLowerCase()
    : "web";
  const [width, height] = COVER_DIMENSIONS[aspectRatio][resolution];
  return {
    mode,
    aspectRatio,
    resolution,
    width,
    height,
    templateUrl: String(options.templateUrl || "").trim(),
    referenceImageUrl: String(options.referenceImageUrl || "").trim(),
    promptStyle: String(options.promptStyle || "Premium editorial, clean, credible, student-focused").trim().slice(0, 600),
    includeLogo: Boolean(options.includeLogo),
    logoUrl: String(options.logoUrl || "").trim(),
    contextLogoUrl: String(options.contextLogoUrl || "").trim(),
    contextLogoName: String(options.contextLogoName || "").trim().slice(0, 160),
    logoPosition: "top-center",
  };
}

export function resolveBlogMediaSource(value) {
  const storedValue = toStoredMediaKeys(String(value || "").trim());
  const publicValue = String(toPublicMediaUrls(storedValue) || "").trim();
  if (!publicValue || publicValue.includes("://")) return publicValue;
  const mediaBaseUrl = String(process.env.MEDIA_BASE_URL || "").replace(/\/$/, "");
  if (!mediaBaseUrl) return publicValue;
  return `${mediaBaseUrl}/${publicValue.split("/").map(encodeURIComponent).join("/")}`;
}

async function downloadCoverSource(value, label) {
  const sourceUrl = resolveBlogMediaSource(value);
  let parsed;
  try { parsed = new URL(sourceUrl); } catch { throw new Error(`${label} is not a valid media URL`); }
  if (parsed.protocol !== "https:") throw new Error(`${label} must use HTTPS`);
  if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname.toLowerCase())) throw new Error(`${label} cannot use a local address`);
  const response = await fetch(parsed, { signal: AbortSignal.timeout(20_000), redirect: "follow" });
  if (!response.ok) throw new Error(`${label} could not be downloaded (${response.status})`);
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(finalUrl.hostname.toLowerCase())) {
    throw new Error(`${label} redirected to an unsafe address`);
  }
  if (!String(response.headers.get("content-type") || "").toLowerCase().startsWith("image/")) throw new Error(`${label} is not an image`);
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_COVER_SOURCE_BYTES) throw new Error(`${label} exceeds 20 MB`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_COVER_SOURCE_BYTES) throw new Error(`${label} exceeds 20 MB or is empty`);
  return bytes;
}

function escapeCoverText(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
}

export function formatBlogCoverTitle(value) {
  const normalized = stripHtml(value)
    .replace(/\s*(?:\.{3,}|…)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const fallback = "Make your next education decision with confidence";
  if (!normalized) return fallback;
  if (normalized.length <= BLOG_COVER_TITLE_MAX_CHARACTERS) return normalized;
  const excerptLength = BLOG_COVER_TITLE_MAX_CHARACTERS - 3;
  let excerpt = normalized.slice(0, excerptLength + 1).replace(/\s+\S*$/, "").trim();
  if (!excerpt) excerpt = normalized.slice(0, excerptLength).trim();
  return `${excerpt.replace(/[,:;|\-–—\s]+$/, "")}...`;
}

export function layoutTemplateCoverTitle(value, options) {
  const words = formatBlogCoverTitle(value).split(/\s+/).filter(Boolean);
  const totalCharacters = words.join(" ").length;
  const targetLineCount = Math.max(1, Math.min(3, Math.ceil(totalCharacters / 32)));
  const lineCount = Math.min(targetLineCount, words.length);
  const averageLength = totalCharacters / lineCount;
  const memo = new Map();
  const partition = (wordIndex, linesLeft) => {
    const key = `${wordIndex}:${linesLeft}`;
    if (memo.has(key)) return memo.get(key);
    if (linesLeft === 1) {
      const text = words.slice(wordIndex).join(" ");
      const result = { lines: [text], score: (text.length - averageLength) ** 2 };
      memo.set(key, result);
      return result;
    }
    let best = null;
    const lastBreak = words.length - linesLeft + 1;
    for (let end = wordIndex + 1; end <= lastBreak; end += 1) {
      const text = words.slice(wordIndex, end).join(" ");
      const tail = partition(end, linesLeft - 1);
      const orphanPenalty = end === wordIndex + 1 && words.length > lineCount ? 100_000 : 0;
      const score = ((text.length - averageLength) ** 2) + orphanPenalty + tail.score;
      if (!best || score < best.score) best = { lines: [text, ...tail.lines], score };
    }
    memo.set(key, best);
    return best;
  };
  const lines = partition(0, lineCount)?.lines || [words.join(" ")];

  if (lines.length > 1 && lines.at(-1).split(/\s+/).length === 1) {
    lines[lines.length - 1] = `${lines[lines.length - 2].split(/\s+/).pop()} ${lines.at(-1)}`;
    lines[lines.length - 2] = lines[lines.length - 2].split(/\s+/).slice(0, -1).join(" ");
  }

  const longestLine = Math.max(...lines.map((line) => line.length), 1);
  const maximumFontSize = Math.round(options.width * 0.036);
  const minimumFontSize = Math.round(options.width * 0.026);
  const widthFit = Math.floor((options.width * 0.62) / (longestLine * 0.58));
  const heightFit = Math.floor((options.height * 0.27) / (lines.length * 1.15));
  const fontSize = Math.max(minimumFontSize, Math.min(maximumFontSize, widthFit, heightFit));

  return {
    lines,
    fontSize,
    lineHeight: Math.round(fontSize * 1.15),
    centerX: Math.round(options.width * 0.5),
    centerY: Math.round(options.height * 0.57),
  };
}

export function templateCoverTitleOverlay(value, options) {
  const layout = layoutTemplateCoverTitle(value, options);
  const midpoint = (layout.lines.length - 1) / 2;
  const title = layout.lines.map((text, index) => (
    `<text x="${layout.centerX}" y="${Math.round(layout.centerY + (index - midpoint) * layout.lineHeight)}" `
    + `text-anchor="middle" dominant-baseline="middle" font-family="Inter, Arial, Helvetica, sans-serif" `
    + `font-size="${layout.fontSize}" font-weight="600" fill="#111827">${escapeCoverText(text)}</text>`
  )).join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${options.width}" height="${options.height}" viewBox="0 0 ${options.width} ${options.height}">${title}</svg>`);
}

export async function templateCoverTitleRasterOverlay(value, options) {
  const layout = layoutTemplateCoverTitle(value, options);
  const width = Math.round(options.width * 0.62);
  const rendered = await sharp({
    text: {
      text: layout.lines.map(escapeCoverText).join("\n"),
      font: `Inter SemiBold ${layout.fontSize}`,
      fontfile: BLOG_COVER_FONT_FILE,
      width,
      align: "centre",
      rgba: true,
      dpi: 72,
    },
  }).png().toBuffer({ resolveWithObject: true });

  return {
    input: rendered.data,
    left: Math.round(layout.centerX - rendered.info.width / 2),
    top: Math.round(layout.centerY - rendered.info.height / 2),
  };
}

function stableCoverThemeIndex(value) {
  return [...String(value || "")].reduce((total, character) => ((total * 31) + character.codePointAt(0)) >>> 0, 7) % BLOG_COVER_TEMPLATE_COUNT;
}

export function selectBlogCoverTemplate(value) {
  return stableCoverThemeIndex(value) + 1;
}

function localEditorialBackground(prompt, options) {
  const themeIndex = stableCoverThemeIndex(prompt);
  const [primary, secondary, paper] = BLOG_COVER_THEMES[themeIndex];
  const width = options.width || 1600;
  const height = options.height || 900;
  const variant = themeIndex % 6;
  const accents = [
    `<path d="M0 ${height * 0.78} C${width * 0.2} ${height * 0.57},${width * 0.35} ${height * 1.02},${width * 0.58} ${height * 0.78} S${width * 0.86} ${height * 0.55},${width} ${height * 0.72} V${height} H0Z" fill="${secondary}" opacity=".84"/>`,
    `<path d="M0 0 H${width * 0.38} L${width * 0.15} ${height} H0Z" fill="${primary}" opacity=".78"/><path d="M${width} 0 H${width * 0.72} L${width * 0.9} ${height} H${width}Z" fill="${secondary}" opacity=".76"/>`,
    `<circle cx="${width * 0.11}" cy="${height * 0.72}" r="${height * 0.34}" fill="${secondary}" opacity=".65"/><path d="M${width * 0.68} 0 H${width} V${height} L${width * 0.82} ${height * 0.64}Z" fill="${primary}" opacity=".78"/>`,
    `<path d="M0 ${height * 0.24} L${width * 0.32} 0 H0Z" fill="${primary}"/><path d="M${width} ${height * 0.38} L${width * 0.66} ${height} H${width}Z" fill="${secondary}" opacity=".82"/>`,
    `<path d="M0 ${height} V${height * 0.55} Q${width * 0.23} ${height * 0.32} ${width * 0.4} ${height * 0.68} T${width} ${height * 0.48} V${height}Z" fill="${primary}" opacity=".72"/><circle cx="${width * 0.86}" cy="${height * 0.16}" r="${height * 0.2}" fill="${secondary}" opacity=".58"/>`,
    `<path d="M0 0 L${width * 0.28} 0 L${width * 0.08} ${height} H0Z" fill="${secondary}" opacity=".76"/><path d="M${width} 0 L${width * 0.76} 0 L${width * 0.94} ${height} H${width}Z" fill="${primary}" opacity=".8"/>`,
  ][variant];
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${paper}"/><stop offset="1" stop-color="#ffffff"/></linearGradient><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#ffffff" stroke-opacity=".32" stroke-width="1"/></pattern></defs>
    <rect width="100%" height="100%" fill="url(#paper)"/>${accents}<rect width="100%" height="100%" fill="url(#grid)"/>
    <g fill="none" stroke="#ffffff" stroke-opacity=".24" stroke-width="10"><path d="M${width * 0.04} ${height * 0.2} L${width * 0.18} ${height * 0.07} L${width * 0.32} ${height * 0.2}"/><path d="M${width * 0.76} ${height * 0.82} q${width * 0.09} -${height * 0.18} ${width * 0.18} 0"/></g>
  </svg>`);
}

export async function createLocalEditorialCover(prompt, options) {
  return sharp(localEditorialBackground(prompt, options)).png().toBuffer();
}

export function editorialFrameOverlay(options) {
  const { width, height } = options;
  const x = Math.round(width * 0.082);
  const y = Math.round(height * 0.085);
  const panelWidth = Math.round(width * 0.836);
  const panelHeight = Math.round(height * 0.82);
  const radius = Math.round(width * 0.024);
  const categoryY = Math.round(height * 0.35);
  const categoryHeight = Math.round(height * 0.052);
  const categoryWidth = Math.round(width * 0.19);
  const categoryX = Math.round((width - categoryWidth) / 2);
  const categoryCenterY = categoryY + Math.round(categoryHeight / 2);
  const categoryFontSize = Math.round(width * 0.014);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#0f172a" flood-opacity=".16"/></filter></defs>
    <rect x="${Math.round(width * 0.27)}" y="0" width="${Math.round(width * 0.46)}" height="${Math.round(height * 0.2)}" fill="#ffffff"/>
    <rect x="${x}" y="${y}" width="${panelWidth}" height="${panelHeight}" rx="${radius}" fill="#ffffff" filter="url(#shadow)"/>
    <rect x="${x + 25}" y="${y + 25}" width="${panelWidth - 50}" height="${panelHeight - 50}" rx="${Math.max(18, radius - 8)}" fill="none" stroke="#e2e8f0" stroke-width="2"/>
    <rect x="${categoryX}" y="${categoryY}" width="${categoryWidth}" height="${categoryHeight}" rx="${Math.round(categoryHeight / 2)}" fill="#fff7ed" stroke="#fdba74" stroke-width="1.5"/>
    <text x="${Math.round(width * 0.5)}" y="${categoryCenterY}" text-anchor="middle" dominant-baseline="middle" font-family="Inter,Arial,sans-serif" font-size="${categoryFontSize}" font-weight="700" letter-spacing="1.5" fill="#f97316">EDUCATION NEWS</text>
    <rect x="${Math.round(width * 0.335)}" y="${Math.round(height * 0.71)}" width="${Math.round(width * 0.33)}" height="${Math.max(5, Math.round(height * 0.008))}" rx="4" fill="#fb923c"/>
    <text x="${Math.round(width * 0.5)}" y="${Math.round(height * 0.805)}" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="${Math.round(width * 0.017)}" font-weight="600" fill="#475569">DekhoCampus editorial brief for students, parents and aspirants</text>
  </svg>`);
}

export async function renderBlogCover(sourceBytes, options, titleHook, sourceMode = "generated", diagnostics = null) {
  const base = sharp(sourceBytes, { limitInputPixels: 50_000_000 })
    .rotate()
    .resize(options.width, options.height, { fit: "cover", position: "attention" });
  const brandLogo = await sharp(await readFile(BLOG_COVER_LOGO_FILE))
    .resize({ width: Math.round(options.width * 0.19), fit: "inside", withoutEnlargement: false })
    .png().toBuffer({ resolveWithObject: true });
  const title = await templateCoverTitleRasterOverlay(titleHook, options);
  const composites = [
    { input: editorialFrameOverlay(options), left: 0, top: 0 },
    { input: brandLogo.data, left: Math.round((options.width - brandLogo.info.width) / 2), top: Math.round(options.height * 0.16) },
    title,
  ];
  if (diagnostics) {
    diagnostics.sourceMode ||= sourceMode;
    diagnostics.layout = "locked-editorial-v2";
    diagnostics.templateVariant = selectBlogCoverTemplate(titleHook);
    diagnostics.logoPreservedFromTemplate = false;
    diagnostics.logoApplied = false;
    diagnostics.logoKind = "brand-only";
  }
  base.composite(composites);
  return base.webp({ quality: options.resolution === "web" ? 82 : 88, effort: 5 }).toBuffer();
}

const TITLE_STOP_WORDS = new Set(["a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "the", "to", "with"]);
export const normalizeArticleTitle = (value) => String(value || "")
  .toLowerCase()
  .replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

const TOPIC_STOP_WORDS = new Set([
  ...TITLE_STOP_WORDS,
  "all", "announcement", "best", "check", "checking", "complete", "date", "dates", "day", "details", "download",
  "education", "exam", "explained", "guide", "how", "india", "indian", "instructions", "key", "know", "latest",
  "new", "official", "process", "release", "released", "rules", "student", "students", "step", "steps", "update",
  "updates", "what", "when", "where", "which", "why", "workflow", "you", "your",
]);
const TOPIC_INTENT_PATTERNS = {
  "admit-card": [/\badmit card\b/, /\bhall ticket\b/],
  "answer-key": [/\banswer key\b/, /\bresponse sheet\b/],
  counselling: [/\bcounselling\b/, /\bcounseling\b/, /\bseat allotment\b/, /\bseat allocation\b/],
  "choice-filling": [/\bchoice filling\b/, /\bchoice locking\b/, /\bpreference form\b/],
  cutoff: [/\bcut ?off\b/, /\bqualifying marks?\b/],
  dates: [/\bdate sheet\b/, /\bexam dates?\b/, /\bschedule\b/, /\btimetable\b/, /\bcalendar\b/, /\btimeline\b/],
  documents: [/\bdocuments?\b/, /\bcertificate verification\b/, /\bdocument verification\b/],
  eligibility: [/\beligibility\b/, /\bage limit\b/, /\bqualification criteria\b/],
  fees: [/\bfees?\b/, /\bapplication charge\b/, /\btuition\b/],
  "merit-list": [/\bmerit list\b/, /\brank list\b/, /\bstate rank\b/],
  pattern: [/\bexam pattern\b/, /\bmarking scheme\b/, /\bpaper pattern\b/],
  placement: [/\bplacements?\b/, /\bsalary package\b/, /\bmedian salary\b/],
  preparation: [/\bpreparation\b/, /\bstudy plan\b/, /\brevision\b/, /\bmock test\b/],
  ranking: [/\brankings?\b/, /\bnirf\b/],
  registration: [/\bregistration\b/, /\bapplication form\b/, /\bapply online\b/],
  result: [/\bresults?\b/, /\bscore ?cards?\b/],
  scholarship: [/\bscholarships?\b/, /\bfinancial aid\b/, /\bstipend\b/],
  "seat-matrix": [/\bseat matrix\b/, /\bseat intake\b/, /\bavailable seats?\b/],
  syllabus: [/\bsyllabus\b/, /\btopics? and weightage\b/, /\bchapter weightage\b/],
};
const TOPIC_INTENT_WORDS = new Set(Object.values(TOPIC_INTENT_PATTERNS)
  .flatMap((patterns) => patterns.flatMap((pattern) => pattern.source.replace(/\\b/g, " ").replace(/[^a-z ]/g, " ").split(/\s+/)))
  .filter(Boolean));

function topicInputText(value) {
  if (typeof value === "string") return { title: value, context: value, primaryEntity: "" };
  const title = String(value?.title || value?.headline || value?.topic || value?.slug || "");
  const tags = Array.isArray(value?.tags) ? value.tags.join(" ") : String(value?.tags || "");
  const primaryEntity = String(value?.primary_entity || "");
  const context = [title, value?.angle, value?.search_intent, value?.primary_entity, value?.unique_value, value?.description, value?.meta_keywords, tags]
    .filter(Boolean)
    .join(" ");
  return { title, context, primaryEntity };
}

function normalizedTopicLanguage(value) {
  return normalizeArticleTitle(value)
    .replace(/\bcounseling\b/g, "counselling")
    .replace(/\bhall tickets?\b/g, "admit card")
    .replace(/\bscore cards?\b/g, "result")
    .replace(/\brank lists?\b/g, "merit list")
    .replace(/\bseat allocation\b/g, "seat allotment")
    .replace(/\bnda ii\b/g, "nda 2")
    .replace(/\s+/g, " ")
    .trim();
}

function setOverlap(left, right) {
  if (!left.size || !right.size) return { intersection: 0, jaccard: 0, containment: 0 };
  const intersection = [...left].filter((item) => right.has(item)).length;
  return {
    intersection,
    jaccard: intersection / new Set([...left, ...right]).size,
    containment: intersection / Math.min(left.size, right.size),
  };
}

export function articleTopicProfile(value) {
  const input = topicInputText(value);
  const title = normalizedTopicLanguage(input.title);
  const context = normalizedTopicLanguage(input.context);
  const primaryEntity = normalizedTopicLanguage(input.primaryEntity);
  const years = new Set(title.match(/\b20\d{2}\b/g) || []);
  const intents = new Set(Object.entries(TOPIC_INTENT_PATTERNS)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(context)))
    .map(([intent]) => intent));
  const anchors = new Set(title.split(" ").filter((token) => (
    (token.length > 1 || /^\d+$/.test(token))
    && !years.has(token)
    && !TOPIC_STOP_WORDS.has(token)
    && !TOPIC_INTENT_WORDS.has(token)
  )));
  const entityAnchors = new Set(primaryEntity.split(" ").filter((token) => (
    (token.length > 1 || /^\d+$/.test(token))
    && !TOPIC_STOP_WORDS.has(token)
    && !TOPIC_INTENT_WORDS.has(token)
  )));
  for (const token of entityAnchors) anchors.add(token);
  const qualifiers = new Map();
  for (const match of title.matchAll(/\b(slot|session|round|phase|paper|part)\s+(\d+)\b/g)) qualifiers.set(match[1], match[2]);
  return { title, context, years, intents, anchors, entityAnchors, qualifiers };
}

export function articleTopicSimilarity(left, right) {
  const leftProfile = articleTopicProfile(left);
  const rightProfile = articleTopicProfile(right);
  const titleScore = articleTitleSimilarity(leftProfile.title, rightProfile.title);
  const years = setOverlap(leftProfile.years, rightProfile.years);
  if (leftProfile.years.size && rightProfile.years.size && !years.intersection) return Math.min(titleScore, 0.55);
  for (const [qualifier, value] of leftProfile.qualifiers) {
    if (rightProfile.qualifiers.has(qualifier) && rightProfile.qualifiers.get(qualifier) !== value) return Math.min(titleScore, 0.55);
  }
  const anchors = setOverlap(leftProfile.anchors, rightProfile.anchors);
  const intents = setOverlap(leftProfile.intents, rightProfile.intents);
  if (leftProfile.intents.size && rightProfile.intents.size && !intents.intersection) return Math.min(titleScore, 0.68);
  const explicitEntity = leftProfile.entityAnchors.size ? leftProfile.entityAnchors : rightProfile.entityAnchors;
  const otherAnchors = leftProfile.entityAnchors.size ? rightProfile.anchors : leftProfile.anchors;
  const entityMatch = setOverlap(explicitEntity, otherAnchors);
  if (explicitEntity.size && entityMatch.containment >= 0.8 && (!leftProfile.intents.size || !rightProfile.intents.size || intents.jaccard >= 0.66)) {
    return Math.max(titleScore, 0.95);
  }
  if (titleScore >= 0.88) return titleScore;
  const hasStableSubject = anchors.intersection >= 2 || (anchors.intersection === 1 && Math.min(leftProfile.anchors.size, rightProfile.anchors.size) === 1);
  if (hasStableSubject && anchors.containment >= 0.72 && intents.jaccard >= 0.66) return Math.max(titleScore, 0.94);
  if (hasStableSubject && anchors.containment >= 0.82 && (!leftProfile.intents.size || !rightProfile.intents.size)) return Math.max(titleScore, 0.84);
  return Math.max(titleScore, (anchors.jaccard * 0.62) + (intents.jaccard * 0.38));
}

export function findDuplicateArticleTopic(candidate, existing, threshold = 0.82) {
  return existing.find((article) => (
    slugify(article.slug || article.title) === slugify(candidate.slug || candidate.title || candidate)
    || articleTopicSimilarity(article, candidate) >= threshold
  )) || null;
}

function duplicateArticleError(conflict, siteScope = "dekhocampus") {
  const normalizedScope = normalizeArticleSiteScope(siteScope);
  const profile = articleSiteProfile(normalizedScope);
  return Object.assign(
    new Error(`${profile.brand} already covers this topic: ${conflict.title}`),
    { status: 409, code: "DUPLICATE_ARTICLE", conflict, site_scope: normalizedScope },
  );
}

export function compactArticleCoverage(value) {
  const profile = articleTopicProfile(value);
  const parts = [
    [...profile.anchors].sort().join(" "),
    [...profile.intents].sort().join("+"),
    [...profile.years].sort().join("+"),
    [...profile.qualifiers].map(([name, number]) => `${name}-${number}`).sort().join("+"),
  ].filter(Boolean);
  return parts.join(" | ").slice(0, 180);
}

export function rankArticleTopicConflicts(candidate, existing, limit = 8) {
  return existing
    .map((article) => ({ article, score: articleTopicSimilarity(candidate, article) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, limit));
}

export function resolveArticleWordTarget(topic, configuredWordLimit = 0) {
  const configured = Math.trunc(Number(configuredWordLimit));
  if (configured > 0) return Math.min(2_200, Math.max(700, configured));
  const profile = articleTopicProfile(topic);
  if (["result", "admit-card", "answer-key"].some((intent) => profile.intents.has(intent))) return 900;
  if (["preparation", "counselling", "choice-filling", "placement", "syllabus"].some((intent) => profile.intents.has(intent))) return 1_500;
  return 1_200;
}

const ARTICLE_COVERAGE_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  meta_keywords: true,
  tags: true,
};

export function normalizeArticleSiteScope(value) {
  if (value === undefined || value === null || value === "") return "dekhocampus";
  if (ARTICLE_WRITE_LOCK_SCOPES.includes(value)) return value;
  throw Object.assign(new Error("Article site_scope must be dekhocampus or sarkari"), {
    status: 400,
    code: "INVALID_ARTICLE_SITE_SCOPE",
  });
}

export function articleSiteProfile(siteScope) {
  return normalizeArticleSiteScope(siteScope) === "sarkari"
    ? {
      brand: "Sarkari DekhoCampus",
      audience: "Indian government-job aspirants",
      defaultCategory: "Latest Jobs",
      subject: "government recruitment, results, admit cards, answer keys, admissions, syllabi or scholarships",
    }
    : {
      brand: "DekhoCampus",
      audience: "Indian students and parents",
      defaultCategory: "Education",
      subject: "education, admissions, exams, counselling, scholarships, careers or college decisions",
    };
}

export async function loadArticleCoverage(siteScope = "dekhocampus", client = prisma) {
  return client.articles.findMany({
    where: { site_scope: normalizeArticleSiteScope(siteScope) },
    orderBy: { created_at: "desc" },
    select: ARTICLE_COVERAGE_SELECT,
  });
}

export async function assertArticleTopicsAvailable(candidates, {
  client = prisma,
  excludeIds = [],
  threshold = STRICT_ARTICLE_DUPLICATE_THRESHOLD,
  siteScope,
} = {}) {
  const excluded = new Set(excludeIds.filter(Boolean).map(String));
  const candidatesByScope = new Map();
  for (const candidate of candidates) {
    const candidateScope = normalizeArticleSiteScope(siteScope ?? candidate?.site_scope);
    const scopedCandidates = candidatesByScope.get(candidateScope) || [];
    scopedCandidates.push(candidate);
    candidatesByScope.set(candidateScope, scopedCandidates);
  }
  for (const [candidateScope, scopedCandidates] of candidatesByScope) {
    const coverage = (await loadArticleCoverage(candidateScope, client)).filter((article) => !excluded.has(String(article.id)));
    for (const candidate of scopedCandidates) {
      const conflict = findDuplicateArticleTopic(candidate, coverage, threshold);
      if (conflict) throw duplicateArticleError(conflict, candidateScope);
      coverage.unshift(candidate);
    }
  }
  return true;
}

export function normalizeArticleWriteLockScopes(siteScopes = ARTICLE_WRITE_LOCK_SCOPES) {
  const requested = siteScopes === null || siteScopes === undefined
    ? ARTICLE_WRITE_LOCK_SCOPES
    : (Array.isArray(siteScopes) ? siteScopes : [siteScopes]);
  const values = requested.length ? requested : ARTICLE_WRITE_LOCK_SCOPES;
  if (values.some((value) => !ARTICLE_WRITE_LOCK_SCOPES.includes(value))) {
    throw Object.assign(new Error("Article write lock requires a valid site_scope"), {
      status: 400,
      code: "INVALID_ARTICLE_SITE_SCOPE",
    });
  }
  return [...new Set(values)].sort();
}

export async function acquireArticleWriteLocks(tx, siteScopes = ARTICLE_WRITE_LOCK_SCOPES) {
  const scopes = normalizeArticleWriteLockScopes(siteScopes);
  for (const siteScope of scopes) {
    const rows = await tx.$queryRawUnsafe(
      "SELECT `site_scope` FROM `article_write_locks` WHERE `site_scope` = ? FOR UPDATE",
      siteScope,
    );
    if (rows[0]?.site_scope !== siteScope) {
      throw Object.assign(new Error("Article write lock rows are not initialized. Run the database parity migration."), {
        status: 503,
        code: "ARTICLE_WRITE_LOCK_NOT_READY",
        missing_site_scopes: [siteScope],
      });
    }
  }
  return scopes;
}

export async function withArticleWriteLock(operation, siteScopes = ARTICLE_WRITE_LOCK_SCOPES) {
  const scopes = normalizeArticleWriteLockScopes(siteScopes);
  return prisma.$transaction(async (tx) => {
    await acquireArticleWriteLocks(tx, scopes);
    return operation(tx);
  }, { maxWait: 25_000, timeout: 60_000 });
}

const contextLogoFields = {
  colleges: { aliases: ["name", "short_name"], media: ["logo", "image"] },
  courses: { aliases: ["name", "full_name"], media: ["image"] },
  exams: { aliases: ["name", "full_name", "short_name"], media: ["logo", "image"] },
};

function selectEntityLogo(entity, table) {
  const fields = contextLogoFields[table];
  if (!entity || !fields) return null;
  const url = fields.media.map((field) => String(entity[field] || "").trim()).find(Boolean);
  if (!url) return null;
  const name = fields.aliases.map((field) => String(entity[field] || "").trim()).find(Boolean) || "Context organization";
  return { url, name };
}

export function inferContextLogoName(topic) {
  const title = stripHtml(topic).replace(/^dekhocampus\s*:\s*/i, "").trim();
  const acronym = title.match(/\b[A-Z][A-Z0-9-]{1,10}\b/)?.[0];
  if (acronym) return acronym;
  const organization = title.match(/^(.{3,80}?\b(?:University|Institute|Board|Agency|Commission|Council|Department|Ministry|Authority|School|Academy))\b/i)?.[1];
  if (organization) return organization.trim();
  const words = title.match(/[A-Za-z0-9]+/g) || [];
  return words.slice(0, Math.min(4, words.length)).join(" ");
}

export async function resolveContextualBlogLogo(topic, entityContext = null) {
  const schedule = entityContext?.schedule;
  if (schedule && entityContext?.entity) {
    const table = { college: "colleges", course: "courses", exam: "exams" }[schedule.entity_type];
    return selectEntityLogo(entityContext.entity, table) || {
      url: "",
      name: String(entityContext.entity.name || entityContext.entity.full_name || schedule.entity_slug),
    };
  }

  const rawTitle = stripHtml(topic).replace(/^dekhocampus\s*:\s*/i, "").trim();
  const words = rawTitle.match(/[A-Za-z0-9]+/g) || [];
  if (words.length < 2) return null;
  const phrases = new Set();
  for (let size = 2; size <= Math.min(5, words.length); size += 1) {
    for (let start = 0; start + size <= words.length; start += 1) {
      const phrase = words.slice(start, start + size).join(" ");
      if (phrase.length >= 5) phrases.add(phrase);
    }
  }
  const acronyms = words.filter((word) => /^[A-Z0-9-]{2,12}$/.test(word));
  const searchTerms = [...phrases].sort((a, b) => b.length - a.length).slice(0, 24);
  const titleNormalized = normalizeArticleTitle(rawTitle);
  const candidates = [];
  const namedCandidates = [];

  for (const [table, fields] of Object.entries(contextLogoFields)) {
    const aliasFilters = fields.aliases.flatMap((field) => [
      ...searchTerms.map((term) => ({ [field]: { contains: term } })),
      ...(acronyms.length ? [{ [field]: { in: acronyms } }] : []),
    ]);
    if (!aliasFilters.length) continue;
    const select = Object.fromEntries([...fields.aliases, ...fields.media].map((field) => [field, true]));
    const rows = await prisma[table].findMany({ where: { is_active: true, OR: aliasFilters }, select, take: 30 }).catch(() => []);
    for (const row of rows) {
      const matchedAlias = fields.aliases
        .map((field) => String(row[field] || "").trim())
        .filter((alias) => alias.length >= 3)
        .sort((a, b) => b.length - a.length)
        .find((alias) => titleNormalized.includes(normalizeArticleTitle(alias)));
      if (!matchedAlias) continue;
      const score = normalizeArticleTitle(matchedAlias).length;
      const logo = selectEntityLogo(row, table);
      if (logo) candidates.push({ ...logo, score });
      else namedCandidates.push({ url: "", name: matchedAlias, score });
    }
  }
  const match = candidates.sort((a, b) => b.score - a.score)[0];
  if (match) return { url: match.url, name: match.name };
  const namedMatch = namedCandidates.sort((a, b) => b.score - a.score)[0];
  return namedMatch || { url: "", name: inferContextLogoName(rawTitle) };
}

function titleTokens(value) {
  return new Set(normalizeArticleTitle(value).split(" ").filter((token) => token.length > 1 && !TITLE_STOP_WORDS.has(token)));
}

export function articleTitleSimilarity(left, right) {
  const normalizedLeft = normalizeArticleTitle(left);
  const normalizedRight = normalizeArticleTitle(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  const leftTokens = titleTokens(normalizedLeft);
  const rightTokens = titleTokens(normalizedRight);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const jaccard = intersection / union;
  const containment = intersection / Math.min(leftTokens.size, rightTokens.size);
  return Math.max(jaccard, containment >= 0.9 ? containment * 0.95 : 0);
}

export function findDuplicateArticleTitle(candidate, existing, threshold = 0.82) {
  return existing.find((article) => (
    slugify(article.slug || article.title) === slugify(candidate.slug || candidate.title || candidate)
    || articleTitleSimilarity(article.title, candidate.title || candidate) >= threshold
  )) || null;
}

export function normalizeTopicSuggestions(result) {
  const suggestions = [];
  const topicContainerKey = /topic|article|opportunit|idea|suggestion/i;
  const visit = (value, isTopicContainer = false) => {
    if (typeof value === "string") {
      if (isTopicContainer && value.trim()) suggestions.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, isTopicContainer);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (value.title || value.topic || value.headline) {
      suggestions.push(value);
      return;
    }
    for (const [key, item] of Object.entries(value)) {
      visit(item, isTopicContainer || topicContainerKey.test(key));
    }
  };
  visit(result, Array.isArray(result));
  return suggestions.flatMap((suggestion) => {
    if (typeof suggestion === "string") {
      const title = suggestion.trim();
      return title ? [{ title, angle: "", category: "Education", tags: [], trend_based: false }] : [];
    }
    if (!suggestion || typeof suggestion !== "object") return [];
    const title = String(suggestion.title || suggestion.topic || suggestion.headline || "").trim();
    if (!title) return [];
    return [{
      ...suggestion,
      title,
      angle: String(suggestion.angle || "").trim(),
      category: String(suggestion.category || "Education").trim() || "Education",
      tags: Array.isArray(suggestion.tags) ? suggestion.tags.map(String).filter(Boolean) : [],
      trend_based: suggestion.trend_based === true,
    }];
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseRetryDelayMs(value) {
  const text = String(value || "");
  const seconds = text.match(/(\d+(?:\.\d+)?)s\b/i);
  if (seconds) return Math.ceil(Number(seconds[1]) * 1000);
  const millis = text.match(/retry in\s+(\d+(?:\.\d+)?)ms/i);
  if (millis) return Math.ceil(Number(millis[1]));
  return 0;
}

function geminiErrorMessage(status, payloadText) {
  let providerMessage = payloadText;
  try {
    const payload = JSON.parse(payloadText);
    providerMessage = payload?.error?.message || payloadText;
  } catch {
    providerMessage = payloadText;
  }
  const lower = providerMessage.toLowerCase();
  if (status === 429 && (lower.includes("quota") || lower.includes("resource_exhausted"))) {
    return {
      code: "GEMINI_QUOTA_EXHAUSTED",
      message: "Gemini quota is exhausted for this Google AI Studio project. Enable billing or wait for the quota reset, then retry.",
    };
  }
  if (status === 429) {
    return {
      code: "GEMINI_RATE_LIMITED",
      message: "Gemini is rate-limiting requests. Please wait a moment and retry.",
    };
  }
  return {
    code: "GEMINI_REQUEST_FAILED",
    message: `Gemini request failed (${status}): ${providerMessage.slice(0, 300)}`,
  };
}

export function parseGeminiJsonPayload(payload) {
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "{}";
  try {
    return JSON.parse(cleanJson(text));
  } catch (error) {
    const finishReason = String(payload?.candidates?.[0]?.finishReason || "UNKNOWN");
    const truncated = finishReason === "MAX_TOKENS" || /unterminated|unexpected end/i.test(String(error?.message || error));
    throw Object.assign(
      new Error(truncated
        ? "Gemini stopped before its structured article response was complete"
        : "Gemini returned invalid structured JSON"),
      { code: truncated ? "GEMINI_RESPONSE_TRUNCATED" : "GEMINI_INVALID_JSON", finishReason, cause: error },
    );
  }
}

export function nextGeminiOutputBudget(current) {
  const tokens = Math.max(256, Math.trunc(Number(current || 0)));
  return Math.min(MAX_GEMINI_OUTPUT_TOKENS, Math.max(tokens + 800, Math.ceil(tokens * 1.5)));
}

async function provider(name) {
  return prisma.ai_providers.findFirst({ where: { provider_name: name }, orderBy: { updated_at: "desc" } });
}

export async function ensureSupportedAiModels() {
  const legacyModels = [...LEGACY_GEMINI_MODELS];
  await Promise.all([
    prisma.ai_providers.updateMany({
      where: { provider_name: "gemini", default_model: { in: legacyModels } },
      data: { default_model: DEFAULT_GEMINI_MODEL, updated_at: new Date() },
    }).catch(() => null),
    prisma.ai_runtime_controls.updateMany({
      where: { provider: "gemini", model: { in: legacyModels } },
      data: { model: DEFAULT_GEMINI_MODEL, updated_at: new Date() },
    }).catch(() => null),
    prisma.blog_ai_provider_settings.updateMany({
      where: { text_model: { in: legacyModels } },
      data: { text_model: DEFAULT_GEMINI_MODEL, updated_at: new Date() },
    }).catch(() => null),
    prisma.blog_auto_agent_settings.updateMany({
      where: { text_model: { in: legacyModels } },
      data: { text_model: DEFAULT_GEMINI_MODEL, updated_at: new Date() },
    }).catch(() => null),
  ]);
}

async function aiConfig() {
  const [gemini, openai, blog] = await Promise.all([
    provider("gemini"),
    provider("openai"),
    prisma.blog_ai_provider_settings.findUnique({ where: { id: "default" } }).catch(() => null),
  ]);
  const configuredTextModel = normalizeBlogTextModel(blog?.text_model || DEFAULT_OPENAI_TEXT_MODEL);
  return {
    geminiKey: String(process.env.GEMINI_API_KEY || gemini?.api_key_encrypted || "").trim(),
    geminiModel: normalizeGeminiModel(gemini?.default_model || DEFAULT_GEMINI_MODEL),
    openaiKey: String(process.env.OPENAI_API_KEY || openai?.api_key_encrypted || "").trim(),
    textModel: configuredTextModel,
    imageModel: DEFAULT_OPENAI_IMAGE_MODEL,
    imageQuality: ["low", "medium", "high"].includes(blog?.image_quality) ? blog.image_quality : "low",
  };
}

function openAiErrorMessage(status, payloadText) {
  let providerMessage = payloadText;
  try { providerMessage = JSON.parse(payloadText)?.error?.message || payloadText; } catch { /* keep response text */ }
  return `OpenAI request failed (${status}): ${String(providerMessage).slice(0, 300)}`;
}

export function toOpenAiJsonSchema(schema) {
  if (Array.isArray(schema)) return schema.map((value) => toOpenAiJsonSchema(value));
  if (!schema || typeof schema !== "object") return schema;
  const normalized = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "type") normalized.type = String(value).toLowerCase();
    else if (key === "properties") normalized.properties = Object.fromEntries(Object.entries(value || {}).map(([name, child]) => [name, toOpenAiJsonSchema(child)]));
    else if (key === "items") normalized.items = toOpenAiJsonSchema(value);
    else if (key !== "required" && key !== "additionalProperties") normalized[key] = toOpenAiJsonSchema(value);
  }
  if (normalized.type === "object") {
    normalized.additionalProperties = false;
    normalized.required = Object.keys(normalized.properties || {});
  }
  return normalized;
}

export function nextOpenAiOutputBudget(current) {
  const tokens = Math.max(256, Math.trunc(Number(current || 0)));
  return Math.min(MAX_OPENAI_OUTPUT_TOKENS, Math.max(tokens + 1_000, Math.ceil(tokens * 1.5)));
}

export function parseOpenAiJsonPayload(payload) {
  const choice = payload?.choices?.[0];
  const refusal = choice?.message?.refusal;
  if (refusal) {
    throw Object.assign(new Error(`OpenAI declined the structured response: ${String(refusal).slice(0, 240)}`), { code: "OPENAI_RESPONSE_REFUSED" });
  }
  if (choice?.finish_reason === "length") {
    throw Object.assign(new Error("OpenAI stopped before the structured response was complete"), { code: "OPENAI_RESPONSE_TRUNCATED" });
  }
  if (choice?.finish_reason === "content_filter") {
    throw Object.assign(new Error("OpenAI could not return the article because the response was filtered"), { code: "OPENAI_RESPONSE_REFUSED" });
  }
  const content = choice?.message?.content;
  const text = Array.isArray(content)
    ? content.map((part) => part?.text || part?.content || "").join("")
    : String(content || "");
  if (!text.trim()) {
    throw Object.assign(new Error("OpenAI returned an empty structured response"), { code: "OPENAI_EMPTY_RESPONSE" });
  }
  try { return JSON.parse(cleanJson(text)); }
  catch (error) {
    throw Object.assign(new Error("OpenAI returned invalid structured JSON"), { code: "OPENAI_INVALID_JSON", cause: error });
  }
}

async function openAiJson(prompt, feature = "blog-studio", options = {}) {
  const control = await assertAiEnabled(feature);
  const config = await aiConfig();
  if (!config.openaiKey) throw Object.assign(new Error("OpenAI API key is not configured in AWS or Admin - AI Providers"), { status: 503, code: "OPENAI_NOT_CONFIGURED" });
  const configuredModel = options.model || (control?.provider === "openai" && control?.model ? control.model : config.textModel);
  const model = normalizeBlogTextModel(configuredModel).startsWith("gpt-") ? normalizeBlogTextModel(configuredModel) : DEFAULT_OPENAI_TEXT_MODEL;
  const reasoningEffort = ["none", "low", "medium", "high"].includes(options.reasoningEffort) ? options.reasoningEffort : "low";
  const responseFormat = options.responseSchema
    ? {
        type: "json_schema",
        json_schema: {
          name: `dekhocampus_${String(feature || "structured_response").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 44)}`,
          strict: true,
          schema: toOpenAiJsonSchema(options.responseSchema),
        },
      }
    : { type: "json_object" };
  const requestBody = JSON.stringify({
    model,
    messages: [
      { role: "system", content: "Return valid JSON only. Write factual, original, natural editorial English. Never expose sources, citations, URLs, competitor names, research notes, or AI process in publishable content. Never use an em dash." },
      { role: "user", content: prompt },
    ],
    response_format: responseFormat,
    reasoning_effort: reasoningEffort,
    ...(options.maxOutputTokens ? { max_completion_tokens: Math.max(256, Math.trunc(options.maxOutputTokens)) } : {}),
  });
  let response;
  let providerText = "";
  for (let attempt = 0; attempt <= 3; attempt += 1) {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${config.openaiKey}`, "content-type": "application/json" },
      body: requestBody,
      signal: AbortSignal.timeout(120_000),
    });
    if (response.ok) break;
    providerText = await response.text();
    if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 3) break;
    const retryAfter = Number(response.headers.get("retry-after") || 0) * 1000;
    await sleep(Math.min(30_000, retryAfter || 500 * (attempt + 1)));
  }
  if (!response?.ok) throw Object.assign(new Error(openAiErrorMessage(response?.status || 500, providerText)), { status: response?.status || 500, code: "OPENAI_REQUEST_FAILED" });
  const payload = await response.json();
  const usage = payload.usage || {};
  const inputTokens = Math.max(0, Math.trunc(Number(usage.prompt_tokens || 0)));
  const outputTokens = Math.max(0, Math.trunc(Number(usage.completion_tokens || 0)));
  const totalTokens = Math.max(0, Math.trunc(Number(usage.total_tokens || inputTokens + outputTokens)));
  const cachedInputTokens = Math.max(0, Math.min(inputTokens, Math.trunc(Number(usage.prompt_tokens_details?.cached_tokens || 0))));
  const pricing = OPENAI_TEXT_PRICING_PER_MILLION[model];
  const estimatedCost = pricing
    ? (((inputTokens - cachedInputTokens) * pricing.input) + (cachedInputTokens * pricing.cachedInput) + (outputTokens * pricing.output)) / 1_000_000
    : 0;
  await prisma.ai_usage_events.create({ data: {
    id: randomUUID(), provider: "openai", model, feature, operation: "text-generation",
    input_tokens: BigInt(inputTokens), output_tokens: BigInt(outputTokens), total_tokens: BigInt(totalTokens), image_count: 0, estimated_cost_usd: estimatedCost,
    metadata: {
      cached_input_tokens: cachedInputTokens,
      max_output_tokens: options.maxOutputTokens || null,
      reasoning_effort: reasoningEffort,
      structured_schema: Boolean(options.responseSchema),
      finish_reason: payload.choices?.[0]?.finish_reason || null,
      cost_estimate_available: Boolean(pricing),
      site_scope: options.siteScope ? normalizeArticleSiteScope(options.siteScope) : null,
    },
  } }).catch(() => {});
  let result;
  try {
    result = parseOpenAiJsonPayload(payload);
  } catch (error) {
    const recoverable = ["OPENAI_RESPONSE_TRUNCATED", "OPENAI_EMPTY_RESPONSE", "OPENAI_INVALID_JSON"].includes(error?.code);
    const currentBudget = Math.max(256, Math.trunc(Number(options.maxOutputTokens || 0)));
    const truncationRetries = Math.max(0, Math.trunc(Number(options.truncationRetries || 0)));
    const maxTruncationRetries = Math.min(3, Math.max(1, Math.trunc(Number(options.maxTruncationRetries || 1))));
    if (recoverable && truncationRetries < maxTruncationRetries && currentBudget < MAX_OPENAI_OUTPUT_TOKENS) {
      return openAiJson(prompt, feature, {
        ...options,
        maxOutputTokens: nextOpenAiOutputBudget(currentBudget),
        truncationRetries: truncationRetries + 1,
      });
    }
    throw error;
  }
  return { result, model, provider: "openai" };
}

async function blogTextJson(prompt, feature = "blog-studio", options = {}) {
  const config = await aiConfig();
  const model = normalizeBlogTextModel(options.model || config.textModel);
  if (blogTextProvider(model) === "openai") return openAiJson(prompt, feature, { ...options, model });
  const generated = await geminiJson(prompt, feature, { ...options, model });
  return { ...generated, provider: "gemini" };
}

const TOPIC_NOVELTY_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdicts: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          candidate_index: { type: "INTEGER" },
          is_duplicate: { type: "BOOLEAN" },
          confidence: { type: "NUMBER" },
          conflicts_with: { type: "STRING" },
          reason: { type: "STRING" },
        },
        required: ["candidate_index", "is_duplicate", "confidence", "reason"],
      },
    },
  },
  required: ["verdicts"],
};

async function filterSemanticallyNovelTopics(candidates, existing, model, feature = "blog-agent", siteScope = "dekhocampus") {
  if (!candidates.length || !existing.length) return { accepted: candidates, rejected: [], model: null };
  const normalizedScope = normalizeArticleSiteScope(siteScope);
  const profile = articleSiteProfile(normalizedScope);
  const comparisons = candidates.map((candidate, candidateIndex) => ({
    candidate_index: candidateIndex,
    candidate: {
      title: String(candidate.title || candidate),
      primary_entity: String(candidate.primary_entity || ""),
      search_intent: String(candidate.search_intent || ""),
      angle: String(candidate.angle || ""),
      unique_value: String(candidate.unique_value || ""),
    },
    closest_existing: rankArticleTopicConflicts(candidate, existing, 8).map(({ article, score }) => ({
      title: article.title,
      description: String(article.description || "").slice(0, 240),
      keywords: String(article.meta_keywords || "").slice(0, 160),
      tags: Array.isArray(article.tags) ? article.tags.slice(0, 8) : [],
      local_similarity: Number(score.toFixed(3)),
    })),
  }));
  const generated = await blogTextJson(`Act as ${profile.brand}'s independent topic editor. Decide whether each proposed article is materially new compared with its closest existing coverage: ${JSON.stringify(comparisons)}. Treat the same primary entity, time period, reader search intent, decision or outcome as a duplicate even when the headline, synonyms, word order, format or minor angle changes. A checklist, guide, explainer, update or strategy is not new when it answers the same practical question. Allow a topic only when it serves a genuinely different intent or supplies a distinct, evidence-backed outcome. Return one verdict for every candidate_index. Set confidence from 0 to 1 and name the conflicting existing title when duplicate.`, feature, {
    model,
    reasoningEffort: "low",
    thinkingLevel: "low",
    maxOutputTokens: 1_600,
    responseSchema: TOPIC_NOVELTY_SCHEMA,
    siteScope: normalizedScope,
  });
  const verdicts = Array.isArray(generated.result?.verdicts) ? generated.result.verdicts : [];
  const accepted = [];
  const rejected = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const verdict = verdicts.find((item) => Number(item?.candidate_index) === index);
    if (!verdict) {
      rejected.push({ suggested: candidates[index].title, reason: "semantic novelty review returned no verdict" });
      continue;
    }
    const confidence = Math.min(1, Math.max(0, Number(verdict.confidence) || 0));
    if (verdict.is_duplicate === true && confidence >= 0.72) {
      rejected.push({
        suggested: candidates[index].title,
        conflicts_with: String(verdict.conflicts_with || `existing ${profile.brand} coverage`),
        reason: String(verdict.reason || "same entity and search intent"),
        confidence,
      });
    } else {
      accepted.push(candidates[index]);
    }
  }
  return { accepted, rejected, model: `${generated.provider}:${generated.model}` };
}

async function assertAiEnabled(feature) {
  const global = await prisma.ai_runtime_controls.findUnique({ where: { feature: "global" } }).catch(() => null);
  const control = await prisma.ai_runtime_controls.findUnique({ where: { feature } }).catch(() => null);
  if (global?.is_enabled === false) throw new Error(`AI is paused: ${global.stop_reason || "global emergency stop"}`);
  if (control?.is_enabled === false) throw new Error(`${feature} is paused: ${control.stop_reason || "feature disabled"}`);
  return control;
}

async function geminiJson(prompt, feature = "blog-studio", options = {}) {
  const control = await assertAiEnabled(feature);
  const config = await aiConfig();
  if (!config.geminiKey) throw Object.assign(new Error("Gemini API key is not configured in AWS or Admin - AI Providers"), { status: 503, code: "GEMINI_NOT_CONFIGURED" });
  const requestedModel = options.model || (control?.provider === "gemini" && control?.model ? control.model : config.geminiModel);
  const model = normalizeGeminiModel(requestedModel);
  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: "Return valid JSON only. Use factual, original language. Never use an em dash." }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      // Gemini 3 uses dynamic thinking by default. Structured JSON does not
      // need a large reasoning budget, and that budget can otherwise consume
      // maxOutputTokens before the JSON body is complete.
      thinkingConfig: {
        thinkingLevel: options.thinkingLevel || (options.research ? "minimal" : "low"),
      },
      ...(options.maxOutputTokens ? { maxOutputTokens: Math.max(256, Math.trunc(options.maxOutputTokens)) } : {}),
      ...(options.responseSchema ? { responseSchema: options.responseSchema } : {}),
    },
    ...(options.research ? { tools: [{ google_search: {} }, { url_context: {} }] } : {}),
  });
  let response;
  let providerText = "";
  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt += 1) {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.geminiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: requestBody,
      signal: AbortSignal.timeout(120_000),
    });
    if (response.ok) break;
    providerText = await response.text();
    const retryAfter = Number(response.headers.get("retry-after") || 0) * 1000;
    const hintedDelay = parseRetryDelayMs(providerText);
    const retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
    if (!retryable || attempt === GEMINI_MAX_RETRIES) break;
    const backoff = Math.min(GEMINI_MAX_RETRY_DELAY_MS, retryAfter || hintedDelay || 500 * (attempt + 1));
    await sleep(backoff);
  }
  if (!response?.ok) {
    const friendly = geminiErrorMessage(response?.status || 500, providerText);
    throw Object.assign(new Error(friendly.message), { status: response?.status || 500, code: friendly.code });
  }
  const payload = await response.json();
  const usage = payload.usageMetadata || {};
  const inputTokens = Math.max(0, Math.trunc(Number(usage.promptTokenCount || 0)));
  const outputTokens = Math.max(0, Math.trunc(Number(usage.candidatesTokenCount || 0)));
  const totalTokens = Math.max(0, Math.trunc(Number(usage.totalTokenCount || inputTokens + outputTokens)));
  await prisma.ai_usage_events.create({ data: {
    id: randomUUID(), provider: "gemini", model, feature, operation: "text-generation",
    input_tokens: BigInt(inputTokens), output_tokens: BigInt(outputTokens), total_tokens: BigInt(totalTokens), image_count: 0, estimated_cost_usd: 0,
    metadata: {
      cached_input_tokens: Math.max(0, Math.trunc(Number(usage.cachedContentTokenCount || 0))),
      thought_tokens: Math.max(0, Math.trunc(Number(usage.thoughtsTokenCount || 0))),
      thinking_level: options.thinkingLevel || (options.research ? "minimal" : "low"),
      max_output_tokens: options.maxOutputTokens || null,
      finish_reason: payload.candidates?.[0]?.finishReason || null,
      site_scope: options.siteScope ? normalizeArticleSiteScope(options.siteScope) : null,
    },
  } }).catch(() => {});
  let result;
  try {
    result = parseGeminiJsonPayload(payload);
  } catch (error) {
    if (error?.code === "GEMINI_RESPONSE_TRUNCATED" && !options.truncationRetry && options.maxOutputTokens < MAX_GEMINI_OUTPUT_TOKENS) {
      return geminiJson(prompt, feature, {
        ...options,
        maxOutputTokens: nextGeminiOutputBudget(options.maxOutputTokens),
        truncationRetry: true,
      });
    }
    throw error;
  }
  return { result, model };
}

export async function generateGeminiJson(prompt, feature, options) {
  return geminiJson(prompt, feature, options);
}

export const geminiQuotaHelpers = { normalizeGeminiModel, parseRetryDelayMs, geminiErrorMessage };

async function createGeneratedImage(prompt, options) {
  await assertAiEnabled("blog-cover");
  const config = await aiConfig();
  if (!config.openaiKey) throw Object.assign(new Error("OpenAI API key is not configured for blog images"), { status: 503, code: "OPENAI_NOT_CONFIGURED" });
  let referenceBytes = await readFile(BLOG_COVER_REFERENCE_FILE);
  if (options.referenceImageUrl) {
    try {
      referenceBytes = await downloadCoverSource(options.referenceImageUrl, "Cover style reference");
    } catch {
      // The bundled reference keeps generation available when an uploaded reference expires.
    }
  }
  referenceBytes = await sharp(referenceBytes, { limitInputPixels: 50_000_000 }).rotate().png().toBuffer();
  const form = new FormData();
  form.append("model", config.imageModel || DEFAULT_OPENAI_IMAGE_MODEL);
  form.append("image", new Blob([referenceBytes], { type: "image/png" }), "dekhocampus-cover-reference.png");
  form.append("prompt", `${options.promptStyle}. Use the attached DekhoCampus cover only as a visual-style reference. Create a fresh premium illustrated education background for Indian students about: ${String(prompt).slice(0, 320)}. Generate background artwork only. Do not render text, letters, logos, watermarks, badges, white panels, cards, borders or frames. Keep important visual subjects around the outer edges because the application adds a locked editorial panel in the center.`);
  form.append("size", options.aspectRatio === "1:1" ? "1024x1024" : options.aspectRatio === "4:5" ? "1024x1536" : "1536x1024");
  form.append("quality", config.imageQuality);
  form.append("output_format", "webp");
  form.append("n", "1");
  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { authorization: `Bearer ${config.openaiKey}` },
    body: form,
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`OpenAI image generation failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  const payload = await response.json();
  let bytes;
  if (payload.data?.[0]?.b64_json) bytes = Buffer.from(payload.data[0].b64_json, "base64");
  else {
    const source = await fetch(payload.data?.[0]?.url || "", { signal: AbortSignal.timeout(60_000) });
    if (!source.ok) throw new Error("OpenAI image result could not be downloaded");
    bytes = Buffer.from(await source.arrayBuffer());
  }
  return { bytes, config, usage: payload.usage || {} };
}

export async function createBlogCover(slug, prompt, rawOptions = {}) {
  const options = normalizeBlogCoverOptions(rawOptions);
  const diagnostics = rawOptions.diagnostics && typeof rawOptions.diagnostics === "object" ? rawOptions.diagnostics : null;
  if (options.mode === "none") return "";
  let sourceBytes;
  let sourceMode = "generated";
  let generatedConfig = null;
  let generatedUsage = null;
  if (options.mode === "template") {
    if (options.templateUrl) try {
      sourceBytes = await downloadCoverSource(options.templateUrl, "Cover template");
      sourceMode = "template";
      if (diagnostics) diagnostics.sourceMode = "template";
    } catch (templateError) {
      sourceBytes = await createLocalEditorialCover(prompt, options);
      sourceMode = "bundled-template";
      if (diagnostics) {
        diagnostics.sourceMode = "bundled-template";
        diagnostics.templateError = String(templateError?.message || templateError).slice(0, 200);
      }
    } else {
      sourceBytes = await createLocalEditorialCover(prompt, options);
      sourceMode = "bundled-template";
      if (diagnostics) diagnostics.sourceMode = "bundled-template";
    }
  } else {
    try {
      const generated = await createGeneratedImage(prompt, options);
      sourceBytes = generated.bytes;
      sourceMode = "generated";
      generatedConfig = generated.config;
      generatedUsage = generated.usage;
      if (diagnostics) diagnostics.sourceMode = "generated";
    } catch (generatedError) {
      sourceBytes = await createLocalEditorialCover(prompt, options);
      sourceMode = "bundled-template";
      if (diagnostics) {
        diagnostics.sourceMode = "bundled-template";
        diagnostics.generatedError = String(generatedError?.message || generatedError).slice(0, 200);
      }
    }
  }
  const bytes = await renderBlogCover(sourceBytes, options, prompt, sourceMode, diagnostics);
  const path = `blog-covers/${slug}-${Date.now()}.webp`;
  const upload = await uploadStorageObject("admin-uploads", path, bytes, "image/webp", { cacheControl: "public,max-age=31536000,immutable" });
  if (generatedConfig) {
    const inputTokens = Math.max(0, Math.trunc(Number(generatedUsage?.input_tokens || 0)));
    const outputTokens = Math.max(0, Math.trunc(Number(generatedUsage?.output_tokens || 0)));
    const totalTokens = Math.max(0, Math.trunc(Number(generatedUsage?.total_tokens || inputTokens + outputTokens)));
    await prisma.ai_usage_events.create({ data: {
      id: randomUUID(), provider: "openai", model: generatedConfig.imageModel, feature: "blog-cover", operation: "image-generation",
      input_tokens: BigInt(inputTokens), output_tokens: BigInt(outputTokens), total_tokens: BigInt(totalTokens), image_count: 1, estimated_cost_usd: 0,
      metadata: { slug, aspect_ratio: options.aspectRatio, resolution: options.resolution, quality: generatedConfig.imageQuality, reference_guided: true, layout: "locked-editorial-v2", logo_applied: false, site_scope: rawOptions.siteScope ? normalizeArticleSiteScope(rawOptions.siteScope) : null },
    } }).catch(() => {});
  }
  return upload.publicUrl;
}

async function researchSignals(limit = MAX_RESEARCH_SOURCES, siteScope = "dekhocampus") {
  const normalizedScope = normalizeArticleSiteScope(siteScope);
  const requestedLimit = Math.min(MAX_RESEARCH_SOURCES, Math.max(2, Number(limit) || MAX_RESEARCH_SOURCES));
  const configured = await prisma.blog_research_sources.findMany({ where: { is_active: true }, orderBy: { display_order: "asc" }, take: MAX_RESEARCH_SOURCES });
  const defaults = normalizedScope === "sarkari"
    ? [
      { name: "Google News Government Jobs India", url: "https://news.google.com/rss/search?q=government+jobs+recruitment+notification+India&hl=en-IN&gl=IN&ceid=IN:en", source_type: "public_signal" },
      { name: "Google News Government Exam Updates India", url: "https://news.google.com/rss/search?q=government+exam+result+admit+card+answer+key+India&hl=en-IN&gl=IN&ceid=IN:en", source_type: "public_signal" },
    ]
    : [
      { name: "Google News Education India", url: "https://news.google.com/rss/search?q=education+college+admission+exam+India&hl=en-IN&gl=IN&ceid=IN:en", source_type: "public_signal" },
      { name: "Google Trends India", url: "https://trends.google.com/trending/rss?geo=IN", source_type: "public_signal" },
    ];
  const candidates = normalizedScope === "sarkari" ? [...defaults, ...configured] : [...configured, ...defaults];
  const sources = candidates
    .filter((source, index, values) => values.findIndex((candidate) => candidate.url === source.url) === index)
    .slice(0, requestedLimit);
  const profile = articleSiteProfile(normalizedScope);
  const settled = await Promise.allSettled(sources.map(async (source) => {
    const response = await fetch(source.url, { headers: { "user-agent": `${profile.brand} editorial research/2.0` }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(String(response.status));
    return {
      name: source.name,
      url: source.url,
      source_type: source.source_type,
      signal: stripHtml((await response.text()).slice(0, 24_000)).slice(0, MAX_RESEARCH_SIGNAL_CHARACTERS),
    };
  }));
  return settled.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
}

export function articlePrompt(topic, signals, wordLimit = 0, correctionIssues = [], rawEditorialSettings = {}, requestedSiteScope = "dekhocampus") {
  const normalizedScope = normalizeArticleSiteScope(typeof rawEditorialSettings === "string" ? rawEditorialSettings : requestedSiteScope);
  const profile = articleSiteProfile(normalizedScope);
  const editorial = normalizeBlogAgentSettings({
    audience: profile.audience,
    ...(rawEditorialSettings && typeof rawEditorialSettings === "object" && !Array.isArray(rawEditorialSettings) ? rawEditorialSettings : {}),
  });
  const targetWords = resolveArticleWordTarget(topic, wordLimit);
  const topicBrief = typeof topic === "string"
    ? { title: topic }
    : {
      title: String(topic?.title || topic?.headline || topic?.topic || ""),
      angle: String(topic?.angle || ""),
      search_intent: String(topic?.search_intent || ""),
      primary_entity: String(topic?.primary_entity || ""),
      unique_value: String(topic?.unique_value || ""),
      category: String(topic?.category || profile.defaultCategory),
      tags: Array.isArray(topic?.tags) ? topic.tags : [],
    };
  const correction = correctionIssues.length
    ? `A previous draft failed these publishing checks: ${correctionIssues.join("; ")}. Correct every item without discussing the checks.`
    : "";
  const scopeRules = normalizedScope === "sarkari"
    ? "Set category to exactly one of: Latest Jobs, Results, Admit Card, Answer Key, Admissions, Syllabus, Scholarships. Clearly separate notification facts, eligibility, vacancy or seat details, fees, age limits, important dates, selection stages and official next steps when they apply. Never imply that Sarkari DekhoCampus is the recruiting authority, never promise selection, and mark any unconfirmed date or vacancy figure for verification on the recruiting authority's official website."
    : "Use the most precise education category for the article and keep advice appropriate for students and parents.";
  return `Today is ${new Date().toISOString().slice(0, 10)}. Write one original ${profile.brand} article about ${profile.subject} from this editorial brief: ${JSON.stringify(topicBrief)}.

Editorial contract:
- Primary audience: ${profile.audience}.
- Editorial audience guidance: ${editorial.audience}.
- Language: ${editorial.language}.
- Voice: ${editorial.tone}.
- Discovery goals: ${editorial.content_goals.join(", ")}. SEO means precise search intent and metadata; AEO means a direct answer near the start; GEO and LLMO mean unambiguous entities, dates, claims, relationships and self-contained explanations.
- Target about ${targetWords} words, using only the length the topic genuinely needs.
- Required reader modules: ${editorial.required_sections.join("; ")}.
- Use at least ${editorial.minimum_sources} independent private research signals before stating time-sensitive facts.
- Editorial acceptance target: ${editorial.editorial_quality_target}/100.
- Scope requirements: ${scopeRules}
${correction}

Private fact-checking context: ${JSON.stringify(signals)}. Synthesize facts and add original decision value. Never copy distinctive wording. Never expose source names, publisher names, URLs, citations, footnotes, attribution, a bibliography, or research_notes inside content_html.

Return {title,slug,description,content_html,meta_title,meta_description,meta_keywords,tags,category,hero_hook,research_notes,faqs:[{question,answer}]}. Write a complete, specific, accurate title of roughly 55-85 characters preserving the key exam, institution, authority, date or outcome. Write meta_title at 50-65 characters and meta_description at 140-160 characters. Set hero_hook exactly equal to title. Open with a concise answer that identifies the entity, current consequence and next useful action. Answer one identifiable search intent and deliver the unique value through evidence-backed comparison, calculation, timeline, checklist, interpretation or decision guidance beyond a rewritten announcement. Build topic-specific sections instead of a reusable template. Every section must help the reader decide, act, avoid a mistake or understand a concrete consequence.

Do not put ${profile.brand} in the title, use an ellipsis, add trailing punctuation, or use generic phrases such as Complete Guide or Everything You Need to Know. Write 4-8 distinct search-intent FAQs and include the exact same questions and answers in a visible FAQ section in content_html. Use descriptive H2/H3 headings, short readable paragraphs, and at least one useful list or table. Use natural, reader-first editorial prose with varied sentence lengths and restrained transitions. Never invent interviews, first-hand testing, personal experience, quotes, statistics or official facts. Avoid repetitive outlines, generic filler, exaggerated claims, robotic summaries, and phrases such as "delve", "in today's fast-paced world", "it is important to note", or "in conclusion". When evidence is uncertain, clearly tell readers what detail to verify on the relevant official authority website without naming or linking a research source.`;
}

const ARTICLE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    slug: { type: "STRING" },
    description: { type: "STRING" },
    content_html: { type: "STRING" },
    meta_title: { type: "STRING" },
    meta_description: { type: "STRING" },
    meta_keywords: { type: "STRING" },
    tags: { type: "ARRAY", items: { type: "STRING" } },
    category: { type: "STRING" },
    hero_hook: { type: "STRING" },
    research_notes: { type: "STRING" },
    faqs: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { question: { type: "STRING" }, answer: { type: "STRING" } },
        required: ["question", "answer"],
      },
    },
  },
  required: ["title", "slug", "description", "content_html", "meta_title", "meta_description", "tags", "category", "hero_hook", "faqs"],
};

export function normalizeGeneratedFaqs(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((faq) => {
    const question = stripHtml(faq?.question).slice(0, 500);
    const answer = stripHtml(faq?.answer).slice(0, 4000);
    return question && answer ? [{ question, answer }] : [];
  }).slice(0, 10);
}

export function normalizeGeneratedArticlePayload(value = {}) {
  const wrappers = [value, value?.article, value?.result?.article, value?.result, value?.data];
  const source = wrappers.find((candidate) => (
    candidate && typeof candidate === "object" && (
      candidate.content_html || candidate.content || candidate.body_html || candidate.html || candidate.title
    )
  )) || {};
  return {
    ...source,
    title: String(source.title || source.headline || "").trim(),
    description: String(source.description || source.summary || "").trim(),
    content_html: String(source.content_html || source.content || source.body_html || source.html || "").trim(),
    meta_title: String(source.meta_title || source.seo_title || "").trim(),
    meta_description: String(source.meta_description || source.seo_description || "").trim(),
    meta_keywords: String(source.meta_keywords || source.keywords || "").trim(),
    tags: Array.isArray(source.tags) ? source.tags : [],
    faqs: source.faqs || source.faq || source.questions || [],
  };
}

function sectionIsPresent(section, headings) {
  const wanted = normalizeArticleTitle(section);
  const joined = headings.join(" ");
  const aliases = {
    "answer first": /answer first|quick answer|at a glance|what changed|bottom line|key update/,
    "quick answer": /answer first|quick answer|at a glance|what changed|bottom line|key update/,
    "key facts": /key facts|important facts|important dates|key dates|highlights|overview/,
    "decision guidance": /decision|what should|next steps|how to|checklist|strategy|action plan/,
    faqs: /frequently asked|faqs?|common questions/,
  };
  if (aliases[wanted]) return aliases[wanted].test(joined);
  const terms = wanted.split(" ").filter((term) => term.length > 2);
  return terms.length ? headings.some((heading) => terms.filter((term) => heading.includes(term)).length >= Math.ceil(terms.length * 0.6)) : true;
}

export function assessGeneratedArticle(draft, topic, wordLimit = 0, rawEditorialSettings = {}) {
  const editorial = normalizeBlogAgentSettings(rawEditorialSettings);
  const contentHtml = String(draft?.content_html || "");
  const body = stripHtml(contentHtml);
  const words = body.match(/[A-Za-z0-9][A-Za-z0-9'/-]*/g) || [];
  const targetWords = resolveArticleWordTarget(topic, wordLimit);
  const minimumWords = Math.max(550, Math.min(1200, Math.floor(targetWords * 0.65)));
  const issues = [];
  const checks = [];
  let score = 0;
  const check = (name, passed, points, issue, critical = false) => {
    checks.push({ name, passed, points: passed ? points : 0, possible: points });
    if (passed) score += points;
    else if (issue) issues.push(`${critical ? "Critical: " : ""}${issue}`);
  };
  const titleLength = String(draft?.title || "").trim().length;
  const metaTitleLength = String(draft?.meta_title || "").trim().length;
  const metaDescriptionLength = String(draft?.meta_description || "").trim().length;
  const descriptionLength = String(draft?.description || "").trim().length;
  const headings = [...contentHtml.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)].map((match) => normalizeArticleTitle(stripHtml(match[1]))).filter(Boolean);
  const faqs = normalizeGeneratedFaqs(draft?.faqs);
  const uniqueFaqQuestions = new Set(faqs.map((faq) => normalizeArticleTitle(faq.question)));
  const topicProfile = articleTopicProfile(topic);
  const searchableBody = normalizedTopicLanguage(`${draft?.title || ""} ${draft?.description || ""} ${body}`);
  const introduction = normalizedTopicLanguage(body.split(/\s+/).slice(0, 110).join(" "));
  const introAnchors = [...topicProfile.anchors].filter((anchor) => introduction.includes(anchor)).length;
  const hasAnswerFirstOpening = topicProfile.anchors.size < 2 || introAnchors >= Math.min(2, topicProfile.anchors.size);

  check("Specific title", titleLength >= 45 && titleLength <= 95 && !/\.\.\.|complete guide|everything you need to know/i.test(String(draft?.title || "")), 5, "title must be specific, complete and 45-95 characters");
  check("Search metadata", metaTitleLength >= 45 && metaTitleLength <= 70 && metaDescriptionLength >= 120 && metaDescriptionLength <= 170, 8, "meta title or description is outside its useful search length");
  check("Editorial summary", descriptionLength >= 80 && descriptionLength <= 360, 4, "description must clearly summarize the article in 80-360 characters");
  check("Useful depth", words.length >= minimumWords && words.length <= Math.ceil(targetWords * 1.45), 13, `article has ${words.length} words; useful range is ${minimumWords}-${Math.ceil(targetWords * 1.45)}`, true);
  check("Descriptive structure", headings.length >= 3, 7, "article needs at least three descriptive H2/H3 sections");
  check("Scannable evidence", /<(?:ul|ol|table)\b/i.test(contentHtml), 5, "article needs at least one useful list or table");
  const missingSections = editorial.required_sections.filter((section) => {
    const normalizedSection = normalizeArticleTitle(section);
    if (["answer first", "quick answer"].includes(normalizedSection) && hasAnswerFirstOpening) return false;
    return !sectionIsPresent(section, headings);
  });
  check("Required reader modules", !missingSections.length, 10, `required sections are missing: ${missingSections.join(", ")}`, true);
  check("Distinct FAQs", faqs.length >= 4 && uniqueFaqQuestions.size === faqs.length, 8, "article needs at least four distinct FAQs", true);
  const mirroredFaqs = faqs.filter((faq) => body.toLowerCase().includes(stripHtml(faq.question).toLowerCase())).length;
  check("Visible FAQ parity", faqs.length >= 4 && mirroredFaqs === faqs.length, 7, "every dedicated FAQ must also appear visibly in the article", true);

  check("Answer-first opening", hasAnswerFirstOpening, 8, "opening does not answer the requested topic directly");
  let topicFocused = true;
  if (topicProfile.anchors.size >= 2) {
    const coveredAnchors = [...topicProfile.anchors].filter((anchor) => new RegExp(`\\b${anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(searchableBody));
    topicFocused = coveredAnchors.length / topicProfile.anchors.size >= 0.6;
  }
  check("Intent and entity focus", topicFocused, 10, "article does not stay focused on the requested subject", true);
  check("No published research leakage", !/https?:\/\/|\bwww\.|<h[2-4][^>]*>\s*(sources?|references?|citations?)/i.test(contentHtml), 5, "published content contains a source URL or source section", true);
  check("Natural editorial language", !/\b(?:as an ai|language model|in today's fast-paced world|it is important to note|in conclusion|delve into)\b/i.test(body), 5, "article contains generic or machine-oriented boilerplate", true);

  const paragraphs = [...contentHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => normalizeArticleTitle(stripHtml(match[1])))
    .filter((paragraph) => paragraph.length >= 100);
  check("Original paragraph flow", new Set(paragraphs).size === paragraphs.length, 5, "article repeats one or more paragraphs", true);
  return {
    passed: !issues.some((issue) => issue.startsWith("Critical:")) && score >= editorial.editorial_quality_target,
    score,
    target_score: editorial.editorial_quality_target,
    issues,
    checks,
    word_count: words.length,
    target_words: targetWords,
    minimum_words: minimumWords,
  };
}

const ARTICLE_REVIEW_SCHEMA = {
  type: "OBJECT",
  properties: {
    score: { type: "INTEGER" },
    publishable: { type: "BOOLEAN" },
    issues: { type: "ARRAY", items: { type: "STRING" } },
    strengths: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["score", "publishable", "issues"],
};

export function normalizeArticleReviewResult(value = {}, targetScore = 90) {
  const score = Math.min(100, Math.max(0, Math.trunc(Number(value?.score) || 0)));
  const reviewThreshold = independentArticleReviewThreshold(targetScore);
  const publishable = value?.publishable === true && score >= reviewThreshold;
  const issues = Array.isArray(value?.issues) ? value.issues.map((issue) => stripHtml(issue).slice(0, 500)).filter(Boolean).slice(0, 8) : [];
  if (!publishable && !issues.length) {
    issues.push(score < reviewThreshold
      ? `independent editorial score ${score}/100 is below the required ${reviewThreshold}/100`
      : "independent editorial reviewer marked the article as not publishable without diagnostic detail");
  }
  return {
    score,
    publishable,
    required_score: reviewThreshold,
    issues,
    strengths: Array.isArray(value?.strengths) ? value.strengths.map((item) => stripHtml(item).slice(0, 200)).filter(Boolean).slice(0, 6) : [],
  };
}

export function independentArticleReviewThreshold(targetScore = 90) {
  return Math.min(85, Math.max(75, Math.trunc(Number(targetScore) || 90)));
}

async function reviewGeneratedDraft(draft, topic, signals, editorial, model, feature, siteScope = "dekhocampus") {
  const normalizedScope = normalizeArticleSiteScope(siteScope);
  const profile = articleSiteProfile(normalizedScope);
  const independentReviewThreshold = independentArticleReviewThreshold(editorial.editorial_quality_target);
  const generated = await blogTextJson(`Independently review this proposed ${profile.brand} article before publication. Topic brief: ${JSON.stringify(topic)}. Required subject scope: ${profile.subject}. Editorial goals: ${JSON.stringify({ audience: editorial.audience, goals: editorial.content_goals, required_sections: editorial.required_sections, deterministic_target_score: editorial.editorial_quality_target, independent_review_threshold: independentReviewThreshold })}. Private evidence signals: ${JSON.stringify(signals)}. Draft: ${JSON.stringify({ title: draft.title, description: draft.description, meta_title: draft.meta_title, meta_description: draft.meta_description, content_html: draft.content_html, faqs: draft.faqs })}. Score 0-100 for accurate intent satisfaction, evidence discipline, original information gain, answer-first usefulness, natural reader-focused prose, precise entities/dates, metadata, structure and FAQ consistency. Reject rewritten announcements, generic filler, unsupported claims, misleading certainty, source leakage, repeated templates, mismatched FAQs or content that does not materially help the intended reader act or decide. Mark publishable false only for a material factual, safety, intent, completeness or reader-action defect. Optional polish must not block publication; an article scoring 85-89 can be publishable when it is accurate, complete and useful. If publishable is false or the score is below ${independentReviewThreshold}, issues must contain at least one precise, actionable correction. If there is no substantive defect, set publishable to true and score at least ${independentReviewThreshold}.`, feature, {
    model,
    reasoningEffort: "low",
    thinkingLevel: "low",
    maxOutputTokens: 2_500,
    maxTruncationRetries: 2,
    responseSchema: ARTICLE_REVIEW_SCHEMA,
    siteScope: normalizedScope,
  });
  const review = normalizeArticleReviewResult(generated.result, editorial.editorial_quality_target);
  return {
    ...review,
    model_used: `${generated.provider}:${generated.model}`,
  };
}

export function articleRevisionPrompt(draft, topic, signals, correctionIssues = [], rawEditorialSettings = {}, requestedSiteScope = "dekhocampus") {
  const normalizedScope = normalizeArticleSiteScope(requestedSiteScope);
  const profile = articleSiteProfile(normalizedScope);
  const editorial = normalizeBlogAgentSettings({ audience: profile.audience, ...rawEditorialSettings });
  const feedback = correctionIssues
    .map((issue) => stripHtml(issue).trim())
    .filter(Boolean)
    .slice(0, 8);
  return `Revise this proposed ${profile.brand} article so it passes publication review. Keep its verified useful material, but directly correct every review item. Do not describe the editing process.

Topic brief: ${JSON.stringify(topic)}
Required subject scope: ${profile.subject}
Publishing requirements: ${JSON.stringify({ audience: editorial.audience, goals: editorial.content_goals, required_sections: editorial.required_sections, deterministic_target_score: editorial.editorial_quality_target })}
Review corrections: ${JSON.stringify(feedback)}
Private fact-checking context: ${JSON.stringify(signals)}
Existing draft: ${JSON.stringify({ title: draft?.title, slug: draft?.slug, description: draft?.description, content_html: draft?.content_html, meta_title: draft?.meta_title, meta_description: draft?.meta_description, meta_keywords: draft?.meta_keywords, tags: draft?.tags, category: draft?.category, hero_hook: draft?.hero_hook, faqs: draft?.faqs })}

Return the complete replacement {title,slug,description,content_html,meta_title,meta_description,meta_keywords,tags,category,hero_hook,research_notes,faqs:[{question,answer}]}, not a patch. Preserve the article's exact search intent and answer it immediately. For any time-sensitive detail not established by the private context, remove unsupported certainty, state what the reader must verify on the relevant official authority portal, and do not invent a date, option, process or URL. Keep meta_title at 50-65 characters, meta_description at 140-160 characters, 4-8 distinct FAQs, and mirror the same FAQ questions and answers in content_html. Never expose source names, publisher names, URLs, citations, research notes or the review feedback in publishable content.`;
}

async function generateDraft(topic, { wordLimit = 0, cover = {}, signals = null, requiredTitle = "", editorialSettings = {}, model: requestedModel = "", feature = "blog-studio", siteScope = "dekhocampus" } = {}) {
  const normalizedScope = normalizeArticleSiteScope(siteScope);
  const profile = articleSiteProfile(normalizedScope);
  const editorial = normalizeBlogAgentSettings({ audience: profile.audience, ...editorialSettings });
  const evidence = signals || await researchSignals(Math.max(4, editorial.minimum_sources), normalizedScope);
  const independentEvidence = evidence.filter((source) => source.source_type !== "own");
  if (independentEvidence.length < editorial.minimum_sources) {
    throw Object.assign(new Error(`Only ${independentEvidence.length} independent research source(s) were available; ${editorial.minimum_sources} are required by the editorial settings`), { status: 422, code: "INSUFFICIENT_EDITORIAL_SOURCES" });
  }
  const targetWords = resolveArticleWordTarget(topic, wordLimit);
  const maxOutputTokens = Math.min(MAX_OPENAI_OUTPUT_TOKENS, Math.max(5_000, Math.trunc(targetWords * 6)));
  const fallbackTitle = typeof topic === "string" ? topic : topic?.title || topic?.headline || topic?.topic || "";
  let draft;
  let model = requestedModel || editorial.text_model;
  let textProvider;
  let quality;
  let correctionIssues = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const prompt = attempt > 0 && draft && correctionIssues.length
      ? articleRevisionPrompt(draft, topic, evidence, correctionIssues, editorial, normalizedScope)
      : articlePrompt(topic, evidence, wordLimit, correctionIssues, editorial, normalizedScope);
    const generated = await blogTextJson(prompt, feature, {
      model,
      maxOutputTokens,
      reasoningEffort: "low",
      thinkingLevel: "low",
      responseSchema: ARTICLE_RESPONSE_SCHEMA,
      siteScope: normalizedScope,
    });
    model = generated.model;
    textProvider = generated.provider;
    const generatedArticle = normalizeGeneratedArticlePayload(generated.result);
    const title = String(requiredTitle || generatedArticle.title || fallbackTitle).trim();
    const slug = slugify(requiredTitle || generatedArticle.slug || generatedArticle.title || fallbackTitle);
    draft = {
      ...generatedArticle,
      title,
      slug,
      content_html: stripCompetitorCredits(generatedArticle.content_html),
      tags: Array.isArray(generatedArticle.tags) ? generatedArticle.tags : [],
      hero_hook: title,
      faqs: normalizeGeneratedFaqs(generatedArticle.faqs),
      featured_image: "",
      site_scope: normalizedScope,
    };
    const deterministic = assessGeneratedArticle(draft, topic, wordLimit, editorial);
    if (!deterministic.passed) {
      quality = deterministic;
      correctionIssues = deterministic.issues;
      continue;
    }
    const modelReview = await reviewGeneratedDraft(draft, topic, evidence, editorial, model || editorial.text_model, feature, normalizedScope);
    quality = {
      ...deterministic,
      score: Math.min(deterministic.score, modelReview.score),
      passed: deterministic.passed && modelReview.publishable,
      model_review: modelReview,
      issues: [...deterministic.issues, ...modelReview.issues.map((issue) => `Editorial review: ${issue}`)],
    };
    if (quality.passed) break;
    correctionIssues = quality.issues;
  }
  if (!quality?.passed) {
    const failureIssues = Array.isArray(quality?.issues) ? quality.issues.map((issue) => String(issue || "").trim()).filter(Boolean) : [];
    if (!failureIssues.length) {
      failureIssues.push(Number.isFinite(Number(quality?.score))
        ? `editorial score ${quality.score}/100 is below the required ${quality.target_score || editorial.editorial_quality_target}/100`
        : "the text provider did not return a complete article in the required structure");
    }
    const error = new Error(`Article failed the editorial quality gate: ${failureIssues.join("; ")}`);
    error.status = 422;
    error.code = "ARTICLE_QUALITY_GATE_FAILED";
    error.details = { ...quality, issues: failureIssues };
    throw error;
  }
  draft.featured_image = await createBlogCover(draft.slug, draft.title, { ...cover, siteScope: normalizedScope });
  return { draft, model, textProvider, quality, research_sources: evidence.map((item) => item.url) };
}

export async function handleBlogAiSettings(request, userId) {
  const config = await aiConfig();
  if (request.method === "GET") {
    const row = await prisma.blog_ai_provider_settings.findUnique({ where: { id: "default" } }).catch(() => null);
    return { text_model: row?.text_model || config.textModel, text_provider: blogTextProvider(row?.text_model || config.textModel), image_model: row?.image_model || config.imageModel, image_quality: row?.image_quality || config.imageQuality, gemini_key_set: Boolean(config.geminiKey), openai_key_set: Boolean(config.openaiKey), updated_at: row?.updated_at || null };
  }
  const body = await request.json().catch(() => ({}));
  const requestedTextModel = String(body.text_model || DEFAULT_OPENAI_TEXT_MODEL);
  const updates = { text_model: normalizeBlogTextModel(requestedTextModel), image_model: DEFAULT_OPENAI_IMAGE_MODEL, image_quality: ["low", "medium", "high"].includes(body.image_quality) ? body.image_quality : "low", updated_at: new Date(), updated_by: userId };
  const current = await prisma.blog_ai_provider_settings.findUnique({ where: { id: "default" } });
  await prisma.blog_ai_provider_settings.upsert({ where: { id: "default" }, create: { id: "default", claude_api_key_ciphertext: current?.claude_api_key_ciphertext || "", openai_api_key_ciphertext: current?.openai_api_key_ciphertext || "", ...updates }, update: updates });
  for (const [name, key, model] of [["gemini", body.gemini_api_key, DEFAULT_GEMINI_MODEL], ["openai", body.openai_api_key, updates.text_model.startsWith("gpt-") ? updates.text_model : DEFAULT_OPENAI_TEXT_MODEL]]) {
    if (!String(key || "").trim()) continue;
    const existing = await provider(name);
    if (existing) await prisma.ai_providers.update({ where: { id: existing.id }, data: { api_key_encrypted: String(key).trim(), default_model: model, updated_at: new Date() } });
    else await prisma.ai_providers.create({ data: { id: randomUUID(), provider_name: name, display_name: name === "gemini" ? "Google Gemini" : "OpenAI", api_key_encrypted: String(key).trim(), base_url: name === "gemini" ? "https://generativelanguage.googleapis.com/v1beta" : "https://api.openai.com/v1", default_model: model, is_active: true, icon_emoji: name === "gemini" ? "G" : "AI" } });
  }
  return { success: true };
}

function normalizeStudioDraft(value = {}, defaultCategory = "Education") {
  return {
    title: stripHtml(value.title).trim().slice(0, 300),
    slug: slugify(value.slug || value.title),
    description: stripHtml(value.description).trim().slice(0, 1_000),
    content_html: stripCompetitorCredits(value.content_html || value.content),
    meta_title: stripHtml(value.meta_title || value.title).trim().slice(0, 300),
    meta_description: stripHtml(value.meta_description || value.description).trim().slice(0, 1_000),
    meta_keywords: stripHtml(value.meta_keywords).trim().slice(0, 2_000),
    tags: normalizeStringList(value.tags, [], 30),
    category: stripHtml(value.category || defaultCategory).trim().slice(0, 160) || defaultCategory,
    vertical: stripHtml(value.vertical || "General").trim().slice(0, 160) || "General",
    featured_image: String(toStoredMediaKeys(value.featured_image || "")).trim(),
    faqs: normalizeGeneratedFaqs(value.faqs),
  };
}

async function publishBlogStudioDraft(body, userId) {
  const siteScope = normalizeArticleSiteScope(body.site_scope);
  const profile = articleSiteProfile(siteScope);
  const settingsId = siteScope === "sarkari" ? "sarkari" : "default";
  const scopedSettings = await prisma.blog_auto_agent_settings.findUnique({ where: { id: settingsId } }).catch(() => null);
  const fallbackSettings = settingsId === "default" ? null : await prisma.blog_auto_agent_settings.findUnique({ where: { id: "default" } }).catch(() => null);
  const saved = normalizeBlogAgentSettings({
    ...(scopedSettings || fallbackSettings || {}),
    ...(siteScope === "sarkari" && !scopedSettings ? { audience: profile.audience } : {}),
  });
  const draft = normalizeStudioDraft(body.draft, profile.defaultCategory);
  if (siteScope === "sarkari" && !SARKARI_ARTICLE_CATEGORIES.has(draft.category)) draft.category = profile.defaultCategory;
  if (!draft.title || !draft.slug || !draft.content_html) {
    throw Object.assign(new Error("Title, slug and article content are required"), { status: 400, code: "ARTICLE_FIELDS_REQUIRED" });
  }
  const existing = await loadArticleCoverage(siteScope);
  const localConflict = findDuplicateArticleTopic(draft, existing);
  if (localConflict) {
    throw Object.assign(new Error(`${profile.brand} already covers this topic: ${localConflict.title}`), { status: 409, code: "DUPLICATE_ARTICLE" });
  }
  const semantic = await filterSemanticallyNovelTopics([draft], existing, saved.text_model, "blog-studio", siteScope);
  if (!semantic.accepted.length) {
    const conflict = semantic.rejected[0] || {};
    throw Object.assign(new Error(`This draft overlaps existing coverage${conflict.conflicts_with ? `: ${conflict.conflicts_with}` : ""}`), { status: 409, code: "SEMANTIC_DUPLICATE_ARTICLE" });
  }
  const deterministicQuality = assessGeneratedArticle(draft, draft, saved.word_limit, saved);
  if (!deterministicQuality.passed) {
    throw Object.assign(new Error(`Article no longer meets the publishing quality gate: ${deterministicQuality.issues.join("; ")}`), { status: 422, code: "ARTICLE_QUALITY_GATE_FAILED" });
  }
  const researchSources = normalizeStringList(body.research_sources, [], MAX_RESEARCH_SOURCES);
  const modelReview = await reviewGeneratedDraft(
    draft,
    draft,
    researchSources.map((url) => ({ url, source_type: "research" })),
    saved,
    saved.text_model,
    "blog-studio",
    siteScope,
  );
  const quality = {
    ...deterministicQuality,
    score: Math.min(deterministicQuality.score, modelReview.score),
    passed: deterministicQuality.passed && modelReview.publishable,
    model_review: modelReview,
    issues: [...deterministicQuality.issues, ...modelReview.issues.map((issue) => `Editorial review: ${issue}`)],
  };
  if (!quality.passed) {
    throw Object.assign(new Error(`Article did not pass the independent publishing review: ${quality.issues.join("; ") || "editorial score below target"}`), { status: 422, code: "ARTICLE_QUALITY_GATE_FAILED" });
  }
  const requestedStatus = body.status === "Draft" ? "Draft" : "Published";
  const links = Array.isArray(body.entity_links)
    ? body.entity_links.flatMap((link) => {
      const entityType = String(link?.entity_type || "").replace(/s$/, "");
      const entitySlug = slugify(link?.entity_slug);
      return ["college", "course", "exam"].includes(entityType) && entitySlug ? [{ entity_type: entityType, entity_slug: entitySlug }] : [];
    })
    : [];
  const uniqueLinks = links.filter((link, index) => links.findIndex((candidate) => (
    candidate.entity_type === link.entity_type && candidate.entity_slug === link.entity_slug
  )) === index);
  const article = await withArticleWriteLock(async (tx) => {
    await assertArticleTopicsAvailable([draft], { client: tx, siteScope });
    const created = await tx.articles.create({ data: {
      id: randomUUID(),
      site_scope: siteScope,
      status: requestedStatus,
      title: draft.title,
      slug: draft.slug,
      description: draft.description,
      content: draft.content_html,
      vertical: siteScope === "sarkari" ? "Government Jobs" : draft.vertical,
      category: draft.category,
      author: siteScope === "sarkari" ? "Sarkari DekhoCampus Desk" : "DekhoCampus Editorial",
      featured_image: draft.featured_image,
      views: 0,
      tags: draft.tags,
      meta_title: draft.meta_title,
      meta_description: draft.meta_description,
      meta_keywords: draft.meta_keywords,
      is_active: requestedStatus === "Published",
      created_by: userId || null,
      data_source_urls: researchSources,
      data_quality_score: quality.score,
      data_clean_state: "not_checked",
    } });
    if (draft.faqs.length) {
      await tx.faqs.createMany({ data: draft.faqs.map((faq, index) => ({
        id: randomUUID(), page: siteScope === "sarkari" ? "sarkari_articles" : "articles", item_slug: created.slug, question: faq.question, answer: faq.answer,
        display_order: (index + 1) * 10, is_active: requestedStatus === "Published",
      })) });
    }
    for (const link of uniqueLinks) {
      await tx.article_links.create({ data: { id: randomUUID(), article_id: created.id, ...link } });
    }
    return created;
  }, siteScope);
  return { success: true, article: { id: article.id, slug: article.slug, status: article.status, site_scope: siteScope }, quality, semantic_review: semantic.model, settings_id: settingsId };
}

export async function handleBlogStudio(request, userId = null) {
  const body = await request.json().catch(() => ({}));
  const siteScope = normalizeArticleSiteScope(body.site_scope);
  const profile = articleSiteProfile(siteScope);
  if (body.action === "publish") return publishBlogStudioDraft(body, userId);
  const topic = String(body.topic || "").trim();
  if (!topic) throw Object.assign(new Error("A blog topic is required"), { status: 400 });
  const existing = await loadArticleCoverage(siteScope);
  const existingTopic = findDuplicateArticleTopic({ title: topic }, existing);
  if (existingTopic) {
    throw Object.assign(new Error(`${profile.brand} already covers this topic: ${existingTopic.title}`), { status: 409, code: "DUPLICATE_ARTICLE" });
  }
  const settingsId = siteScope === "sarkari" ? "sarkari" : "default";
  const scopedSettings = await prisma.blog_auto_agent_settings.findUnique({ where: { id: settingsId } }).catch(() => null);
  const fallbackSettings = settingsId === "default" ? null : await prisma.blog_auto_agent_settings.findUnique({ where: { id: "default" } }).catch(() => null);
  const savedCover = scopedSettings || fallbackSettings;
  const editorial = normalizeBlogAgentSettings({
    ...(savedCover || {}),
    ...(siteScope === "sarkari" && !scopedSettings ? { audience: profile.audience } : {}),
    ...(body.word_limit !== undefined ? { word_limit: body.word_limit } : {}),
    ...(body.content_goals !== undefined ? { content_goals: body.content_goals } : {}),
    ...(body.required_sections !== undefined ? { required_sections: body.required_sections } : {}),
    ...(body.minimum_sources !== undefined ? { minimum_sources: body.minimum_sources } : {}),
    ...(body.editorial_quality_target !== undefined ? { editorial_quality_target: body.editorial_quality_target } : {}),
    ...(body.language !== undefined ? { language: body.language } : {}),
    ...(body.audience !== undefined ? { audience: body.audience } : {}),
    ...(body.tone !== undefined ? { tone: body.tone } : {}),
    ...(body.model ? { text_model: body.model } : {}),
  });
  const semantic = await filterSemanticallyNovelTopics([{ title: topic }], existing, editorial.text_model, "blog-studio", siteScope);
  if (!semantic.accepted.length) {
    const conflict = semantic.rejected[0] || {};
    throw Object.assign(new Error(`${profile.brand} already covers this reader intent${conflict.conflicts_with ? `: ${conflict.conflicts_with}` : ""}`), { status: 409, code: "SEMANTIC_DUPLICATE_ARTICLE" });
  }
  const image = body.image && typeof body.image === "object" ? body.image : {};
  const coverDiagnostics = {};
  const contextLogo = await resolveContextualBlogLogo(topic);
  const generated = await generateDraft({ title: topic }, { wordLimit: editorial.word_limit, editorialSettings: editorial, model: editorial.text_model, feature: "blog-studio", siteScope, cover: {
    imageMode: image.mode || savedCover?.image_mode || "none",
    templateUrl: image.template_url || savedCover?.image_template_url,
    referenceImageUrl: image.reference_image_url || image.template_url || savedCover?.image_template_url,
    promptStyle: image.prompt_style || savedCover?.image_prompt_style,
    includeLogo: image.include_logo ?? savedCover?.include_logo,
    logoUrl: image.logo_url || savedCover?.logo_url,
    contextLogoUrl: contextLogo?.url,
    contextLogoName: contextLogo?.name,
    aspectRatio: image.aspect_ratio || savedCover?.image_aspect_ratio,
    resolution: image.resolution || savedCover?.output_resolution,
    diagnostics: coverDiagnostics,
  } });
  const duplicate = findDuplicateArticleTopic(generated.draft, existing);
  if (duplicate) {
    throw Object.assign(new Error(`${profile.brand} already covers this topic: ${duplicate.title}`), { status: 409, code: "DUPLICATE_ARTICLE" });
  }
  return {
    draft: generated.draft,
    model_used: `${generated.textProvider}:${generated.model}`,
    image_model_used: coverDiagnostics.sourceMode === "generated" ? "openai" : coverDiagnostics.sourceMode || "none",
    cover_diagnostics: coverDiagnostics,
    quality: generated.quality,
    editorial_settings: editorial,
    semantic_review: semantic.model,
    research_sources: generated.research_sources,
    site_scope: siteScope,
    settings_id: settingsId,
  };
}

export async function handleArticleCover(request) {
  const body = await request.json().catch(() => ({}));
  const siteScope = normalizeArticleSiteScope(body.site_scope);
  const title = stripHtml(body.title).trim();
  if (!title) throw Object.assign(new Error("Article title is required to generate a cover"), { status: 400, code: "ARTICLE_TITLE_REQUIRED" });
  const settingsId = siteScope === "sarkari" ? "sarkari" : "default";
  const scopedSettings = await prisma.blog_auto_agent_settings.findUnique({ where: { id: settingsId } }).catch(() => null);
  const settings = scopedSettings || (settingsId === "default" ? null : await prisma.blog_auto_agent_settings.findUnique({ where: { id: "default" } }).catch(() => null));
  const diagnostics = {};
  const contextLogo = await resolveContextualBlogLogo(title);
  const featuredImage = await createBlogCover(slugify(body.slug || title) || `article-${Date.now()}`, title, {
    imageMode: "template",
    templateUrl: settings?.image_template_url || DEFAULT_BLOG_COVER_TEMPLATE_KEY,
    includeLogo: false,
    contextLogoUrl: contextLogo?.url,
    contextLogoName: contextLogo?.name,
    aspectRatio: "16:9",
    resolution: "web",
    diagnostics,
    siteScope,
  });
  return { featured_image: featuredImage, cover_title: formatBlogCoverTitle(title), cover_diagnostics: diagnostics, site_scope: siteScope, settings_id: settingsId };
}

export async function handleAiGenerate(request) {
  const body = await request.json().catch(() => ({}));
  const table = String(body.entity_type || "");
  if (table === "articles") {
    throw Object.assign(new Error("Use Editorial Blog Studio for articles so research, semantic duplicate detection, FAQs and the publishing quality gate cannot be bypassed"), { status: 409, code: "USE_EDITORIAL_BLOG_STUDIO" });
  }
  if (!schemaMetadata[table] || !["colleges", "courses", "exams", "scholarships", "career_profiles"].includes(table)) throw new Error("Unsupported entity type");
  const count = Math.min(20, Math.max(1, Number(body.count || body.names?.length || 1)));
  const fields = Object.entries(schemaMetadata[table].fields).filter(([name, meta]) => !["id", "created_at", "updated_at", "short_id"].includes(name) && !meta.ignored).map(([name, meta]) => `${name}:${meta.type}${meta.nullable ? "?" : ""}`);
  const prompt = `Generate ${count} production-ready ${table} records for DekhoCampus. Topic: ${body.topic || ""}. Exact requested names: ${JSON.stringify(body.names || [])}. Use official-source-first, conservative facts; omit uncertain values. Return {items:[...]}. Each item must use this schema: ${fields.join(", ")}. JSON fields must be arrays or objects, booleans must be booleans, slugs lowercase-hyphen. Articles must be Published and contain original HTML without competitor credits.`;
  const generated = { ...(await geminiJson(prompt, "admin-ai-generate")), provider: "gemini" };
  const { result, model } = generated;
  const rawItems = Array.isArray(result.items) ? result.items.slice(0, count) : [];
  const items = [];
  for (const raw of rawItems) {
    const item = { ...raw };
    if (schemaMetadata[table].fields.slug) item.slug = slugify(item.slug || item.name || item.title);
    const existing = item.slug ? await prisma.$queryRawUnsafe(`SELECT 1 FROM \`${table}\` WHERE \`slug\` = ? LIMIT 1`, item.slug) : [];
    items.push({ ...item, _action: existing.length ? "upsert" : "insert", _key: item.slug || item.name || item.title });
  }
  return { items, model_used: `${generated.provider}:${model}`, counts: { inserts: items.filter((item) => item._action === "insert").length, upserts: items.filter((item) => item._action === "upsert").length }, duplicate_titles_skipped: [] };
}

async function saveGeneratedArticle(topic, settings, signals, entityContext = null, existingCoverage = null) {
  const editorial = normalizeBlogAgentSettings(settings);
  const siteScope = "dekhocampus";
  const topicTitle = String(topic?.title || topic).trim();
  const existing = existingCoverage || await loadArticleCoverage(siteScope);
  if (findDuplicateArticleTopic(topic, existing)) return null;
  const schedule = entityContext?.schedule || null;
  const contextLogo = await resolveContextualBlogLogo(topicTitle, entityContext);
  const generated = await generateDraft(topic, {
    wordLimit: editorial.word_limit,
    signals,
    requiredTitle: topicTitle,
    editorialSettings: editorial,
    model: editorial.text_model,
    feature: "blog-agent",
    siteScope,
    cover: {
      imageMode: editorial.image_mode,
      templateUrl: editorial.image_template_url,
      referenceImageUrl: editorial.image_template_url,
      promptStyle: editorial.image_prompt_style,
      includeLogo: editorial.include_logo,
      logoUrl: editorial.logo_url,
      contextLogoUrl: contextLogo?.url,
      contextLogoName: contextLogo?.name,
      aspectRatio: editorial.image_aspect_ratio,
      resolution: editorial.output_resolution,
    },
  });
  const draft = generated.draft;
  if (findDuplicateArticleTopic(draft, existing)) return null;
  const shouldReview = editorial.human_review_required || editorial.publish_status === "Draft";
  const status = shouldReview ? "Draft" : "Published";
  const selectedAuthors = editorial.author_ids.length
    ? await prisma.authors.findMany({
      where: { id: { in: editorial.author_ids }, is_active: true },
      select: { id: true, name: true },
    })
    : [];
  const orderedAuthors = editorial.author_ids.flatMap((id) => {
    const author = selectedAuthors.find((candidate) => candidate.id === id);
    return author ? [author] : [];
  });
  let selectedAuthor = null;
  let nextAuthorIndex = editorial.last_author_index || 0;
  if (editorial.author_mode === "single") selectedAuthor = orderedAuthors[0] || null;
  if (editorial.author_mode === "round_robin" && orderedAuthors.length) {
    nextAuthorIndex = (Math.max(-1, Number(editorial.last_author_index) || -1) + 1) % orderedAuthors.length;
    selectedAuthor = orderedAuthors[nextAuthorIndex];
  }
  let article;
  try {
    article = await withArticleWriteLock(async (tx) => {
      await assertArticleTopicsAvailable([draft], { client: tx, siteScope });
      const created = await tx.articles.create({ data: {
        id: randomUUID(), site_scope: siteScope, status,
        title: String(draft.title || topic), slug: draft.slug, description: String(draft.description || ""), content: String(draft.content_html || ""), vertical: "General", category: String(draft.category || "Education"), author: selectedAuthor?.name || "DekhoCampus Editorial", author_id: selectedAuthor?.id || null, featured_image: draft.featured_image || "", views: 0, tags: [...new Set([...(draft.tags || []), "auto-blog-agent", ...(topic?.trend_based === true ? ["google-trends-daily"] : []), ...(schedule ? ["entity-article-agent", schedule.entity_type, schedule.entity_slug] : [])])], meta_title: String(draft.meta_title || draft.title || topic), meta_description: String(draft.meta_description || draft.description || ""), meta_keywords: String(draft.meta_keywords || ""), is_active: status === "Published", data_source_urls: generated.research_sources, data_quality_score: generated.quality.score, data_clean_state: "not_checked",
      } });
      if (draft.faqs.length) {
        await tx.faqs.createMany({ data: draft.faqs.map((faq, index) => ({ id: randomUUID(), page: "articles", item_slug: created.slug, question: faq.question, answer: faq.answer, display_order: (index + 1) * 10, is_active: status === "Published" })) });
      }
      if (schedule) {
        await tx.article_links.create({ data: { id: randomUUID(), article_id: created.id, entity_type: schedule.entity_type.replace(/s$/, ""), entity_slug: schedule.entity_slug } });
        await tx.entity_article_publications.create({ data: { id: randomUUID(), schedule_id: schedule.id, article_id: created.id, entity_type: schedule.entity_type, entity_slug: schedule.entity_slug, topic_kind: "researched_update", generated_for_date: new Date() } });
      }
      if (editorial.author_mode === "round_robin" && selectedAuthor) {
        await tx.blog_auto_agent_settings.update({ where: { id: "default" }, data: { last_author_index: nextAuthorIndex } }).catch(() => null);
      }
      return created;
    }, siteScope);
  } catch (error) {
    if (error?.code === "DUPLICATE_ARTICLE") return null;
    throw error;
  }
  if (!article) return null;
  if (existingCoverage) existingCoverage.unshift({
    id: article.id,
    slug: article.slug,
    title: article.title,
    description: article.description,
    meta_keywords: article.meta_keywords,
    tags: article.tags,
  });
  return article.id;
}

class RunControlError extends Error {
  constructor(status) {
    super(`Blog run ${status}`);
    this.code = "BLOG_RUN_CONTROLLED";
    this.status = status;
  }
}

async function assertRunActive(runId, executionToken) {
  const run = await prisma.blog_auto_agent_runs.findUnique({ where: { id: runId }, select: { status: true, control_note: true } });
  if (!run) throw new RunControlError("missing");
  if (run.status !== "running") throw new RunControlError(run.status);
  if (run.control_note !== executionToken) throw new RunControlError("superseded");
}

async function controlBlogRun(body) {
  const runId = String(body.run_id || "").trim();
  if (!runId) throw Object.assign(new Error("run_id is required"), { status: 400 });
  const run = await prisma.blog_auto_agent_runs.findUnique({ where: { id: runId } });
  if (!run) throw Object.assign(new Error("Blog-agent run not found"), { status: 404 });
  const now = new Date();
  if (body.action === "pause") {
    if (run.status !== "running") throw Object.assign(new Error(`Only a running task can be paused (current: ${run.status})`), { status: 409 });
    await prisma.blog_auto_agent_runs.update({ where: { id: runId }, data: { status: "paused", paused_at: now, current_step: "Paused by administrator", control_note: `paused:${randomUUID()}` } });
    return { success: true, run_id: runId, status: "paused" };
  }
  if (body.action === "cancel" || body.action === "abort") {
    if (!["running", "paused", "cancelling"].includes(run.status)) throw Object.assign(new Error(`Task is already ${run.status}`), { status: 409 });
    const status = body.action === "abort" ? "aborted" : "cancelled";
    await prisma.blog_auto_agent_runs.update({ where: { id: runId }, data: {
      status, finished_at: now, current_step: status === "aborted" ? "Aborted immediately by administrator" : "Cancelled safely by administrator",
      ...(status === "aborted" ? { aborted_at: now } : { cancelled_at: now }), control_note: `${status}:${randomUUID()}`,
    } });
    return { success: true, run_id: runId, status };
  }
  if (body.action === "resume") {
    if (run.status !== "paused") throw Object.assign(new Error(`Only a paused task can be resumed (current: ${run.status})`), { status: 409 });
    return runBlogAgent({ trigger_type: run.trigger_type || "manual", resume_run_id: runId });
  }
  throw Object.assign(new Error("Unsupported blog-agent action"), { status: 400 });
}

async function entityRunContext(body, settings) {
  if (body.mode !== "entity_schedule") return null;
  const scheduleId = String(body.schedule_id || "").trim();
  if (!scheduleId) throw Object.assign(new Error("schedule_id is required"), { status: 400 });
  const schedule = await prisma.entity_article_schedules.findUnique({ where: { id: scheduleId } });
  if (!schedule) throw Object.assign(new Error("Entity article schedule not found"), { status: 404 });
  if (!schedule.enabled && body.trigger_type === "schedule") return { skipped: true, message: "Entity article schedule is paused", schedule };
  if (body.trigger_type === "schedule" && schedule.next_run_at > new Date()) return { skipped: true, message: "Entity article schedule is not due yet", schedule };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60_000);
  const completed = await prisma.entity_article_publications.count({ where: { schedule_id: schedule.id, generated_for_date: { gte: today, lt: tomorrow } } });
  const remaining = Math.max(0, Math.min(10, Number(schedule.articles_per_day || 1)) - completed);
  if (!remaining) return { skipped: true, message: "Daily article target already reached", schedule };
  const table = { college: "colleges", course: "courses", exam: "exams" }[schedule.entity_type];
  if (!table) throw new Error(`Unsupported entity schedule type: ${schedule.entity_type}`);
  const entity = await prisma[table].findFirst({ where: { slug: schedule.entity_slug } });
  if (!entity) throw new Error(`${schedule.entity_type} ${schedule.entity_slug} no longer exists`);
  return {
    schedule,
    entity,
    postCount: body.generate_remaining_today ? remaining : 1,
    settings: { ...settings, publish_status: schedule.publish_status, human_review_required: schedule.human_review_required },
  };
}

export async function runBlogAgent(body = {}) {
  if (body.action) return controlBlogRun(body);
  await assertAiEnabled("blog-agent");
  const storedSettings = await prisma.blog_auto_agent_settings.findUnique({ where: { id: "default" } });
  if (!storedSettings) throw new Error("Auto Blog Agent settings are missing");
  let settings = normalizeBlogAgentSettings(storedSettings);
  const triggerType = body.trigger_type || "manual";
  const entityContext = await entityRunContext(body, settings);
  if (entityContext?.skipped) return { skipped: true, message: entityContext.message, schedule_id: entityContext.schedule.id };
  if (entityContext) settings = normalizeBlogAgentSettings(entityContext.settings);
  if (!entityContext && triggerType === "schedule" && !settings.enabled) return { skipped: true, message: "Blog auto agent is disabled" };
  if (!entityContext && triggerType === "schedule" && settings.next_run_at && settings.next_run_at > new Date()) return { skipped: true, message: "Next run time has not arrived yet", next_run_at: settings.next_run_at };
  const interval = settings.interval_minutes;
  const dailyCap = settings.daily_post_cap;
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const todayCount = await prisma.$queryRawUnsafe("SELECT COUNT(*) AS total FROM `articles` WHERE `site_scope` = 'dekhocampus' AND `created_at` >= ? AND JSON_CONTAINS(`tags`, JSON_QUOTE('auto-blog-agent'))", dayStart);
  const remaining = Math.max(0, dailyCap - Number(todayCount[0]?.total || 0));
  if (!remaining) return { skipped: true, message: "Daily post cap reached", count: dailyCap };
  const postCount = Math.min(MAX_POSTS_PER_RUN, remaining, entityContext?.postCount || Math.max(1, Number(settings.posts_per_run || 1)));
  const todayTrendCount = !entityContext && settings.google_trends_daily_enabled
    ? await prisma.$queryRawUnsafe("SELECT COUNT(*) AS total FROM `articles` WHERE `site_scope` = 'dekhocampus' AND `created_at` >= ? AND JSON_CONTAINS(`tags`, JSON_QUOTE('google-trends-daily'))", dayStart)
    : [{ total: 0 }];
  const trendPostsDue = !entityContext && settings.google_trends_daily_enabled
    ? Math.min(postCount, Math.max(0, settings.google_trends_daily_posts - Number(todayTrendCount[0]?.total || 0)))
    : 0;
  const running = await prisma.blog_auto_agent_runs.findFirst({ where: { status: "running", ...(body.resume_run_id ? { NOT: { id: body.resume_run_id } } : {}) }, select: { id: true } });
  if (running) return { skipped: true, message: "Another blog run is already active", run_id: running.id };
  const executionToken = `executor:${randomUUID()}`;
  const run = body.resume_run_id
    ? await prisma.blog_auto_agent_runs.update({ where: { id: body.resume_run_id }, data: { status: "running", resumed_at: new Date(), finished_at: null, message: "Resumed", current_step: "Resuming education research", control_note: executionToken } })
    : await prisma.blog_auto_agent_runs.create({ data: { id: randomUUID(), status: "running", trigger_type: triggerType, interval_minutes: interval, model_provider: blogTextProvider(settings.text_model), word_limit: settings.word_limit, sources: [], selected_topics: [], created_article_ids: [], message: "Researching", progress: 5, current_step: "Researching education signals", estimated_seconds: postCount * 180, completed_steps: 0, total_steps: postCount * 2 + 1, control_note: executionToken, entity_schedule_id: entityContext?.schedule.id || null, agent_mode: entityContext ? "entity_schedule" : "general" } });
  try {
    const signals = await researchSignals(Math.max(4, settings.minimum_sources), "dekhocampus");
    await assertRunActive(run.id, executionToken);
    const recent = await loadArticleCoverage("dekhocampus");
    const entityInstruction = entityContext
      ? `Generate only for this ${entityContext.schedule.entity_type}: ${JSON.stringify({ name: entityContext.schedule.entity_name, slug: entityContext.schedule.entity_slug, facts: entityContext.entity, topic_focus: entityContext.schedule.topic_focus })}. Prefer a timely verified update; otherwise create an evergreen student guide. Every topic must be specifically useful for this entity.`
      : "Cover the strongest Indian education opportunities across admissions, exams, counselling, scholarships, careers and college decisions.";
    const hasTrendSignal = signals.some((source) => /google trends/i.test(String(source.name || "")));
    const trendInstruction = trendPostsDue && hasTrendSignal
      ? `Prioritize ${trendPostsDue} proposal(s) supported by the Google Trends signal and mark only those proposals trend_based=true. A trend alone is not enough: it still needs a precise student intent, reliable evidence and material novelty. Never label an unsupported topic as trend based.`
      : "Set trend_based=false for every proposal.";
    // The local semantic gate still compares against all loaded articles. The
    // model only needs a representative recent sample to avoid costly retries.
    const promptCoverage = [...new Set(recent.map(compactArticleCoverage).filter(Boolean))]
      .slice(0, MAX_TOPIC_PROMPT_FINGERPRINTS);
    const topics = [];
    const comparedCoverage = [...recent];
    const rejected = [];
    for (let round = 1; round <= 3 && topics.length < postCount; round += 1) {
      const rejectedInstruction = rejected.length
        ? `These suggestions were rejected as too similar to existing coverage; propose materially different student questions and angles: ${JSON.stringify(rejected.slice(-20))}.`
        : "";
      const suggestionCount = Math.min(8, Math.max(postCount * 2, 6));
      const { result } = await blogTextJson(`Using these private official/public/competitor-gap signals ${JSON.stringify(signals)}, propose ${suggestionCount} original Indian education article opportunities. ${entityInstruction} ${trendInstruction} Existing DekhoCampus subject + intent fingerprints to avoid: ${JSON.stringify(promptCoverage)}. ${rejectedInstruction} Use competitor material only to identify coverage gaps; never copy, cite, link, name, or credit it. Select named exams, institutions, authorities, deadlines, decisions or high-intent student questions with current evidence. Reject vague regional roundups, generic advice, speculative future-year topics and angles that merely restate an announcement. A changed word order or headline is not a new topic. Each proposal needs one primary entity, one precise search intent, and a non-empty unique value that is materially absent from existing coverage. Each title must be complete, specific, factual, roughly 55-85 characters, free of ellipses or trailing punctuation, and substantially different from every avoided fingerprint. Never truncate a title for cover artwork.`, "blog-agent", {
        model: settings.text_model,
        reasoningEffort: "low",
        thinkingLevel: "minimal",
        maxOutputTokens: 1200,
        siteScope: "dekhocampus",
        responseSchema: {
          type: "OBJECT",
          properties: {
            topics: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING" },
                  angle: { type: "STRING" },
                  search_intent: { type: "STRING" },
                  primary_entity: { type: "STRING" },
                  unique_value: { type: "STRING" },
                  category: { type: "STRING" },
                  tags: { type: "ARRAY", items: { type: "STRING" } },
                  trend_based: { type: "BOOLEAN" },
                },
                required: ["title", "angle", "search_intent", "primary_entity", "unique_value", "trend_based"],
              },
            },
          },
          required: ["topics"],
        },
      });
      await assertRunActive(run.id, executionToken);
      const locallyNovel = [];
      for (const topic of normalizeTopicSuggestions(result)) {
        const duplicate = findDuplicateArticleTopic(topic, comparedCoverage);
        if (duplicate) {
          rejected.push({ suggested: topic.title, conflicts_with: duplicate.title });
          continue;
        }
        locallyNovel.push(topic);
      }
      const semantic = await filterSemanticallyNovelTopics(locallyNovel, comparedCoverage, settings.text_model, "blog-agent");
      rejected.push(...semantic.rejected);
      const rankedTopics = trendPostsDue
        ? [...semantic.accepted].sort((left, right) => Number(right.trend_based === true) - Number(left.trend_based === true))
        : semantic.accepted;
      for (const topic of rankedTopics) {
        topics.push(topic);
        comparedCoverage.push({ ...topic, slug: slugify(topic.title) });
        if (topics.length >= postCount) break;
      }
    }
    if (!topics.length) throw new Error(`The configured text model returned no usable non-duplicate article topics after three structured research attempts (${rejected.length} duplicate suggestions rejected). Review the active research sources and try again.`);
    await prisma.blog_auto_agent_runs.update({ where: { id: run.id }, data: { progress: 30, current_step: `Writing ${topics.length} article(s)`, selected_topics: topics, sources: signals.map(({ signal, ...source }) => source) } });
    const ids = [];
    for (const topic of topics) {
      await assertRunActive(run.id, executionToken);
      const id = await saveGeneratedArticle(topic, settings, signals, entityContext, recent);
      await assertRunActive(run.id, executionToken);
      if (id) ids.push(id);
    }
    const nextRun = new Date(Date.now() + interval * 60_000);
    if (entityContext) {
      const scheduleNextRun = new Date(Date.now() + Math.max(MIN_INTERVAL_MINUTES, Number(entityContext.schedule.interval_minutes || 1440)) * 60_000);
      await prisma.entity_article_schedules.update({ where: { id: entityContext.schedule.id }, data: { last_run_at: new Date(), next_run_at: scheduleNextRun, last_status: ids.length ? "completed" : "skipped", last_message: ids.length ? `Created ${ids.length} article(s)` : "No new non-duplicate topic was available" } });
    } else {
      await prisma.blog_auto_agent_settings.update({ where: { id: "default" }, data: { interval_minutes: interval, daily_post_cap: dailyCap, posts_per_run: Math.min(MAX_POSTS_PER_RUN, settings.posts_per_run), last_run_at: new Date(), next_run_at: nextRun } });
    }
    const actionLabel = settings.human_review_required || settings.publish_status === "Draft" ? "Created for review" : "Published";
    await prisma.blog_auto_agent_runs.update({ where: { id: run.id }, data: { status: "completed", progress: 100, current_step: "Completed", completed_steps: topics.length * 2 + 1, finished_at: new Date(), created_article_ids: ids, message: `${actionLabel} ${ids.length} article(s); ${rejected.length} duplicate topic(s) rejected` } });
    return { success: true, created_article_ids: ids, topics, duplicate_topics_rejected: rejected, next_run_at: nextRun, run_id: run.id, schedule_id: entityContext?.schedule.id || null };
  } catch (error) {
    if (error?.code === "BLOG_RUN_CONTROLLED") return { success: true, run_id: run.id, status: error.status, message: error.message };
    await prisma.blog_auto_agent_runs.update({ where: { id: run.id }, data: { status: "failed", progress: 100, current_step: "Failed", finished_at: new Date(), message: String(error?.message || error).slice(0, 2000) } });
    if (entityContext) await prisma.entity_article_schedules.update({ where: { id: entityContext.schedule.id }, data: { last_status: "failed", last_message: String(error?.message || error).slice(0, 500) } });
    throw error;
  }
}

let workerTimer;
let workerBusy = false;
export async function startBlogAgentWorker() {
  await prisma.blog_auto_agent_runs.updateMany({ where: { status: "running" }, data: { status: "failed", progress: 100, current_step: "Interrupted by process restart", finished_at: new Date(), message: "This run was interrupted by a Node process restart. Start a new run or resume it from the admin controls." } });
  const tick = async () => {
    if (workerBusy) return;
    workerBusy = true;
    try {
      const dueEntity = await prisma.entity_article_schedules.findFirst({ where: { enabled: true, next_run_at: { lte: new Date() } }, orderBy: { next_run_at: "asc" }, select: { id: true } });
      if (dueEntity) await runBlogAgent({ trigger_type: "schedule", mode: "entity_schedule", schedule_id: dueEntity.id });
      await runBlogAgent({ trigger_type: "schedule" });
    } catch (error) { if (error?.code !== "GEMINI_NOT_CONFIGURED") console.error("Blog agent schedule failed", error); } finally { workerBusy = false; }
  };
  workerTimer = setInterval(() => void tick(), 15 * 60_000);
  workerTimer.unref?.();
  setTimeout(() => void tick(), 60_000).unref?.();
}

export function stopBlogAgentWorker() {
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = undefined;
}

export const blogLimits = { MAX_POSTS_PER_RUN, MAX_DAILY_POSTS, MIN_INTERVAL_MINUTES };
