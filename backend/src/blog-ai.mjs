import { createHash, randomUUID, webcrypto } from "node:crypto";
import { prisma, schemaMetadata } from "./db.mjs";

const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1";
const MAX_POSTS_PER_RUN = 10;
const MAX_DAILY_POSTS = 48;
const MIN_INTERVAL_MINUTES = 30;

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

async function decryptLegacy(value) {
  if (!value || !String(value).startsWith("v1.")) return "";
  const serviceKey = String(process.env.SUPABASE_STORAGE_SERVICE_KEY || "");
  if (!serviceKey) return "";
  const [, iv64, data64] = String(value).split(".");
  const digest = createHash("sha256").update(`dekhocampus-blog-ai:${serviceKey}`).digest();
  const key = await webcrypto.subtle.importKey("raw", digest, "AES-GCM", false, ["decrypt"]);
  const decrypted = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(iv64, "base64") }, key, Buffer.from(data64, "base64"));
  return Buffer.from(decrypted).toString("utf8");
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
    openaiKey: String(process.env.OPENAI_API_KEY || openai?.api_key_encrypted || await decryptLegacy(blog?.openai_api_key_ciphertext).catch(() => "")).trim(),
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
  if (!config.geminiKey) throw Object.assign(new Error("Gemini API key is not configured in DigitalOcean or Admin - AI Providers"), { status: 503, code: "GEMINI_NOT_CONFIGURED" });
  const model = normalizeGeminiModel(control?.provider === "gemini" && control?.model ? control.model : config.geminiModel);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.geminiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: "Return valid JSON only. Use factual, original language. Never use an em dash." }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.45 },
      ...(options.research ? { tools: [{ google_search: {} }, { url_context: {} }] } : {}),
    }),
  });
  if (!response.ok) throw new Error(`Gemini request failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "{}";
  const result = JSON.parse(cleanJson(text));
  await prisma.ai_usage_events.create({ data: { id: randomUUID(), provider: "gemini", model, feature, operation: "text-generation", input_tokens: 0, output_tokens: 0, image_count: 0, estimated_cost_usd: 0, metadata: {} } }).catch(() => {});
  return { result, model };
}

export async function generateGeminiJson(prompt, feature, options) {
  return geminiJson(prompt, feature, options);
}

async function uploadGeneratedImage(slug, prompt) {
  await assertAiEnabled("blog-cover");
  const config = await aiConfig();
  if (!config.openaiKey) throw Object.assign(new Error("OpenAI API key is not configured for blog images"), { status: 503, code: "OPENAI_NOT_CONFIGURED" });
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { authorization: `Bearer ${config.openaiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: config.imageModel || DEFAULT_OPENAI_IMAGE_MODEL, prompt: `Editorial education news cover for Indian students. No text, no logo, no watermark. Topic: ${String(prompt).slice(0, 500)}`, size: "1536x1024", quality: config.imageQuality, output_format: "webp", n: 1 }),
  });
  if (!response.ok) throw new Error(`OpenAI image generation failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  const payload = await response.json();
  let bytes;
  if (payload.data?.[0]?.b64_json) bytes = Buffer.from(payload.data[0].b64_json, "base64");
  else {
    const source = await fetch(payload.data?.[0]?.url || "");
    if (!source.ok) throw new Error("OpenAI image result could not be downloaded");
    bytes = Buffer.from(await source.arrayBuffer());
  }
  const storageUrl = String(process.env.SUPABASE_STORAGE_URL || "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_STORAGE_SERVICE_KEY || "");
  if (!storageUrl || !serviceKey) throw new Error("Supabase storage is not configured");
  const path = `blog-covers/${slug}-${Date.now()}.webp`;
  const upload = await fetch(`${storageUrl}/storage/v1/object/admin-uploads/${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "content-type": "image/webp", "cache-control": "max-age=31536000", "x-upsert": "false" },
    body: bytes,
  });
  if (!upload.ok) throw new Error(`Supabase image upload failed (${upload.status}): ${(await upload.text()).slice(0, 400)}`);
  await prisma.ai_usage_events.create({ data: { id: randomUUID(), provider: "openai", model: config.imageModel, feature: "blog-cover", operation: "image-generation", input_tokens: 0, output_tokens: 0, image_count: 1, estimated_cost_usd: 0, metadata: { slug } } }).catch(() => {});
  return `${storageUrl}/storage/v1/object/public/admin-uploads/${path}`;
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

async function generateDraft(topic, { wordLimit = 1200, imageMode = "none", signals = null } = {}) {
  const evidence = signals || await researchSignals();
  const { result, model } = await geminiJson(articlePrompt(topic, evidence, wordLimit), "blog-studio");
  const slug = slugify(result.slug || result.title || topic);
  const draft = {
    ...result,
    slug,
    content_html: stripCompetitorCredits(result.content_html),
    tags: Array.isArray(result.tags) ? result.tags : [],
    featured_image: "",
  };
  if (imageMode !== "none") draft.featured_image = await uploadGeneratedImage(slug, result.hero_hook || result.title || topic);
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
  const generated = await generateDraft(topic, { wordLimit: body.word_limit, imageMode: body.image?.mode || "none" });
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
  const generated = await generateDraft(topic, { wordLimit: settings.word_limit, imageMode: settings.image_mode, signals });
  const draft = generated.draft;
  const existing = await prisma.articles.findFirst({ where: { OR: [{ slug: draft.slug }, { title: draft.title }] }, select: { id: true } });
  if (existing) return null;
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
    const signals = await researchSignals(20);
    await assertRunActive(run.id, executionToken);
    const recent = await prisma.articles.findMany({ orderBy: { created_at: "desc" }, take: 500, select: { title: true, slug: true } });
    const entityInstruction = entityContext
      ? `Generate only for this ${entityContext.schedule.entity_type}: ${JSON.stringify({ name: entityContext.schedule.entity_name, slug: entityContext.schedule.entity_slug, facts: entityContext.entity, topic_focus: entityContext.schedule.topic_focus })}. Prefer a timely verified update; otherwise create an evergreen student guide. Every topic must be specifically useful for this entity.`
      : "Cover the strongest Indian education opportunities across admissions, exams, counselling, scholarships, careers and college decisions.";
    const { result } = await geminiJson(`Using these official/public/competitor-gap signals ${JSON.stringify(signals)}, propose ${Math.max(postCount * 2, 4)} original Indian education article opportunities. ${entityInstruction} Existing titles to avoid: ${JSON.stringify(recent)}. Competitor material is gap research only; do not copy or credit it. Return {topics:[{title,angle,category,tags}]}.`, "blog-agent");
    await assertRunActive(run.id, executionToken);
    const topics = (Array.isArray(result.topics) ? result.topics : []).filter((topic) => topic.title).slice(0, postCount);
    await prisma.blog_auto_agent_runs.update({ where: { id: run.id }, data: { progress: 30, current_step: `Writing ${topics.length} article(s)`, selected_topics: topics, sources: signals.map(({ signal, ...source }) => source) } });
    const ids = [];
    for (const topic of topics) {
      await assertRunActive(run.id, executionToken);
      const id = await saveGeneratedArticle(topic.title, settings, signals, entityContext?.schedule || null);
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
  await prisma.blog_auto_agent_runs.updateMany({ where: { status: "running", started_at: { lt: new Date(Date.now() - 30 * 60_000) } }, data: { status: "failed", progress: 100, current_step: "Recovered after restart", finished_at: new Date(), message: "Interrupted run recovered after process restart" } });
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
  setTimeout(() => void tick(), 15_000).unref?.();
}

export function stopBlogAgentWorker() {
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = undefined;
}

export const blogLimits = { MAX_POSTS_PER_RUN, MAX_DAILY_POSTS, MIN_INTERVAL_MINUTES };
