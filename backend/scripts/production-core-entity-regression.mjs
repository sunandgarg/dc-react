#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { prisma, schemaMetadata } from "../src/db.mjs";
import { handleRest } from "../src/rest.mjs";

const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || "https://dekhocampus.com").replace(/\/$/, "");
const MANIFEST_PATH = process.env.CORE_REGRESSION_MANIFEST || "/tmp/dc-core-entity-regression.json";
const PREFIX = "codex-core-qa-";
const phase = process.argv[2] || "prepare";

const ADMIN_FIELDS = {
  colleges: [
    "admission_criteria_points", "admission_deadline", "admission_process", "affiliation_kind", "apply_cta_mode",
    "apply_url", "approval_logo_names", "approval_logos", "approvals", "author_id", "banner_ad_image", "brochure_url",
    "carousel_images", "categories", "category", "city", "course_fee_content", "courses_count", "cutoff", "description",
    "eligibility_criteria", "established", "facilities", "facilities_content", "featured_rank", "fees", "gallery_images",
    "highlights", "hostel_life", "image", "is_active", "is_partner", "location", "logo", "meta_description",
    "meta_keywords", "meta_title", "naac_grade", "name", "official_website", "page_summary", "parent_university_slug",
    "placement", "placement_content", "priority", "ranking", "rankings_content", "rating", "related_courses",
    "related_exams", "reviews", "scholarship_available", "scholarship_details", "secondary_city", "secondary_state",
    "short_name", "show_in_explore_by_category", "slug", "square_ad_image", "state", "status", "tags",
    "top_recruiters", "type", "youtube_video_url",
  ],
  courses: [
    "about_content", "admission_process", "author_id", "avg_fees", "avg_salary", "careers", "categories", "category",
    "colleges_count", "cutoff_content", "description", "domain", "duration", "duration_type", "eligibility", "fee",
    "fee_type", "fees_content", "full_name", "growth", "high_fee", "image", "is_active", "level",
    "linked_college_subjects", "linked_school_classes", "low_fee", "meta_description", "meta_keywords", "meta_title",
    "mode", "name", "official_website", "page_summary", "placements_content", "priority", "rating", "recruiters_content",
    "scope_content", "short_description", "show_in_explore_by_category", "slug", "specialization_content",
    "specializations", "status", "study_type", "subjects", "subjects_content", "syllabus_content", "syllabus_pdf_url",
    "top_exams", "youtube_video_url",
  ],
  exams: [
    "age_limit", "applicants", "application_end_date", "application_mode", "application_process", "application_start_date",
    "author_id", "brochure_url", "cast_wise_fee", "categories", "category", "center_content", "counselling_content",
    "cutoff_content", "dates_content", "description", "duration", "eligibility", "exam_date", "exam_pattern", "exam_type",
    "frequency", "full_name", "gender_wise", "how_to_apply_video_url", "image", "important_dates", "is_active",
    "is_top_exam", "language", "level", "linked_college_subjects", "linked_school_classes", "logo", "meta_description",
    "meta_keywords", "meta_title", "mode", "name", "negative_marking", "official_website", "page_summary",
    "preparation_tips", "priority", "question_paper", "question_papers", "registration_url", "result_content", "result_date",
    "sample_paper_url", "seats", "short_name", "show_in_explore_by_category", "slug", "status", "summary_content",
    "syllabus", "top_colleges", "website", "youtube_video_url",
  ],
  articles: [
    "author", "author_id", "category", "content", "description", "featured_image", "featured_rank", "is_active",
    "meta_description", "meta_keywords", "meta_title", "slug", "status", "tags", "title", "vertical", "views",
  ],
};

const ROUTES = {
  colleges: (slug) => `/colleges/${slug}`,
  courses: (slug) => `/courses/${slug}`,
  exams: (slug) => `/exams/${slug}`,
  articles: (slug) => `/news/${slug}`,
};

function requestFor(table, method, { body, id, prefer = "return=representation" } = {}) {
  const url = new URL(`http://localhost/v1/rest/${table}`);
  url.searchParams.set("select", "*");
  if (id) url.searchParams.set("id", `eq.${id}`);
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

function resultRow(result) {
  return Array.isArray(result.body) ? result.body[0] : result.body;
}

function markerFor(runToken, editPhase) {
  return `Codex Core QA ${editPhase ? "Edited" : "Create"} ${runToken}`;
}

function slugFor(table, runToken, editPhase) {
  return `${PREFIX}${runToken}-${table}${editPhase ? "-edited" : ""}`.toLowerCase().slice(0, 180);
}

function stringValue(table, field, marker, runToken, editPhase) {
  const slug = slugFor(table, runToken, editPhase);
  const urls = new Set([
    "apply_url", "brochure_url", "how_to_apply_video_url", "official_website", "registration_url", "sample_paper_url",
    "syllabus_pdf_url", "website", "youtube_video_url",
  ]);
  const images = new Set([
    "banner_ad_image", "featured_image", "image", "logo", "square_ad_image",
  ]);
  if (field === "slug") return slug;
  if (field === "status") return "Published";
  if (field === "name") return `${marker} ${table.slice(0, -1)}`;
  if (field === "title") return `${marker} article`;
  if (field === "full_name") return `${marker} full name`;
  if (field === "short_name") return editPhase ? "CCQE" : "CCQC";
  if (field === "author") return "DekhoCampus Editorial QA";
  if (field === "vertical") return "General";
  if (field === "category") return table === "articles" ? "Education" : "Engineering";
  if (field === "type") return "Private";
  if (field === "level") return "Undergraduate";
  if (field === "mode" || field === "application_mode") return "Online";
  if (field === "study_type") return "Regular";
  if (field === "duration_type") return "Years";
  if (field === "fee_type") return "Total";
  if (field === "exam_type") return "National";
  if (field === "frequency") return "Annual";
  if (field === "language") return "English";
  if (field === "apply_cta_mode") return "lead";
  if (field === "affiliation_kind") return "standalone";
  if (field === "scholarship_available") return "Yes";
  if (field === "naac_grade") return editPhase ? "A++" : "A+";
  if (field === "exam_date" || field === "application_start_date" || field === "application_end_date" || field === "result_date") {
    return editPhase ? "2027-02-15" : "2027-01-15";
  }
  if (images.has(field)) return `${PUBLIC_BASE_URL}${editPhase ? "/favicon.png" : "/placeholder.svg"}`;
  if (urls.has(field)) return `${PUBLIC_BASE_URL}/${slug}/${field}`;
  if (field === "parent_university_slug") return null;
  if (field.endsWith("_content") || ["content", "description", "page_summary", "short_description"].includes(field)) {
    return `<p>${marker} verified ${table} ${field} on the public page.</p>`;
  }
  if (field === "meta_title") return `${marker} meta title`;
  if (field === "meta_description") return `${marker} meta description`;
  if (field === "meta_keywords") return `${marker}, regression, ${table}`;
  if (field === "city" || field === "secondary_city") return editPhase ? "Gurugram" : "New Delhi";
  if (field === "state" || field === "secondary_state") return editPhase ? "Haryana" : "Delhi";
  if (field === "location") return editPhase ? "Gurugram, Haryana" : "New Delhi, Delhi";
  if (field === "duration") return editPhase ? "5 Years" : "4 Years";
  if (field === "domain") return "Education";
  return `${marker} ${field}`;
}

async function valueFor(table, fieldName, runToken, editPhase, authorId) {
  const field = schemaMetadata[table].fields[fieldName];
  const marker = markerFor(runToken, editPhase);
  if (fieldName === "author_id") return authorId;
  if (fieldName === "id") return randomUUID();
  if (fieldName === "data_clean_state") return "never_checked";
  if (fieldName === "editorial_audit_state") return "not_ready";
  if (fieldName === "editorial_source_tier") return "unverified";
  if (field.type === "String") return field.format === "uuid" ? randomUUID() : stringValue(table, fieldName, marker, runToken, editPhase);
  if (field.type === "Json") {
    if (fieldName === "important_dates") return [{ event: `${marker} application`, date: editPhase ? "2027-02-15" : "2027-01-15" }];
    return [`${marker} ${fieldName}`];
  }
  if (field.type === "Boolean") {
    if (fieldName === "is_active") return true;
    return !editPhase;
  }
  if (field.type === "DateTime") return editPhase ? "2027-02-15T00:00:00.000Z" : "2027-01-15T00:00:00.000Z";
  if (field.type === "Decimal" || field.type === "Float") {
    if (fieldName === "rating") return editPhase ? 4.7 : 4.6;
    return editPhase ? 150000 : 125000;
  }
  if (fieldName === "established") return editPhase ? 2025 : 2024;
  if (fieldName === "priority") return editPhase ? 998 : 999;
  if (fieldName === "featured_rank") return editPhase ? 3 : 4;
  if (field.type === "BigInt") return String(Date.now());
  return editPhase ? 22 : 11;
}

async function payloadFor(table, runToken, editPhase, authorId) {
  const metadata = schemaMetadata[table];
  if (!metadata) throw new Error(`Unknown table: ${table}`);
  const configured = ADMIN_FIELDS[table];
  const missing = configured.filter((field) => !metadata.fields[field]);
  if (missing.length) throw new Error(`${table} regression fields missing from schema: ${missing.join(", ")}`);

  const fields = new Set(configured);
  if (!editPhase) {
    for (const [name, field] of Object.entries(metadata.fields)) {
      if (field.nullable || field.default !== null || name === "short_id") continue;
      fields.add(name);
    }
  }

  const payload = {};
  for (const field of fields) {
    const value = await valueFor(table, field, runToken, editPhase, authorId);
    if (value !== null || metadata.fields[field].nullable) payload[field] = value;
  }
  return payload;
}

function comparable(table, fieldName, value) {
  if (value === null || value === undefined) return value;
  const field = schemaMetadata[table].fields[fieldName];
  if (field.type === "Boolean") return value === true || value === 1 || value === "1";
  if (["Decimal", "Float", "Int"].includes(field.type)) return Number(value);
  if (field.type === "BigInt") return String(value);
  if (field.type === "DateTime") return new Date(value).toISOString();
  return value;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function assertPersisted(table, expected, actual) {
  for (const field of ADMIN_FIELDS[table]) {
    if (!(field in expected)) throw new Error(`${table}.${field} was not included in the write payload`);
    const wanted = comparable(table, field, expected[field]);
    const stored = comparable(table, field, actual?.[field]);
    if (JSON.stringify(canonical(stored)) !== JSON.stringify(canonical(wanted))) {
      throw new Error(`${table}.${field} mismatch: expected ${JSON.stringify(wanted)}, got ${JSON.stringify(stored)}`);
    }
  }
}

async function publicRow(table, id) {
  const url = new URL(`${PUBLIC_BASE_URL}/v1/rest/${table}`);
  url.searchParams.set("select", "*");
  url.searchParams.set("id", `eq.${id}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const body = await response.text();
  if (!response.ok) throw new Error(`Public ${table} read returned ${response.status}: ${body.slice(0, 240)}`);
  const rows = JSON.parse(body);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error(`Public ${table} read did not return exactly one row`);
  return rows[0];
}

async function deleteById(table, id) {
  const result = await handleRest(table, requestFor(table, "DELETE", { id, prefer: "" }));
  if (![200, 204].includes(result.status)) throw new Error(`${table} cleanup returned ${result.status}`);
  const check = await handleRest(table, requestFor(table, "GET", { id, prefer: "" }));
  if (check.status !== 406) throw new Error(`${table} record remained after cleanup`);
}

async function cleanupStale() {
  for (const table of Object.keys(ADMIN_FIELDS)) {
    await prisma[table].deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }
}

async function prepare() {
  await cleanupStale();
  const runToken = Date.now().toString(36);
  const author = await prisma.authors.findFirst({ where: { is_active: true }, select: { id: true } });
  const entities = [];
  try {
    for (const table of Object.keys(ADMIN_FIELDS)) {
      const payload = await payloadFor(table, runToken, false, author?.id ?? null);
      const result = await handleRest(table, requestFor(table, "POST", { body: payload }));
      if (result.status !== 201) throw new Error(`${table} create returned ${result.status}: ${JSON.stringify(result.body)}`);
      const created = resultRow(result);
      assertPersisted(table, payload, created);
      assertPersisted(table, payload, await publicRow(table, created.id));
      entities.push({
        table,
        id: created.id,
        slug: created.slug,
        marker: markerFor(runToken, false),
        route: ROUTES[table](created.slug),
        fieldsChecked: ADMIN_FIELDS[table].length,
      });
    }
  } catch (error) {
    for (const entity of entities.reverse()) await deleteById(entity.table, entity.id).catch(() => {});
    throw error;
  }
  const manifest = { runToken, phase: "create", entities };
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  return manifest;
}

async function edit() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const author = await prisma.authors.findFirst({ where: { is_active: true }, select: { id: true } });
  const entities = [];
  for (const entity of manifest.entities) {
    const payload = await payloadFor(entity.table, manifest.runToken, true, author?.id ?? null);
    const result = await handleRest(entity.table, requestFor(entity.table, "PATCH", { id: entity.id, body: payload }));
    if (result.status !== 200) throw new Error(`${entity.table} edit returned ${result.status}: ${JSON.stringify(result.body)}`);
    const edited = resultRow(result);
    assertPersisted(entity.table, payload, edited);
    assertPersisted(entity.table, payload, await publicRow(entity.table, entity.id));
    entities.push({
      ...entity,
      slug: edited.slug,
      marker: markerFor(manifest.runToken, true),
      route: ROUTES[entity.table](edited.slug),
    });
  }
  const editedManifest = { ...manifest, phase: "edit", entities };
  await writeFile(MANIFEST_PATH, JSON.stringify(editedManifest, null, 2));
  return editedManifest;
}

async function cleanup() {
  let manifest = null;
  try {
    manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const failures = [];
  for (const entity of [...(manifest?.entities || [])].reverse()) {
    try {
      await deleteById(entity.table, entity.id);
    } catch (error) {
      failures.push(`${entity.table}:${entity.id}: ${error.message}`);
    }
  }
  await cleanupStale();
  await rm(MANIFEST_PATH, { force: true });
  if (failures.length) throw new Error(failures.join("; "));
  return { ok: true, phase: "cleanup", removed: manifest?.entities?.length || 0 };
}

try {
  const report = phase === "prepare" ? await prepare() : phase === "edit" ? await edit() : phase === "cleanup" ? await cleanup() : null;
  if (!report) throw new Error(`Unknown phase: ${phase}`);
  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
} finally {
  await prisma.$disconnect();
}
