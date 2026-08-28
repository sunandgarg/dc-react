import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma, schemaMetadata } from "./db.mjs";
import { uploadStorageObject } from "./storage.mjs";
import { toPublicMediaUrls, toStoredMediaKeys } from "./media-values.mjs";

const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1";
const MAX_POSTS_PER_RUN = 10;
const MAX_DAILY_POSTS = 48;
const MIN_INTERVAL_MINUTES = 30;
const GEMINI_MAX_RETRIES = 4;
const GEMINI_MAX_RETRY_DELAY_MS = 30_000;
const MAX_COVER_SOURCE_BYTES = 20 * 1024 * 1024;

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
const stripCompetitorCredits = (value) => String(value || "")
  .replace(/<h[1-6][^>]*>\s*(sources?|references?|citations?)[\s\S]*$/i, "")
  .replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*(collegedunia|collegedekho|shiksha|careers360|kollegeapply|getmyuni|pagalguy)(?:(?!<\/p>)[\s\S])*<\/p>/gi, "")
  .replace(/[\u2013\u2014]/g, "-")
  .trim();

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
    promptStyle: String(options.promptStyle || "Premium editorial, clean, credible, student-focused").trim().slice(0, 600),
    includeLogo: Boolean(options.includeLogo),
    logoUrl: String(options.logoUrl || "").trim(),
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

export async function createLocalEditorialCover(prompt, options) {
  const words = stripHtml(prompt).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = `${line} ${word}`.trim();
    if (candidate.length > 28 && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
    if (lines.length === 3) break;
  }
  if (line && lines.length < 4) lines.push(line);
  const fontSize = Math.max(48, Math.round(options.width * 0.052));
  const lineHeight = Math.round(fontSize * 1.18);
  const titleY = Math.round(options.height * 0.35);
  const title = lines.slice(0, 4).map((text, index) => `<text x="${Math.round(options.width * 0.09)}" y="${titleY + index * lineHeight}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" fill="#0f172a">${escapeCoverText(text)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${options.width}" height="${options.height}" viewBox="0 0 ${options.width} ${options.height}">
    <rect width="100%" height="100%" fill="#f8fafc"/>
    <rect width="100%" height="${Math.max(18, Math.round(options.height * 0.025))}" fill="#f97316"/>
    <rect x="${Math.round(options.width * 0.78)}" y="0" width="${Math.round(options.width * 0.22)}" height="100%" fill="#1d4ed8"/>
    <rect x="${Math.round(options.width * 0.09)}" y="${Math.round(options.height * 0.21)}" width="${Math.round(options.width * 0.12)}" height="${Math.max(8, Math.round(options.height * 0.012))}" fill="#f97316"/>
    <text x="${Math.round(options.width * 0.09)}" y="${Math.round(options.height * 0.17)}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.max(24, Math.round(options.width * 0.022))}" font-weight="700" fill="#1d4ed8">DEKHOCAMPUS EDITORIAL</text>
    ${title}
    <text x="${Math.round(options.width * 0.09)}" y="${Math.round(options.height * 0.86)}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.max(22, Math.round(options.width * 0.018))}" fill="#475569">Admissions, exams and college decisions explained clearly</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function renderBlogCover(sourceBytes, options, diagnostics = null) {
  const base = sharp(sourceBytes, { limitInputPixels: 50_000_000 })
    .rotate()
    .resize(options.width, options.height, { fit: "cover", position: "attention" });
  if (options.includeLogo && options.logoUrl) {
    try {
      const logoSource = await downloadCoverSource(options.logoUrl, "Cover logo");
      const logo = await sharp(logoSource, { limitInputPixels: 20_000_000 })
        .rotate()
        .resize({ width: Math.round(options.width * 0.2), height: Math.round(options.height * 0.11), fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer({ resolveWithObject: true });
      const left = Math.max(24, Math.round((options.width - logo.info.width) / 2));
      const top = Math.max(24, Math.round(options.height * 0.045));
      base.composite([{ input: logo.data, left, top }]);
      if (diagnostics) diagnostics.logoApplied = true;
    } catch (error) {
      if (diagnostics) {
        diagnostics.logoApplied = false;
        diagnostics.logoError = String(error?.message || error).slice(0, 200);
      }
    }
  }
  return base.webp({ quality: options.resolution === "web" ? 82 : 88, effort: 5 }).toBuffer();
}

const TITLE_STOP_WORDS = new Set(["a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "the", "to", "with"]);
export const normalizeArticleTitle = (value) => String(value || "")
  .toLowerCase()
  .replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

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
      return title ? [{ title, angle: "", category: "Education", tags: [] }] : [];
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
  const configuredGeminiModel = normalizeGeminiModel(gemini?.default_model || blog?.text_model || DEFAULT_GEMINI_MODEL);
  return {
    geminiKey: String(process.env.GEMINI_API_KEY || gemini?.api_key_encrypted || "").trim(),
    geminiModel: configuredGeminiModel,
    openaiKey: String(process.env.OPENAI_API_KEY || openai?.api_key_encrypted || "").trim(),
    imageModel: DEFAULT_OPENAI_IMAGE_MODEL,
    imageQuality: ["low", "medium", "high"].includes(blog?.image_quality) ? blog.image_quality : "medium",
  };
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
  const model = normalizeGeminiModel(control?.provider === "gemini" && control?.model ? control.model : config.geminiModel);
  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: "Return valid JSON only. Use factual, original language. Never use an em dash." }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.45,
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
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "{}";
  const result = JSON.parse(cleanJson(text));
  await prisma.ai_usage_events.create({ data: { id: randomUUID(), provider: "gemini", model, feature, operation: "text-generation", input_tokens: 0, output_tokens: 0, image_count: 0, estimated_cost_usd: 0, metadata: {} } }).catch(() => {});
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
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { authorization: `Bearer ${config.openaiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: config.imageModel || DEFAULT_OPENAI_IMAGE_MODEL, prompt: `${options.promptStyle}. Editorial education news cover for Indian students. No text, no logo, no watermark. Topic: ${String(prompt).slice(0, 500)}`, size: options.aspectRatio === "1:1" ? "1024x1024" : options.aspectRatio === "4:5" ? "1024x1536" : "1536x1024", quality: config.imageQuality, output_format: "webp", n: 1 }),
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
  return { bytes, config };
}

export async function createBlogCover(slug, prompt, rawOptions = {}) {
  const options = normalizeBlogCoverOptions(rawOptions);
  const diagnostics = rawOptions.diagnostics && typeof rawOptions.diagnostics === "object" ? rawOptions.diagnostics : null;
  if (options.mode === "none") return "";
  let sourceBytes;
  let generatedConfig = null;
  if (options.mode === "template") {
    if (!options.templateUrl) throw new Error("A cover template is required when image mode is template");
    try {
      sourceBytes = await downloadCoverSource(options.templateUrl, "Cover template");
      if (diagnostics) diagnostics.sourceMode = "template";
    } catch (templateError) {
      try {
        const generated = await createGeneratedImage(prompt, options);
        sourceBytes = generated.bytes;
        generatedConfig = generated.config;
        if (diagnostics) {
          diagnostics.sourceMode = "generated-fallback";
          diagnostics.templateError = String(templateError?.message || templateError).slice(0, 200);
        }
      } catch (generatedError) {
        sourceBytes = await createLocalEditorialCover(prompt, options);
        if (diagnostics) {
          diagnostics.sourceMode = "local-fallback";
          diagnostics.generatedError = String(generatedError?.message || generatedError).slice(0, 200);
        }
      }
    }
  } else {
    try {
      const generated = await createGeneratedImage(prompt, options);
      sourceBytes = generated.bytes;
      generatedConfig = generated.config;
      if (diagnostics) diagnostics.sourceMode = "generated";
    } catch (generatedError) {
      sourceBytes = await createLocalEditorialCover(prompt, options);
      if (diagnostics) {
        diagnostics.sourceMode = "local-fallback";
        diagnostics.generatedError = String(generatedError?.message || generatedError).slice(0, 200);
      }
    }
  }
  const bytes = await renderBlogCover(sourceBytes, options, diagnostics);
  const path = `blog-covers/${slug}-${Date.now()}.webp`;
  const upload = await uploadStorageObject("admin-uploads", path, bytes, "image/webp", { cacheControl: "public,max-age=31536000,immutable" });
  if (generatedConfig) {
    await prisma.ai_usage_events.create({ data: { id: randomUUID(), provider: "openai", model: generatedConfig.imageModel, feature: "blog-cover", operation: "image-generation", input_tokens: 0, output_tokens: 0, image_count: 1, estimated_cost_usd: 0, metadata: { slug, aspect_ratio: options.aspectRatio, resolution: options.resolution, logo_applied: options.includeLogo && Boolean(options.logoUrl) } } }).catch(() => {});
  }
  return upload.publicUrl;
}

async function researchSignals(limit = 12) {
  const configured = await prisma.blog_research_sources.findMany({ where: { is_active: true }, orderBy: { display_order: "asc" }, take: limit });
  const defaults = [
    { name: "Google News Education India", url: "https://news.google.com/rss/search?q=education+college+admission+exam+India&hl=en-IN&gl=IN&ceid=IN:en", source_type: "public_signal" },
    { name: "Google Trends India", url: "https://trends.google.com/trending/rss?geo=IN", source_type: "public_signal" },
  ];
  const sources = configured.length ? configured : defaults;
  const settled = await Promise.allSettled(sources.slice(0, limit).map(async (source) => {
    const response = await fetch(source.url, { headers: { "user-agent": "DekhoCampus editorial research/2.0" }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(String(response.status));
    return { name: source.name, url: source.url, source_type: source.source_type, signal: stripHtml((await response.text()).slice(0, 120_000)).slice(0, 5000) };
  }));
  return settled.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
}

function articlePrompt(topic, signals, wordLimit = 1200) {
  return `Today is ${new Date().toISOString().slice(0, 10)}. Write one original DekhoCampus education article about ${topic} for Indian students and parents. Target ${Math.min(2200, Math.max(700, Number(wordLimit)))} words. Research signals are for trend and fact awareness only; never copy wording or credit competitor publishers in the article body: ${JSON.stringify(signals)}. Return {title,slug,description,content_html,meta_title,meta_description,meta_keywords,tags,category,hero_hook,research_notes}. Use concise direct answers, descriptive H2/H3 headings, short paragraphs, useful lists, an FAQ section, and verifiable facts. Do not include Sources, References, Citations or competitor names in content_html. When evidence is uncertain, tell readers to verify the official authority website.`;
}

async function generateDraft(topic, { wordLimit = 1200, cover = {}, signals = null, requiredTitle = "" } = {}) {
  const evidence = signals || await researchSignals();
  const { result, model } = await geminiJson(articlePrompt(topic, evidence, wordLimit), "blog-studio");
  const title = String(requiredTitle || result.title || topic).trim();
  const slug = slugify(requiredTitle || result.slug || result.title || topic);
  const draft = {
    ...result,
    title,
    slug,
    content_html: stripCompetitorCredits(result.content_html),
    tags: Array.isArray(result.tags) ? result.tags : [],
    featured_image: "",
  };
  draft.featured_image = await createBlogCover(slug, result.hero_hook || result.title || topic, cover);
  return { draft, model, research_sources: evidence.map((item) => item.url) };
}

export async function handleBlogAiSettings(request, userId) {
  const config = await aiConfig();
  if (request.method === "GET") {
    const row = await prisma.blog_ai_provider_settings.findUnique({ where: { id: "default" } }).catch(() => null);
    return { text_model: row?.text_model || config.geminiModel, image_model: row?.image_model || config.imageModel, image_quality: row?.image_quality || config.imageQuality, gemini_key_set: Boolean(config.geminiKey), openai_key_set: Boolean(config.openaiKey), updated_at: row?.updated_at || null };
  }
  const body = await request.json().catch(() => ({}));
  const requestedTextModel = String(body.text_model || DEFAULT_GEMINI_MODEL);
  const updates = { text_model: normalizeGeminiModel(requestedTextModel), image_model: DEFAULT_OPENAI_IMAGE_MODEL, image_quality: ["low", "medium", "high"].includes(body.image_quality) ? body.image_quality : "medium", updated_at: new Date(), updated_by: userId };
  const current = await prisma.blog_ai_provider_settings.findUnique({ where: { id: "default" } });
  await prisma.blog_ai_provider_settings.upsert({ where: { id: "default" }, create: { id: "default", claude_api_key_ciphertext: current?.claude_api_key_ciphertext || "", openai_api_key_ciphertext: current?.openai_api_key_ciphertext || "", ...updates }, update: updates });
  for (const [name, key, model] of [["gemini", body.gemini_api_key, updates.text_model], ["openai", body.openai_api_key, updates.image_model]]) {
    if (!String(key || "").trim()) continue;
    const existing = await provider(name);
    if (existing) await prisma.ai_providers.update({ where: { id: existing.id }, data: { api_key_encrypted: String(key).trim(), default_model: model, updated_at: new Date() } });
    else await prisma.ai_providers.create({ data: { id: randomUUID(), provider_name: name, display_name: name === "gemini" ? "Google Gemini" : "OpenAI", api_key_encrypted: String(key).trim(), base_url: name === "gemini" ? "https://generativelanguage.googleapis.com/v1beta" : "https://api.openai.com/v1", default_model: model, is_active: false, icon_emoji: name === "gemini" ? "G" : "AI" } });
  }
  return { success: true };
}

export async function handleBlogStudio(request) {
  const body = await request.json().catch(() => ({}));
  const topic = String(body.topic || "").trim();
  if (!topic) throw Object.assign(new Error("A blog topic is required"), { status: 400 });
  const generated = await generateDraft(topic, { wordLimit: body.word_limit, cover: {
    imageMode: body.image?.mode || "none",
    templateUrl: body.image?.template_url,
    promptStyle: body.image?.prompt_style,
    includeLogo: body.image?.include_logo,
    logoUrl: body.image?.logo_url,
    aspectRatio: body.image?.aspect_ratio,
    resolution: body.image?.resolution,
  } });
  return { draft: generated.draft, model_used: `gemini:${generated.model}`, image_model_used: generated.draft.featured_image ? "openai" : "none", research_sources: generated.research_sources };
}

export async function handleAiGenerate(request) {
  const body = await request.json().catch(() => ({}));
  const table = String(body.entity_type || "");
  if (!schemaMetadata[table] || !["colleges", "courses", "exams", "articles", "scholarships", "career_profiles"].includes(table)) throw new Error("Unsupported entity type");
  const count = Math.min(20, Math.max(1, Number(body.count || body.names?.length || 1)));
  const fields = Object.entries(schemaMetadata[table].fields).filter(([name, meta]) => !["id", "created_at", "updated_at", "short_id"].includes(name) && !meta.ignored).map(([name, meta]) => `${name}:${meta.type}${meta.nullable ? "?" : ""}`);
  const prompt = `Generate ${count} production-ready ${table} records for DekhoCampus. Topic: ${body.topic || ""}. Exact requested names: ${JSON.stringify(body.names || [])}. Use official-source-first, conservative facts; omit uncertain values. Return {items:[...]}. Each item must use this schema: ${fields.join(", ")}. JSON fields must be arrays or objects, booleans must be booleans, slugs lowercase-hyphen. Articles must be Draft and contain original HTML without competitor credits.`;
  const { result, model } = await geminiJson(prompt, table === "articles" ? "blog-studio" : "admin-ai-generate");
  const rawItems = Array.isArray(result.items) ? result.items.slice(0, count) : [];
  const items = [];
  for (const raw of rawItems) {
    const item = { ...raw };
    if (schemaMetadata[table].fields.slug) item.slug = slugify(item.slug || item.name || item.title);
    if (table === "articles") { item.status = "Draft"; item.content = stripCompetitorCredits(item.content || item.content_html); delete item.content_html; }
    const existing = item.slug ? await prisma.$queryRawUnsafe(`SELECT 1 FROM \`${table}\` WHERE \`slug\` = ? LIMIT 1`, item.slug) : [];
    items.push({ ...item, _action: existing.length ? "upsert" : "insert", _key: item.slug || item.name || item.title });
  }
  return { items, model_used: `gemini:${model}`, counts: { inserts: items.filter((item) => item._action === "insert").length, upserts: items.filter((item) => item._action === "upsert").length }, duplicate_titles_skipped: [] };
}

async function saveGeneratedArticle(topic, settings, signals, schedule = null) {
  const topicTitle = String(topic?.title || topic).trim();
  const generated = await generateDraft(topicTitle, { wordLimit: settings.word_limit, signals, requiredTitle: topicTitle, cover: {
    imageMode: settings.image_mode,
    templateUrl: settings.image_template_url,
    promptStyle: settings.image_prompt_style,
    includeLogo: settings.include_logo,
    logoUrl: settings.logo_url,
    aspectRatio: settings.image_aspect_ratio,
    resolution: settings.output_resolution,
  } });
  const draft = generated.draft;
  const existing = await prisma.articles.findMany({ orderBy: { created_at: "desc" }, take: 5000, select: { id: true, slug: true, title: true } });
  if (findDuplicateArticleTitle(draft, existing)) return null;
  const article = await prisma.articles.create({ data: {
    id: randomUUID(), status: settings.human_review_required ? "Draft" : settings.publish_status,
    title: String(draft.title || topic), slug: draft.slug, description: String(draft.description || ""), content: String(draft.content_html || ""), vertical: "General", category: String(draft.category || "Education"), author: "DekhoCampus Editorial", featured_image: draft.featured_image || "", views: 0, tags: [...new Set([...(draft.tags || []), "auto-blog-agent", ...(schedule ? ["entity-article-agent", schedule.entity_type, schedule.entity_slug] : [])])], meta_title: String(draft.meta_title || draft.title || topic), meta_description: String(draft.meta_description || draft.description || ""), meta_keywords: String(draft.meta_keywords || ""), is_active: true, data_source_urls: generated.research_sources, data_clean_state: "not_checked",
  } });
  if (schedule) {
    await prisma.article_links.create({ data: { id: randomUUID(), article_id: article.id, entity_type: schedule.entity_type.replace(/s$/, ""), entity_slug: schedule.entity_slug } }).catch(() => {});
    await prisma.entity_article_publications.create({ data: { id: randomUUID(), schedule_id: schedule.id, article_id: article.id, entity_type: schedule.entity_type, entity_slug: schedule.entity_slug, topic_kind: "researched_update", generated_for_date: new Date() } });
  }
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
  let settings = await prisma.blog_auto_agent_settings.findUnique({ where: { id: "default" } });
  if (!settings) throw new Error("Auto Blog Agent settings are missing");
  const triggerType = body.trigger_type || "manual";
  const entityContext = await entityRunContext(body, settings);
  if (entityContext?.skipped) return { skipped: true, message: entityContext.message, schedule_id: entityContext.schedule.id };
  if (entityContext) settings = entityContext.settings;
  if (!entityContext && triggerType === "schedule" && !settings.enabled) return { skipped: true, message: "Blog auto agent is disabled" };
  if (!entityContext && triggerType === "schedule" && settings.next_run_at && settings.next_run_at > new Date()) return { skipped: true, message: "Next run time has not arrived yet", next_run_at: settings.next_run_at };
  const interval = Math.max(MIN_INTERVAL_MINUTES, Number(settings.interval_minutes || 60));
  const dailyCap = Math.min(MAX_DAILY_POSTS, Math.max(1, Number(settings.daily_post_cap || 12)));
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const todayCount = await prisma.$queryRawUnsafe("SELECT COUNT(*) AS total FROM `articles` WHERE `created_at` >= ? AND JSON_CONTAINS(`tags`, JSON_QUOTE('auto-blog-agent'))", dayStart);
  const remaining = Math.max(0, dailyCap - Number(todayCount[0]?.total || 0));
  if (!remaining) return { skipped: true, message: "Daily post cap reached", count: dailyCap };
  const postCount = Math.min(MAX_POSTS_PER_RUN, remaining, entityContext?.postCount || Math.max(1, Number(settings.posts_per_run || 1)));
  const running = await prisma.blog_auto_agent_runs.findFirst({ where: { status: "running", ...(body.resume_run_id ? { NOT: { id: body.resume_run_id } } : {}) }, select: { id: true } });
  if (running) return { skipped: true, message: "Another blog run is already active", run_id: running.id };
  const executionToken = `executor:${randomUUID()}`;
  const run = body.resume_run_id
    ? await prisma.blog_auto_agent_runs.update({ where: { id: body.resume_run_id }, data: { status: "running", resumed_at: new Date(), finished_at: null, message: "Resumed", current_step: "Resuming education research", control_note: executionToken } })
    : await prisma.blog_auto_agent_runs.create({ data: { id: randomUUID(), status: "running", trigger_type: triggerType, interval_minutes: interval, model_provider: "gemini", word_limit: settings.word_limit, sources: [], selected_topics: [], created_article_ids: [], message: "Researching", progress: 5, current_step: "Researching education signals", estimated_seconds: postCount * 90, completed_steps: 0, total_steps: postCount * 2 + 1, control_note: executionToken, entity_schedule_id: entityContext?.schedule.id || null, agent_mode: entityContext ? "entity_schedule" : "general" } });
  try {
    const signals = await researchSignals(12);
    await assertRunActive(run.id, executionToken);
    const recent = await prisma.articles.findMany({ orderBy: { created_at: "desc" }, take: 5000, select: { title: true, slug: true } });
    const entityInstruction = entityContext
      ? `Generate only for this ${entityContext.schedule.entity_type}: ${JSON.stringify({ name: entityContext.schedule.entity_name, slug: entityContext.schedule.entity_slug, facts: entityContext.entity, topic_focus: entityContext.schedule.topic_focus })}. Prefer a timely verified update; otherwise create an evergreen student guide. Every topic must be specifically useful for this entity.`
      : "Cover the strongest Indian education opportunities across admissions, exams, counselling, scholarships, careers and college decisions.";
    const promptTitles = recent.slice(0, 500);
    const topics = [];
    const comparedTitles = [...recent];
    const rejected = [];
    for (let round = 1; round <= 3 && topics.length < postCount; round += 1) {
      const rejectedInstruction = rejected.length
        ? `These suggestions were rejected as too similar to existing coverage; propose materially different student questions and angles: ${JSON.stringify(rejected.slice(-20))}.`
        : "";
      const { result } = await geminiJson(`Using these official/public/competitor-gap signals ${JSON.stringify(signals)}, propose ${Math.max(postCount * 4, 8)} original Indian education article opportunities. ${entityInstruction} Recent DekhoCampus titles to avoid: ${JSON.stringify(promptTitles)}. ${rejectedInstruction} Search current web results for competitor coverage and official updates, but use competitor material only to identify coverage gaps; never copy or credit it. Titles must be specific, factual, useful and substantially different from every avoided title. Return topic objects with a non-empty title.`, "blog-agent", {
        research: true,
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
                  category: { type: "STRING" },
                  tags: { type: "ARRAY", items: { type: "STRING" } },
                },
                required: ["title"],
              },
            },
          },
          required: ["topics"],
        },
      });
      await assertRunActive(run.id, executionToken);
      for (const topic of normalizeTopicSuggestions(result)) {
        const duplicate = findDuplicateArticleTitle(topic, comparedTitles);
        if (duplicate) {
          rejected.push({ suggested: topic.title, conflicts_with: duplicate.title });
          continue;
        }
        topics.push(topic);
        comparedTitles.push({ title: topic.title, slug: slugify(topic.title) });
        if (topics.length >= postCount) break;
      }
    }
    if (!topics.length) throw new Error(`Gemini returned no usable non-duplicate article topics after three structured research attempts (${rejected.length} duplicate suggestions rejected). Review the active research sources and try again.`);
    await prisma.blog_auto_agent_runs.update({ where: { id: run.id }, data: { progress: 30, current_step: `Writing ${topics.length} article(s)`, selected_topics: topics, sources: signals.map(({ signal, ...source }) => source) } });
    const ids = [];
    for (const topic of topics) {
      await assertRunActive(run.id, executionToken);
      const id = await saveGeneratedArticle(topic, settings, signals, entityContext?.schedule || null);
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
    await prisma.blog_auto_agent_runs.update({ where: { id: run.id }, data: { status: "completed", progress: 100, current_step: "Completed", completed_steps: topics.length * 2 + 1, finished_at: new Date(), created_article_ids: ids, message: `Created ${ids.length} draft article(s)` } });
    return { success: true, created_article_ids: ids, topics, next_run_at: nextRun, run_id: run.id, schedule_id: entityContext?.schedule.id || null };
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
