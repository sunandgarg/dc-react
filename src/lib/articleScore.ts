import { visibleArticleText } from "@/lib/articleEditor";

export type ArticleScoreStatus = "pass" | "warn" | "fail";

export type ArticleScoreCheck = {
  key: string;
  label: string;
  status: ArticleScoreStatus;
  weight: number;
  detail: string;
  fix?: string;
};

export type ArticleScoreCategory = {
  score: number;
  checks: ArticleScoreCheck[];
};

export type ArticleScoreFaq = { question?: string | null; answer?: string | null };

export type ArticleScoreInput = {
  title?: string | null;
  slug?: string | null;
  description?: string | null;
  content?: string | null;
  content_html?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  primary_keyword?: string | null;
  author?: string | null;
  author_id?: string | null;
  updated_at?: string | null;
  faqs?: ArticleScoreFaq[];
  faqsLoaded?: boolean;
};

export type ArticleScoreReport = {
  targetKeyword: string;
  targetKeywordSource: "explicit" | "meta keywords" | "title-derived" | "missing";
  wordCount: number;
  seo: ArticleScoreCategory;
  aeo: ArticleScoreCategory;
  geo: ArticleScoreCategory;
  overall: number;
};

const TITLE_MIN = 35;
const TITLE_MAX = 60;
const DESCRIPTION_MIN = 100;
const DESCRIPTION_MAX = 155;
const DIRECT_ANSWER_MIN = 40;
const DIRECT_ANSWER_MAX = 60;
const HUMAN_BANNED_TERMS = [
  "delve", "foster", "harness", "leverage", "empower", "elevate", "streamline", "showcase", "navigate", "underscore", "demystify", "unravel", "augment",
  "crucial", "robust", "pivotal", "multifaceted", "bespoke", "transformative", "seamless", "dynamic", "quintessential", "nuanced", "overarching", "comprehensive", "holistic",
  "tapestry", "landscape", "realm", "ecosystem", "paradigm", "furthermore", "moreover", "additionally", "nevertheless", "consequently", "henceforth", "in tandem with",
  "it is worth noting that", "it is important to remember", "one might argue that", "in today's digital age", "at the end of the day", "a testament to", "in conclusion", "ultimately", "to summarize", "game-changer", "dive in", "unlock the power", "beacon", "vital role", "firstly", "secondly", "in summary",
];
const STOP_WORDS = new Set(["a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with", "without", "how", "what", "when", "where", "which", "why", "should", "can", "your", "you"]);

const normalize = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim();
const lower = (value: unknown) => normalize(value).toLowerCase();
const wordCount = (value: string) => (value.match(/[A-Za-z0-9][A-Za-z0-9'/-]*/g) || []).length;
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const countPhrase = (text: string, phrase: string) => phrase ? (text.match(new RegExp(escapeRegExp(phrase), "gi")) || []).length : 0;
const htmlText = (value: unknown) => visibleArticleText(normalize(value));
const rawHtml = (input: ArticleScoreInput) => String(input.content_html || input.content || "").trim();
const html = (input: ArticleScoreInput) => normalize(rawHtml(input));

function makeCheck(key: string, label: string, status: ArticleScoreStatus, weight: number, detail: string, fix?: string): ArticleScoreCheck {
  return { key, label, status, weight, detail, ...(fix ? { fix } : {}) };
}

function scoreChecks(checks: ArticleScoreCheck[]): ArticleScoreCategory {
  const possible = checks.reduce((total, check) => total + check.weight, 0);
  const earned = checks.reduce((total, check) => total + check.weight * (check.status === "pass" ? 1 : check.status === "warn" ? 0.5 : 0), 0);
  return { score: possible ? Math.round((earned / possible) * 100) : 0, checks };
}

function resolveTargetKeyword(input: ArticleScoreInput): Pick<ArticleScoreReport, "targetKeyword" | "targetKeywordSource"> {
  const explicit = normalize(input.primary_keyword);
  if (explicit) return { targetKeyword: explicit, targetKeywordSource: "explicit" };
  const metaKeyword = normalize(input.meta_keywords).split(",").map((value) => value.trim()).find(Boolean);
  if (metaKeyword) return { targetKeyword: metaKeyword, targetKeywordSource: "meta keywords" };
  const derived = normalize(input.title).toLowerCase().split(/[^a-z0-9]+/).filter((word) => word && !STOP_WORDS.has(word)).slice(0, 4).join(" ");
  return derived ? { targetKeyword: derived, targetKeywordSource: "title-derived" } : { targetKeyword: "", targetKeywordSource: "missing" };
}

function parseContent(value: string) {
  const headings = [...value.matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((match) => ({ level: Number(match[1]), text: htmlText(match[2]) }));
  const paragraphs = [...value.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => htmlText(match[1])).filter(Boolean);
  const h2Sections = [...value.matchAll(/<h2\b[^>]*>([\s\S]*?)(?:<\/h2>)([\s\S]*?)(?=<h2\b|$)/gi)].map((match) => ({ heading: htmlText(match[1]), body: match[2] }));
  const answerParagraphs = h2Sections
    .filter((section) => !/faq|frequently asked questions|common questions/i.test(section.heading))
    .map((section) => wordCount(htmlText(section.body.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "")))
    .filter((count) => count > 0);
  const links = [...value.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  const internalLinks = links.filter((href) => href.startsWith("/") || href.startsWith("#")).length;
  const externalLinks = links.filter((href) => /^https?:\/\//i.test(href)).length;
  const visible = htmlText(value);
  return { headings, paragraphs, answerParagraphs, internalLinks, externalLinks, visible };
}

export function scoreArticleForEditor(input: ArticleScoreInput = {}): ArticleScoreReport {
  const content = html(input);
  const parsed = parseContent(content);
  const title = normalize(input.title);
  const description = htmlText(input.description);
  const metaTitle = normalize(input.meta_title);
  const metaDescription = normalize(input.meta_description);
  const slug = normalize(input.slug);
  const target = resolveTargetKeyword(input);
  const targetLower = lower(target.targetKeyword);
  const bodyLower = lower(parsed.visible);
  const first100Lower = lower((parsed.visible.match(/[A-Za-z0-9][A-Za-z0-9'/-]*/g) || []).slice(0, 100).join(" "));
  const phraseCount = countPhrase(bodyLower, targetLower);
  const bannedHits = HUMAN_BANNED_TERMS.filter((term) => bodyLower.includes(term));
  const hasRawMarkdown = /(?:^|\n)\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s)|\*\*|__|(?:^|\n)\s*\|[^\n]+\|/m.test(rawHtml(input));
  const questionHeadings = parsed.headings.filter((heading) => /\?|^(what|why|how|when|where|which|can|should|do|does|is|are)\b/i.test(heading.text));
  const faqItems = Array.isArray(input.faqs) ? input.faqs.filter((faq) => normalize(faq.question) && normalize(faq.answer)) : [];
  const faqParity = faqItems.length > 0 && faqItems.every((faq) => bodyLower.includes(lower(faq.question)) && bodyLower.includes(lower(faq.answer)));

  const seo = scoreChecks([
    makeCheck("seo-meta-title", "Meta title length", metaTitle.length >= TITLE_MIN && metaTitle.length <= TITLE_MAX ? "pass" : metaTitle.length >= 25 && metaTitle.length <= 70 ? "warn" : "fail", 12, `${metaTitle.length}/60 characters`, `Keep the meta title between ${TITLE_MIN} and ${TITLE_MAX} characters.`),
    makeCheck("seo-meta-description", "Meta description length", metaDescription.length >= DESCRIPTION_MIN && metaDescription.length <= DESCRIPTION_MAX ? "pass" : metaDescription.length >= 80 && metaDescription.length <= 180 ? "warn" : "fail", 12, `${metaDescription.length}/155 characters`, `Keep the meta description between ${DESCRIPTION_MIN} and ${DESCRIPTION_MAX} characters.`),
    makeCheck("seo-keyword", "Target phrase placement", targetLower && metaTitle.toLowerCase().includes(targetLower) && first100Lower.includes(targetLower) && phraseCount >= 3 && phraseCount <= 5 ? "pass" : targetLower && (metaTitle.toLowerCase().includes(targetLower) || first100Lower.includes(targetLower)) ? "warn" : "fail", 14, target.targetKeyword ? `${target.targetKeyword} appears ${phraseCount} time${phraseCount === 1 ? "" : "s"}; source: ${target.targetKeywordSource}` : "No target phrase available", "Add one primary phrase in Meta Keywords, place it in the meta title and opening, then use it naturally 3-5 times."),
    makeCheck("seo-title", "Article title", title.length >= 45 && title.length <= 95 ? "pass" : title.length >= 30 ? "warn" : "fail", 8, `${title.length} characters`, "Use a specific, descriptive title that matches the article intent."),
    makeCheck("seo-slug", "Readable URL slug", /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 ? "pass" : "fail", 8, slug || "Missing slug", "Use lowercase words separated by hyphens."),
    makeCheck("seo-headings", "Semantic heading hierarchy", parsed.headings.length >= 3 && !/<h1\b/i.test(content) ? "pass" : parsed.headings.length > 0 ? "warn" : "fail", 10, `${parsed.headings.length} H2/H3 headings; H1 inside body: ${/<h1\b/i.test(content) ? "yes" : "no"}`, "Use descriptive H2/H3 headings and keep the page title as the only H1."),
    makeCheck("seo-links", "Internal linking", parsed.internalLinks >= 3 ? "pass" : parsed.internalLinks > 0 ? "warn" : "fail", 8, `${parsed.internalLinks} internal link${parsed.internalLinks === 1 ? "" : "s"}`, "Add at least three relevant, verified DekhoCampus internal links."),
    makeCheck("seo-depth", "Content depth", parsed.visible.length ? wordCount(parsed.visible) >= 550 ? "pass" : wordCount(parsed.visible) >= 350 ? "warn" : "fail" : "fail", 10, `${wordCount(parsed.visible)} visible words`, "Add enough original detail to answer the reader's decision, not filler."),
    makeCheck("seo-markdown", "Clean HTML output", hasRawMarkdown ? "fail" : "pass", 8, hasRawMarkdown ? "Markdown markers detected" : "No raw Markdown markers", "Use semantic HTML instead of Markdown syntax."),
    makeCheck("seo-banned-language", "Human editorial language", bannedHits.length === 0 ? "pass" : "fail", 10, bannedHits.length ? `Blocked wording: ${bannedHits.slice(0, 4).join(", ")}` : "No blocked corporate or AI-cliché wording", "Replace blocked buzzwords with concrete, plain language."),
  ]);

  const aeo = scoreChecks([
    makeCheck("aeo-opening", "Answer near the opening", parsed.paragraphs.length > 0 && wordCount(parsed.paragraphs[0]) >= 20 && wordCount(parsed.paragraphs[0]) <= 90 ? "pass" : parsed.paragraphs.length > 0 ? "warn" : "fail", 16, parsed.paragraphs.length ? `${wordCount(parsed.paragraphs[0])} words in the opening paragraph` : "No opening paragraph", "Answer the search intent in the first two or three sentences."),
    makeCheck("aeo-h2-answers", "Direct answers under H2s", parsed.answerParagraphs.length > 0 && parsed.answerParagraphs.every((count) => count >= DIRECT_ANSWER_MIN && count <= DIRECT_ANSWER_MAX) ? "pass" : parsed.answerParagraphs.length > 0 ? "warn" : "fail", 18, parsed.answerParagraphs.length ? `${parsed.answerParagraphs.join(", ")} words in first paragraphs` : "No prose-led H2 answer paragraphs", `Keep the first paragraph under each prose-led H2 around ${DIRECT_ANSWER_MIN}-${DIRECT_ANSWER_MAX} words.`),
    makeCheck("aeo-question-headings", "Question-led extraction points", questionHeadings.length >= 2 ? "pass" : questionHeadings.length === 1 ? "warn" : "fail", 12, `${questionHeadings.length} question-style heading${questionHeadings.length === 1 ? "" : "s"}`, "Use clear question or decision headings where they match the reader's intent."),
    makeCheck("aeo-lists", "Scannable lists", /<(?:ul|ol)\b/i.test(content) ? "pass" : "warn", 10, /<(?:ul|ol)\b/i.test(content) ? "Lists found" : "No semantic list found", "Use a list for real steps, statistics, features, or checks when it improves scanning."),
    makeCheck("aeo-faq", "Visible FAQ answers", input.faqsLoaded === false ? "warn" : faqParity && faqItems.length >= 4 ? "pass" : faqItems.length ? "fail" : "warn", 12, input.faqsLoaded === false ? "FAQ records are edited separately; verify them before publishing" : faqItems.length ? `${faqItems.length} FAQs; visible parity: ${faqParity ? "yes" : "no"}` : "No FAQ data supplied", "Keep 4-8 topic-specific FAQ answers visible in the article when the article contract requires them."),
    makeCheck("aeo-prompt-residue", "No prompt residue", /^(?:answer\s*first|answer|executive\s+summary)\s*:/i.test(parsed.visible) ? "fail" : "pass", 10, "Opening does not expose a writing instruction", "Start with the answer, not a label such as 'Answer first:'."),
    makeCheck("aeo-table", "Structured comparison", /<table\b/i.test(content) && /<th\b/i.test(content) ? "pass" : "warn", 8, /<table\b/i.test(content) ? "Labelled table found" : "No labelled comparison table", "Add a labelled table only when it clarifies a real comparison or decision."),
    makeCheck("aeo-clean-text", "No long dash or AI-process wording", !/[\u2013\u2014]/.test(parsed.visible) && !/\b(?:as an ai|language model|ai[- ]generated|ai detector)\b/i.test(parsed.visible) ? "pass" : "fail", 6, "Reader-facing copy is free of internal process language", "Remove AI-process wording and unsupported typography from publishable text."),
  ]);

  const geo = scoreChecks([
    makeCheck("geo-entities", "Clear entities and intent", title && parsed.visible.length >= 300 && /\b(?:20\d{2}|19\d{2})\b/.test(`${title} ${parsed.visible}`) ? "pass" : title ? "warn" : "fail", 14, title ? "Title and article body are present" : "Missing article title", "Name the exam, institution, audience, and time context plainly."),
    makeCheck("geo-self-contained", "Self-contained answer passages", parsed.answerParagraphs.filter((count) => count >= 35).length >= 2 ? "pass" : parsed.answerParagraphs.length ? "warn" : "fail", 16, `${parsed.answerParagraphs.filter((count) => count >= 35).length} answer-ready passages`, "Make key passages understandable without requiring a reader to open another page."),
    makeCheck("geo-information-gain", "Evidence-backed information gain", /<(?:ul|ol|table)\b/i.test(content) && /\b(?:because|before|after|check|verify|eligib|fee|date|rule)\b/i.test(parsed.visible) ? "pass" : "warn", 14, "Concrete decision detail detected", "Add a named authority fact, practical comparison, or evidence-backed decision detail."),
    makeCheck("geo-citation-ready", "Extractable HTML", parsed.headings.length >= 3 && /<(?:p|ul|ol|table)\b/i.test(content) ? "pass" : "fail", 14, "Headings and semantic content blocks are available", "Use clean paragraphs, headings, lists, and labelled tables."),
    makeCheck("geo-author", "Authorship signal", normalize(input.author) || normalize(input.author_id) ? "pass" : "warn", 10, normalize(input.author) || normalize(input.author_id) ? "Author profile supplied" : "No author profile supplied", "Select the real author profile before publishing."),
    makeCheck("geo-freshness", "Freshness signal", normalize(input.updated_at) ? "pass" : "warn", 8, normalize(input.updated_at) ? "Updated timestamp available" : "Updated timestamp is added on save", "Confirm time-sensitive facts and publish with an updated date."),
    makeCheck("geo-duplicate-safety", "No visible source leakage", !/https?:\/\/|www\.|according to|as reported by/i.test(parsed.visible) ? "pass" : "fail", 12, "No source URL or attribution leakage detected", "Keep private research out of publishable copy and use verified internal links only."),
    makeCheck("geo-faq", "Question and answer coverage", faqParity || (input.faqsLoaded === false && /faq|frequently asked questions/i.test(parsed.visible)) ? "pass" : "warn", 12, faqParity ? "FAQ questions and answers are mirrored" : "FAQ coverage needs a final review", "Keep reader questions and answers visible for AI extraction and users."),
  ]);

  return {
    ...target,
    wordCount: wordCount(parsed.visible),
    seo,
    aeo,
    geo,
    overall: Math.round((seo.score * 0.4) + (aeo.score * 0.3) + (geo.score * 0.3)),
  };
}
