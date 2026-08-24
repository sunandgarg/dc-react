import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { generateBlogJson, loadBlogAiConfig, resolveClaudeTextModel, type BlogAiConfig } from "../_shared/blog-ai.ts";
import { logAiUsage } from "../_shared/ai-usage.ts";
import { getAiRuntimeControl } from "../_shared/ai-control.ts";
import { geminiGenerate, geminiGroundedGenerate } from "../_shared/gemini.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-data-cleaner-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TABLES: Record<string, string> = {
  colleges: "colleges",
  courses: "courses",
  exams: "exams",
  careers: "career_profiles",
  scholarships: "scholarships",
  articles: "articles",
  study_material: "study_subjects",
  college_study: "college_universities",
  cat_universe: "cat_universe_modules",
};

const ALLOWED_FIELDS: Record<string, string[]> = {
  colleges: [
    "official_website", "name", "short_name", "description", "page_summary", "established", "type", "category",
    "categories", "city", "state", "location", "fees", "admission_process", "eligibility_criteria", "cutoff",
    "admission_deadline", "scholarship_available", "scholarship_details", "placement", "placement_content",
    "ranking", "rankings_content", "facilities", "facilities_content", "highlights", "tags", "approvals",
    "affiliation_kind", "parent_university_slug", "secondary_city", "secondary_state", "admission_criteria_points",
    "related_courses", "related_exams",
    "naac_grade", "top_recruiters", "hostel_life", "course_fee_content", "meta_title", "meta_description", "meta_keywords",
    "image", "logo", "carousel_images", "gallery_images", "brochure_url", "approval_logos", "banner_ad_image", "square_ad_image",
  ],
  courses: [
    "official_website", "name", "full_name", "description", "short_description", "page_summary", "category", "categories",
    "domain", "level", "mode", "study_type", "duration", "duration_type", "eligibility", "fee", "fee_type",
    "low_fee", "high_fee", "avg_fees", "avg_salary", "growth", "specializations", "subjects", "top_exams", "careers",
    "about_content", "admission_process", "cutoff_content", "fees_content", "placements_content", "recruiters_content",
    "scope_content", "specialization_content", "subjects_content", "syllabus_content", "meta_title", "meta_description", "meta_keywords",
    "image", "syllabus_pdf_url",
  ],
  exams: [
    "official_website", "website", "name", "short_name", "full_name", "description", "page_summary", "category", "categories",
    "exam_type", "level", "mode", "frequency", "duration", "language", "eligibility", "age_limit", "application_mode",
    "application_start_date", "application_end_date", "exam_date", "result_date", "registration_url", "brochure_url", "sample_paper_url",
    "applicants", "question_paper", "question_papers",
    "application_process", "exam_pattern", "negative_marking", "cast_wise_fee", "gender_wise", "important_dates", "syllabus",
    "seats", "summary_content", "dates_content", "cutoff_content", "result_content", "counselling_content", "center_content",
    "preparation_tips", "meta_title", "meta_description", "meta_keywords", "image", "logo",
  ],
  careers: [
    "official_website", "name", "domain", "short_description", "description", "page_summary", "avg_salary", "growth",
    "experience_required", "top_skills", "top_companies", "job_roles", "related_courses", "related_exams",
    "meta_title", "meta_description", "meta_keywords", "image",
  ],
  scholarships: [
    "official_website", "title", "provider", "description", "page_summary", "category", "level", "amount", "deadline",
    "eligibility", "apply_url", "meta_title", "meta_description", "image",
  ],
  articles: [
    "official_website", "title", "description", "content", "category", "vertical", "tags", "meta_title", "meta_description", "meta_keywords", "featured_image",
  ],
  study_material: ["official_website", "name", "description", "cover_image"],
  college_study: ["official_website", "name", "short_name", "state", "city", "logo", "description", "total_semesters", "meta_title", "meta_description"],
  cat_universe: ["official_website", "title", "subtitle", "description", "detail_points", "audience_text", "meta_title", "meta_description"],
};

const MEDIA_ARRAY_FIELDS = new Set(["carousel_images", "gallery_images", "approval_logos"]);
const ARRAY_FIELDS = new Set([
  ...MEDIA_ARRAY_FIELDS,
  "approvals", "categories", "facilities", "highlights", "tags", "top_recruiters", "related_courses", "related_exams",
  "careers", "specializations", "subjects", "top_exams", "syllabus",
]);
const JSON_FIELDS = new Set(["admission_criteria_points", "important_dates", "question_papers"]);
const BOOLEAN_FIELDS = new Set(["negative_marking"]);
const NUMBER_FIELDS = new Set(["established", "fee", "low_fee", "high_fee"]);
const MEDIA_URL_FIELDS = new Set([
  "image", "logo", "cover_image", "featured_image", "brochure_url", "syllabus_pdf_url",
  "banner_ad_image", "square_ad_image",
]);
const OFFICIAL_ONLY_FIELDS = new Set([
  ...MEDIA_URL_FIELDS,
  ...MEDIA_ARRAY_FIELDS,
  "website", "registration_url", "apply_url", "sample_paper_url",
]);

const BLOCKED_HOST_PARTS = [
  "collegedunia", "wikipedia", "quora", "reddit", "facebook", "instagram", "youtube", "linkedin", "pinterest",
];
const AUTHORITATIVE_HOST_PARTS = [
  ".gov.in", ".ac.in", ".edu.in", "ugc.gov.in", "aicte-india.org", "nta.ac.in", "nirfindia.org",
  "education.gov.in", "nmc.org.in", "barcouncilofindia.org", "icai.org", "icsi.edu", "icmai.in",
];
const REPUTABLE_SECONDARY_HOST_PARTS = [
  "thehindu.com", "indianexpress.com", "hindustantimes.com", "timesofindia.indiatimes.com",
  "economictimes.indiatimes.com", "business-standard.com", "ndtv.com", "news18.com",
  "shiksha.com", "careers360.com", "collegedekho.com", "collegepravesh.com",
  "getmyuni.com", "education.indianexpress.com", "topuniversities.com", "timeshighereducation.com",
  "coursera.org", "edx.org", "swayam.gov.in", "nptel.ac.in",
];
const HIGH_RISK_FIELDS = new Set([
  "fees", "fee", "low_fee", "high_fee", "avg_fees", "avg_salary", "growth", "cutoff", "cutoff_content",
  "placement", "placement_content", "placements_content", "ranking", "rankings_content", "approvals", "naac_grade",
  "application_start_date", "application_end_date", "exam_date", "result_date", "important_dates", "seats",
  "applicants", "eligibility", "eligibility_criteria", "age_limit", "negative_marking", "cast_wise_fee", "gender_wise",
]);
const SEO_FIELDS = new Set(["meta_title", "meta_description", "meta_keywords", "page_summary"]);
const RICH_TEXT_FIELDS = new Set([
  "description", "content", "about_content", "scope_content", "subjects_content", "placements_content",
  "admission_process", "fees_content", "cutoff_content", "specialization_content", "recruiters_content",
  "syllabus_content", "summary_content", "dates_content", "result_content", "counselling_content",
  "center_content", "preparation_tips", "facilities_content", "rankings_content", "placement_content",
  "course_fee_content", "hostel_life", "scholarship_details", "application_process", "exam_pattern",
]);
const GENERIC_COURSE_SOURCE_URLS = [
  "https://www.ugc.gov.in/",
  "https://www.aicte-india.org/",
  "https://swayam.gov.in/",
  "https://nptel.ac.in/",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function normalizeUrl(value: unknown) {
  try {
    const url = new URL(String(value || "").trim());
    if (!/^https?:$/.test(url.protocol)) return "";
    url.hash = "";
    return url.toString();
  } catch { return ""; }
}

function hostOf(value: string) {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

function isBlockedHost(host: string) {
  return !host || BLOCKED_HOST_PARTS.some((part) => host.includes(part));
}

function sameOfficialDomain(candidate: string, officialHost: string) {
  const host = hostOf(candidate);
  return !!host && !isBlockedHost(host) && (host === officialHost || host.endsWith(`.${officialHost}`) || officialHost.endsWith(`.${host}`));
}

function sourceTier(url: string, officialHost = "") {
  const host = hostOf(url);
  if (!host || isBlockedHost(host)) return 0;
  if (officialHost && sameOfficialDomain(url, officialHost)) return 3;
  if (AUTHORITATIVE_HOST_PARTS.some((part) => host === part.replace(/^\./, "") || host.endsWith(part) || host.includes(part))) return 3;
  if (REPUTABLE_SECONDARY_HOST_PARTS.some((part) => host === part || host.endsWith(`.${part}`))) return 2;
  return 1;
}

function sameSourceDomain(left: string, right: string) {
  const leftHost = hostOf(left);
  const rightHost = hostOf(right);
  return !!leftHost && !!rightHost && (
    leftHost === rightHost ||
    leftHost.endsWith(`.${rightHost}`) ||
    rightHost.endsWith(`.${leftHost}`)
  );
}

function collectCitationUrls(value: unknown, output = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => collectCitationUrls(item, output));
  else if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    if (typeof object.url === "string") {
      const url = normalizeUrl(object.url);
      if (url) output.add(url);
    }
    Object.entries(object).forEach(([key, item]) => { if (key !== "text") collectCitationUrls(item, output); });
  }
  return output;
}

function fallbackCourseSources(row: Record<string, unknown>) {
  const name = cleanString(row.name || row.full_name || row.title || row.slug, 300).toLowerCase();
  if (!name) return [] as string[];
  const urls = new Set<string>(["https://www.ugc.gov.in/", "https://swayam.gov.in/"]);
  if (/(engineering|technology|b\.?tech|m\.?tech|polytechnic|diploma|aerospace|computer|mechanical|civil|electrical|electronics|textile|petroleum|biomedical)/i.test(name)) {
    urls.add("https://www.aicte-india.org/");
    urls.add("https://nptel.ac.in/");
  }
  return [...urls];
}

function pageMatchesEntity(text: string, aliases: string[]) {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const normalizedTokens = new Set(normalized.split(" ").filter(Boolean));
  return aliases.some((alias) => {
    const exact = alias.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (exact.length >= 4 && normalized.includes(exact)) return true;
    const tokens = [...new Set(exact.split(" ").filter((token) => token.length >= 2 && !["the", "and", "for", "of", "in"].includes(token)))];
    return tokens.length > 0 && tokens.filter((token) => normalizedTokens.has(token)).length >= Math.min(2, tokens.length);
  });
}

function entityAliases(row: Record<string, unknown>) {
  return [...new Set(["full_name", "name", "title", "short_name", "slug"]
    .map((field) => cleanString(row[field], 300))
    .filter(Boolean))];
}

function parseJson(raw: string) {
  const cleaned = String(raw || "{}").replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("The selected AI provider did not return a JSON object");
  }
}

async function parseOrRepair(config: BlogAiConfig, raw: string) {
  try { return parseJson(raw); } catch (error) {
    const fixed = await generateBlogJson(config, `Repair this malformed JSON. Preserve facts and URLs. Return only one valid JSON object.\n\n${raw}`);
    try { return parseJson(fixed); } catch { throw error; }
  }
}

async function requireAdmin(req: Request, admin: any) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authentication required");
  const { data } = await admin.auth.getUser(token);
  if (!data.user) throw new Error("Invalid session");
  const { data: role } = await admin.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
  if (!role) throw new Error("Admin permission required");
  return data.user;
}

async function requireTickAccess(req: Request, admin: any) {
  const supplied = req.headers.get("x-data-cleaner-secret") || "";
  if (supplied) {
    const { data } = await admin.from("data_cleaning_settings").select("scheduler_token").eq("id", "default").maybeSingle();
    if (data?.scheduler_token && supplied === data.scheduler_token) return null;
  }
  return requireAdmin(req, admin);
}

function compactExisting(row: Record<string, unknown>, entityType: string) {
  const allowed = new Set([
    "id", "slug", "data_clean_attempts", "data_clean_successes", "data_last_checked_at",
    "data_clean_state", "data_verified_at", "data_quality_score",
    ...(ALLOWED_FIELDS[entityType] || []),
  ]);
  return Object.fromEntries(Object.entries(row).filter(([key]) => allowed.has(key)));
}

function seedOfficialUrl(row: Record<string, unknown>) {
  for (const key of ["official_website", "website", "registration_url", "apply_url", "brochure_url"]) {
    const value = normalizeUrl(row[key]);
    const host = hostOf(value);
    if (value && !isBlockedHost(host)) return value;
  }
  return "";
}

async function fetchSourcePage(url: string) {
  if (!url) return { url: "", text: "" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "DekhoCampus cited-data-research/2.0", Accept: "text/html,application/xhtml+xml,text/plain,application/pdf" },
    });
    if (!response.ok) return { url: "", text: "" };
    const finalUrl = normalizeUrl(response.url || url);
    if (!finalUrl || isBlockedHost(hostOf(finalUrl))) return { url: "", text: "" };
    const text = (await response.text()).slice(0, 180_000)
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").slice(0, 24_000);
    return { url: finalUrl, text };
  } catch { return { url: "", text: "" }; } finally { clearTimeout(timer); }
}

async function discoverTrustedSources(entityType: string, row: Record<string, unknown>) {
  const name = cleanString(row.name || row.title || row.slug, 300);
  if (!name) return { officialUrl: "", dossier: "", pages: [] as Array<{ url: string; text: string }>, sourceUrls: [] as string[] };
  const aliases = entityAliases(row);
  const location = [row.city, row.state, row.location].filter(Boolean).join(", ");
  const request = {
    system: "Research education data using a transparent source hierarchy. Prefer first-party, government and regulator sources, then reputable independent sources. Never use social media, forums, Wikipedia or Collegedunia. Return valid JSON only.",
    prompt: `Build a concise research dossier for this DekhoCampus ${entityType} record.
Name: ${name}
Full name or aliases: ${aliases.join(" | ")}
Location or context: ${location || "not provided"}
Existing category or description: ${cleanString(row.category || row.description, 500) || "not provided"}

Return JSON only:
{"official_url":"https://... or empty","sources":[{"url":"https://...","type":"official|government|regulator|reputable_secondary","title":"..."}],"source_notes":["short verified fact with source URL"]}

Find 3-6 directly relevant sources when available. Generic courses may use regulator pages, professional bodies, government curriculum/career pages, university course pages and reputable education publications. Exams and colleges should prioritize their own site, the responsible authority, government/regulator records, ranking/accreditation sources and reputable reporting. Do not copy source wording; only identify facts and URLs. Prefer sources whose facts support AIO, AEO, SEO, GEO and LLMO answer extraction.`,
  };
  let grounded;
  try {
    grounded = await geminiGroundedGenerate({ ...request, model: "gemini-3.5-flash-lite" });
  } catch {
    grounded = await geminiGroundedGenerate({ ...request, model: "gemini-3.6-flash" });
  }
  const parsed = parseJson(grounded.text);
  const officialUrl = normalizeUrl(parsed.official_url);
  const declaredSources = Array.isArray(parsed.sources)
    ? parsed.sources.map((source: unknown) => normalizeUrl(typeof source === "string" ? source : (source as any)?.url))
    : [];
  const seed = seedOfficialUrl(row);
  const candidates = [...new Set([seed, officialUrl, ...declaredSources, ...grounded.sourceUrls].filter(Boolean))].slice(0, 10);
  const fetched = await Promise.all(candidates.map((url) => fetchSourcePage(url)));
  const pages = fetched
    .filter((page) => page.url && page.text && pageMatchesEntity(page.text, aliases))
    .filter((page, index, all) => all.findIndex((candidate) => sameSourceDomain(candidate.url, page.url)) === index)
    .slice(0, 6);
  // Grounded research often finds the correct source even when that site blocks
  // server-side HTML retrieval. Keep those cited URLs instead of turning a valid
  // research result into a false "no source" outcome.
  const sourceUrls = [...new Set([
    ...pages.map((page) => page.url),
    officialUrl,
    ...declaredSources,
    ...grounded.sourceUrls,
  ].map(normalizeUrl).filter((url) => sourceTier(url) > 0))].slice(0, 10);
  const verifiedOfficialUrl = officialUrl && sourceUrls.some((url) => sameSourceDomain(url, officialUrl)) ? officialUrl : "";
  return { officialUrl: verifiedOfficialUrl, dossier: grounded.text, pages, sourceUrls };
}

async function resolveOpenAiKey(admin: any, config: BlogAiConfig) {
  const environmentKey = String(Deno.env.get("OPENAI_API_KEY") || "").trim();
  if (environmentKey) return environmentKey;
  if (config.openaiKey) return config.openaiKey;
  const { data } = await admin
    .from("ai_providers")
    .select("api_key_encrypted")
    .eq("provider_name", "openai")
    .not("api_key_encrypted", "is", null)
    .order("is_active", { ascending: false })
    .limit(1)
    .maybeSingle();
  return String(data?.api_key_encrypted || "").trim();
}

async function researchWithAi(admin: any, config: BlogAiConfig, entityType: string, row: Record<string, unknown>) {
  const runtime = await getAiRuntimeControl(admin, "data-cleaner");
  const provider = runtime.provider || "anthropic";
  const name = String(row.name || row.title || row.slug || "");
  let seedUrl = seedOfficialUrl(row);
  let directText = "";
  let discoverySources: string[] = [];
  let researchDossier = "";
  if (provider === "gemini" || provider === "openai") {
    try {
      const discovered = await discoverTrustedSources(entityType, row);
      seedUrl = discovered.officialUrl || seedUrl;
      directText = discovered.pages.map((page) => `SOURCE: ${page.url}\n${page.text}`).join("\n\n");
      discoverySources = discovered.sourceUrls;
      researchDossier = discovered.dossier;
    } catch (error) {
      console.warn("[data-cleaner] trusted source discovery failed", error);
    }
  } else if (seedUrl) {
    const seedPage = await fetchSourcePage(seedUrl);
    if (seedPage.url && seedPage.text && pageMatchesEntity(seedPage.text, entityAliases(row))) {
      seedUrl = seedPage.url;
      directText = `SOURCE: ${seedPage.url}\n${seedPage.text}`;
      discoverySources = [seedPage.url];
    }
  }
  // Never ask the model for a field that does not exist in the current table.
  // Several legacy entity schemas intentionally have no `official_website`
  // column; proposing it caused the entire otherwise-valid update to fail.
  const allowedFields = (ALLOWED_FIELDS[entityType] || []).filter((field) =>
    Object.prototype.hasOwnProperty.call(row, field)
  );
  const fieldTypeHints = Object.fromEntries(allowedFields.map((field) => {
    const current = row[field];
    const type = ARRAY_FIELDS.has(field)
      ? "array"
      : JSON_FIELDS.has(field)
        ? "json"
        : BOOLEAN_FIELDS.has(field)
          ? "boolean"
          : NUMBER_FIELDS.has(field)
            ? "number"
            : Array.isArray(current)
              ? "array"
              : current === null || current === undefined
                ? "string-or-null"
                : typeof current;
    return [field, type];
  }));
  const prompt = `Today is ${new Date().toISOString().slice(0, 10)}. Research and improve this DekhoCampus ${entityType} record using a transparent evidence hierarchy:
1. First-party institution, examination authority, government, regulator, accreditation, ranking or professional-body sources.
2. Reputable independent news and established education publications for supporting context.
Never use social media, forums, Wikipedia, user-generated claims or Collegedunia. Never copy source wording. Synthesize original, factual content and cite every factual field.

Entity: ${name}
Existing record: ${JSON.stringify(compactExisting(row, entityType))}
Known official URL candidate: ${seedUrl || "none"}
Grounded research dossier: ${researchDossier || "not available"}
Retrieved cited source material: ${directText || "not available"}
Fields you may propose: ${allowedFields.join(", ")}
Database field type hints: ${JSON.stringify(fieldTypeHints)}

Audit every allowed field. Fill missing fields and improve thin, duplicated, outdated or unclear descriptive fields; preserve accurate existing facts that do not need changes. Map every value to the exact database field name and type above. Never invent fees, dates, rankings, placements, salary, cutoffs, approvals, URLs or statistics. High-risk facts must use an official/regulator source or at least two independent reputable sources. Generic course records may update stable descriptive fields from reputable secondary, government, regulator, university, professional-body and curriculum sources even when there is no single official course authority. For fee ranges, store plain numeric values only in numeric fields and concise human-readable values in text fields. Established must be a four-digit integer. Dates must be unambiguous.

Apply people-first AIO, AEO, SEO, GEO and LLMO optimization to every proposed text field:
- Begin descriptions and summaries with a direct, self-contained answer that names the entity and its purpose.
- Use clear entity names, location, level, duration, eligibility and current year only when verified.
- Make each section distinct, concise, fact-dense and easy to quote; use descriptive headings, short paragraphs, lists or tables where HTML is appropriate.
- Cover likely student questions naturally: what it is, who it is for, eligibility, admission/application, fees, syllabus, outcomes, dates and next steps when supported.
- Write an accurate meta title (maximum 65 characters), meta description (maximum 170 characters) and useful semantic keywords without stuffing.
- Avoid filler, promotional superlatives, repeated boilerplate, unsupported comparisons and awkward keyword repetition.
- Make the descriptive copy feel at least 80% human-written: use natural sentence rhythm, varied openings, plain Indian-English phrasing and concrete wording.
- Do not write robotic filler such as "typically includes the following", "offers various opportunities", "caters to", "covers the basics", "is designed for individuals seeking" or repetitive template transitions.
- When existing content is thin, generic or duplicated, rewrite it into cleaner original prose instead of lightly paraphrasing the same structure.

For media fields, remain official-only: return direct HTTPS links from the verified first-party website for logos, campus/content images, galleries and brochures/PDFs. Never use secondary-site images, Google Images, social media, stock photos, screenshots or generated images. Leave media unchanged when the official source does not expose a suitable asset.

Return JSON only with this shape:
{"official_url":"https://... or empty","confidence":0.0,"updates":{},"field_evidence":{"field":["https://source-1...","https://source-2..."]},"warnings":[],"source_urls":["https://all-sources-used..."]}
Every updated field must have field_evidence except SEO fields derived directly from the cited record facts. Return the strongest official URL separately when one exists.`;

  if (provider === "gemini") {
    const model = runtime.model === "gemini-3.5-flash" ? "gemini-3.6-flash" : runtime.model || "gemini-3.5-flash-lite";
    if (!discoverySources.length && entityType === "courses") {
      discoverySources = fallbackCourseSources(row);
      researchDossier = `No course-specific URL was retrievable. Use only stable, non-sensitive course taxonomy and curriculum framing supported by Indian higher-education/regulator/open-learning sources: ${discoverySources.join(", ")}.`;
    }
    if (!discoverySources.length) {
      return {
        parsed: {
          official_url: seedUrl || "",
          confidence: 0.5,
          updates: {},
          field_evidence: {},
          warnings: ["No retrievable trusted source could be matched to this record."],
          source_urls: [],
        },
        citationUrls: [],
        model,
        usage: {},
        provider,
      };
    }

    const raw = await geminiGenerate({
      model,
      json: true,
      system: "You are a cited education data editor. Follow the evidence hierarchy, write original people-first content and return valid JSON only.",
      prompt: `${prompt}\nGemini mode rule: use only the supplied grounded dossier and retrieved source material. If the dossier says no course-specific URL was retrievable, update only non-sensitive generic course fields such as description, short_description, page_summary, about_content, scope_content, subjects_content, syllabus_content, meta_title, meta_description, meta_keywords, category, level, mode, study_type, subjects, careers and specializations. Do not update fees, salaries, growth, cutoffs, admission dates, media or official URLs from generic fallback sources.`,
    });
    return { parsed: await parseOrRepair({ ...config, textModel: model }, raw), citationUrls: [...new Set([seedUrl, ...discoverySources])], model, usage: {}, provider };
  }

  if (provider === "openai") {
    const model = runtime.model || "gpt-4o-mini";
    if (!discoverySources.length && entityType === "courses") {
      discoverySources = fallbackCourseSources(row);
      researchDossier = `No course-specific URL was retrievable. Use only stable, non-sensitive course taxonomy and curriculum framing supported by Indian higher-education/regulator/open-learning sources: ${discoverySources.join(", ")}.`;
    }
    if (!discoverySources.length) {
      return {
        parsed: {
          official_url: seedUrl || "",
          confidence: 0.5,
          updates: {},
          field_evidence: {},
          warnings: ["No retrievable trusted source could be matched to this record."],
          source_urls: [],
        },
        citationUrls: [],
        model,
        usage: {},
        provider,
      };
    }

    const openaiKey = await resolveOpenAiKey(admin, config);
    if (!openaiKey) throw new Error("OpenAI API key is not configured. Save the existing OpenAI key in Admin - AI Providers.");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a cited education data editor. Follow the evidence hierarchy, write original people-first content and return valid JSON only." },
          { role: "user", content: `${prompt}\nOpenAI mode rule: use only the supplied grounded dossier and retrieved source material. If the dossier says no course-specific URL was retrievable, update only non-sensitive generic course fields such as description, short_description, page_summary, about_content, scope_content, subjects_content, syllabus_content, meta_title, meta_description, meta_keywords, category, level, mode, study_type, subjects, careers and specializations. Do not update fees, salaries, growth, cutoffs, admission dates, media or official URLs from generic fallback sources.` },
        ],
      }),
    });
    if (!response.ok) throw new Error(`OpenAI data cleaning failed (${response.status}): ${(await response.text()).slice(0, 350)}`);
    const payload = await response.json();
    const raw = payload.choices?.[0]?.message?.content || "{}";
    return {
      parsed: await parseOrRepair({ ...config, openaiKey, textModel: model }, raw),
      citationUrls: [...new Set([seedUrl, ...discoverySources])],
      model,
      usage: payload.usage || {},
      provider,
    };
  }

  const model = await resolveClaudeTextModel(config);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": config.claudeKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model, max_tokens: 8192,
      system: "You are a cited education data editor. Follow the evidence hierarchy, corroborate sensitive facts and return valid JSON only.",
      messages: [{ role: "user", content: prompt }],
      tools: [{
        type: "web_search_20250305", name: "web_search", max_uses: 5,
        user_location: { type: "approximate", country: "IN", timezone: "Asia/Kolkata" },
      }],
    }),
  });
  if (!response.ok) {
    if (!discoverySources.length) throw new Error(`Claude trusted-source research failed (${response.status}): ${(await response.text()).slice(0, 350)}`);
    const raw = await generateBlogJson(config, `${prompt}\nWeb search is unavailable. Use only the supplied retrieved source material.`);
    return { parsed: await parseOrRepair(config, raw), citationUrls: discoverySources, model, usage: {}, provider };
  }
  const payload = await response.json();
  const raw = (payload.content || []).filter((block: any) => block.type === "text").map((block: any) => block.text || "").join("");
  return { parsed: await parseOrRepair(config, raw), citationUrls: [...collectCitationUrls(payload)], model, usage: payload.usage || {}, provider };
}

function cleanString(value: unknown, max = 100_000) {
  return String(value ?? "").replace(/[\u2013\u2014]/g, "-").replace(/\0/g, "").trim().slice(0, max);
}

function stripHtml(value: unknown, max = 100_000) {
  return cleanString(value, max)
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function parseJsonish(value: unknown): unknown {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!/^[\[{]/.test(trimmed)) return undefined;
  try { return JSON.parse(trimmed); } catch {
    try { return JSON.parse(trimmed.replace(/'/g, '"')); } catch { return undefined; }
  }
}

function bestScalarText(value: unknown, max = 100_000): string {
  const parsed = parseJsonish(value);
  if (parsed !== undefined) return bestScalarText(parsed, max);
  if (Array.isArray(value)) return value.map((item) => bestScalarText(item, max)).filter(Boolean).join(", ").slice(0, max);
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    for (const key of ["Cat_name", "cat_name", "category_name", "name", "title", "label", "value", "full_name", "short_name"]) {
      const text = bestScalarText(object[key], max);
      if (text) return text;
    }
    const first = Object.entries(object).find(([key, item]) => !/^(cat_)?(id|slug|uuid)$/i.test(key) && (typeof item === "string" || typeof item === "number"));
    return first ? bestScalarText(first[1], max) : "";
  }
  return stripHtml(value, max);
}

function listFromValue(value: unknown) {
  const parsed = parseJsonish(value);
  const source = parsed !== undefined ? parsed : value;
  if (Array.isArray(source)) return source.map((item) => bestScalarText(item, 500)).filter(Boolean);
  if (typeof source === "string") return source.split(/[,\n;|]+/).map((item) => bestScalarText(item, 500)).filter(Boolean);
  const text = bestScalarText(source, 500);
  return text ? [text] : [];
}

function normalizeValue(field: string, value: unknown, current: unknown) {
  if (value === null || value === undefined) return undefined;
  if (field === "established") {
    const year = Number(String(value).match(/(?:18|19|20)\d{2}/)?.[0]);
    return year >= 1800 && year <= new Date().getFullYear() ? year : undefined;
  }
  if (typeof current === "number" || NUMBER_FIELDS.has(field)) {
    const number = Number(String(value).replace(/[^0-9.]/g, ""));
    return Number.isFinite(number) && number >= 0 ? number : undefined;
  }
  if (typeof current === "boolean" || BOOLEAN_FIELDS.has(field)) return typeof value === "boolean" ? value : undefined;
  if (Array.isArray(current) || ARRAY_FIELDS.has(field)) {
    const items = Array.isArray(value) ? value : listFromValue(value);
    if (MEDIA_ARRAY_FIELDS.has(field)) return [...new Set(items.map((item) => normalizeUrl(item)).filter(Boolean))].slice(0, 100);
    return [...new Set(items.map((item) => bestScalarText(item, 500)).filter(Boolean))].slice(0, 100);
  }
  if ((typeof current === "object" && current !== null) || JSON_FIELDS.has(field)) {
    return typeof value === "object" ? value : undefined;
  }
  if (field === "meta_title") return cleanString(value, 65);
  if (field === "meta_description") return stripHtml(value, 170);
  if (field === "page_summary") return stripHtml(value, 600);
  if (field.includes("url") || field === "website" || field === "official_website" || MEDIA_URL_FIELDS.has(field)) return normalizeUrl(value) || undefined;
  if (!RICH_TEXT_FIELDS.has(field)) return bestScalarText(value);
  return cleanString(value);
}

function buildVerifiedUpdate(entityType: string, row: Record<string, unknown>, research: any, citationUrls: string[]) {
  const proposedOfficialUrl = normalizeUrl(research.official_url || seedOfficialUrl(row));
  const proposedOfficialHost = hostOf(proposedOfficialUrl);
  const returnedSources = Array.isArray(research.source_urls) ? research.source_urls.map(normalizeUrl) : [];
  const sources = [...new Set([...citationUrls, ...returnedSources].map(normalizeUrl).filter((url) => sourceTier(url) > 0))].slice(0, 30);
  if (!sources.length) return { update: {}, sources: [], warnings: ["No acceptable cited source was verified"] };
  const officialUrl = proposedOfficialUrl && !isBlockedHost(proposedOfficialHost) &&
    sources.some((url) => sameOfficialDomain(url, proposedOfficialHost))
    ? proposedOfficialUrl
    : "";
  const officialHost = hostOf(officialUrl);

  const allowed = new Set((ALLOWED_FIELDS[entityType] || []).filter((field) =>
    Object.prototype.hasOwnProperty.call(row, field)
  ));
  const evidence = research.field_evidence && typeof research.field_evidence === "object" ? research.field_evidence : {};
  const update: Record<string, unknown> = {};
  if (officialUrl && allowed.has("official_website")) update.official_website = officialUrl;
  else if (officialUrl && allowed.has("website")) update.website = officialUrl;
  for (const [field, value] of Object.entries(research.updates || {})) {
    if (!allowed.has(field) || field === "official_website") continue;
    const fieldSources = Array.isArray(evidence[field])
      ? evidence[field].map(normalizeUrl).filter(Boolean)
      : [];
    const verifiedEvidence = fieldSources.filter((fieldUrl: string) =>
      sources.some((sourceUrl) => sameSourceDomain(fieldUrl, sourceUrl))
    );
    const distinctEvidenceHosts = [...new Set(verifiedEvidence.map(hostOf).filter(Boolean))];
    const hasOfficialEvidence = verifiedEvidence.some((url: string) =>
      (officialHost && sameOfficialDomain(url, officialHost)) || sourceTier(url, officialHost) >= 3
    );
    const isOfficialOnlyField = OFFICIAL_ONLY_FIELDS.has(field);
    const isHighRiskField = HIGH_RISK_FIELDS.has(field);
    const hasEnoughEvidence = SEO_FIELDS.has(field)
      ? sources.length > 0
      : isOfficialOnlyField
        ? hasOfficialEvidence
        : isHighRiskField
          ? hasOfficialEvidence || distinctEvidenceHosts.length >= 2
          : verifiedEvidence.length > 0;
    if (!hasEnoughEvidence) continue;
    const normalized = normalizeValue(field, value, row[field]);
    if (normalized !== undefined && JSON.stringify(normalized) !== JSON.stringify(row[field])) update[field] = normalized;
  }
  return { update, sources, warnings: Array.isArray(research.warnings) ? research.warnings.map((w: unknown) => cleanString(w, 500)) : [] };
}

async function completeItem(admin: any, item: any, status: string, values: Record<string, unknown>) {
  await admin.from("data_cleaning_items").update({ status, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...values }).eq("id", item.id);
  await admin.rpc("refresh_data_cleaning_job", { _job_id: item.job_id });
}

function cleaningLifecycleUpdate(row: Record<string, unknown>, state: string, successful = false) {
  return {
    data_clean_attempts: Math.max(Number(row.data_clean_attempts || 0) + 1, 1),
    data_clean_successes: Math.max(Number(row.data_clean_successes || 0) + (successful ? 1 : 0), 0),
    ...(successful && "ai_clean_pass_count" in row
      ? { ai_clean_pass_count: Math.max(Number(row.ai_clean_pass_count || 0) + 1, 1) }
      : {}),
    data_last_checked_at: new Date().toISOString(),
    data_clean_state: state,
  };
}

async function markCleaningAttempt(admin: any, table: string, row: Record<string, unknown>, state: string) {
  const { error } = await admin.from(table).update(cleaningLifecycleUpdate(row, state)).eq("id", row.id);
  if (error) throw error;
}

async function markCleaningFailure(admin: any, table: string, row: Record<string, unknown>) {
  const { error } = await admin.from(table).update({
    data_clean_state: "failed",
    data_last_checked_at: new Date().toISOString(),
  }).eq("id", row.id);
  if (error) throw error;
}

async function applyApprovedItem(admin: any, item: any) {
  const table = TABLES[item.entity_type];
  if (!table) throw new Error("Unsupported content type");
  const { data: current, error: readError } = await admin
    .from(table)
    .select("*")
    .eq("id", item.entity_id)
    .single();
  if (readError) throw readError;
  const now = new Date().toISOString();
  const update = {
    ...(item.proposed_data || {}),
    data_verified_at: now,
    data_source_urls: item.source_urls,
    data_quality_score: Math.round(Number(item.confidence || 0) * 100),
    data_clean_attempts: Math.max(Number(current?.data_clean_attempts || 0), Number(item.cleaning_pass || 1)),
    data_clean_successes: Number(current?.data_clean_successes || 0) + 1,
    ...(["colleges", "courses", "exams"].includes(item.entity_type)
      ? { ai_clean_pass_count: Math.max(Number(current?.ai_clean_pass_count || 0) + 1, 1) }
      : {}),
    data_last_checked_at: now,
    data_clean_state: "cleaned",
    updated_at: now,
  };
  const { error: applyError } = await admin.from(table).update(update).eq("id", item.entity_id);
  if (applyError) throw applyError;
}

async function processItem(admin: any, config: BlogAiConfig, item: any) {
  await getAiRuntimeControl(admin, "data-cleaner");
  const table = TABLES[item.entity_type];
  if (!table) return completeItem(admin, item, "failed", { error_message: "Unsupported content type" });
  await admin.from("data_cleaning_jobs").update({ current_entity: item.entity_type, current_name: item.entity_name, message: `Verifying ${item.entity_name}`, updated_at: new Date().toISOString() }).eq("id", item.job_id);
  let currentRow: Record<string, unknown> | null = null;
  try {
    const { data: row, error } = await admin.from(table).select("*").eq("id", item.entity_id).maybeSingle();
    if (error) throw error;
    if (!row) return completeItem(admin, item, "skipped", { error_message: "Record no longer exists" });
    currentRow = row;
    const result = await researchWithAi(admin, config, item.entity_type, row);
    await logAiUsage(admin, {
      provider: result.provider || (String(result.model || "").startsWith("gemini") ? "gemini" : "anthropic"), model: result.model, feature: "data-cleaner", operation: item.entity_type,
      inputTokens: result.usage?.input_tokens ?? result.usage?.prompt_tokens,
      outputTokens: result.usage?.output_tokens ?? result.usage?.completion_tokens,
      requestId: item.id, metadata: { job_id: item.job_id, entity_id: item.entity_id },
    });
    const confidence = Math.max(0, Math.min(1, Number(result.parsed.confidence || 0)));
    const verified = buildVerifiedUpdate(item.entity_type, row, result.parsed, result.citationUrls);
    const changedFields = Object.keys(verified.update).filter((field) => JSON.stringify(row[field]) !== JSON.stringify(verified.update[field]));
    if (!verified.sources.length || !changedFields.length) {
      await markCleaningAttempt(admin, table, row, "checked_no_change");
      return completeItem(admin, item, "skipped", {
        official_url: normalizeUrl(result.parsed.official_url) || verified.sources[0] || "",
        source_urls: verified.sources,
        confidence: verified.sources.length ? confidence : null,
        before_data: compactExisting(row, item.entity_type), proposed_data: verified.update, changed_fields: changedFields,
        warnings: verified.warnings,
        error_message: !verified.sources.length
          ? "Research pass completed - no safe cited improvement was available"
          : "Research pass completed - current values already match the supported evidence",
      });
    }

    const { data: job } = await admin.from("data_cleaning_jobs").select("apply_mode,status").eq("id", item.job_id).single();
    if (job?.status === "cancelled") return completeItem(admin, item, "cancelled", { error_message: "Cancelled before changes were applied" });
    const audit = {
      official_url: verified.update.official_website || verified.sources[0] || "", source_urls: verified.sources, confidence,
      before_data: compactExisting(row, item.entity_type), proposed_data: verified.update,
      changed_fields: changedFields, warnings: verified.warnings,
    };
    if (job?.apply_mode !== "auto_apply") {
      await markCleaningAttempt(admin, table, row, "awaiting_review");
      return completeItem(admin, item, "review", audit);
    }

    const now = new Date().toISOString();
    const update = {
      ...verified.update,
      ...cleaningLifecycleUpdate(row, "cleaned", true),
      data_verified_at: now,
      data_source_urls: verified.sources,
      data_quality_score: Math.round(confidence * 100),
      updated_at: now,
    };
    const { error: updateError } = await admin.from(table).update(update).eq("id", item.entity_id);
    if (updateError) throw updateError;
    return completeItem(admin, item, "updated", audit);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (currentRow) {
      await markCleaningFailure(admin, table, currentRow).catch((trackingError) =>
        console.warn("[data-cleaner] failed to mark lifecycle state", trackingError)
      );
    }
    return completeItem(admin, item, item.attempt >= 3 ? "failed" : "failed", { error_message: message.slice(0, 1200) });
  }
}

async function processTick(admin: any, serviceRole: string, functionUrl: string) {
  console.log("[data-cleaner] tick started");
  const { data: settings } = await admin.from("data_cleaning_settings").select("worker_concurrency,scheduler_token").eq("id", "default").single();
  const config = await loadBlogAiConfig(admin, serviceRole);
  await getAiRuntimeControl(admin, "data-cleaner");
  console.log("[data-cleaner] AI configuration loaded");
  const { data: items, error } = await admin.rpc("claim_data_cleaning_items", { _limit: settings?.worker_concurrency || 2 });
  if (error) throw error;
  if (!items?.length) { console.log("[data-cleaner] no queued items"); return; }
  console.log(`[data-cleaner] claimed ${items.length} item(s)`);
  await Promise.all(items.map((item: any) => processItem(admin, config, item)));
  const { data: remaining } = await admin.from("data_cleaning_items").select("id", { count: "exact", head: false }).eq("job_id", items[0].job_id).eq("status", "queued").limit(1);
  if (remaining?.length) {
    await fetch(functionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY") || "", "x-data-cleaner-secret": settings.scheduler_token },
      body: JSON.stringify({ action: "tick" }),
    }).catch(() => undefined);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRole);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "tick");
    if (action === "tick") {
      await requireTickAccess(req, admin);
      EdgeRuntime.waitUntil(processTick(admin, serviceRole, `${supabaseUrl}/functions/v1/admin-data-cleaner`).catch((error) => console.error("[data-cleaner] background tick failed", error)));
      return json({ success: true, accepted: true });
    }

    const user = await requireAdmin(req, admin);
    if (action === "enrich_draft") {
      const entityType = String(body.entity_type || "");
      if (!["colleges", "courses", "exams"].includes(entityType)) {
        return json({ error: "Draft enrichment supports colleges, courses and exams" }, 400);
      }
      const record = body.record && typeof body.record === "object" ? body.record as Record<string, unknown> : {};
      if (!cleanString(record.name || record.title, 300)) return json({ error: "Enter a record name first" }, 400);
      const config = await loadBlogAiConfig(admin, serviceRole);
      const result = await researchWithAi(admin, config, entityType, record);
      const confidence = Math.max(0, Math.min(1, Number(result.parsed.confidence || 0)));
      const verified = buildVerifiedUpdate(entityType, record, result.parsed, result.citationUrls);
      const changedFields = Object.keys(verified.update).filter((field) => JSON.stringify(record[field]) !== JSON.stringify(verified.update[field]));
      await logAiUsage(admin, {
        provider: result.provider || "unknown",
        model: result.model,
        feature: "data-cleaner",
        operation: `${entityType}-draft-enrichment`,
        inputTokens: result.usage?.input_tokens ?? result.usage?.prompt_tokens,
        outputTokens: result.usage?.output_tokens ?? result.usage?.completion_tokens,
        userId: user.id,
        metadata: { changed_fields: changedFields },
      });
      return json({
        success: true,
        official_url: normalizeUrl(result.parsed.official_url || verified.update.official_website),
        source_urls: verified.sources,
        confidence,
        proposed_data: verified.update,
        changed_fields: changedFields,
        warnings: verified.warnings,
      });
    }
    if (action === "start") {
      const entityTypes = [...new Set((Array.isArray(body.entity_types) ? body.entity_types : []).filter((type: string) => TABLES[type]))];
      const { data: jobId, error } = await admin.rpc("create_data_cleaning_job", {
        _entity_types: entityTypes, _batch_size: Number(body.batch_size || 100),
        _max_records: body.max_records ? Number(body.max_records) : null,
        _apply_mode: body.apply_mode === "auto_apply" ? "auto_apply" : "review", _created_by: user.id,
      });
      if (error) throw error;
      EdgeRuntime.waitUntil(processTick(admin, serviceRole, `${supabaseUrl}/functions/v1/admin-data-cleaner`).catch((error) => console.error("[data-cleaner] start tick failed", error)));
      return json({ success: true, job_id: jobId });
    }
    if (["pause", "resume", "cancel"].includes(action)) {
      const status = action === "pause" ? "paused" : action === "resume" ? "running" : "cancelled";
      const { error } = await admin.from("data_cleaning_jobs").update({ status, message: action === "resume" ? "Resumed" : `${action[0].toUpperCase()}${action.slice(1)}`, updated_at: new Date().toISOString() }).eq("id", body.job_id);
      if (error) throw error;
      if (action === "cancel") await admin.from("data_cleaning_items").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("job_id", body.job_id).eq("status", "queued");
      if (action === "resume") EdgeRuntime.waitUntil(processTick(admin, serviceRole, `${supabaseUrl}/functions/v1/admin-data-cleaner`).catch((error) => console.error("[data-cleaner] resume tick failed", error)));
      return json({ success: true });
    }
    if (action === "retry_skipped") {
      const { data: priorJob, error: priorError } = await admin
        .from("data_cleaning_jobs")
        .select("entity_types,batch_size,max_records,apply_mode")
        .eq("id", body.job_id)
        .single();
      if (priorError) throw priorError;
      const { data: nextJobId, error: nextJobError } = await admin.rpc("create_data_cleaning_job", {
        _entity_types: priorJob.entity_types,
        _batch_size: priorJob.batch_size,
        _max_records: priorJob.max_records,
        _apply_mode: priorJob.apply_mode,
        _created_by: user.id,
      });
      if (nextJobError) throw nextJobError;
      EdgeRuntime.waitUntil(processTick(admin, serviceRole, `${supabaseUrl}/functions/v1/admin-data-cleaner`).catch((error) => console.error("[data-cleaner] next pass tick failed", error)));
      return json({ success: true, job_id: nextJobId, message: "Created the next incomplete cleaning pass" });
    }
    if (["approve", "reject"].includes(action)) {
      const { data: item, error } = await admin.from("data_cleaning_items").select("*").eq("id", body.item_id).single();
      if (error) throw error;
      if (item.status !== "review") return json({ error: "This item is no longer awaiting review" }, 409);
      if (action === "reject") {
        const table = TABLES[item.entity_type];
        if (table) {
          await admin.from(table).update({
            data_clean_state: "review_rejected",
            data_last_checked_at: new Date().toISOString(),
          }).eq("id", item.entity_id);
        }
        await completeItem(admin, item, "skipped", { error_message: "Rejected by administrator" });
        return json({ success: true });
      }
      await applyApprovedItem(admin, item);
      await completeItem(admin, item, "updated", { error_message: null });
      return json({ success: true });
    }
    if (action === "approve_all") {
      const { data: reviewItems, error } = await admin.from("data_cleaning_items").select("*").eq("job_id", body.job_id).eq("status", "review").limit(5000);
      if (error) throw error;
      let approved = 0;
      const failures: string[] = [];
      for (const item of reviewItems || []) {
        try {
          if (!TABLES[item.entity_type] || !item.source_urls?.length) continue;
          await applyApprovedItem(admin, item);
          await completeItem(admin, item, "updated", { error_message: null }); approved += 1;
        } catch (applyError) { failures.push(`${item.entity_name}: ${applyError instanceof Error ? applyError.message : String(applyError)}`); }
      }
      return json({ success: failures.length === 0, approved, failures: failures.slice(0, 20) });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("admin-data-cleaner", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
