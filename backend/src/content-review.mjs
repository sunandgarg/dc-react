import { randomUUID } from "node:crypto";
import { prisma } from "./db.mjs";

const REVIEWED_TABLES = new Set(["colleges", "courses", "exams", "articles"]);
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
    await prisma.$executeRawUnsafe(
      "UPDATE `content_change_reviews` SET `status` = ?, `reviewed_by` = ?, `review_notes` = ?, `reviewed_at` = ? WHERE `id` = ?",
      status, reviewerId, String(body.review_notes || "").slice(0, 4000) || null, new Date(), String(body.id || ""),
    );
    return { success: true };
  }
  throw Object.assign(new Error("Method not allowed"), { status: 405, code: "METHOD_NOT_ALLOWED" });
}
