#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { handleBlogAiSettings } from "../src/blog-ai.mjs";
import { prisma, quote, schemaMetadata } from "../src/db.mjs";
import { handleRest } from "../src/rest.mjs";

const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || "https://dekhocampus.com").replace(/\/$/, "");
const runToken = `codex-production-regression-${Date.now()}`;

// These are the resources that expose create/edit controls in the production admin.
// Read-only dashboards, logs, applications, reviews, leads, users and analytics are
// covered by route/API smoke tests without manufacturing business activity.
const ADMIN_CREATE_TABLES = [
  "about_founders", "about_milestones", "about_page", "about_press", "about_stats", "about_team", "about_values",
  "ads", "ad_units", "ai_providers", "also_check_modules", "approval_bodies", "article_categories", "articles", "authors",
  "career_profiles", "career_course_links",
  "cat_universe_sections", "cat_universe_modules", "cat_universe_resources", "cat_universe_cutoffs",
  "colleges", "college_contacts", "companies", "course_fees", "courses", "email_providers", "exams",
  "facilities_library", "faculty", "faqs", "featured_colleges", "hero_banners", "hero_categories",
  "intent_event_weights", "intent_university_webhooks", "jobs", "landing_pages", "legal_pages",
  "lp_universities", "lp_automation_rules", "lp_marketing_flows", "lp_multi_flows", "lp_utm_links", "marketing_automations",
  "otp_providers", "placement_records", "popular_places", "program_categories", "promoted_programs", "scholarships",
  "site_integrations", "stream_categories", "trusted_partners", "universities", "url_mappings",
  "study_boards", "study_subjects", "study_chapters", "study_resources", "study_board_links", "study_toppers",
  "college_programs", "college_universities", "college_semesters", "college_subjects", "college_resources",
  "college_quick_links", "college_few_links", "college_toppers",
];

const PUBLIC_READ_TABLES = new Set([
  "about_founders", "about_milestones", "about_page", "about_press", "about_stats", "about_team", "about_values",
  "ads", "ad_units", "also_check_modules", "approval_bodies", "article_categories", "articles", "authors",
  "career_profiles", "career_course_links", "cat_universe_sections", "cat_universe_modules", "cat_universe_resources",
  "cat_universe_cutoffs", "colleges", "college_contacts", "companies", "course_fees", "courses", "exams",
  "facilities_library", "faculty", "faqs", "featured_colleges", "hero_banners", "hero_categories", "jobs",
  "landing_pages", "legal_pages", "placement_records", "popular_places", "program_categories", "promoted_programs",
  "scholarships", "site_integrations", "stream_categories", "trusted_partners", "url_mappings", "study_boards",
  "study_subjects", "study_chapters", "study_resources", "study_board_links", "study_toppers", "college_programs",
  "college_universities", "college_semesters", "college_subjects", "college_resources", "college_quick_links",
  "college_few_links", "college_toppers", "universities",
]);

const DETAIL_ROUTES = {
  articles: (row) => `/news/${row.slug}`,
  authors: (row) => `/author/${row.slug}`,
  career_profiles: (row) => `/careers/${row.slug}`,
  colleges: (row) => `/colleges/${row.slug}`,
  courses: (row) => `/courses/${row.slug}`,
  exams: (row) => `/exams/${row.slug}`,
  jobs: (row) => `/jobs/${row.slug}`,
  landing_pages: (row) => `/landing/${row.slug}`,
  legal_pages: (row) => `/legal/${row.slug}`,
  promoted_programs: (row) => `/premium-programs/${row.slug}`,
  scholarships: (row) => `/scholarships/${row.slug}`,
};

const KEEP_DISABLED = new Set([
  "ads", "ad_units", "ai_providers", "email_providers", "featured_colleges", "hero_banners",
  "intent_university_webhooks", "lp_universities", "marketing_automations", "otp_providers", "site_integrations",
  "trusted_partners", "universities",
]);

const created = [];
const createdByTable = new Map();
const results = [];
const failures = [];

function rowBody(result) {
  return Array.isArray(result.body) ? result.body[0] : result.body;
}

function requestFor(table, method, { body, filters = {}, prefer = "return=representation" } = {}) {
  const url = new URL(`http://localhost/v1/rest/${table}`);
  url.searchParams.set("select", "*");
  for (const [field, value] of Object.entries(filters)) url.searchParams.set(field, `eq.${value}`);
  return new Request(url, {
    method,
    headers: {
      accept: "application/vnd.pgrst.object+json",
      "content-type": "application/json",
      ...(prefer ? { prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function firstReference(table, field) {
  const existing = createdByTable.get(table);
  if (existing?.[field] !== null && existing?.[field] !== undefined) return existing[field];
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ${quote(field)} AS value FROM ${quote(table)} WHERE ${quote(field)} IS NOT NULL LIMIT 1`,
  );
  if (!rows.length) throw new Error(`No ${table}.${field} value is available for a required relationship`);
  return rows[0].value;
}

function textValue(table, name) {
  const slug = `${runToken}-${table}`.slice(0, 180);
  if (name === "id") return randomUUID();
  if (name.includes("email")) return `${runToken.slice(-24)}@example.com`;
  if (/(phone|mobile|whatsapp)/.test(name)) return "9000000001";
  if (/(url|website|link)$/.test(name) || name.includes("_url") || name === "api_url") return `https://example.com/${slug}`;
  if (/(image|photo|logo|brochure|file)$/.test(name) || name.includes("_image") || name.includes("_logo")) {
    return `https://example.com/${slug}.png`;
  }
  if (name === "status") return "Draft";
  if (name === "year") return "2026";
  if (name === "category") return "Regression";
  if (name === "role") return "Regression";
  if (name === "provider_name") return `${slug}-provider`;
  if (name === "short_code") return `qa${Date.now().toString(36)}`.slice(0, 16);
  if (/(slug|code|key)$/.test(name)) return slug;
  if (["name", "title", "label", "display_name", "college_name", "company_name"].includes(name)) return `Codex production regression ${table}`;
  return `Codex production regression ${table} ${name}`;
}

async function requiredValue(table, name, field) {
  if (field.foreignKey) return firstReference(field.foreignKey[0], field.foreignKey[1]);
  if (field.type === "String") return field.format === "uuid" ? randomUUID() : textValue(table, name);
  if (field.type === "Json") return String(field.format).endsWith("[]") ? [] : {};
  if (field.type === "Boolean") return false;
  if (field.type === "DateTime") return new Date().toISOString();
  if (field.type === "Decimal" || field.type === "Float") return 4.5;
  if (field.type === "BigInt") return String(Date.now());
  if (name === "year") return 2026;
  return 1;
}

async function payloadFor(table) {
  const metadata = schemaMetadata[table];
  if (!metadata || metadata.ignored) throw new Error(`${table} is unavailable or read-only`);
  const payload = {};
  for (const [name, field] of Object.entries(metadata.fields)) {
    if (field.nullable || field.default !== null) continue;
    if (field.primaryKey && field.default !== null) continue;
    if (name === "short_id" && ["colleges", "courses", "exams"].includes(table)) continue;
    payload[name] = await requiredValue(table, name, field);
  }
  if (metadata.fields.slug) payload.slug = `${runToken}-${table}`.slice(0, 180);
  if (metadata.fields.is_active && KEEP_DISABLED.has(table)) payload.is_active = false;
  if (metadata.fields.enabled && KEEP_DISABLED.has(table)) payload.enabled = false;
  if (metadata.fields.status && ["articles", "colleges", "courses"].includes(table)) payload.status = "Draft";
  if (metadata.fields.data_clean_state) payload.data_clean_state = "never_checked";
  return payload;
}

function editableField(table) {
  const fields = schemaMetadata[table].fields;
  const preferred = ["name", "title", "label", "description", "notes", "display_name", "short_description"];
  return preferred.find((name) => fields[name] && !fields[name].primaryKey)
    || Object.entries(fields).find(([name, field]) => field.type === "String"
      && !field.primaryKey
      && !field.foreignKey
      && !/(^|_)(slug|id|code|key)$/.test(name))?.[0]
    || (fields.display_order ? "display_order" : null)
    || Object.entries(fields).find(([name, field]) => !field.primaryKey && !["created_at", "updated_at"].includes(name))?.[0];
}

async function publicRows(table, filters) {
  const url = new URL(`${PUBLIC_BASE_URL}/v1/rest/${table}`);
  url.searchParams.set("select", "*");
  for (const [field, value] of Object.entries(filters)) url.searchParams.set(field, `eq.${value}`);
  const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`public ${table} read failed (${response.status}): ${text.slice(0, 240)}`);
  return JSON.parse(text);
}

async function verifyDetailRoute(table, row) {
  const path = DETAIL_ROUTES[table]?.(row);
  if (!path) return null;
  const response = await fetch(`${PUBLIC_BASE_URL}${path}`, { redirect: "manual", signal: AbortSignal.timeout(20_000) });
  if (![200, 301, 302, 307, 308].includes(response.status)) throw new Error(`${path} returned ${response.status}`);
  return { path, status: response.status };
}

function orderTables(tables) {
  const remaining = new Set(tables);
  const ordered = [];
  while (remaining.size) {
    const ready = [...remaining].filter((table) => Object.values(schemaMetadata[table]?.fields || {}).every((field) => {
      const target = field.foreignKey?.[0];
      return !target || !remaining.has(target);
    }));
    const batch = ready.length ? ready : [remaining.values().next().value];
    for (const table of batch) {
      remaining.delete(table);
      ordered.push(table);
    }
  }
  return ordered;
}

async function exerciseTable(table) {
  const payload = await payloadFor(table);
  const insert = await handleRest(table, requestFor(table, "POST", { body: payload }));
  if (insert.status !== 201) throw new Error(`insert returned ${insert.status}`);
  const inserted = rowBody(insert);
  const filters = Object.fromEntries(schemaMetadata[table].primaryKeys.map((field) => [field, inserted?.[field]]));
  if (Object.values(filters).some((value) => value === null || value === undefined || value === "")) {
    throw new Error(`insert did not return primary key values: ${schemaMetadata[table].primaryKeys.join(",")}`);
  }
  created.push({ table, filters });
  createdByTable.set(table, inserted);

  const field = editableField(table);
  if (!field) throw new Error("no safe editable field was found");
  const fieldMetadata = schemaMetadata[table].fields[field];
  const relationshipLike = Boolean(fieldMetadata.foreignKey) || /(^|_)(slug|id|code|key)$/.test(field);
  const editedValue = relationshipLike
    ? inserted[field]
    : fieldMetadata.type === "String"
      ? `Codex production regression edited ${table}`
      : fieldMetadata.type === "Boolean"
        ? !inserted[field]
        : ["Int", "BigInt", "Decimal", "Float"].includes(fieldMetadata.type)
          ? Number(inserted[field] || 0) + 1
          : inserted[field];
  const update = await handleRest(table, requestFor(table, "PATCH", { filters, body: { [field]: editedValue } }));
  if (update.status !== 200) throw new Error(`update returned ${update.status}`);

  const read = await handleRest(table, requestFor(table, "GET", { filters, prefer: "" }));
  const stored = rowBody(read);
  if (!stored || JSON.stringify(stored[field]) !== JSON.stringify(editedValue)) throw new Error(`${field} edit did not persist`);

  let publicRead = false;
  if (PUBLIC_READ_TABLES.has(table)) {
    const rows = await publicRows(table, filters);
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("public API did not return the inserted row");
    publicRead = true;
  }
  const detail = await verifyDetailRoute(table, { ...inserted, [field]: editedValue });
  results.push({ table, created: true, edited: true, publicRead, detail });
}

async function verifyBlogSettingsUpsert() {
  const current = await prisma.blog_auto_agent_settings.findUnique({ where: { id: "default" } });
  if (!current) throw new Error("blog_auto_agent_settings.default is missing");
  const serializable = JSON.parse(JSON.stringify(current, (_key, value) => typeof value === "bigint" ? value.toString() : value));
  const request = () => requestFor("blog_auto_agent_settings", "POST", {
    body: serializable,
    prefer: "resolution=merge-duplicates,return=representation",
  });
  const first = await handleRest("blog_auto_agent_settings", request());
  const second = await handleRest("blog_auto_agent_settings", request());
  if (first.status !== 201 || second.status !== 201) throw new Error(`settings upsert returned ${first.status}/${second.status}`);

  const provider = await handleBlogAiSettings(new Request("http://localhost/v1/functions/admin-blog-ai-settings", { method: "GET" }), null);
  if (!provider.text_model || !provider.image_model) throw new Error("blog AI provider settings are incomplete");
  results.push({ table: "blog_auto_agent_settings", created: false, edited: true, duplicateUpsertSafe: true });
}

async function cleanup() {
  const cleanupFailures = [];
  for (const item of [...created].reverse()) {
    try {
      await handleRest(item.table, requestFor(item.table, "DELETE", { filters: item.filters, prefer: "" }));
      const check = await handleRest(item.table, requestFor(item.table, "GET", { filters: item.filters, prefer: "" }));
      if (check.status !== 406) throw new Error("row remained after delete");
    } catch (error) {
      cleanupFailures.push(`${item.table}:${JSON.stringify(item.filters)}: ${error.message}`);
    }
  }
  // Clean the record left by the interrupted browser confirmation in the same QA run.
  await prisma.companies.deleteMany({ where: { name: { startsWith: "Codex QA 20260828 Company" } } });
  await prisma.intent_event_weights.deleteMany({ where: { label: { startsWith: "Codex production regression" } } });
  if (cleanupFailures.length) throw new Error(`cleanup failed: ${cleanupFailures.join("; ")}`);
}

try {
  await verifyBlogSettingsUpsert();
  for (const table of orderTables(ADMIN_CREATE_TABLES)) {
    try {
      await exerciseTable(table);
    } catch (error) {
      failures.push({ table, error: String(error?.message || error) });
    }
  }
} finally {
  try {
    await cleanup();
  } catch (error) {
    failures.push({ table: "cleanup", error: String(error?.message || error) });
  }
  await prisma.$disconnect();
}

const report = {
  ok: failures.length === 0,
  runToken,
  tablesRequested: ADMIN_CREATE_TABLES.length,
  tablesPassed: results.filter((item) => item.table !== "blog_auto_agent_settings").length,
  settingsChecks: results.filter((item) => item.table === "blog_auto_agent_settings").length,
  publicReads: results.filter((item) => item.publicRead).length,
  detailRoutes: results.filter((item) => item.detail).map((item) => item.detail),
  cleanupCompleted: !failures.some((item) => item.table === "cleanup"),
  failures,
  results,
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
