import { randomUUID } from "node:crypto";
import { handleRest, handleRpc } from "./rest.mjs";
import { prisma } from "./db.mjs";

const publicReadTables = new Set([
  "about_founders", "about_milestones", "about_page", "about_press", "about_stats", "about_team", "about_values",
  "ad_scripts", "ad_units", "ads", "adsense_settings", "also_check_modules", "approval_bodies",
  "article_categories", "article_links", "articles", "authors", "career_course_links", "career_profiles",
  "cat_universe_cutoffs", "cat_universe_modules", "cat_universe_resources", "cat_universe_sections", "cat_universe_settings",
  "college_contacts", "college_facilities", "college_few_links", "college_programs", "college_quick_links", "college_resources",
  "college_reviews", "college_semesters", "college_subjects", "college_toppers", "college_universities", "colleges", "companies",
  "course_fees", "course_specializations", "courses", "exams", "facilities_library", "faculty", "faqs", "feature_toggles",
  "featured_colleges", "hero_banners", "hero_categories", "hero_settings", "jobs", "landing_pages", "lead_form_settings",
  "legal_pages", "placement_records", "popular_places", "program_categories", "programs", "promoted_programs", "push_landing_pages",
  "scholarships", "site_integrations", "state_cities", "states_cities", "stream_categories", "study_board_links", "study_boards", "study_chapters",
  "study_resources", "study_subjects", "study_toppers", "target_roadmaps", "trusted_partners", "universities", "url_mappings",
  "college_editorial_completion_progress", "leads_daily_business_rollup",
]);

const publicWriteTables = new Set([
  "ad_analytics_events", "college_applications", "cta_events", "intent_events", "intent_visitors", "job_applications",
  "landing_page_leads", "leads", "referrals", "url_clicks", "user_consent", "user_events",
]);

const ownedTables = new Map([
  ["profiles", "user_id"], ["user_documents", "user_id"], ["user_education_entries", "user_id"],
  ["user_favorites", "user_id"], ["user_sessions", "user_id"], ["wallet_transactions", "user_id"],
]);

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const allowedOrigins = String(process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080,https://dekhocampus.com")
  .split(",").map((value) => value.trim()).filter(Boolean);

function corsHeaders(request) {
  const origin = request.headers.get("origin");
  return {
    "access-control-allow-origin": origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "null",
    "access-control-allow-headers": "accept, accept-profile, authorization, apikey, content-profile, content-type, prefer, range, range-unit, x-client-info, x-request-id, x-supabase-api-version",
    "access-control-expose-headers": "content-range, range-unit, x-request-id",
    "access-control-allow-methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
    vary: "Origin",
  };
}

function json(status, body, requestId, request, extraHeaders = {}) {
  const headers = { ...corsHeaders(request), ...extraHeaders, "x-request-id": requestId };
  if (body !== null && body !== undefined) headers["content-type"] = "application/json";
  return new Response(body === null || body === undefined ? null : JSON.stringify(body), { status, headers });
}

function bearerToken(request) {
  const value = request.headers.get("authorization") || "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

async function resolveIdentity(request) {
  const token = bearerToken(request);
  if (!token || token.startsWith("sb_publishable_")) return null;
  const base = process.env.SUPABASE_URL || process.env.SUPABASE_FUNCTIONS_FALLBACK_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !publishableKey) throw new HttpError(503, "AUTH_NOT_CONFIGURED", "Supabase Auth compatibility is not configured");
  const response = await fetch(`${base.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { authorization: `Bearer ${token}`, apikey: publishableKey },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user?.id === "string" ? user : null;
}

async function isAdmin(userId) {
  const rows = await prisma.$queryRawUnsafe("SELECT 1 FROM `user_roles` WHERE `user_id` = ? AND `role` = 'admin' LIMIT 1", userId);
  return rows.length > 0;
}

async function authorizeRest(table, request) {
  if (["GET", "HEAD"].includes(request.method) && publicReadTables.has(table)) return request;
  if (publicWriteTables.has(table) && request.method === "POST") return request;

  const identity = await resolveIdentity(request);
  if (!identity) throw new HttpError(401, "AUTH_REQUIRED", "A valid user session is required");
  if (await isAdmin(identity.id)) return request;

  const ownerColumn = ownedTables.get(table);
  if (!ownerColumn) throw new HttpError(403, "ADMIN_REQUIRED", "Administrator access is required");
  if (request.method === "POST") {
    const input = await request.clone().json();
    const rows = Array.isArray(input) ? input : [input];
    if (rows.some((row) => row?.[ownerColumn] !== identity.id)) {
      throw new HttpError(403, "ROW_ACCESS_DENIED", `New ${table} rows must belong to the authenticated user`);
    }
    return request;
  }
  const url = new URL(request.url);
  url.searchParams.set(ownerColumn, `eq.${identity.id}`);
  return new Request(url, request);
}

async function authorizeRpc(name, request) {
  if (["search_directory_fast", "increment_url_clicks"].includes(name)) return;
  const identity = await resolveIdentity(request);
  if (!identity) throw new HttpError(401, "AUTH_REQUIRED", "A valid user session is required");
  if (await isAdmin(identity.id)) return;
  if (name === "intent_merge_visitor") {
    const body = await request.clone().json().catch(() => ({}));
    if (body._user_id === identity.id) return;
  }
  if (["has_role", "is_user_approved"].includes(name)) {
    const body = await request.clone().json().catch(() => ({}));
    if (body._user_id === identity.id) return;
  }
  throw new HttpError(403, "RPC_ACCESS_DENIED", "This operation requires administrator access");
}

async function proxySupabaseFunction(name, request, requestId) {
  const base = process.env.SUPABASE_FUNCTIONS_FALLBACK_URL || process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !publishableKey) return json(501, { code: "FUNCTION_NOT_MIGRATED", error: `Function ${name} requires a native Node handler or configured Supabase fallback` }, requestId, request);
  const headers = new Headers(request.headers);
  headers.set("apikey", headers.get("apikey") || publishableKey);
  headers.set("x-request-id", requestId);
  const response = await fetch(`${base.replace(/\/$/, "")}/functions/v1/${encodeURIComponent(name)}`, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
  });
  const responseHeaders = new Headers(response.headers);
  Object.entries(corsHeaders(request)).forEach(([key, value]) => responseHeaders.set(key, value));
  responseHeaders.set("x-request-id", requestId);
  return new Response(response.body, { status: response.status, headers: responseHeaders });
}

export async function handleRequest(request) {
  const requestId = request.headers.get("x-request-id") || randomUUID();
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...corsHeaders(request), "x-request-id": requestId } });
  const url = new URL(request.url);
  if (url.pathname === "/health" || url.pathname === "/v1/status") {
    return json(200, { ok: true, backend: "node", database: "mysql", orm: "prisma", requestId }, requestId, request);
  }

  try {
    const rpcMatch = url.pathname.match(/^\/v1\/rest\/rpc\/([A-Za-z0-9_-]+)$/);
    if (rpcMatch) {
      await authorizeRpc(rpcMatch[1], request);
      const result = await handleRpc(rpcMatch[1], request);
      return json(result.status, result.body, requestId, request, result.headers);
    }
    const restMatch = url.pathname.match(/^\/v1\/rest\/([A-Za-z0-9_]+)$/);
    if (restMatch) {
      const authorizedRequest = await authorizeRest(restMatch[1], request);
      const result = await handleRest(restMatch[1], authorizedRequest);
      return json(result.status, result.body, requestId, request, result.headers);
    }
    const functionMatch = url.pathname.match(/^\/v1\/functions\/([A-Za-z0-9_-]+)$/);
    if (functionMatch) return proxySupabaseFunction(functionMatch[1], request, requestId);
    return json(404, { error: "Route not found", requestId }, requestId, request);
  } catch (error) {
    console.error(`[${requestId}]`, error);
    const status = Number(error?.status || 400);
    return json(status, { code: error?.code || "NODE_API_ERROR", message: error instanceof Error ? error.message : "Request failed", requestId }, requestId, request);
  }
}
