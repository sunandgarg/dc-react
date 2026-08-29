#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { handleContentReviews } from "../src/content-review.mjs";
import { prisma, quote, schemaMetadata } from "../src/db.mjs";
import { provisionExistingRestrictedEditor } from "../src/editor-access.mjs";
import { handleRest } from "../src/rest.mjs";

const TABLES = ["colleges", "courses", "exams", "articles"];
const PREFIX = `codex-editor-review-${Date.now().toString(36)}`;

function requestFor(table, method, { body, id } = {}) {
  const url = new URL(`http://localhost/v1/rest/${table}`);
  url.searchParams.set("select", "*");
  if (id) url.searchParams.set("id", `eq.${id}`);
  return new Request(url, {
    method,
    headers: { accept: "application/vnd.pgrst.object+json", "content-type": "application/json", prefer: "return=representation" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function requiredValue(table, name, field) {
  if (field.foreignKey) {
    const [targetTable, targetField] = field.foreignKey;
    const rows = await prisma.$queryRawUnsafe(`SELECT ${quote(targetField)} AS value FROM ${quote(targetTable)} WHERE ${quote(targetField)} IS NOT NULL LIMIT 1`);
    if (!rows.length) throw new Error(`No value exists for ${table}.${name} -> ${targetTable}.${targetField}`);
    return rows[0].value;
  }
  if (field.type === "String") {
    if (field.format === "uuid") return randomUUID();
    if (name === "slug") return `${PREFIX}-${table}`;
    if (name === "status") return table === "exams" ? "Upcoming" : "Draft";
    if (name === "name" || name === "title") return `Restricted editor QA ${table}`;
    if (name.includes("email")) return `${PREFIX}@example.com`;
    if (name.includes("url") || name === "website") return `https://dekhocampus.com/${PREFIX}-${table}`;
    return `Restricted editor QA ${name}`;
  }
  if (field.type === "Json") return field.format?.endsWith("[]") ? [] : {};
  if (field.type === "Boolean") return false;
  if (field.type === "DateTime") return new Date().toISOString();
  if (["Decimal", "Float"].includes(field.type)) return 4.5;
  if (field.type === "BigInt") return String(Date.now());
  return 1;
}

async function payloadFor(table) {
  const fields = schemaMetadata[table].fields;
  const payload = {};
  for (const [name, field] of Object.entries(fields)) {
    if (field.nullable || field.default !== null || name === "short_id") continue;
    payload[name] = await requiredValue(table, name, field);
  }
  payload.slug = `${PREFIX}-${table}`;
  if (fields.name) payload.name = `Restricted editor QA ${table}`;
  if (fields.title) payload.title = `Restricted editor QA ${table}`;
  if (fields.description) payload.description = `<p>${PREFIX} create</p>`;
  if (fields.content) payload.content = `<p>${PREFIX} article create</p>`;
  if (fields.status) payload.status = table === "exams" ? "Upcoming" : "Draft";
  if (fields.is_active) payload.is_active = false;
  return payload;
}

async function pendingReview(table, actorId, operation) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT * FROM `content_change_reviews` WHERE `entity_type` = ? AND `actor_user_id` = ? AND `operation` = ? AND `status` = 'pending' AND `entity_slug` = ? ORDER BY `created_at` DESC LIMIT 1",
    table, actorId, operation, `${PREFIX}-${table}`,
  );
  if (!rows[0]) throw new Error(`${table} ${operation} did not enter the admin review bucket`);
  return rows[0];
}

async function approve(review, reviewerId) {
  const result = await handleContentReviews(new Request("http://localhost/v1/functions/content-reviews", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: review.id, status: "approved", review_notes: "Automated reversible production verification" }),
  }), reviewerId);
  if (!result.success || !result.applied) throw new Error(`Review ${review.id} was not applied`);
}

async function liveRow(table) {
  return prisma[table].findFirst({ where: { slug: `${PREFIX}-${table}` } });
}

async function cleanup() {
  for (const table of TABLES) await prisma[table].deleteMany({ where: { slug: `${PREFIX}-${table}` } });
  await prisma.$executeRawUnsafe("DELETE FROM `content_change_reviews` WHERE `entity_slug` LIKE ?", `${PREFIX}-%`);
}

try {
  await provisionExistingRestrictedEditor();
  const editor = await prisma.app_auth_users.findFirst({ where: { phone: { in: ["7428966263", "+917428966263"] } } });
  if (!editor) throw new Error("Restricted editor 7428966263 was not provisioned");
  const permissions = await prisma.user_permissions.findMany({ where: { user_id: editor.id, resource: { in: TABLES } } });
  for (const table of TABLES) {
    const permission = permissions.find((row) => row.resource === table);
    if (!permission?.can_view || !permission?.can_create || !permission?.can_edit || permission?.can_publish || permission?.can_delete) {
      throw new Error(`${table} restricted permission is incorrect`);
    }
  }
  const reviewer = await prisma.user_roles.findFirst({ where: { role: "admin" }, select: { user_id: true } });
  if (!reviewer) throw new Error("No admin reviewer is available");

  await cleanup();
  for (const table of TABLES) {
    const payload = await payloadFor(table);
    const stagedCreate = await handleRest(table, requestFor(table, "POST", { body: payload }), {
      actorUserId: editor.id, stageReview: true, forceDraft: true,
    });
    if (stagedCreate.status !== 202 || await liveRow(table)) throw new Error(`${table} create bypassed review`);
    const createReview = await pendingReview(table, editor.id, "create");
    await approve(createReview, reviewer.user_id);
    const createdRow = await liveRow(table);
    if (!createdRow) throw new Error(`${table} approved create was not applied`);
    const field = schemaMetadata[table].fields.description ? "description" : schemaMetadata[table].fields.content ? "content" : schemaMetadata[table].fields.name ? "name" : "title";
    const editedValue = `<p>${PREFIX} approved edit</p>`;
    const stagedEdit = await handleRest(table, requestFor(table, "PATCH", { id: createdRow.id, body: { [field]: editedValue } }), {
      actorUserId: editor.id, stageReview: true, forceDraft: true,
    });
    if (stagedEdit.status !== 202) throw new Error(`${table} edit did not enter review`);
    const unchanged = await liveRow(table);
    if (unchanged[field] === editedValue) throw new Error(`${table} edit changed live data before approval`);
    const editReview = await pendingReview(table, editor.id, "update");
    await approve(editReview, reviewer.user_id);
    const edited = await liveRow(table);
    if (edited[field] !== editedValue) throw new Error(`${table} approved edit was not applied`);
  }
  console.log(JSON.stringify({ success: true, phone: "7428966263", resources: TABLES, review_required: true }));
} finally {
  await cleanup();
  await prisma.$disconnect();
}
