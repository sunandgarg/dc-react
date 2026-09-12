import { randomUUID } from "node:crypto";
import { handleRest, handleRpc } from "./rest.mjs";
import { prisma } from "./db.mjs";
import { handleAuth, resolveNativeIdentity, sendPhoneOtp, verifyPhoneOtp, verifyLeadOtpProof } from "./auth.mjs";
import { handleStorage } from "./storage.mjs";
import { enqueueLeadAutomation, wakeLeadOutboxWorker } from "./lead-outbox.mjs";
import { dispatchLead, previewLeadAutomation } from "./lead-automation.mjs";
import { integrationStatus } from "./integration-status.mjs";
import { handleContentReviews } from "./content-review.mjs";
import { handleAiGenerate, handleArticleCover, handleBlogAiSettings, handleBlogStudio, runBlogAgent } from "./blog-ai.mjs";
import { handleDataCleaner } from "./data-cleaner.mjs";
import { canContentEditorAccess, canContentHeadAccess } from "./editor-access.mjs";
import { storageConfig } from "./storage.mjs";
import { publishSitemap, readPublishedSitemap } from "./sitemap-publish.mjs";
import { handleClarityExport } from "./clarity-export.mjs";
import { handleEmailAdmin } from "./email.mjs";
import { handleCatExperience } from "./cat-experience.mjs";
import { handleIntentExport, handlePredictLeadIntent, handleSummarizeUserSession, linkIntentActivityToLead } from "./intent-intelligence.mjs";
import { consumePublicWriteLimit } from "./public-write-rate-limit.mjs";

const publicReadTables = new Set([
  "about_founders", "about_milestones", "about_page", "about_press", "about_stats", "about_team", "about_values",
  "ad_scripts", "ad_units", "ads", "adsense_settings", "also_check_modules", "approval_bodies",
  "article_categories", "article_links", "articles", "authors", "career_course_links", "career_profiles",
  "cat_universe_cutoffs", "cat_universe_modules", "cat_universe_resources", "cat_universe_sections", "cat_universe_settings",
  "college_contacts", "college_facilities", "college_few_links", "college_programs", "college_quick_links", "college_resources",
  "college_reviews", "college_semesters", "college_subjects", "college_toppers", "college_universities", "colleges", "companies",
  "course_fees", "course_specializations", "courses", "exams", "facilities_library", "faculty", "faqs", "feature_toggles",
  "featured_colleges", "hero_banners", "hero_categories", "hero_settings", "jobs", "landing_pages", "lead_form_settings",
  "legal_pages", "placement_records", "popular_places", "program_categories", "programs", "promoted_programs",
  "scholarships", "site_integrations", "state_cities", "states_cities", "stream_categories", "study_board_links", "study_boards", "study_chapters",
  "study_resources", "study_subjects", "study_toppers", "trusted_partners", "url_mappings",
  "college_editorial_completion_progress",
]);

const publicWriteTables = new Set([
  "ad_analytics_events", "college_applications", "cta_events", "intent_events", "intent_visitors", "job_applications",
  "landing_page_leads", "url_clicks", "user_consent", "user_events",
]);

const publicWriteFields = new Map([
  ["ad_analytics_events", new Set(["ad_unit_id", "event_type", "device", "page_url", "country"])],
  ["college_applications", new Set(["name", "email", "phone", "city", "state", "college_slug", "college_name", "course_slug", "course_interest", "message"])],
  ["cta_events", new Set(["page", "cta", "entity_slug", "entity_name", "session_id", "referrer", "path", "utm_source", "utm_medium", "utm_campaign", "user_agent", "meta"])],
  ["intent_events", new Set(["event_type", "visitor_id", "session_id", "college_slug", "course_slug", "exam_slug", "university_slug", "device_type", "city", "state", "country", "traffic_source", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "page_url", "referrer", "metadata"])],
  ["intent_visitors", new Set(["visitor_id", "last_seen_at", "device_type", "city", "state", "country", "user_agent", "utm", "referrer", "landing_url"])],
  ["job_applications", new Set(["job_id", "job_slug", "job_title", "company", "full_name", "email", "phone", "current_location", "experience", "current_company", "current_designation", "expected_salary", "notice_period", "resume_url", "portfolio_url", "linkedin_url", "cover_letter", "source"])],
  ["landing_page_leads", new Set(["landing_slug", "name", "email", "phone", "city", "state", "course", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid", "referrer", "page_url", "consent"])],
  ["url_clicks", new Set(["url_id", "user_agent", "referrer", "country", "city", "device_type", "browser", "os"])],
  ["user_consent", new Set(["session_id", "essential", "analytics", "marketing", "prefill", "user_agent"])],
  ["user_events", new Set(["session_id", "event_type", "path", "element", "metadata", "user_agent", "referrer", "x", "y", "vw", "vh"])],
]);

const PUBLIC_WRITE_MAX_BYTES = 256 * 1024;
const PUBLIC_WRITE_MAX_ROWS = 100;
const PUBLIC_INTENT_MAX_DISTINCT_SUBJECTS = 10;
const SAVE_LEAD_MAX_BYTES = 64 * 1024;

function assertPublicIntentSubjectLimit(table, rows) {
  if (table !== "intent_events") return;
  const subjects = new Set();
  for (const row of rows) {
    const userId = String(row?.user_id || "").trim();
    const visitorId = String(row?.visitor_id || "").trim();
    if (userId) subjects.add(`user:${userId}`);
    else if (visitorId) subjects.add(`visitor:${visitorId}`);
  }
  if (subjects.size > PUBLIC_INTENT_MAX_DISTINCT_SUBJECTS) {
    throw new HttpError(400, "INTENT_SUBJECT_LIMIT", `Anonymous intent batches may contain at most ${PUBLIC_INTENT_MAX_DISTINCT_SUBJECTS} distinct subjects`);
  }
}

function sanitizePublicWriteValue(value, depth = 0) {
  if (depth > 8) return null;
  if (typeof value === "string") return value.slice(0, 20_000);
  if (value === null || ["number", "boolean"].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizePublicWriteValue(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 100)
      .map(([key, item]) => [key.slice(0, 100), sanitizePublicWriteValue(item, depth + 1)]));
  }
  return null;
}

async function sanitizePublicWriteRequest(table, request) {
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > PUBLIC_WRITE_MAX_BYTES) throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Anonymous event payload is too large");
  const raw = await request.clone().text();
  if (new TextEncoder().encode(raw).byteLength > PUBLIC_WRITE_MAX_BYTES) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Anonymous event payload is too large");
  }
  let input;
  try { input = JSON.parse(raw); } catch { throw new HttpError(400, "INVALID_JSON", "A valid JSON payload is required"); }
  const rows = Array.isArray(input) ? input : [input];
  if (!rows.length || rows.length > PUBLIC_WRITE_MAX_ROWS || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new HttpError(400, "INVALID_PUBLIC_WRITE", "Anonymous writes require 1 to 100 object rows");
  }
  assertPublicIntentSubjectLimit(table, rows);
  consumePublicWriteLimit({
    clientKey: request.headers.get("x-dc-client-ip") || "unknown",
    table,
    units: rows.length,
  });
  const allowed = publicWriteFields.get(table);
  const sanitized = rows.map((row) => {
    const safe = Object.fromEntries(Object.entries(row)
      .filter(([key]) => allowed.has(key))
      .map(([key, value]) => [key, sanitizePublicWriteValue(value)]));
    if (["college_applications", "job_applications"].includes(table)) safe.status = "submitted";
    return safe;
  });
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");
  return new Request(request.url, { method: request.method, headers, body: JSON.stringify(Array.isArray(input) ? sanitized : sanitized[0]) });
}

async function readRateLimitedPublicJson(request, table, maxBytes) {
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > maxBytes) throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Request payload is too large");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Request payload is too large");
  }
  let input;
  try { input = JSON.parse(raw); } catch { throw new HttpError(400, "INVALID_JSON", "A valid JSON payload is required"); }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HttpError(400, "INVALID_JSON", "A JSON object is required");
  }
  consumePublicWriteLimit({
    clientKey: request.headers.get("x-dc-client-ip") || "unknown",
    table,
    units: 1,
  });
  return input;
}

const SITE_SCOPED_TABLES = new Set(["articles", "leads"]);
const VALID_SITE_SCOPES = new Set(["dekhocampus", "sarkari"]);

function assertValidSiteScopePayload(table, input) {
  if (!SITE_SCOPED_TABLES.has(table)) return;
  const rows = Array.isArray(input) ? input : [input];
  if (rows.some((row) => row && typeof row === "object" && Object.hasOwn(row, "site_scope") && !VALID_SITE_SCOPES.has(row.site_scope))) {
    throw new HttpError(400, "INVALID_SITE_SCOPE", "site_scope must be dekhocampus or sarkari");
  }
}

async function validateSiteScopeWriteRequest(table, request) {
  if (!SITE_SCOPED_TABLES.has(table) || !["POST", "PUT", "PATCH"].includes(request.method)) return request;
  const input = await request.clone().json().catch(() => undefined);
  if (input !== undefined) assertValidSiteScopePayload(table, input);
  return request;
}

export const apiSecurityInternals = { sanitizePublicWriteRequest, readRateLimitedPublicJson, siteScopeForRequest, enforcePublicArticlePolicy, assertValidSiteScopePayload, assertPublicIntentSubjectLimit };

const ownedTables = new Map([
  ["profiles", "user_id"], ["user_documents", "user_id"], ["user_education_entries", "user_id"],
  ["user_favorites", "user_id"], ["user_sessions", "user_id"], ["wallet_transactions", "user_id"],
  ["referrals", "referrer_id"], ["target_roadmaps", "user_id"],
]);

const publicReadSelections = new Map([
  ["articles", "id,site_scope,status,title,slug,description,content,vertical,category,author,author_id,featured_image,views,tags,meta_title,meta_description,meta_keywords,is_active,featured_rank,official_website,data_verified_at,created_at,updated_at"],
  ["site_integrations", "key,value,enabled"],
  ["adsense_settings", "id,publisher_id,client_id,account_id,verification_meta,auto_ads_enabled,ads_globally_enabled,enabled_on_mobile,enabled_on_desktop,enabled_for_guests,enabled_for_logged_in,disabled_roles,disabled_pages,ads_per_page_limit,lazy_load_enabled,refresh_interval_seconds,head_scripts,body_scripts,footer_scripts,custom_css,custom_js,created_at,updated_at"],
]);

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const TRANSIENT_DATABASE_ERROR_CODES = new Set(["P1001", "P1002", "P2024"]);
const TRANSIENT_DATABASE_RETRY_AFTER_SECONDS = 2;

function transientDatabaseErrorCode(error) {
  const visited = new Set();
  let current = error;
  for (let depth = 0; current && typeof current === "object" && depth < 4; depth += 1) {
    if (visited.has(current)) break;
    visited.add(current);
    if (typeof current.code === "string" && TRANSIENT_DATABASE_ERROR_CODES.has(current.code)) return current.code;
    current = current.cause;
  }
  return null;
}

function classifyRequestError(error) {
  const explicitStatus = Number(error?.status);
  if (Number.isInteger(explicitStatus) && explicitStatus >= 400 && explicitStatus <= 599) {
    return {
      status: explicitStatus,
      code: error?.code || "NODE_API_ERROR",
      message: error instanceof Error ? error.message : "Request failed",
      retryAfter: error?.retryAfter,
    };
  }

  if (transientDatabaseErrorCode(error)) {
    return {
      status: 503,
      code: "DATABASE_TEMPORARILY_UNAVAILABLE",
      message: "The database is temporarily unavailable. Please retry shortly.",
      retryAfter: TRANSIENT_DATABASE_RETRY_AFTER_SECONDS,
    };
  }

  return {
    status: 400,
    code: error?.code || "NODE_API_ERROR",
    message: error instanceof Error ? error.message : "Request failed",
    retryAfter: error?.retryAfter,
  };
}

export const apiErrorInternals = { classifyRequestError, transientDatabaseErrorCode };

const SARKARI_SITE_ORIGINS = new Set([
  "https://sarkari.dekhocampus.com",
  "https://sarkari-dekhocampus.pages.dev",
]);

function normalizedOrigin(value) {
  try { return new URL(String(value || "")).origin; } catch { return ""; }
}

function siteScopeForRequest(request) {
  return SARKARI_SITE_ORIGINS.has(normalizedOrigin(request.headers.get("origin"))) ? "sarkari" : "dekhocampus";
}

function enforcePublicArticlePolicy(request) {
  const url = new URL(request.url);
  const requestedScope = String(url.searchParams.get("site_scope") || "").match(/^eq\.(dekhocampus|sarkari)$/)?.[1];
  url.searchParams.set("site_scope", `eq.${requestedScope || siteScopeForRequest(request)}`);
  url.searchParams.set("status", "eq.Published");
  url.searchParams.set("is_active", "eq.true");
  return new Request(url, request);
}

const allowedOrigins = String(process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080,https://dekhocampus-aws-candidate.pages.dev,https://dekhocampus.com,https://www.dekhocampus.com,https://sarkari-dekhocampus.pages.dev,https://sarkari.dekhocampus.com")
  .split(",").map((value) => value.trim()).filter(Boolean);

function corsHeaders(request) {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  const allowedOrigin = origin && (allowedOrigins.includes(origin) || origin === requestOrigin) ? origin : allowedOrigins[0] || "null";
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-headers": "accept, accept-profile, authorization, apikey, content-profile, content-type, prefer, range, range-unit, x-client-info, x-request-id, x-upsert",
    "access-control-expose-headers": "content-range, range-unit, retry-after, x-request-id",
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
  return resolveNativeIdentity(request);
}

async function isAdmin(userId) {
  const rows = await prisma.$queryRawUnsafe("SELECT 1 FROM `user_roles` WHERE `user_id` = ? AND `role` = 'admin' LIMIT 1", userId);
  return rows.length > 0;
}

async function authorizeRest(table, request) {
  if (["GET", "HEAD"].includes(request.method) && publicReadTables.has(table)) {
    const identity = bearerToken(request) ? await resolveIdentity(request) : null;
    if (identity && await isAdmin(identity.id)) return { request, actorUserId: identity.id };
    const publicRequest = table === "articles" ? enforcePublicArticlePolicy(request) : request;
    const safeSelection = publicReadSelections.get(table);
    if (!safeSelection) return { request: publicRequest, actorUserId: null, publicAccess: true };
    const url = new URL(publicRequest.url);
    url.searchParams.set("select", safeSelection);
    return { request: new Request(url, publicRequest), actorUserId: null, publicAccess: true };
  }
  if (publicWriteTables.has(table) && request.method === "POST") {
    const trackingIdentity = bearerToken(request) && ["intent_events", "user_events"].includes(table)
      ? await resolveIdentity(request)
      : null;
    return {
      request: await sanitizePublicWriteRequest(table, request),
      actorUserId: null,
      siteScope: siteScopeForRequest(request),
      trackingUserId: trackingIdentity?.id || null,
    };
  }

  const identity = await resolveIdentity(request);
  if (!identity) throw new HttpError(401, "AUTH_REQUIRED", "A valid user session is required");
  if (await isAdmin(identity.id)) return { request: await validateSiteScopeWriteRequest(table, request), actorUserId: null, siteScope: siteScopeForRequest(request) };
  const ownerColumn = ownedTables.get(table);
  if (request.method === "DELETE" && !ownerColumn) {
    throw new HttpError(403, "ADMIN_REQUIRED", "Only an administrator can permanently delete website data");
  }

  if (["GET", "HEAD"].includes(request.method) && ["user_roles", "user_permissions"].includes(table)) {
    const url = new URL(request.url);
    url.searchParams.set("user_id", `eq.${identity.id}`);
    return { request: new Request(url, request), actorUserId: null };
  }

  if (!ownerColumn) {
    const action = request.method === "POST"
      ? (String(request.headers.get("prefer") || "").includes("resolution=merge-duplicates") ? "edit" : "create")
      : request.method === "PATCH" ? "edit" : request.method === "DELETE" ? "delete" : "view";
    const editorialRoles = await prisma.$queryRawUnsafe(
      "SELECT `role` FROM `user_roles` WHERE `user_id` = ? AND `role` IN ('content_head','content')",
      identity.id,
    );
    if (editorialRoles.some((row) => row.role === "content_head") && canContentHeadAccess(table, action)) {
      return { request: await validateSiteScopeWriteRequest(table, request), actorUserId: null, stageReview: false, forceDraft: false };
    }
    if (editorialRoles.some((row) => row.role === "content") && canContentEditorAccess(table, action)) {
      return { request: await validateSiteScopeWriteRequest(table, request), actorUserId: identity.id, stageReview: action !== "view", forceDraft: action !== "view" };
    }
    const permission = await prisma.$queryRawUnsafe(
      `SELECT \`can_publish\` FROM \`user_permissions\`
       WHERE \`user_id\` = ? AND (\`resource\` = ? OR \`module\` = ?)
         AND ((? = 'view' AND \`can_view\` = 1)
           OR (? = 'create' AND \`can_create\` = 1)
           OR (? = 'edit' AND \`can_edit\` = 1)
           OR (? = 'delete' AND \`can_delete\` = 1))
       LIMIT 1`,
      identity.id, table, table, action, action, action, action,
    );
    if (!permission.length) throw new HttpError(403, "PERMISSION_DENIED", `You do not have ${action} permission for ${table}`);
    const requiresReview = !Boolean(permission[0]?.can_publish);
    return { request: await validateSiteScopeWriteRequest(table, request), actorUserId: identity.id, stageReview: requiresReview, forceDraft: requiresReview };
  }
  if (request.method === "POST") {
    const input = await request.clone().json();
    const rows = Array.isArray(input) ? input : [input];
    if (rows.some((row) => row?.[ownerColumn] !== identity.id)) {
      throw new HttpError(403, "ROW_ACCESS_DENIED", `New ${table} rows must belong to the authenticated user`);
    }
    return { request, actorUserId: null };
  }
  const url = new URL(request.url);
  url.searchParams.set(ownerColumn, `eq.${identity.id}`);
  return { request: new Request(url, request), actorUserId: null };
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

async function bootstrapPayload() {
  const rows = async (table, where = "") => prisma.$queryRawUnsafe(`SELECT * FROM \`${table}\` ${where}`);
  const [heroBanners, heroSettings, featuredColleges, trustedPartners, leadFormSettings, featureToggles, ads, siteIntegrations] = await Promise.all([
    rows("hero_banners", "WHERE `is_active` = 1 ORDER BY `display_order` ASC"),
    rows("hero_settings", "LIMIT 1"),
    rows("featured_colleges", `AS featured
      INNER JOIN (
        SELECT \`college_slug\`, MAX(\`updated_at\`) AS \`latest_updated_at\`
          FROM \`featured_colleges\`
         GROUP BY \`college_slug\`
      ) AS latest
        ON latest.\`college_slug\` = featured.\`college_slug\`
       AND latest.\`latest_updated_at\` = featured.\`updated_at\`
      WHERE featured.\`is_active\` = 1
      ORDER BY featured.\`display_order\` ASC`),
    rows("trusted_partners", "WHERE `is_active` = 1 ORDER BY `display_order` ASC"),
    rows("lead_form_settings", "LIMIT 1"),
    rows("feature_toggles"),
    rows("ads", "WHERE `is_active` = 1"),
    rows("site_integrations", "WHERE `enabled` = 1"),
  ]);
  return {
    hero_banners: heroBanners,
    hero_settings: heroSettings[0] || null,
    featured_colleges: featuredColleges,
    trusted_partners: trustedPartners,
    lead_form_settings: leadFormSettings[0] || null,
    feature_toggles: featureToggles,
    ads,
    site_integrations: siteIntegrations.map(({ key, value, enabled }) => ({ key, value, enabled: Boolean(enabled) })),
  };
}

async function linkSavedLeadIntent(input, leadId, siteScope) {
  if (!input.intent_visitor_id && !input.intent_session_id) return undefined;
  try {
    await linkIntentActivityToLead({
      leadId,
      visitorId: input.intent_visitor_id,
      sessionId: input.intent_session_id,
      siteScope,
    });
    return true;
  } catch (error) {
    console.warn("Saved lead intent linkage was rejected", error?.code || error?.message || error);
    return false;
  }
}

async function saveLead(request) {
  const siteScope = siteScopeForRequest(request);
  const input = await readRateLimitedPublicJson(request, "save-lead", SAVE_LEAD_MAX_BYTES);
  const phone = String(input.phone || "").replace(/\D/g, "").slice(-10);
  const email = String(input.email || "").trim().toLowerCase();
  if (!input.name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[6-9]\d{9}$/.test(phone)) {
    throw new HttpError(400, "INVALID_LEAD", "Name, email and a valid 10-digit Indian mobile number are required");
  }
  const phase = input.phase === "identity" ? "identity" : "complete";
  const otpVerified = Boolean(input.otp_verified)
    && verifyLeadOtpProof(input.otp_verification_token, `+91${phone}`);
  const hasConsentAccepted = Object.hasOwn(input, "consent_terms_accepted");
  const hasConsentText = Object.hasOwn(input, "consent_text");
  const consentAccepted = input.consent_terms_accepted === true;
  const consentText = input.consent_text === null || input.consent_text === undefined
    ? null
    : String(input.consent_text).slice(0, 20_000);
  if (siteScope === "sarkari" && ((!input.lead_id && !consentAccepted) || (hasConsentAccepted && !consentAccepted))) {
    throw new HttpError(400, "CONSENT_REQUIRED", "Accept the Privacy Policy and Terms before requesting Sarkari updates");
  }
  const consentAt = consentAccepted ? new Date() : null;
  const consentUpdate = {
    ...(hasConsentAccepted ? { consent_terms_accepted: consentAccepted, consent_at: consentAt } : {}),
    ...(hasConsentText ? { consent_text: consentText } : {}),
  };
  if (input.lead_id) {
    const leadId = String(input.lead_id);
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.leads.updateMany({
        where: { id: leadId, phone, site_scope: siteScope },
        data: {
        ...(otpVerified ? { otp_verified: true } : {}),
        current_situation: input.current_situation ? String(input.current_situation) : null,
        city: input.city ? String(input.city).slice(0, 250) : null,
        state: input.state ? String(input.state).slice(0, 250) : null,
        interested_college_slug: input.interested_college_slug ? String(input.interested_college_slug) : null,
        interested_course_slug: input.interested_course_slug ? String(input.interested_course_slug) : null,
        interested_exam_slug: input.interested_exam_slug ? String(input.interested_exam_slug) : null,
        program_mode: input.program_mode ? String(input.program_mode) : "unknown",
        status: "new",
        updated_at: new Date(),
        ...consentUpdate,
        },
      });
      if (updated.count && siteScope === "dekhocampus") await enqueueLeadAutomation(tx, leadId);
      return updated;
    });
    if (!result.count) throw new HttpError(404, "LEAD_NOT_FOUND", "The saved lead could not be updated");
    const intentLinked = await linkSavedLeadIntent(input, leadId, siteScope);
    if (siteScope === "dekhocampus") wakeLeadOutboxWorker();
    return { success: true, lead_id: leadId, phase: "complete", site_scope: siteScope, ...(intentLinked === undefined ? {} : { intent_linked: intentLinked }) };
  }
  const existingCount = await prisma.leads.count({ where: { site_scope: siteScope, OR: [{ phone }, { email }] } });
  const lead = await prisma.$transaction(async (tx) => {
    const created = await tx.leads.create({
      data: {
      id: randomUUID(),
      site_scope: siteScope,
      name: String(input.name).slice(0, 250),
      email: email.slice(0, 320),
      phone,
      city: phase === "complete" && input.city ? String(input.city).slice(0, 250) : null,
      state: phase === "complete" && input.state ? String(input.state).slice(0, 250) : null,
      current_situation: phase === "complete" && input.current_situation ? String(input.current_situation) : null,
      initial_query: input.initial_query ? String(input.initial_query) : null,
      source: input.source ? String(input.source) : "website",
      cta: input.cta ? String(input.cta) : null,
      page_url: input.page_url ? String(input.page_url) : null,
      interested_college_slug: phase === "complete" && input.interested_college_slug ? String(input.interested_college_slug) : null,
      interested_course_slug: phase === "complete" && input.interested_course_slug ? String(input.interested_course_slug) : null,
      interested_exam_slug: phase === "complete" && input.interested_exam_slug ? String(input.interested_exam_slug) : null,
      otp_verified: otpVerified,
      program_mode: phase === "complete" && input.program_mode ? String(input.program_mode) : "unknown",
      device_type: input.device_type ? String(input.device_type) : null,
      source_category: input.source_category ? String(input.source_category) : null,
      status: "new",
      consent_terms_accepted: consentAccepted,
      consent_text: consentText,
      consent_at: consentAt,
      },
    });
    if (phase === "complete" && siteScope === "dekhocampus") await enqueueLeadAutomation(tx, created.id);
    return created;
  });
  const intentLinked = await linkSavedLeadIntent(input, lead.id, siteScope);
  if (phase === "complete" && siteScope === "dekhocampus") wakeLeadOutboxWorker();
  return { success: true, lead_id: lead.id, phase, existing_count: existingCount, site_scope: siteScope, ...(intentLinked === undefined ? {} : { intent_linked: intentLinked }) };
}

async function sharedTargetRoadmap(request) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || "").trim();
  if (!/^[A-Za-z0-9_-]{12,128}$/.test(token)) throw new HttpError(400, "INVALID_SHARE_TOKEN", "A valid roadmap share token is required");
  const rows = await prisma.$queryRawUnsafe(
    `SELECT \`target_college\`, \`target_course\`, \`class_level\`, \`stream\`, \`board\`,
            \`current_percent\`, \`state\`, \`hours_per_day\`, \`weaknesses\`, \`roadmap\`, \`share_token\`
       FROM \`target_roadmaps\` WHERE \`share_token\` = ? LIMIT 1`,
    token,
  );
  if (!rows.length) throw new HttpError(404, "ROADMAP_NOT_FOUND", "This shared roadmap is unavailable");
  const row = rows[0];
  if (typeof row.roadmap === "string") {
    try { row.roadmap = JSON.parse(row.roadmap); } catch { row.roadmap = null; }
  }
  return row;
}

async function handleLeadAutomation(request) {
  const body = await request.json().catch(() => ({}));
  if (body.dry_run !== false) return previewLeadAutomation(body.lead || {});
  const leadId = String(body.lead_id || body.lead?.id || "").trim();
  if (!leadId) throw new HttpError(400, "SAVED_LEAD_REQUIRED", "Choose a saved lead before making a real partner push");
  return dispatchLead(leadId);
}

export async function handleRequest(request) {
  const requestId = request.headers.get("x-request-id") || randomUUID();
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...corsHeaders(request), "x-request-id": requestId } });
  const url = new URL(request.url);
  if (url.pathname === "/health/live") {
    return json(200, { ok: true, backend: "node", requestId }, requestId, request);
  }
  if (url.pathname === "/health" || url.pathname === "/v1/status") {
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      return json(200, {
        ok: true,
        backend: "node",
        database: "mysql",
        orm: "prisma",
        storage: storageConfig().provider,
        requestId,
      }, requestId, request);
    } catch (error) {
      console.error(`[${requestId}] health check failed`, error);
      return json(503, { ok: false, backend: "node", database: "unavailable", requestId }, requestId, request);
    }
  }

  try {
    const sitemapResponse = await readPublishedSitemap(request);
    if (sitemapResponse) return sitemapResponse;
    const authResult = await handleAuth(request);
    if (authResult) return json(authResult.status, authResult.body, requestId, request);
    const storageResult = await handleStorage(request);
    if (storageResult instanceof Response) {
      const headers = new Headers(storageResult.headers);
      Object.entries(corsHeaders(request)).forEach(([key, value]) => headers.set(key, value));
      headers.set("x-request-id", requestId);
      return new Response(storageResult.body, { status: storageResult.status, headers });
    }
    if (storageResult) return json(storageResult.status, storageResult.body, requestId, request);
    const rpcMatch = url.pathname.match(/^\/v1\/rest\/rpc\/([A-Za-z0-9_-]+)$/);
    if (rpcMatch) {
      await authorizeRpc(rpcMatch[1], request);
      const result = await handleRpc(rpcMatch[1], request);
      return json(result.status, result.body, requestId, request, result.headers);
    }
    const restMatch = url.pathname.match(/^\/v1\/rest\/([A-Za-z0-9_]+)$/);
    if (restMatch) {
      const table = restMatch[1];
      const authorization = await authorizeRest(table, request);
      const result = await handleRest(table, authorization.request, authorization);
      const publicArticleCache = authorization.publicAccess && table === "articles" && result.status < 400
        ? { "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" }
        : {};
      return json(result.status, result.body, requestId, request, { ...result.headers, ...publicArticleCache });
    }
    const functionMatch = url.pathname.match(/^\/v1\/functions\/([A-Za-z0-9_-]+)$/);
    if (functionMatch) {
      if (functionMatch[1] === "send-otp") return json(200, await sendPhoneOtp(request), requestId, request);
      if (functionMatch[1] === "phone-auth") return json(200, await verifyPhoneOtp(request), requestId, request);
      if (functionMatch[1] === "bootstrap") return json(200, await bootstrapPayload(), requestId, request, { "cache-control": "public, max-age=300, stale-while-revalidate=600" });
      if (functionMatch[1] === "save-lead") return json(200, await saveLead(request), requestId, request);
      if (functionMatch[1] === "cat-experience") {
        return json(200, await handleCatExperience(request), requestId, request, { "cache-control": "private, no-store" });
      }
      if (functionMatch[1] === "shared-target-roadmap") return json(200, await sharedTargetRoadmap(request), requestId, request, { "cache-control": "public, max-age=60, stale-while-revalidate=300" });
      if (functionMatch[1] === "lp-dispatch-lead") {
        const identity = await resolveIdentity(request);
        if (!identity || !(await isAdmin(identity.id))) throw new HttpError(403, "ADMIN_REQUIRED", "Administrator access is required");
        return json(200, await handleLeadAutomation(request), requestId, request, { "cache-control": "private, no-store" });
      }
      if (functionMatch[1] === "integration-status") {
        const identity = await resolveIdentity(request);
        if (!identity || !(await isAdmin(identity.id))) throw new HttpError(403, "ADMIN_REQUIRED", "Administrator access is required");
        return json(200, await integrationStatus(), requestId, request, { "cache-control": "private, no-store" });
      }
      if (functionMatch[1] === "send-email") {
        const identity = await resolveIdentity(request);
        if (!identity || !(await isAdmin(identity.id))) throw new HttpError(403, "ADMIN_REQUIRED", "Administrator access is required");
        return json(200, await handleEmailAdmin(request, identity.id), requestId, request, { "cache-control": "private, no-store" });
      }
      if (functionMatch[1] === "admin-clarity-export") {
        const identity = await resolveIdentity(request);
        if (!identity || !(await isAdmin(identity.id))) throw new HttpError(403, "ADMIN_REQUIRED", "Administrator access is required");
        return json(200, await handleClarityExport(request), requestId, request, { "cache-control": "private, no-store" });
      }
      if (functionMatch[1] === "publish-sitemap") {
        const identity = await resolveIdentity(request);
        if (!identity || !(await isAdmin(identity.id))) throw new HttpError(403, "ADMIN_REQUIRED", "Administrator access is required");
        return json(200, await publishSitemap(request), requestId, request, { "cache-control": "private, no-store" });
      }
      if (functionMatch[1] === "content-reviews") {
        const identity = await resolveIdentity(request);
        if (!identity || !(await isAdmin(identity.id))) throw new HttpError(403, "ADMIN_REQUIRED", "Administrator access is required");
        return json(200, await handleContentReviews(request, identity.id), requestId, request, { "cache-control": "private, no-store" });
      }
      if (functionMatch[1] === "admin-article-cover") {
        const authorization = request.headers.get("authorization");
        await authorizeRest("articles", new Request(request.url, { method: "POST", headers: authorization ? { authorization } : {} }));
        return json(200, await handleArticleCover(request), requestId, request, { "cache-control": "private, no-store" });
      }
      if (["admin-blog-ai-settings", "admin-blog-studio", "admin-blog-agent", "admin-ai-generate"].includes(functionMatch[1])) {
        const identity = await resolveIdentity(request);
        if (!identity || !(await isAdmin(identity.id))) throw new HttpError(403, "ADMIN_REQUIRED", "Administrator access is required");
        const body = functionMatch[1] === "admin-blog-agent" ? await request.json().catch(() => ({})) : null;
        let result;
        if (functionMatch[1] === "admin-blog-agent" && !body.action) {
          const task = runBlogAgent(body);
          const early = await Promise.race([
            task.then((value) => ({ settled: true, value }), (error) => ({ settled: true, error })),
            new Promise((resolve) => setTimeout(() => resolve({ settled: false }), 1_500)),
          ]);
          if (early.settled && early.error) throw early.error;
          result = early.settled
            ? early.value
            : { accepted: true, message: "Blog agent started. Progress is available in the run history." };
          if (!early.settled) void task.catch((error) => console.error("Manual blog agent run failed", error));
        } else {
          result = functionMatch[1] === "admin-blog-ai-settings" ? await handleBlogAiSettings(request, identity.id)
            : functionMatch[1] === "admin-blog-studio" ? await handleBlogStudio(request, identity.id)
            : functionMatch[1] === "admin-blog-agent" ? await runBlogAgent(body)
            : await handleAiGenerate(request);
        }
        return json(200, result, requestId, request, { "cache-control": "private, no-store" });
      }
      if (functionMatch[1] === "admin-data-cleaner") {
        const identity = await resolveIdentity(request);
        if (!identity || !(await isAdmin(identity.id))) throw new HttpError(403, "ADMIN_REQUIRED", "Administrator access is required");
        return json(200, await handleDataCleaner(request, identity.id), requestId, request, { "cache-control": "private, no-store" });
      }
      if (["predict-lead-intent", "intent-export-csv", "summarize-user-session"].includes(functionMatch[1])) {
        const identity = await resolveIdentity(request);
        if (!identity || !(await isAdmin(identity.id))) throw new HttpError(403, "ADMIN_REQUIRED", "Administrator access is required");
        if (functionMatch[1] === "predict-lead-intent") {
          return json(200, await handlePredictLeadIntent(request), requestId, request, { "cache-control": "private, no-store" });
        }
        if (functionMatch[1] === "summarize-user-session") {
          return json(200, await handleSummarizeUserSession(request), requestId, request, { "cache-control": "private, no-store" });
        }
        const exportResponse = await handleIntentExport(request, identity.id);
        const headers = new Headers(exportResponse.headers);
        Object.entries(corsHeaders(request)).forEach(([key, value]) => headers.set(key, value));
        headers.set("x-request-id", requestId);
        return new Response(exportResponse.body, { status: exportResponse.status, headers });
      }
      return json(501, { code: "FUNCTION_NOT_MIGRATED", error: `Function ${functionMatch[1]} has no native Node handler` }, requestId, request);
    }
    return json(404, { error: "Route not found", requestId }, requestId, request);
  } catch (error) {
    const responseError = classifyRequestError(error);
    if (responseError.status >= 500 || !error?.status) console.error(`[${requestId}]`, error);
    const retryHeaders = responseError.retryAfter
      ? { "cache-control": "no-store", "retry-after": String(responseError.retryAfter) }
      : {};
    return json(responseError.status, { code: responseError.code, message: responseError.message, requestId }, requestId, request, retryHeaders);
  }
}
