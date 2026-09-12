#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { prisma, quote, schemaMetadata } from "../src/db.mjs";
import { CONTENT_HEAD_PHONE, CONTENT_HEAD_RESOURCES, provisionExistingContentHead } from "../src/editor-access.mjs";
import { handleRest } from "../src/rest.mjs";

const TABLES = ["colleges", "courses", "exams", "articles"];
const PREFIX = `codex-content-head-${Date.now().toString(36)}`;

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
    if (name === "status") return table === "exams" ? "Upcoming" : "Published";
    if (name === "name" || name === "title") return `Content Head QA ${table}`;
    if (name.includes("email")) return `${PREFIX}@example.com`;
    if (name.includes("url") || name === "website") return `https://dekhocampus.com/${PREFIX}-${table}`;
    return `Content Head QA ${name}`;
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
  if (fields.name) payload.name = `Content Head QA ${table}`;
  if (fields.title) payload.title = `Content Head QA ${table}`;
  if (fields.description) payload.description = `<p>${PREFIX} create</p>`;
  if (fields.content) payload.content = `<p>${PREFIX} article create</p>`;
  if (fields.status) payload.status = table === "exams" ? "Upcoming" : "Published";
  if (fields.is_active) payload.is_active = true;
  return payload;
}

async function liveRow(table) {
  return prisma[table].findFirst({ where: { slug: `${PREFIX}-${table}` } });
}

async function cleanup() {
  for (const table of TABLES) await prisma[table].deleteMany({ where: { slug: `${PREFIX}-${table}` } });
  await prisma.$executeRawUnsafe("DELETE FROM `content_change_reviews` WHERE `entity_slug` LIKE ?", `${PREFIX}-%`);
}

try {
  const contentHead = await provisionExistingContentHead();
  const roleRows = await prisma.user_roles.findMany({ where: { user_id: contentHead.id } });
  if (roleRows.length !== 1 || roleRows[0].role !== "content_head") {
    throw new Error("Content Head role is not exclusive or correctly assigned");
  }
  const permissions = await prisma.user_permissions.findMany({ where: { user_id: contentHead.id } });
  if (permissions.length !== CONTENT_HEAD_RESOURCES.size) throw new Error("Content Head permission count is incorrect");
  for (const table of TABLES) {
    const permission = permissions.find((row) => row.resource === table);
    if (!permission?.can_view || !permission?.can_create || !permission?.can_edit || !permission?.can_publish || permission?.can_delete) {
      throw new Error(`${table} Content Head permission is incorrect`);
    }
  }

  await cleanup();
  for (const table of TABLES) {
    const payload = await payloadFor(table);
    const created = await handleRest(table, requestFor(table, "POST", { body: payload }), {
      actorUserId: null, stageReview: false, forceDraft: false,
    });
    if (created.status !== 201) throw new Error(`${table} direct create returned ${created.status}`);
    const createdRow = await liveRow(table);
    if (!createdRow) throw new Error(`${table} direct create was not persisted`);
    if (schemaMetadata[table].fields.is_active && createdRow.is_active !== true) throw new Error(`${table} direct create was forced inactive`);
    if (table === "articles" && createdRow.status !== "Published") throw new Error("Article was not directly published");

    const field = schemaMetadata[table].fields.description ? "description" : schemaMetadata[table].fields.content ? "content" : schemaMetadata[table].fields.name ? "name" : "title";
    const editedValue = `<p>${PREFIX} direct edit</p>`;
    const editedResponse = await handleRest(table, requestFor(table, "PATCH", { id: createdRow.id, body: { [field]: editedValue } }), {
      actorUserId: null, stageReview: false, forceDraft: false,
    });
    if (editedResponse.status !== 200) throw new Error(`${table} direct edit returned ${editedResponse.status}`);
    const edited = await liveRow(table);
    if (edited[field] !== editedValue) throw new Error(`${table} direct edit was not applied`);
  }
  const reviewCount = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS `count` FROM `content_change_reviews` WHERE `entity_slug` LIKE ?",
    `${PREFIX}-%`,
  );
  if (Number(reviewCount[0]?.count || 0) !== 0) throw new Error("Direct Content Head writes incorrectly entered the review bucket");
  console.log(JSON.stringify({ success: true, phone: CONTENT_HEAD_PHONE, resources: TABLES, direct_publish: true, delete_allowed: false }));
} finally {
  await cleanup();
  await prisma.$disconnect();
}
