import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { geminiGenerate, GEMINI_MODEL } from "./gemini.ts";
import { blogTextProviderLabel, generateAndUploadBlogCover, generateBlogJson, loadBlogAiConfig } from "../_shared/blog-ai.ts";
import { applyBlogTextRuntimeControl, applyImageRuntimeControl, getAiRuntimeControl } from "../_shared/ai-control.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-blog-agent-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_SOURCES = [
  { name: "Google Trends India", url: "https://trends.google.com/trending/rss?geo=IN", source_type: "public_signal" },
  { name: "Google News Education", url: "https://news.google.com/rss/search?q=education+OR+college+OR+admission+OR+exam+India&hl=en-IN&gl=IN&ceid=IN:en", source_type: "public_signal" },
  { name: "Google News Exams", url: "https://news.google.com/rss/search?q=JEE+OR+NEET+OR+CUET+OR+CAT+OR+board+exam+India&hl=en-IN&gl=IN&ceid=IN:en", source_type: "public_signal" },
  { name: "DekhoCampus", url: "https://dekhocampus.com/news", source_type: "own" },
];

const BLOCKED_ARTICLE_COMPETITOR_PATTERN = /(collegedekho|college\s*dekho|collegedunia|college\s*dunia|shiksha|careers\s*360|careers360|kollege\s*apply|kollegeapply|getmyuni|pagalguy)/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function stripHtml(input: string) {
  return input
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXml(value: string) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function trendTrafficScore(value: string) {
  const match = String(value || "").replace(/,/g, "").match(/([\d.]+)\s*([KMB])?\+?/i);
  if (!match) return 0;
  const base = Number(match[1]);
  const multiplier = { k: 1_000, m: 1_000_000, b: 1_000_000_000 }[String(match[2] || "").toLowerCase() as "k" | "m" | "b"] || 1;
  return Number.isFinite(base) ? base * multiplier : 0;
}

function extractGoogleTrendCandidates(xml: string) {
  const candidates: Array<{ title: string; approximate_traffic: string; traffic_score: number }> = [];
  const itemPattern = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  for (const match of xml.matchAll(itemPattern)) {
    const item = match[1];
    const title = decodeXml(item.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    const traffic = decodeXml(item.match(/<(?:ht:)?approx_traffic[^>]*>([\s\S]*?)<\/(?:ht:)?approx_traffic>/i)?.[1] || "");
    if (!title || !traffic) continue;
    candidates.push({ title, approximate_traffic: traffic, traffic_score: trendTrafficScore(traffic) });
  }
  return candidates.sort((a, b) => b.traffic_score - a.traffic_score).slice(0, 20);
}

function isGoogleTrendsSource(source: any) {
  return /trends\.google\.com\/trending/i.test(String(source?.url || ""));
}

function esc(value: string) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function cleanControlNote(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 300);
}

function normalizeArticleLinks(html: unknown) {
  return stripArticleSourceSection(String(html || ""))
    .replace(/<a\s+([^>]*href=["']https?:\/\/([^"']+)["'][^>]*)>/gi, (match, attrs, host) => {
      const internal = /(^|\.)dekhocampus\.(in|com)(\/|$)/i.test(String(host));
      if (internal) return match.replace(/\srel=["'][^"']*["']/i, "");
      if (/\srel=["']/i.test(attrs)) return `<a ${attrs.replace(/\srel=["'][^"']*["']/i, ' rel="nofollow noopener noreferrer"')}>`;
      return `<a ${attrs} rel="nofollow noopener noreferrer">`;
    })
    .replace(/[\u2013\u2014]/g, "-");
}

function stripArticleSourceSection(value: unknown) {
  return String(value || "")
    .replace(/<h[1-6][^>]*>\s*(?:<[^>]+>\s*)*(?:sources?|references?|citations?|bibliography|source\s+links?|credits?)(?:\s*<\/[^>]+>)*\s*<\/h[1-6]>[\s\S]*$/i, "")
    .replace(/<p[^>]*>\s*(?:<strong>|<b>)?\s*(?:sources?|references?|citations?|bibliography|source\s+links?|credits?)\s*(?:<\/strong>|<\/b>)?(?:\s*<br\s*\/?>)?[\s\S]*$/i, "")
    .replace(/<div[^>]*>\s*(?:<strong>|<b>)?\s*(?:sources?|references?|citations?|bibliography|source\s+links?|credits?)\s*(?:<\/strong>|<\/b>)?(?:\s*<br\s*\/?>)?[\s\S]*$/i, "")
    .replace(/(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:sources?|references?|citations?|bibliography|source\s+links?|credits?)\s*(?:\*\*)?\s*(?:\n|<br\s*\/?>)[\s\S]*$/i, "")
    .replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*(?:collegedekho|college\s*dekho|collegedunia|college\s*dunia|shiksha|careers\s*360|careers360|kollege\s*apply|kollegeapply|getmyuni|pagalguy)(?:(?!<\/p>)[\s\S])*<\/p>\s*$/gi, "")
    .replace(/(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?[^\n]*(?:collegedekho|college\s*dekho|collegedunia|college\s*dunia|shiksha|careers\s*360|careers360|kollege\s*apply|kollegeapply|getmyuni|pagalguy)[^\n]*(?:\*\*)?\s*$/gim, "")
    .trim();
}

function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function coverSvg(title: string, kicker: string) {
  const words = title.split(/\s+/).slice(0, 13).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0f172a"/><stop offset=".55" stop-color="#1d4ed8"/><stop offset="1" stop-color="#f5821f"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><circle cx="1300" cy="130" r="330" fill="#fff" opacity=".09"/><circle cx="170" cy="840" r="370" fill="#fff" opacity=".08"/><text x="115" y="145" fill="#dbeafe" font-family="Arial,sans-serif" font-size="34" font-weight="700" letter-spacing="5">DEKHOCAMPUS · ${esc(kicker.toUpperCase().slice(0, 42))}</text><foreignObject x="115" y="245" width="1280" height="430"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;color:white;font-size:78px;line-height:1.12;font-weight:850">${esc(words)}</div></foreignObject><text x="115" y="820" fill="#e0f2fe" font-family="Arial,sans-serif" font-size="30">Fresh guidance for students and parents</text></svg>`;
}

async function requireAccess(req: Request, admin: any) {
  const configuredSecret = Deno.env.get("BLOG_AGENT_SECRET") || "";
  const incomingSecret = req.headers.get("x-blog-agent-secret") || "";
  if (configuredSecret && incomingSecret && incomingSecret === configuredSecret) return;

  // Supabase cron uses a per-project token stored in the admin-only settings
  // row. This keeps scheduled AI generation independent of a browser session.
  if (incomingSecret) {
    const { data: scheduler } = await admin.from("blog_auto_agent_settings")
      .select("scheduler_token")
      .eq("id", "default")
      .maybeSingle();
    if (scheduler?.scheduler_token && incomingSecret === scheduler.scheduler_token) return;
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authentication required");
  const { data: userData } = await admin.auth.getUser(token);
  if (!userData.user) throw new Error("Invalid session");
  const { data: role } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").limit(1).maybeSingle();
  if (!role) throw new Error("Admin permission required");
}

async function fetchSignals(sources: any[]) {
  const safeSources = sources.filter((source) => !BLOCKED_ARTICLE_COMPETITOR_PATTERN.test(`${source?.name || ""} ${source?.url || ""}`));
  const results = await Promise.allSettled(safeSources.map(async (source) => {
    const response = await fetch(source.url, {
      headers: {
        "User-Agent": "DekhoCampus editorial research bot/1.0",
        "Accept": "application/rss+xml,application/xml,text/xml,text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) return { ...source, ok: false, signal: `Unavailable ${response.status}` };
    const raw = (await response.text()).slice(0, 160000);
    const trend_candidates = isGoogleTrendsSource(source) ? extractGoogleTrendCandidates(raw) : [];
    const signal = stripHtml(raw).slice(0, 4500);
    return { ...source, ok: true, signal, trend_candidates };
  }));
  return results.map((result, index) => result.status === "fulfilled" ? result.value : { ...safeSources[index], ok: false, signal: "Fetch failed" });
}

async function loadInternalLinkContext(admin: any, topic: any) {
  const words = String(`${topic?.primary_keyword || ""} ${topic?.title || ""}`)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !["admission", "latest", "update", "india", "students", "college", "course", "exam"].includes(word))
    .slice(0, 4);
  if (!words.length) return [];
  const or = (column: string) => words.map((word) => `${column}.ilike.%${word}%`).join(",");
  const requests = [
    { table: "colleges", column: "name", path: "colleges", type: "college" },
    { table: "courses", column: "name", path: "courses", type: "course" },
    { table: "exams", column: "name", path: "exams", type: "exam" },
    { table: "careers", column: "title", path: "careers", type: "career" },
    { table: "jobs", column: "title", path: "jobs", type: "job" },
    { table: "scholarships", column: "name", path: "scholarships", type: "scholarship" },
  ];
  const settled = await Promise.allSettled(requests.map(async (request) => {
    const { data, error } = await admin.from(request.table).select(`${request.column},slug`).or(or(request.column)).limit(4);
    if (error) return [];
    return (data || []).map((row: any) => ({
      label: row[request.column],
      type: request.type,
      url: `https://dekhocampus.com/${request.path}/${row.slug}`,
    }));
  }));
  return settled.flatMap((result) => result.status === "fulfilled" ? result.value : []).slice(0, 16);
}

async function chooseProvider(admin: any, providerName: string) {
  const { data } = await admin.from("ai_providers").select("provider_name,base_url,api_key_encrypted,default_model");
  return (data || []).find((p: any) => p.provider_name?.toLowerCase() === String(providerName).toLowerCase() && p.api_key_encrypted);
}

function isQuotaOrRateLimit(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /\b429\b|quota|rate.?limit|resource_exhausted/i.test(message);
}

async function generateBlogJsonResilient(
  admin: any,
  config: any,
  prompt: string,
  operation: string,
) {
  try {
    return await generateBlogJson(config, prompt, { admin, feature: "blog-agent", operation });
  } catch (firstError) {
    if (!isQuotaOrRateLimit(firstError)) throw firstError;

    const originalModel = String(config.textModel || "");
    const alternatives = ["openai", "anthropic", "xai"];
    const failures: string[] = [firstError instanceof Error ? firstError.message : String(firstError)];

    for (const providerName of alternatives) {
      const provider = await chooseProvider(admin, providerName);
      try {
        if (providerName === "openai") {
          if (provider?.api_key_encrypted) config.openaiKey = provider.api_key_encrypted;
          if (!config.openaiKey) continue;
          config.textModel = provider?.default_model || "gpt-4o-mini";
        } else if (providerName === "anthropic") {
          if (provider?.api_key_encrypted) config.claudeKey = provider.api_key_encrypted;
          if (!config.claudeKey) continue;
          config.textModel = provider?.default_model || "auto-haiku";
        } else {
          if (!provider?.api_key_encrypted) continue;
          config.compatibleApiKey = provider.api_key_encrypted;
          config.compatibleBaseUrl = provider.base_url || "https://api.x.ai/v1";
          config.textModel = provider.default_model || "grok-3-mini";
        }
        const result = await generateBlogJson(config, prompt, { admin, feature: "blog-agent", operation: `${operation}-quota-fallback` });
        return result;
      } catch (fallbackError) {
        failures.push(fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
      }
    }

    config.textModel = originalModel;
    throw new Error(`Gemini quota is exhausted and no configured fallback provider succeeded. Add an OpenAI, Claude or Grok key in Admin - AI Providers, or wait for the Gemini quota reset. ${failures.join(" | ").slice(0, 1200)}`);
  }
}

type SelectedEntity = {
  entity_type: "college" | "course" | "exam";
  slug: string;
  article_count?: number;
  topic_focus?: string[];
  schedule_id?: string;
  topic_offset?: number;
};

const ENTITY_ANGLES = {
  college: [
    ["latest_updates", "latest verified updates and what students should check now"],
    ["admissions", "admission process, eligibility, documents and decision timeline"],
    ["courses", "course choices, curriculum pathways and who each programme suits"],
    ["placements", "placement preparation, recruiter context and outcome questions to ask"],
    ["campus", "campus facilities, student life and practical planning"],
    ["scholarships", "scholarships, financial planning and application guidance"],
    ["evergreen_guides", "a practical student and parent decision guide"],
  ],
  course: [
    ["latest_updates", "latest academic and admission updates"],
    ["overview", "course scope, structure and who should choose it"],
    ["eligibility", "eligibility, entrance routes and application planning"],
    ["curriculum", "subjects, skills and learning roadmap"],
    ["careers", "career paths, roles and employability skills"],
    ["colleges", "how to compare colleges offering this course"],
    ["evergreen_guides", "a complete student decision guide"],
  ],
  exam: [
    ["latest_updates", "latest verified notice, dates and student action points"],
    ["eligibility", "eligibility, application steps and required documents"],
    ["pattern", "exam pattern, syllabus and marking strategy"],
    ["preparation", "preparation plan, revision method and mock-test strategy"],
    ["last_minute", "last-minute preparation and exam-day checklist"],
    ["cutoff", "result, cutoff and counselling guidance"],
    ["evergreen_guides", "a complete candidate guide"],
  ],
} as const;

async function loadSelectedEntityResearch(admin: any, selected: SelectedEntity[]) {
  const tableByType = { college: "colleges", course: "courses", exam: "exams" } as const;
  const pathByType = { college: "colleges", course: "courses", exam: "exams" } as const;
  const topics: any[] = [];
  const officialSources: any[] = [];

  for (const item of selected.slice(0, 20)) {
    const table = tableByType[item.entity_type];
    if (!table || !item.slug) continue;
    const { data } = await admin.from(table).select("*").eq("slug", item.slug).maybeSingle();
    if (!data) continue;
    let rawSources = data.data_source_urls;
    if (typeof rawSources === "string") {
      try { rawSources = JSON.parse(rawSources); } catch { /* keep invalid legacy source metadata out of fetches */ }
    }
    const sourceUrls = new Set<string>();
    [data.official_website, data.website].forEach((url: unknown) => {
      if (/^https?:\/\//i.test(String(url || ""))) sourceUrls.add(String(url));
    });
    if (Array.isArray(rawSources)) rawSources.forEach((url) => /^https?:\/\//i.test(String(url || "")) && sourceUrls.add(String(url)));
    if (rawSources && typeof rawSources === "object") {
      const values = [rawSources.website, ...(Array.isArray(rawSources.official) ? rawSources.official : []), ...(Array.isArray(rawSources.sources) ? rawSources.sources : [])];
      values.forEach((url) => /^https?:\/\//i.test(String(url || "")) && sourceUrls.add(String(url)));
    }
    sourceUrls.forEach((url) => officialSources.push({ name: `${data.name} official source`, url, source_type: "official", entity_type: item.entity_type, entity_slug: item.slug }));
    const safeRecord = Object.fromEntries(Object.entries(data).filter(([key]) => !["id", "created_at", "updated_at"].includes(key)).slice(0, 80));
    const requestedCount = Math.min(10, Math.max(1, Number(item.article_count || 1)));
    const focus = new Set((item.topic_focus || []).map((value) => String(value).toLowerCase()));
    const angles = ENTITY_ANGLES[item.entity_type];
    const preferredAngles = focus.size ? angles.filter(([kind]) => focus.has(kind)) : angles;
    const finalAngles = preferredAngles.length ? preferredAngles : angles;
    for (let index = 0; index < requestedCount; index += 1) {
      const [topicKind, angle] = finalAngles[(index + Number(item.topic_offset || 0)) % finalAngles.length];
      topics.push({
        title: `${data.name}: ${angle}`,
        angle: `A source-aware ${angle} for Indian students and parents`,
        primary_keyword: data.name,
        geo_focus: [data.city, data.state, "India"].filter(Boolean).join(", "),
        reason: index === 0 ? "Selected by an administrator for official-source research" : "Scheduled entity coverage with a distinct student-intent angle",
        category: item.entity_type === "exam" ? "Exams" : item.entity_type === "course" ? "Courses" : "Colleges",
        tags: [item.entity_type, item.slug, "entity-article-agent", topicKind],
        topic_kind: topicKind,
        selected_entity: { type: item.entity_type, slug: item.slug, name: data.name, url: `https://dekhocampus.com/${pathByType[item.entity_type]}/${item.slug}` },
        database_facts: safeRecord,
        schedule_id: item.schedule_id || null,
      });
    }

    const newsQuery = encodeURIComponent(`\"${data.name}\" education OR admission OR exam`);
    officialSources.push({
      name: `${data.name} public news signals`,
      url: `https://news.google.com/rss/search?q=${newsQuery}&hl=en-IN&gl=IN&ceid=IN:en`,
      source_type: "public_signal",
      entity_type: item.entity_type,
      entity_slug: item.slug,
    });
  }
  return { topics, officialSources };
}

async function callModel(admin: any, providerName: string, prompt: string) {
  const chosen = await chooseProvider(admin, providerName);
  if (!chosen || chosen.provider_name === "gemini") {
    return { raw: await geminiGenerate({ system: "Return valid JSON only.", prompt, json: true }) || "{}", modelUsed: `gemini:${GEMINI_MODEL}` };
  }

  const anthropic = chosen.provider_name === "anthropic" || String(chosen.base_url || "").includes("anthropic.com");
  const response = await fetch(chosen.base_url, anthropic
    ? { method: "POST", headers: { "x-api-key": chosen.api_key_encrypted, "anthropic-version": "2023-06-01", "Content-Type": "application/json" }, body: JSON.stringify({ model: chosen.default_model, max_tokens: 8192, system: "Return valid JSON only.", messages: [{ role: "user", content: prompt }] }) }
    : { method: "POST", headers: { Authorization: `Bearer ${chosen.api_key_encrypted}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: chosen.default_model, messages: [{ role: "system", content: "Return valid JSON only." }, { role: "user", content: prompt }], response_format: { type: "json_object" } }) });

  if (!response.ok) throw new Error(`Selected AI provider failed with ${response.status}`);
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || (Array.isArray(data.content) ? data.content.map((b: any) => b.text || "").join("") : "{}");
  return { raw, modelUsed: `${chosen.provider_name}:${chosen.default_model}` };
}

function parseJson(raw: string) {
  const cleaned = String(raw || "{}").replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("AI response did not contain a JSON object");
  }
}

async function parseOrRepairJson(blogAi: any, raw: string, admin?: any) {
  try {
    return parseJson(raw);
  } catch (firstError) {
    const repairPrompt = `Repair the following malformed JSON into one valid JSON object. Preserve every factual value and all HTML content. Escape quotes, backslashes and newlines correctly. Remove markdown fences. Return only the repaired JSON object.\n\n${raw}`;
    const repaired = admin
      ? await generateBlogJsonResilient(admin, blogAi, repairPrompt, "json-repair")
      : await generateBlogJson(blogAi, repairPrompt);
    try {
      return parseJson(repaired);
    } catch {
      throw new Error(`AI returned malformed JSON and automatic repair failed: ${firstError instanceof Error ? firstError.message : String(firstError)}`);
    }
  }
}

async function uploadCover(admin: any, slug: string, svg: string) {
  const path = `blog-covers/${slug}-${Date.now()}.svg`;
  const { error } = await admin.storage.from("admin-uploads").upload(path, new Blob([svg], { type: "image/svg+xml" }), { contentType: "image/svg+xml", upsert: false });
  if (error) return "";
  return admin.storage.from("admin-uploads").getPublicUrl(path).data.publicUrl;
}

async function updateRun(admin: any, runId: string, values: Record<string, unknown>) {
  if (runId) await admin.from("blog_auto_agent_runs").update(values).eq("id", runId);
}

class RunControlError extends Error {
  status: "paused" | "cancelled" | "aborted";
  constructor(status: "paused" | "cancelled" | "aborted") {
    super(`RUN_${status.toUpperCase()}`);
    this.status = status;
  }
}

async function assertRunActive(admin: any, runId: string) {
  if (!runId) return;
  const { data, error } = await admin.from("blog_auto_agent_runs").select("status").eq("id", runId).maybeSingle();
  if (error) throw error;
  if (["paused", "cancelled", "aborted"].includes(data?.status)) {
    throw new RunControlError(data.status);
  }
}

async function loadExistingArticles(admin: any) {
  const rows: any[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin.from("articles")
      .select("id,title,slug,description,created_at")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function normalizedTitle(value: string) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isSimilarTitle(candidate: string, existingTitles: string[]) {
  const words = new Set(normalizedTitle(candidate).split(" ").filter((word) => word.length > 2));
  if (!words.size) return true;
  return existingTitles.some((title) => {
    const other = new Set(title.split(" ").filter((word) => word.length > 2));
    const intersection = [...words].filter((word) => other.has(word)).length;
    const union = new Set([...words, ...other]).size;
    return union > 0 && intersection / union >= 0.72;
  });
}

function dedupeSources(rows: any[] | null | undefined) {
  const byUrl = new Map<string, any>();
  for (const source of [...DEFAULT_SOURCES, ...(rows || [])]) {
    const url = String(source?.url || "").trim();
    if (!url || BLOCKED_ARTICLE_COMPETITOR_PATTERN.test(`${source?.name || ""} ${url}`)) continue;
    // A saved setting deliberately overrides the built-in default, including
    // its active/inactive state.
    byUrl.set(url.toLowerCase(), { ...source, url });
  }
  return [...byUrl.values()];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, service);

  let runId = "";
  let activeEntitySchedule: any = null;
  try {
    await requireAccess(req, admin);
    const body: any = await req.json().catch(() => ({}));
    let resumedRun: any = null;

    if (["pause", "resume", "cancel", "abort"].includes(body.action)) {
      const requestedRunId = String(body.run_id || "");
      if (!requestedRunId) return json({ error: "run_id is required" }, 400);
      const { data: existingRun, error: runError } = await admin.from("blog_auto_agent_runs").select("*").eq("id", requestedRunId).maybeSingle();
      if (runError) throw runError;
      if (!existingRun) return json({ error: "Blog-agent run not found" }, 404);

      if (body.action === "pause") {
        if (existingRun.status !== "running") return json({ error: `Only a running task can be paused (current: ${existingRun.status})` }, 409);
        await updateRun(admin, requestedRunId, { status: "paused", paused_at: new Date().toISOString(), current_step: "Paused by administrator", control_note: cleanControlNote(body.note) });
        return json({ success: true, run_id: requestedRunId, status: "paused" });
      }
      if (body.action === "cancel") {
        if (!["running", "paused", "cancelling"].includes(existingRun.status)) return json({ error: `Task is already ${existingRun.status}` }, 409);
        await updateRun(admin, requestedRunId, { status: "cancelled", cancelled_at: new Date().toISOString(), finished_at: new Date().toISOString(), current_step: "Cancelled safely by administrator", control_note: cleanControlNote(body.note) });
        return json({ success: true, run_id: requestedRunId, status: "cancelled" });
      }
      if (body.action === "abort") {
        if (!["running", "paused", "cancelling"].includes(existingRun.status)) return json({ error: `Task is already ${existingRun.status}` }, 409);
        await updateRun(admin, requestedRunId, { status: "aborted", aborted_at: new Date().toISOString(), finished_at: new Date().toISOString(), current_step: "Aborted immediately by administrator", control_note: cleanControlNote(body.note) });
        return json({ success: true, run_id: requestedRunId, status: "aborted" });
      }

      if (existingRun.status !== "paused") return json({ error: `Only a paused task can be resumed (current: ${existingRun.status})` }, 409);
      resumedRun = existingRun;
      runId = requestedRunId;
      await updateRun(admin, requestedRunId, {
        status: "running",
        resumed_at: new Date().toISOString(),
        paused_at: null,
        finished_at: null,
        current_step: "Resuming from saved progress",
        control_note: cleanControlNote(body.note),
      });
    }
    const entityScheduleMode = body.mode === "entity_schedule";
    const entityResearchMode = body.mode === "entity_research" || entityScheduleMode;
    const triggerType = entityScheduleMode ? "entity_schedule" : body.trigger_type === "schedule" ? "schedule" : entityResearchMode ? "entity_research" : "manual";

    let requestedEntities = (Array.isArray(body.selected_entities) ? body.selected_entities : []) as SelectedEntity[];
    if (entityScheduleMode) {
      if (body.schedule_id) {
        const { data, error } = await admin.from("entity_article_schedules").select("*").eq("id", body.schedule_id).maybeSingle();
        if (error) throw error;
        activeEntitySchedule = data;
        if (activeEntitySchedule) {
          await admin.from("entity_article_schedules").update({ last_status: "running", last_message: "Manual run started" }).eq("id", activeEntitySchedule.id);
        }
      } else {
        const { data, error } = await admin.rpc("claim_due_entity_article_schedule");
        if (error) throw error;
        activeEntitySchedule = data?.[0] || null;
      }
      if (!activeEntitySchedule) return json({ skipped: true, message: "No entity article schedule is due" });

      const indiaDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const { count, error: countError } = await admin.from("entity_article_publications")
        .select("id", { count: "exact", head: true })
        .eq("schedule_id", activeEntitySchedule.id)
        .eq("generated_for_date", indiaDate);
      if (countError) throw countError;
      const producedToday = Number(count || 0);
      const remainingToday = Math.max(0, Number(activeEntitySchedule.articles_per_day || 1) - producedToday);
      if (!remainingToday) {
        await admin.from("entity_article_schedules").update({ last_status: "skipped", last_message: "Daily article target already reached" }).eq("id", activeEntitySchedule.id);
        return json({ skipped: true, message: "Daily entity article target reached", schedule_id: activeEntitySchedule.id });
      }
      const requestedNow = body.generate_remaining_today ? remainingToday : Math.min(remainingToday, Math.max(1, Number(body.article_count || 1)));
      requestedEntities = [{
        entity_type: activeEntitySchedule.entity_type,
        slug: activeEntitySchedule.entity_slug,
        article_count: requestedNow,
        topic_focus: activeEntitySchedule.topic_focus,
        schedule_id: activeEntitySchedule.id,
        topic_offset: producedToday,
      }];
      body.override = {
        ...(body.override || {}),
        posts_per_run: requestedNow,
        publish_status: activeEntitySchedule.publish_status,
        human_review_required: activeEntitySchedule.human_review_required,
      };
    }

    const { data: settingsRow } = await admin.from("blog_auto_agent_settings").select("*").eq("id", "default").maybeSingle();
    const settings = {
      enabled: false,
      interval_minutes: 60,
      posts_per_run: 2,
      daily_post_cap: 12,
      publish_status: "Published",
      model_provider: "gemini",
      text_model: "gemini-3.5-flash-lite",
      word_limit: 1200,
      author_mode: "none",
      author_ids: [],
      last_author_index: -1,
      language: "English",
      audience: "Indian students and parents",
      tone: "Clear, practical, trustworthy",
      content_goals: ["SEO", "AEO", "GEO", "AIO", "LLMO", "LLM"],
      required_sections: ["Quick answer", "Key facts", "Step-by-step guidance", "FAQs"],
      minimum_sources: 2,
      editorial_quality_target: 80,
      human_review_required: true,
      image_mode: "generated",
      image_provider: "gemini",
      image_model: "gemini-3.1-flash-lite-image",
      image_template_url: "",
      image_prompt_style: "Premium editorial, clean, credible, student-focused",
      include_logo: true,
      logo_url: "https://dekhocampus.com/brand/dekhocampus-blog-logo.png",
      logo_position: "top-center",
      image_aspect_ratio: "16:9",
      output_resolution: "4k",
      google_trends_daily_enabled: true,
      google_trends_daily_posts: 3,
      ...(settingsRow || {}),
      ...(body.override || {}),
    };
    const blogAi = await loadBlogAiConfig(admin, service);
    // The provider selected in the blog-agent form is authoritative for this
    // workflow. Runtime Control Centre is applied afterwards as the deliberate
    // operational override/failover layer.
    if (settings.model_provider === "gemini") blogAi.textModel = settings.text_model || "gemini-3.5-flash-lite";
    else if (settings.model_provider === "openai") blogAi.textModel = settings.text_model || "gpt-5.6-luna";
    else if (settings.model_provider === "anthropic" || settings.model_provider === "claude") blogAi.textModel = settings.text_model || "auto-haiku";
    else if (settings.model_provider === "xai") blogAi.textModel = settings.text_model || "grok-4.5";
    else throw new Error(`Unsupported blog text provider: ${settings.model_provider}. Choose Gemini, Claude, OpenAI or Grok.`);
    await applyBlogTextRuntimeControl(admin, "blog-agent", blogAi);
    if (String(blogAi.textModel).startsWith("grok")) {
      const xai = await chooseProvider(admin, "xai");
      if (!xai) throw new Error("Grok / xAI API key is not configured in Admin - AI Providers");
      blogAi.compatibleApiKey = xai.api_key_encrypted;
      blogAi.compatibleBaseUrl = xai.base_url || "https://api.x.ai/v1";
    }
    blogAi.imageProvider = settings.image_provider || "gemini";
    blogAi.imageModel = settings.image_model || (blogAi.imageProvider === "gemini" ? "gemini-3.1-flash-lite-image" : blogAi.imageProvider === "xai" ? "grok-imagine-image" : "gpt-image-1");
    if (blogAi.imageProvider === "xai") {
      const xai = await chooseProvider(admin, "xai");
      if (!xai) throw new Error("Grok / xAI API key is not configured in Admin - AI Providers");
      blogAi.imageApiKey = xai.api_key_encrypted;
      blogAi.imageBaseUrl = xai.base_url || "https://api.x.ai/v1";
    }
    const selectedAuthorIds = Array.isArray(settings.author_ids) ? settings.author_ids.filter(Boolean) : [];
    const { data: selectedAuthorRows } = selectedAuthorIds.length
      ? await admin.from("authors").select("id,name").eq("is_active", true).in("id", selectedAuthorIds)
      : { data: [] };
    const authorsById = new Map((selectedAuthorRows || []).map((author: any) => [author.id, author]));
    const selectedAuthors = selectedAuthorIds.map((id: string) => authorsById.get(id)).filter(Boolean) as Array<{ id: string; name: string }>;

    if (!entityResearchMode && triggerType === "schedule" && !settings.enabled) return json({ skipped: true, message: "Blog auto agent is disabled" });
    if (!entityResearchMode && triggerType === "schedule" && settings.next_run_at && new Date(settings.next_run_at).getTime() > Date.now()) {
      return json({ skipped: true, message: "Next run time has not arrived yet", next_run_at: settings.next_run_at });
    }

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const { data: todayArticles } = await admin.from("articles").select("id").gte("created_at", dayStart.toISOString()).contains("tags", ["auto-blog-agent"]);
    const effectiveDailyCap = entityResearchMode ? 100 : Number(settings.daily_post_cap || 12);
    if ((todayArticles || []).length >= effectiveDailyCap) {
      return json({ skipped: true, message: "Daily post cap reached", count: (todayArticles || []).length });
    }

    if (resumedRun) {
      await updateRun(admin, runId, {
        current_step: "Preparing research sources after resume",
        estimated_seconds: Math.max(90, Number(settings.posts_per_run || 1) * 105),
      });
    } else {
      const { data: run } = await admin.from("blog_auto_agent_runs").insert({
        status: "running",
        trigger_type: triggerType,
        interval_minutes: settings.interval_minutes,
        model_provider: settings.model_provider,
        word_limit: settings.word_limit,
        progress: 3,
        current_step: "Preparing research sources",
        estimated_seconds: Math.max(90, Number(settings.posts_per_run || 1) * 105),
        total_steps: 2 + Number(settings.posts_per_run || 1) * 3,
        entity_schedule_id: activeEntitySchedule?.id || null,
        agent_mode: entityScheduleMode ? "entity_schedule" : entityResearchMode ? "entity_research" : "general",
      }).select("id").single();
      runId = run?.id || "";
    }

    const { data: sourceRows } = await admin.from("blog_research_sources").select("*").order("display_order");
    let sources = dedupeSources(sourceRows).filter((source) => source.is_active !== false);
    let selectedEntityTopics: any[] = [];
    if (entityResearchMode) {
      const selected = requestedEntities
        .filter((item: any) => ["college", "course", "exam"].includes(item?.entity_type) && item?.slug)
        .slice(0, 20) as SelectedEntity[];
      if (!selected.length) throw new Error("Select at least one college, course or exam for research");
      const entityResearch = await loadSelectedEntityResearch(admin, selected);
      selectedEntityTopics = entityResearch.topics;
      sources = [...entityResearch.officialSources, ...sources].slice(0, 30);
    }
    await updateRun(admin, runId, { progress: 8, current_step: `Researching ${sources.length} sources`, completed_steps: 0 });
    const signals = await fetchSignals(sources);
    await assertRunActive(admin, runId);
    await updateRun(admin, runId, { progress: 20, current_step: "Checking every existing DekhoCampus article", completed_steps: 1 });
    const existingArticles = await loadExistingArticles(admin);
    const existingSlugs = new Set(existingArticles.map((article: any) => article.slug));
    const existingTitleList = existingArticles.map((article: any) => normalizedTitle(article.title));
    const existingTitles = new Set(existingTitleList);

    const { data: dailyTrendArticles } = triggerType === "schedule" && settings.google_trends_daily_enabled !== false
      ? await admin.from("articles").select("id").gte("created_at", dayStart.toISOString()).contains("tags", ["google-trends-daily"])
      : { data: [] };
    const trendSlotsRemaining = triggerType === "schedule" && settings.google_trends_daily_enabled !== false
      ? Math.max(0, Math.min(3, Number(settings.google_trends_daily_posts || 3)) - (dailyTrendArticles || []).length)
      : 0;
    const trendCandidates = signals
      .flatMap((signal: any) => Array.isArray(signal.trend_candidates) ? signal.trend_candidates : [])
      .sort((a: any, b: any) => Number(b.traffic_score || 0) - Number(a.traffic_score || 0))
      .slice(0, 20);
    const remainingDailyCapacity = Math.max(0, effectiveDailyCap - (todayArticles || []).length);
    const dailyTrendMode = !entityResearchMode && trendSlotsRemaining > 0 && trendCandidates.length > 0;
    const requestedEntityArticleCount = entityResearchMode
      ? requestedEntities.reduce((sum, item) => sum + Math.min(10, Math.max(1, Number(item.article_count || 1))), 0)
      : Number(settings.posts_per_run || 1);
    const postLimit = Math.max(0, Math.min(
      dailyTrendMode ? trendSlotsRemaining : requestedEntityArticleCount,
      remainingDailyCapacity,
    ));
    if (!postLimit) return json({ skipped: true, message: "Daily post cap reached", count: (todayArticles || []).length });

    const dailyTrendInstruction = dailyTrendMode
      ? `\n\nDAILY GOOGLE TRENDS MODE: Select exactly ${postLimit} distinct article opportunities from these top Indian Google Trends candidates, ordered by their published approximate traffic estimate:\n${JSON.stringify(trendCandidates)}\nEvery returned topic MUST contain trend_source_title copied exactly from one candidate title and trend_volume copied from that candidate's approximate_traffic. Do not invent a trend, do not select a lower-volume candidate while a higher-volume relevant education candidate is available, and skip unrelated/non-education candidates.`
      : "";
    const topicPrompt = `You are the DekhoCampus education-news editor. Today is ${new Date().toISOString().slice(0, 10)} in India.\n\nResearch signals from official, public, Google News/trend and own website pages only:\n${JSON.stringify(signals)}\n\nRecent DekhoCampus article titles and slugs to avoid duplicates:\n${JSON.stringify(existingArticles.slice(0, 1500).map((a: any) => ({ title: a.title, slug: a.slug })))}\n\nPick the best ${dailyTrendMode ? postLimit : Math.max(postLimit * 2, 4)} article opportunities for Indian students and parents. Prioritise timely admissions, exams, counselling, scholarships, careers and college decisions. Reject anything already covered by DekhoCampus. Do not use, cite, mention or link competitor publishers.${dailyTrendInstruction}\nReturn JSON only: {topics:[{title,angle,primary_keyword,geo_focus,reason,category,tags:[...],trend_source_title?,trend_volume?}]}.`;
    const generatedTopics = entityResearchMode
      ? selectedEntityTopics
      : ((await parseOrRepairJson(blogAi, await generateBlogJsonResilient(admin, blogAi, topicPrompt + "\nUse natural plain language, never use an em dash, and return JSON only.", "topic-research"), admin)).topics || []);
    await assertRunActive(admin, runId);
    const allowedTrendTitles = new Set(trendCandidates.map((item: any) => normalizedTitle(item.title)));
    const topics = generatedTopics.filter((topic: any) => {
      const candidateSlug = slugify(topic.title || "");
      const isAllowedTrend = !dailyTrendMode || allowedTrendTitles.has(normalizedTitle(topic.trend_source_title));
      return isAllowedTrend && candidateSlug && !existingSlugs.has(candidateSlug) && !existingTitles.has(normalizedTitle(topic.title)) && !isSimilarTitle(topic.title, existingTitleList);
    }).slice(0, postLimit);
    await updateRun(admin, runId, {
      progress: 30,
      current_step: topics.length ? `Selected ${topics.length} original topic(s)` : "No new non-duplicate topics found",
      selected_topics: topics,
      sources: signals.map(({ signal, ...rest }: any) => rest),
      completed_steps: 2,
    });

    const createdIds: string[] = Array.isArray(resumedRun?.created_article_ids) ? [...resumedRun.created_article_ids] : [];
    for (const [topicIndex, topic] of topics.entries()) {
      if (createdIds.length >= postLimit) break;
      await getAiRuntimeControl(admin, "blog-agent");
      await assertRunActive(admin, runId);
      const baseProgress = 30 + Math.round((topicIndex / Math.max(topics.length, 1)) * 65);
      await updateRun(admin, runId, { progress: baseProgress, current_step: `Writing article ${topicIndex + 1} of ${topics.length}`, completed_steps: 2 + topicIndex * 3 });
      const internalLinkContext = await loadInternalLinkContext(admin, topic);
      const topicSignals = topic.selected_entity?.slug
        ? signals.filter((source: any) => !source.entity_slug || source.entity_slug === topic.selected_entity.slug)
        : signals;
      const articlePrompt = `Create a complete original DekhoCampus article from this approved topic:\n${JSON.stringify(topic)}\n\nResearch context:\n${JSON.stringify(topicSignals)}\n\nVerified internal-link candidates (use only when genuinely useful):\n${JSON.stringify(internalLinkContext)}\n\nEditorial configuration:\n${JSON.stringify({
        language: settings.language,
        audience: settings.audience,
        tone: settings.tone,
        content_goals: settings.content_goals,
        required_sections: settings.required_sections,
        minimum_sources: settings.minimum_sources,
        editorial_quality_target: settings.editorial_quality_target,
      })}\n\nTarget length: ${settings.word_limit} words.\n\nReturn JSON only: {title,slug,description,content_html,meta_title,meta_description,meta_keywords,tags,entity_suggestions:[{entity_type,entity_slug,label}],research_notes,cover_kicker}.\n\nRules: optimise for the configured search, answer-engine, geographic and AI-discovery goals while prioritising student usefulness. Open with a concise direct answer, use descriptive headings, short paragraphs, comparison-ready facts, FAQs, named entities, and small hyphen '-' only. Turn the approved angle into a natural, specific headline instead of copying the prompt wording. Write naturally with varied sentence length and concrete student-facing explanations; do not claim a human or detector score. Never copy source wording or structure. Never describe an item as news, latest, announced, changed or current unless a dated research signal supports that statement. If no genuine recent update exists, write the supplied evergreen student-guide angle and say what readers should verify on the official site. Treat database_facts as context that can be stale; do not repeat fees, dates, rankings, acreage, placements, recruiters, approvals or superlative claims unless corroborated by supplied first-party evidence. Never call a programme world-class or invent a development. Avoid fake certainty on dates, fees, cutoffs or rules. Use official, first-party, regulator, authority, government, university, exam-authority, Google News/trend and DekhoCampus internal context only. Do not use competitor sites as research sources. Do not add any visible Sources, References, Citations, bibliography, source links, credits or competitor-credit section in content_html. Never mention or link competitor publication names/domains such as CollegeDekho, Collegedunia, Shiksha, Careers360, KollegeApply, GetMyUni or PaGaLGuY in the article body. Keep source notes only inside research_notes for internal editorial review. Add useful internal links only when a matching DekhoCampus college, course, exam, job profile, scholarship, tool or news page is present in the supplied context.`;
      const articleRaw = await generateBlogJsonResilient(admin, blogAi, articlePrompt + "\nThis is AI-assisted content that requires editorial review. Never claim human authorship, undetectability, a detector score or 0 AI.", "article-generation");
      await assertRunActive(admin, runId);
      const draft = await parseOrRepairJson(blogAi, articleRaw, admin);
      const slug = slugify(draft.slug || draft.title || topic.title);
      if (!slug || existingSlugs.has(slug) || existingTitles.has(normalizedTitle(draft.title || topic.title)) || isSimilarTitle(draft.title || topic.title, existingTitleList)) continue;
      await updateRun(admin, runId, { progress: Math.min(90, baseProgress + 12), current_step: `Generating cover ${topicIndex + 1} of ${topics.length}`, completed_steps: 3 + topicIndex * 3 });
      let featured_image = "";
      if (settings.image_mode !== "none") {
        const configuredImageProvider = blogAi.imageProvider;
        const imageControl = await applyImageRuntimeControl(admin, blogAi);
        if (imageControl.provider && ["gemini", "openai", "xai"].includes(imageControl.provider)) blogAi.imageProvider = imageControl.provider as any;
        if (blogAi.imageProvider !== configuredImageProvider && !imageControl.model) {
          blogAi.imageModel = blogAi.imageProvider === "gemini" ? "gemini-3.1-flash-lite-image" : blogAi.imageProvider === "xai" ? "grok-imagine-image" : "gpt-image-1";
        }
        if (blogAi.imageProvider === "xai" && !blogAi.imageApiKey) {
          const xai = await chooseProvider(admin, "xai");
          if (!xai) throw new Error("Grok / xAI image API key is not configured in Admin - AI Providers");
          blogAi.imageApiKey = xai.api_key_encrypted;
          blogAi.imageBaseUrl = xai.base_url || "https://api.x.ai/v1";
        }
        featured_image = await generateAndUploadBlogCover(admin, blogAi, slug, draft.hero_hook || draft.title || topic.title, {
          mode: settings.image_mode,
          templateUrl: settings.image_template_url,
          promptStyle: settings.image_prompt_style,
          includeLogo: settings.include_logo,
          logoUrl: settings.logo_url,
          logoPosition: settings.logo_position,
          aspectRatio: settings.image_aspect_ratio,
          resolution: settings.output_resolution,
        });
        await assertRunActive(admin, runId);
      }
      const tags = Array.from(new Set([
        ...(draft.tags || []),
        "auto-blog-agent",
        ...(entityResearchMode ? ["entity-article-agent", topic.selected_entity?.type, topic.selected_entity?.slug, topic.topic_kind].filter(Boolean) : []),
        ...(dailyTrendMode ? ["google-trends-daily", "trending"] : []),
      ]));
      const authorIndex = settings.author_mode === "round_robin" && selectedAuthors.length
        ? (Number(settings.last_author_index ?? -1) + createdIds.length + 1) % selectedAuthors.length
        : 0;
      const assignedAuthor = settings.author_mode !== "none" ? selectedAuthors[authorIndex] : undefined;

      await updateRun(admin, runId, { progress: Math.min(96, baseProgress + 23), current_step: `Publishing article ${topicIndex + 1} of ${topics.length}`, completed_steps: 4 + topicIndex * 3 });
      const { data: article, error } = await admin.from("articles").insert({
        title: draft.title || topic.title,
        slug,
        description: draft.description || topic.angle || "",
        content: normalizeArticleLinks(draft.content_html || ""),
        meta_title: draft.meta_title || draft.title || topic.title,
        meta_description: draft.meta_description || draft.description || topic.angle || "",
        meta_keywords: draft.meta_keywords || topic.primary_keyword || "",
        tags,
        category: topic.category || "",
        author: assignedAuthor?.name || "DekhoCampus Editorial",
        author_id: assignedAuthor?.id || null,
        featured_image,
        status: settings.human_review_required ? "Draft" : settings.publish_status,
        is_active: true,
      }).select("id").single();
      if (error) throw error;
      createdIds.push(article.id);
      existingSlugs.add(slug);
      const savedTitle = normalizedTitle(draft.title || topic.title);
      existingTitles.add(savedTitle);
      existingTitleList.push(savedTitle);

      if (topic.selected_entity?.type && topic.selected_entity?.slug) {
        await admin.from("article_links").upsert({
          article_id: article.id,
          entity_type: topic.selected_entity.type,
          entity_slug: topic.selected_entity.slug,
        }, { onConflict: "article_id,entity_type,entity_slug" });
      }
      if (topic.schedule_id) {
        await admin.from("entity_article_publications").insert({
          schedule_id: topic.schedule_id,
          article_id: article.id,
          entity_type: topic.selected_entity?.type,
          entity_slug: topic.selected_entity?.slug,
          topic_kind: topic.topic_kind || "evergreen_guide",
        });
      }

      for (const suggestion of draft.entity_suggestions || []) {
        await admin.from("article_links").upsert({ article_id: article.id, entity_type: suggestion.entity_type, entity_slug: suggestion.entity_slug }, { onConflict: "article_id,entity_type,entity_slug" });
      }
    }

    const nextRun = new Date(Date.now() + Number(settings.interval_minutes || 60) * 60 * 1000).toISOString();
    const nextAuthorIndex = settings.author_mode === "round_robin" && selectedAuthors.length && createdIds.length
      ? (Number(settings.last_author_index ?? -1) + createdIds.length) % selectedAuthors.length
      : Number(settings.last_author_index ?? -1);
    if (!entityResearchMode) {
      await admin.from("blog_auto_agent_settings").upsert({ id: "default", last_run_at: new Date().toISOString(), next_run_at: nextRun, last_author_index: nextAuthorIndex });
    }
    if (activeEntitySchedule) {
      await admin.from("entity_article_schedules").update({
        last_run_at: new Date().toISOString(),
        last_status: createdIds.length ? "completed" : "skipped",
        last_message: createdIds.length ? `Created ${createdIds.length} article(s)` : "No new non-duplicate topic was available",
      }).eq("id", activeEntitySchedule.id);
    }
    if (runId) await admin.from("blog_auto_agent_runs").update({
      status: "completed",
      progress: 100,
      current_step: "Completed",
      completed_steps: 2 + topics.length * 3,
      finished_at: new Date().toISOString(),
      sources: signals.map(({ signal, ...rest }) => rest),
      selected_topics: topics,
      created_article_ids: createdIds,
      message: `Created ${createdIds.length} article(s) using ${blogTextProviderLabel(blogAi.textModel)}:${blogAi.textModel} and ${blogAi.imageProvider || "openai"}:${blogAi.imageModel}`,
    }).eq("id", runId);

    return json({ success: true, created_article_ids: createdIds, topics, next_run_at: entityResearchMode ? activeEntitySchedule?.next_run_at || null : nextRun, schedule_id: activeEntitySchedule?.id || null });
  } catch (error) {
    if (error instanceof RunControlError) {
      return json({ success: true, run_id: runId, status: error.status, message: `Run ${error.status}` });
    }
    const message = error instanceof Error ? error.message : String(error);
    if (runId) await admin.from("blog_auto_agent_runs").update({ status: "failed", progress: 100, current_step: "Failed", finished_at: new Date().toISOString(), message }).eq("id", runId);
    if (activeEntitySchedule?.id) {
      await admin.from("entity_article_schedules").update({ last_status: "failed", last_message: message.slice(0, 500) }).eq("id", activeEntitySchedule.id);
    }
    return json({ error: message }, 400);
  }
});
