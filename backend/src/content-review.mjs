import { randomUUID } from "node:crypto";
import { prisma, quote, schemaMetadata } from "./db.mjs";

const REVIEWED_TABLES = new Set([
  "articles", "article_categories", "article_links", "authors",
  "colleges", "college_contacts", "college_facilities", "college_few_links",
  "college_programs", "college_quick_links", "college_resources", "college_semesters",
  "college_subjects", "college_toppers", "college_universities",
  "courses", "course_fees", "course_specializations", "exams",
  "career_profiles", "career_course_links", "companies", "placement_records",
  "faculty", "facilities_library", "scholarships", "jobs",
  "study_board_links", "study_boards", "study_chapters", "study_resources",
  "study_subjects", "study_toppers", "faqs", "popular_places",
  "program_categories", "programs", "promoted_programs", "stream_categories",
]);
const IGNORED_FIELDS = new Set(["updated_at"]);

function jsonValue(value) {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === "bigint") return item.toString();
    if (item instanceof Date) return item.toISOString();
    return item;
  });
}

function changedFields(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys].filter((key) => !IGNORED_FIELDS.has(key) && jsonValue(before?.[key]) !== jsonValue(after?.[key]));
}

export async function ensureContentReviewTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`content_change_reviews\` (
      \`id\` CHAR(36) NOT NULL,
      \`entity_type\` VARCHAR(32) NOT NULL,
      \`entity_id\` VARCHAR(191) NULL,
      \`entity_slug\` VARCHAR(255) NULL,
      \`entity_name\` VARCHAR(500) NULL,
      \`operation\` VARCHAR(16) NOT NULL,
      \`actor_user_id\` CHAR(36) NOT NULL,
      \`before_json\` JSON NULL,
      \`after_json\` JSON NOT NULL,
      \`changed_fields\` JSON NOT NULL,
      \`status\` VARCHAR(24) NOT NULL DEFAULT 'pending',
      \`reviewed_by\` CHAR(36) NULL,
      \`review_notes\` TEXT NULL,
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`reviewed_at\` DATETIME(3) NULL,
      PRIMARY KEY (\`id\`),
      INDEX \`content_change_reviews_status_created_idx\` (\`status\`, \`created_at\`),
      INDEX \`content_change_reviews_actor_idx\` (\`actor_user_id\`, \`created_at\`),
      INDEX \`content_change_reviews_entity_idx\` (\`entity_type\`, \`entity_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function recordContentReviews({ table, operation, actorUserId, beforeRows = [], afterRows = [] }) {
  if (!actorUserId || !REVIEWED_TABLES.has(table)) return;
  const beforeById = new Map(beforeRows.map((row) => [String(row.id || row.slug || ""), row]));
  for (const after of afterRows) {
    const key = String(after.id || after.slug || "");
    const before = beforeById.get(key) || null;
    const fields = changedFields(before, after);
    if (!fields.length) continue;
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`content_change_reviews\`
        (\`id\`,\`entity_type\`,\`entity_id\`,\`entity_slug\`,\`entity_name\`,\`operation\`,\`actor_user_id\`,\`before_json\`,\`after_json\`,\`changed_fields\`,\`status\`,\`created_at\`)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      randomUUID(), table, after.id || null, after.slug || null, after.name || after.title || null,
      operation, actorUserId, before ? jsonValue(before) : null, jsonValue(after), jsonValue(fields), "pending", new Date(),
    );
  }
}

function databaseValue(table, fieldName, value) {
  if (value === null || value === undefined) return null;
  const field = schemaMetadata[table].fields[fieldName];
  if (field?.type === "Json") return typeof value === "string" ? value : JSON.stringify(value);
  if (field?.type === "Boolean") return value ? 1 : 0;
  if (field?.type === "BigInt") return String(value);
  if (field?.type === "DateTime") {
    if (field.format === "date") return String(value).slice(0, 10);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString().replace("T", " ").replace("Z", "");
  }
  return value;
}

function parseReviewJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

async function applyApprovedReview(tx, review) {
  const table = review.entity_type;
  if (!REVIEWED_TABLES.has(table) || !schemaMetadata[table]) throw new Error("Review targets an unsupported resource");
  const after = parseReviewJson(review.after_json, {});
  const changed = parseReviewJson(review.changed_fields, []);
  const fields = schemaMetadata[table].fields;

  if (review.operation === "create") {
    if (["colleges", "courses", "exams"].includes(table) && fields.short_id && after.short_id === undefined) {
      const starts = { colleges: 10001, courses: 20001, exams: 30001 };
      const maximum = await tx.$queryRawUnsafe(`SELECT MAX(\`short_id\`) AS maximum FROM ${quote(table)}`);
      after.short_id = Math.max(starts[table], Number(maximum[0]?.maximum || starts[table] - 1) + 1);
    }
    const columns = Object.keys(after).filter((column) => fields[column]);
    if (!columns.length) throw new Error("Reviewed create contains no writable fields");
    const existing = after.id
      ? await tx.$queryRawUnsafe(`SELECT 1 FROM ${quote(table)} WHERE \`id\` = ? LIMIT 1`, after.id)
      : [];
    if (existing.length) {
      const updates = columns.filter((column) => !["id", "created_at"].includes(column));
      await tx.$executeRawUnsafe(
        `UPDATE ${quote(table)} SET ${updates.map((column) => `${quote(column)} = ?`).join(",")} WHERE \`id\` = ?`,
        ...updates.map((column) => databaseValue(table, column, after[column])), after.id,
      );
      return;
    }
    await tx.$executeRawUnsafe(
      `INSERT INTO ${quote(table)} (${columns.map(quote).join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
      ...columns.map((column) => databaseValue(table, column, after[column])),
    );
    return;
  }

  const columns = changed.filter((column) => fields[column] && !["id", "created_at", "updated_at", "short_id"].includes(column));
  if (!columns.length) return;
  const identityField = review.entity_id ? "id" : "slug";
  const identityValue = review.entity_id || review.entity_slug;
  if (!identityValue) throw new Error("Reviewed update has no stable entity identity");
  const result = await tx.$executeRawUnsafe(
    `UPDATE ${quote(table)} SET ${columns.map((column) => `${quote(column)} = ?`).join(",")}${fields.updated_at ? ",`updated_at` = ?" : ""} WHERE ${quote(identityField)} = ?`,
    ...columns.map((column) => databaseValue(table, column, after[column])),
    ...(fields.updated_at ? [new Date()] : []), identityValue,
  );
  if (!result) throw new Error("The reviewed record no longer exists");
}

export async function handleContentReviews(request, reviewerId) {
  const url = new URL(request.url);
  if (request.method === "GET") {
    const status = url.searchParams.get("status") || "all";
    const entityType = url.searchParams.get("entity_type") || "";
    const params = [];
    const clauses = [];
    if (status !== "all") { clauses.push("`status` = ?"); params.push(status); }
    if (entityType) { clauses.push("`entity_type` = ?"); params.push(entityType); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM \`content_change_reviews\` ${where} ORDER BY \`created_at\` DESC LIMIT 500`,
      ...params,
    );
    return rows.map((row) => ({
      ...row,
      before_json: typeof row.before_json === "string" ? JSON.parse(row.before_json) : row.before_json,
      after_json: typeof row.after_json === "string" ? JSON.parse(row.after_json) : row.after_json,
      changed_fields: typeof row.changed_fields === "string" ? JSON.parse(row.changed_fields) : row.changed_fields,
    }));
  }
  if (request.method === "PATCH") {
    const body = await request.json().catch(() => ({}));
    const status = ["approved", "needs_changes"].includes(body.status) ? body.status : "approved";
    const reviewId = String(body.id || "");
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe("SELECT * FROM `content_change_reviews` WHERE `id` = ? FOR UPDATE", reviewId);
      const review = rows[0];
      if (!review) throw Object.assign(new Error("Review was not found"), { status: 404, code: "REVIEW_NOT_FOUND" });
      if (review.status !== "pending") throw Object.assign(new Error("Review has already been decided"), { status: 409, code: "REVIEW_ALREADY_DECIDED" });
      if (status === "approved") await applyApprovedReview(tx, review);
      await tx.$executeRawUnsafe(
        "UPDATE `content_change_reviews` SET `status` = ?, `reviewed_by` = ?, `review_notes` = ?, `reviewed_at` = ? WHERE `id` = ?",
        status, reviewerId, String(body.review_notes || "").slice(0, 4000) || null, new Date(), reviewId,
      );
    });
    return { success: true, applied: status === "approved" };
  }
  throw Object.assign(new Error("Method not allowed"), { status: 405, code: "METHOD_NOT_ALLOWED" });
}
