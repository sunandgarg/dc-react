import { randomUUID } from "node:crypto";
import { prisma, quote, schemaMetadata, tableNames, jsonSafe } from "./db.mjs";
import { recordContentReviews } from "./content-review.mjs";
import { toPublicMediaUrls, toStoredMediaKeys } from "./media-values.mjs";
import { invalidateDirectorySearchCache, searchDirectory } from "./directory-search.mjs";

const CONTROL_PARAMS = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
const SHORT_ID_STARTS = { colleges: 10001, courses: 20001, exams: 30001 };
const HOMEPAGE_EXPLORE_TABLES = new Set(["colleges", "courses", "exams"]);

function stampHomepageExploreSelection(table, input) {
  if (!HOMEPAGE_EXPLORE_TABLES.has(table) || input?.show_in_explore_by_category === undefined) return input;
  return {
    ...input,
    explore_by_category_checked_at: input.show_in_explore_by_category ? new Date().toISOString() : null,
  };
}

function splitDepth(value, separator = ",") {
  const parts = [];
  let depth = 0;
  let quoted = false;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '"' && value[index - 1] !== "\\") quoted = !quoted;
    if (!quoted && ["(", "{"].includes(char)) depth += 1;
    if (!quoted && [")", "}"].includes(char)) depth -= 1;
    if (!quoted && depth === 0 && char === separator) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function parseSelect(value = "*") {
  return splitDepth(value).map((token) => {
    const open = token.indexOf("(");
    if (open < 0) {
      const [alias, field] = token.includes(":") ? token.split(":", 2) : [null, token];
      return { kind: "field", alias, field: field.trim() };
    }
    const rawName = token.slice(0, open);
    const [alias, relationPart] = rawName.includes(":") ? rawName.split(":", 2) : [null, rawName];
    const relation = relationPart.split("!")[0];
    return { kind: "relation", alias, relation, fields: parseSelect(token.slice(open + 1, -1)) };
  });
}

function parseLiteral(value) {
  const raw = String(value ?? "");
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw.replace(/^"|"$/g, "").replaceAll('\\"', '"');
}

export function normalizeForDatabase(value, field) {
  if (value === null || value === undefined) return null;
  value = toStoredMediaKeys(value);
  if (field?.type === "Json") return typeof value === "string" ? value : JSON.stringify(value);
  if (field?.type === "Boolean") return value ? 1 : 0;
  if (field?.type === "BigInt") return String(value);
  if (field?.type === "DateTime") {
    if (field.nullable && String(value).trim() === "") return null;
    if (field.format === "date") return String(value).slice(0, 10);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString().replace("T", " ").replace("Z", "");
  }
  return value;
}

export function applyDefaults(table, row) {
  const result = { ...row };
  for (const [name, field] of Object.entries(schemaMetadata[table].fields)) {
    if (result[name] !== undefined) continue;
    const normalizedDefault = String(field.default).toLowerCase();
    if (String(field.default).includes("gen_random_uuid")) result[name] = randomUUID();
    else if (normalizedDefault === "now()") result[name] = new Date().toISOString();
    else if (["current_date", "current_date()"].includes(normalizedDefault)) result[name] = new Date().toISOString().slice(0, 10);
    else if (field.default !== null) result[name] = field.default;
    else if (field.type === "Json" && !field.nullable) {
      result[name] = String(field.format).endsWith("[]") ? [] : {};
    }
  }
  return result;
}

export function forceDraftPayload(table, input) {
  const row = { ...input };
  const fields = schemaMetadata[table]?.fields || {};
  if (fields.is_active) row.is_active = false;
  if (fields.is_published) row.is_published = false;
  if (fields.published) row.published = false;
  if (fields.published_at) row.published_at = null;
  if (["articles", "colleges", "courses"].includes(table) && fields.status) row.status = "Draft";
  if (table === "exams" && fields.status && ["Applications Open", "Applications Closed"].includes(String(row.status || ""))) {
    row.status = "Upcoming";
  }
  return row;
}

export function nextShortIdValue(table, currentMax) {
  const start = SHORT_ID_STARTS[table];
  if (!start) return undefined;
  if (currentMax === null || currentMax === undefined) return start;
  return Math.max(start, Number(currentMax) + 1);
}

export function resolveConflictColumns(table, requestedColumns = "") {
  const explicit = String(requestedColumns)
    .split(",")
    .filter((column) => schemaMetadata[table].fields[column]);
  return explicit.length ? explicit : schemaMetadata[table].primaryKeys;
}

function isDuplicateKeyError(error) {
  const detail = `${error?.message || ""} ${error?.meta?.message || ""} ${error?.meta?.code || ""}`;
  return error?.code === "P2002" || /duplicate entry|\b1062\b/i.test(detail);
}

export function decodeRow(table, row) {
  for (const [name, field] of Object.entries(schemaMetadata[table].fields)) {
    if (field.type === "Json" && typeof row[name] === "string") {
      try { row[name] = JSON.parse(row[name]); } catch { /* retain legacy non-JSON text */ }
    }
    if (field.type === "Decimal" && row[name] !== null && row[name] !== undefined) {
      row[name] = typeof row[name]?.toNumber === "function" ? row[name].toNumber() : Number(row[name]);
    }
  }
  return toPublicMediaUrls(toStoredMediaKeys(row));
}

function columnFor(table, rawColumn) {
  const column = rawColumn.split(".").at(-1);
  if (!schemaMetadata[table]?.fields[column]) throw new Error(`Unknown column ${table}.${column}`);
  return column;
}

function filterSql(table, rawColumn, expression, params) {
  const column = columnFor(table, rawColumn);
  const field = schemaMetadata[table].fields[column];
  let value = String(expression);
  let negate = false;
  if (value.startsWith("not.")) {
    negate = true;
    value = value.slice(4);
  }
  const dot = value.indexOf(".");
  const operator = dot < 0 ? "eq" : value.slice(0, dot);
  const rawValue = dot < 0 ? value : value.slice(dot + 1);
  const sqlColumn = quote(column);
  const wrap = (sql) => negate ? `NOT (${sql})` : sql;

  if (operator === "is") {
    if (rawValue === "null") return wrap(`${sqlColumn} IS NULL`);
    params.push(rawValue === "true" ? 1 : 0);
    return wrap(`${sqlColumn} = ?`);
  }
  if (operator === "in") {
    const values = splitDepth(rawValue.replace(/^\(|\)$/g, "")).map(parseLiteral);
    if (!values.length) return negate ? "1=1" : "1=0";
    params.push(...values.map((item) => normalizeForDatabase(item, field)));
    return wrap(`${sqlColumn} IN (${values.map(() => "?").join(",")})`);
  }
  if (["like", "ilike"].includes(operator)) {
    params.push(rawValue.replaceAll("*", "%"));
    return wrap(operator === "ilike" ? `LOWER(${sqlColumn}) LIKE LOWER(?)` : `${sqlColumn} LIKE ?`);
  }
  if (["fts", "plfts", "phfts", "wfts"].includes(operator)) {
    params.push(`%${rawValue}%`);
    return wrap(`${sqlColumn} LIKE ?`);
  }
  if (["cs", "cd", "ov"].includes(operator)) {
    params.push(rawValue);
    return wrap(operator === "cd" ? `JSON_CONTAINS(?, ${sqlColumn})` : `JSON_CONTAINS(${sqlColumn}, ?)`);
  }
  const sqlOperator = { eq: "=", neq: "!=", gt: ">", gte: ">=", lt: "<", lte: "<=" }[operator];
  if (!sqlOperator) throw new Error(`Unsupported filter operator: ${operator}`);
  params.push(normalizeForDatabase(parseLiteral(rawValue), field));
  return wrap(`${sqlColumn} ${sqlOperator} ?`);
}

function booleanGroupSql(table, value, joiner, params) {
  const body = String(value).replace(/^\(|\)$/g, "");
  const clauses = splitDepth(body).map((clause) => {
    const first = clause.indexOf(".");
    if (first < 0) throw new Error(`Invalid ${joiner} filter`);
    return filterSql(table, clause.slice(0, first), clause.slice(first + 1), params);
  });
  return clauses.length ? `(${clauses.join(` ${joiner} `)})` : "1=1";
}

function buildWhere(table, url, params) {
  const clauses = [];
  for (const [key, value] of url.searchParams.entries()) {
    if (CONTROL_PARAMS.has(key)) continue;
    if (key === "or") clauses.push(booleanGroupSql(table, value, "OR", params));
    else if (key === "and") clauses.push(booleanGroupSql(table, value, "AND", params));
    else clauses.push(filterSql(table, key, value, params));
  }
  return clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
}

function selectSql(table, nodes) {
  const fields = nodes.filter((node) => node.kind === "field");
  if (!fields.length || fields.some((node) => node.field === "*")) return "*";
  return fields.map((node) => {
    const field = columnFor(table, node.field);
    return node.alias ? `${quote(field)} AS ${quote(node.alias)}` : quote(field);
  }).join(",");
}

function relationSourceFields(table, nodes) {
  const fields = [];
  for (const node of nodes.filter((item) => item.kind === "relation" && tableNames.has(item.relation))) {
    const outbound = Object.entries(schemaMetadata[table].fields).find(([, field]) => field.foreignKey?.[0] === node.relation);
    const inbound = Object.entries(schemaMetadata[node.relation].fields).find(([, field]) => field.foreignKey?.[0] === table);
    if (outbound) fields.push(outbound[0]);
    else if (inbound) fields.push(inbound[1].foreignKey[1]);
  }
  return [...new Set(fields)];
}

function orderSql(table, value) {
  if (!value) return "";
  const items = splitDepth(value).flatMap((item) => {
    const [field, direction = "asc"] = item.split(".");
    if (field.includes("(") || !schemaMetadata[table].fields[field]) return [];
    return [`${quote(field)} ${direction.toLowerCase() === "desc" ? "DESC" : "ASC"}`];
  });
  return items.length ? ` ORDER BY ${items.join(",")}` : "";
}

async function hydrateRelations(table, rows, nodes) {
  const relationNodes = nodes.filter((node) => node.kind === "relation" && tableNames.has(node.relation));
  for (const node of relationNodes) {
    const related = node.relation;
    const outputName = node.alias || related;
    const outbound = Object.entries(schemaMetadata[table].fields).find(([, field]) => field.foreignKey?.[0] === related);
    const inbound = Object.entries(schemaMetadata[related].fields).find(([, field]) => field.foreignKey?.[0] === table);
    if (outbound) {
      const [foreignField, field] = outbound;
      const targetField = field.foreignKey[1];
      const values = [...new Set(rows.map((row) => row[foreignField]).filter((value) => value !== null && value !== undefined))];
      if (!values.length) { rows.forEach((row) => { row[outputName] = null; }); continue; }
      const params = [...values];
      const relatedRows = await prisma.$queryRawUnsafe(`SELECT ${selectSql(related, node.fields)}, ${quote(targetField)} AS ${quote("__relation_key")} FROM ${quote(related)} WHERE ${quote(targetField)} IN (${values.map(() => "?").join(",")})`, ...params);
      const byKey = new Map(relatedRows.map((row) => {
        const key = String(row.__relation_key);
        delete row.__relation_key;
        return [key, decodeRow(related, row)];
      }));
      rows.forEach((row) => { row[outputName] = byKey.get(String(row[foreignField])) || null; });
    } else if (inbound) {
      const [foreignField, field] = inbound;
      const sourceField = field.foreignKey[1];
      const values = [...new Set(rows.map((row) => row[sourceField]).filter((value) => value !== null && value !== undefined))];
      if (!values.length) { rows.forEach((row) => { row[outputName] = []; }); continue; }
      const relatedRows = await prisma.$queryRawUnsafe(`SELECT ${selectSql(related, node.fields)}, ${quote(foreignField)} AS ${quote("__relation_key")} FROM ${quote(related)} WHERE ${quote(foreignField)} IN (${values.map(() => "?").join(",")})`, ...values);
      const groups = new Map();
      for (const relatedRow of relatedRows) {
        const key = String(relatedRow.__relation_key);
        delete relatedRow.__relation_key;
        groups.set(key, [...(groups.get(key) || []), decodeRow(related, relatedRow)]);
      }
      rows.forEach((row) => { row[outputName] = groups.get(String(row[sourceField])) || []; });
    } else {
      rows.forEach((row) => { row[outputName] = null; });
    }
  }
  return rows;
}

function responseHeaders(total, start, count) {
  const end = count ? start + count - 1 : start;
  return { "content-range": `${start}-${end}/${total}`, "range-unit": "items" };
}

function representationBody(request, rows) {
  const safe = jsonSafe(rows);
  const wantsObject = String(request.headers.get("accept") || "").includes("application/vnd.pgrst.object");
  if (!wantsObject) return safe;
  if (safe.length !== 1) {
    const error = new Error(`JSON object requested, ${safe.length} rows returned`);
    error.code = "PGRST116";
    throw error;
  }
  return safe[0];
}

async function handleGet(table, request, url) {
  const nodes = parseSelect(url.searchParams.get("select") || "*");
  const requestedFields = new Set(nodes.filter((node) => node.kind === "field").map((node) => node.field));
  const selectingAll = requestedFields.has("*") || requestedFields.size === 0;
  const hiddenRelationFields = selectingAll ? [] : relationSourceFields(table, nodes).filter((field) => !requestedFields.has(field));
  const params = [];
  const where = buildWhere(table, url, params);
  const countRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS total FROM ${quote(table)}${where}`, ...params);
  const total = Number(countRows[0]?.total || 0);
  const range = request.headers.get("range")?.split("-").map(Number);
  const offset = Number(url.searchParams.get("offset") ?? range?.[0] ?? 0);
  const requestedLimit = Number(url.searchParams.get("limit") ?? (range ? range[1] - range[0] + 1 : 1000));
  const limit = Math.max(0, Math.min(1000, Number.isFinite(requestedLimit) ? requestedLimit : 1000));
  const selection = [selectSql(table, nodes), ...hiddenRelationFields.map(quote)].join(",");
  const query = `SELECT ${selection} FROM ${quote(table)}${where}${orderSql(table, url.searchParams.get("order"))} LIMIT ${limit} OFFSET ${Math.max(0, offset)}`;
  let rows = request.method === "HEAD" ? [] : await prisma.$queryRawUnsafe(query, ...params);
  rows = rows.map((row) => decodeRow(table, row));
  rows = await hydrateRelations(table, rows, nodes);
  rows.forEach((row) => hiddenRelationFields.forEach((field) => delete row[field]));
  const safe = jsonSafe(rows);
  const wantsObject = String(request.headers.get("accept") || "").includes("application/vnd.pgrst.object");
  if (wantsObject) {
    if (safe.length !== 1) return { status: 406, body: { code: "PGRST116", message: `JSON object requested, ${safe.length} rows returned` }, headers: responseHeaders(total, offset, safe.length) };
    return { status: 200, body: safe[0], headers: responseHeaders(total, offset, 1) };
  }
  return { status: 200, body: safe, headers: responseHeaders(total, offset, safe.length) };
}

async function insertRow(table, input, merge, conflictColumns) {
  const row = applyDefaults(table, input);
  const allowed = schemaMetadata[table].fields;
  const providedColumns = Object.keys(row).filter((column) => allowed[column]);
  if (merge && conflictColumns.length) {
    const conflictValues = conflictColumns.map((column) => normalizeForDatabase(row[column], allowed[column]));
    if (conflictValues.every((value) => value !== undefined)) {
      const columns = providedColumns;
      const values = columns.map((column) => normalizeForDatabase(row[column], allowed[column]));
      const updates = columns.filter((column) => !conflictColumns.includes(column));
      const duplicateClause = updates.length
        ? updates.map((column) => `${quote(column)} = VALUES(${quote(column)})`).join(",")
        : `${quote(conflictColumns[0])} = VALUES(${quote(conflictColumns[0])})`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO ${quote(table)} (${columns.map(quote).join(",")}) VALUES (${columns.map(() => "?").join(",")}) ON DUPLICATE KEY UPDATE ${duplicateClause}`,
        ...values,
      );
      return row;
    }
  }

  const generateShortId = row.short_id === undefined && SHORT_ID_STARTS[table];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (generateShortId) {
      const maximum = await prisma.$queryRawUnsafe(`SELECT MAX(${quote("short_id")}) AS maximum FROM ${quote(table)}`);
      row.short_id = nextShortIdValue(table, maximum[0]?.maximum);
    }
    const columns = Object.keys(row).filter((column) => allowed[column]);
    if (!columns.length) throw new Error("Insert contains no known columns");
    const values = columns.map((column) => normalizeForDatabase(row[column], allowed[column]));
    try {
      await prisma.$executeRawUnsafe(`INSERT INTO ${quote(table)} (${columns.map(quote).join(",")}) VALUES (${columns.map(() => "?").join(",")})`, ...values);
      return row;
    } catch (error) {
      if (!generateShortId || !isDuplicateKeyError(error) || attempt === 3) throw error;
    }
  }
  throw new Error(`Unable to allocate short_id for ${table}`);
}

async function handlePost(table, request, url, context) {
  const input = await request.json();
  const sourceRows = (Array.isArray(input) ? input : [input]).map((row) => stampHomepageExploreSelection(table, row));
  const rows = context.forceDraft ? sourceRows.map((row) => forceDraftPayload(table, row)) : sourceRows;
  const prefer = String(request.headers.get("prefer") || "");
  const merge = prefer.includes("resolution=merge-duplicates");
  const conflictColumns = merge
    ? resolveConflictColumns(table, url.searchParams.get("on_conflict") || "")
    : [];
  if (context.stageReview) {
    const staged = rows.map((row) => applyDefaults(table, row));
    await recordContentReviews({ table, operation: "create", actorUserId: context.actorUserId, afterRows: staged });
    return {
      status: 202,
      body: prefer.includes("return=representation") ? representationBody(request, staged) : null,
      headers: { "x-dc-review-status": "pending" },
    };
  }
  const inserted = [];
  for (const row of rows) inserted.push(await insertRow(table, row, merge, conflictColumns));
  await recordContentReviews({ table, operation: "create", actorUserId: context.actorUserId, afterRows: inserted });
  return { status: 201, body: prefer.includes("return=representation") ? representationBody(request, inserted) : null };
}

async function handlePatch(table, request, url, context) {
  const source = stampHomepageExploreSelection(table, await request.json());
  const input = context.forceDraft ? forceDraftPayload(table, source) : source;
  const allowed = schemaMetadata[table].fields;
  if (allowed.updated_at && input.updated_at === undefined) input.updated_at = new Date().toISOString();
  const columns = Object.keys(input).filter((column) => allowed[column]);
  const params = columns.map((column) => normalizeForDatabase(input[column], allowed[column]));
  const where = buildWhere(table, url, params);
  if (!where) throw new Error("Refusing unfiltered update");
  const prefer = String(request.headers.get("prefer") || "");
  const needsBefore = prefer.includes("return=representation") || Boolean(context.actorUserId);
  let before = [];
  if (needsBefore) before = await prisma.$queryRawUnsafe(`SELECT * FROM ${quote(table)}${where}`, ...params.slice(columns.length));
  const body = before.map((row) => ({ ...row, ...input }));
  if (context.stageReview) {
    await recordContentReviews({ table, operation: "update", actorUserId: context.actorUserId, beforeRows: before, afterRows: body });
    return {
      status: 202,
      body: prefer.includes("return=representation") ? representationBody(request, body) : null,
      headers: { "x-dc-review-status": "pending" },
    };
  }
  await prisma.$executeRawUnsafe(`UPDATE ${quote(table)} SET ${columns.map((column) => `${quote(column)} = ?`).join(",")}${where}`, ...params);
  await recordContentReviews({ table, operation: "update", actorUserId: context.actorUserId, beforeRows: before, afterRows: body });
  return { status: 200, body: prefer.includes("return=representation") ? representationBody(request, body) : null };
}

async function handleDelete(table, request, url) {
  const params = [];
  const where = buildWhere(table, url, params);
  if (!where) throw new Error("Refusing unfiltered delete");
  const prefer = String(request.headers.get("prefer") || "");
  const rows = prefer.includes("return=representation") ? await prisma.$queryRawUnsafe(`SELECT * FROM ${quote(table)}${where}`, ...params) : [];
  await prisma.$executeRawUnsafe(`DELETE FROM ${quote(table)}${where}`, ...params);
  return { status: 200, body: prefer.includes("return=representation") ? representationBody(request, rows) : null };
}

export async function handleRest(table, request, context = {}) {
  if (!tableNames.has(table)) return { status: 404, body: { code: "PGRST205", message: `Table ${table} is unavailable` } };
  const url = new URL(request.url);
  if (["GET", "HEAD"].includes(request.method)) return handleGet(table, request, url);
  if (schemaMetadata[table].ignored) return { status: 405, body: { code: "25006", message: `Resource ${table} is read-only` } };
  let result;
  if (request.method === "POST") result = await handlePost(table, request, url, context);
  else if (request.method === "PATCH") result = await handlePatch(table, request, url, context);
  else if (request.method === "DELETE") result = await handleDelete(table, request, url);
  if (result) {
    if (["colleges", "courses", "exams", "career_profiles"].includes(table) && result.status < 400) invalidateDirectorySearchCache();
    return result;
  }
  return { status: 405, body: { message: "Method not allowed" } };
}

export async function handleRpc(name, request) {
  const body = request.method === "GET" ? Object.fromEntries(new URL(request.url).searchParams) : await request.json().catch(() => ({}));
  if (name === "has_role") {
    const rows = await prisma.$queryRawUnsafe("SELECT 1 FROM `user_roles` WHERE `user_id` = ? AND `role` = ? LIMIT 1", body._user_id, body._role);
    return { status: 200, body: rows.length > 0 };
  }
  if (name === "clear_featured_rank" || name === "set_featured_rank") {
    if (!tableNames.has(body._table) || !schemaMetadata[body._table].fields.featured_rank) throw new Error("Invalid featured table");
    await prisma.$executeRawUnsafe(`UPDATE ${quote(body._table)} SET \`featured_rank\` = ? WHERE \`id\` = ?`, name === "clear_featured_rank" ? null : body._rank, body._id);
    return { status: 200, body: null };
  }
  if (name === "set_ai_emergency_stop") {
    const stopped = body._stopped ?? body._enabled ?? false;
    await prisma.$executeRawUnsafe("UPDATE `ai_runtime_controls` SET `is_enabled` = ?, `stop_reason` = ?, `updated_at` = CURRENT_TIMESTAMP(3)", stopped ? 0 : 1, body._reason || null);
    return { status: 200, body: null };
  }
  if (name === "intent_merge_visitor") {
    await prisma.$executeRawUnsafe("UPDATE `intent_events` SET `user_id` = ? WHERE `visitor_id` = ? AND `user_id` IS NULL", body._user_id, body._visitor_id);
    await prisma.$executeRawUnsafe("UPDATE `intent_visitors` SET `user_id` = ?, `updated_at` = CURRENT_TIMESTAMP(3) WHERE `id` = ?", body._user_id, body._visitor_id);
    return { status: 200, body: null };
  }
  if (name === "increment_url_clicks") {
    await prisma.$executeRawUnsafe("UPDATE `url_mappings` SET `clicks` = COALESCE(`clicks`, 0) + 1 WHERE `id` = ?", body.p_url_id || body.mapping_id || body._mapping_id);
    return { status: 200, body: null };
  }
  if (name === "is_user_approved") {
    const rows = await prisma.$queryRawUnsafe("SELECT 1 FROM `user_roles` WHERE `user_id` = ? LIMIT 1", body._user_id);
    return { status: 200, body: rows.length > 0 };
  }
  if (name === "search_directory_fast") {
    const query = String(body.p_query || "").trim().toLowerCase().slice(0, 120);
    const limit = Math.max(1, Math.min(Number(body.p_limit || 10), 15));
    if (query.length < 2) return { status: 200, body: [] };
    const rows = await searchDirectory(query, limit);
    return { status: 200, body: rows, headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } };
  }
  if (name === "get_data_cleaning_coverage") {
    const mappings = [
      ["colleges", "colleges"], ["courses", "courses"], ["exams", "exams"],
      ["careers", "career_profiles"], ["scholarships", "scholarships"], ["articles", "articles"],
      ["study_material", "study_subjects"], ["college_study", "college_universities"], ["cat_universe", "cat_universe_modules"],
    ];
    const rows = [];
    for (const [entityType, table] of mappings) {
      const [row] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS total_records, SUM(data_clean_attempts = 0) AS never_checked, SUM(data_clean_attempts > 0) AS checked_records, SUM(data_clean_successes > 0) AS cleaned_records, SUM(data_clean_state = 'awaiting_review') AS pending_reviews, SUM(data_clean_state = 'failed') AS failed_checks, COALESCE(MIN(data_clean_attempts), 0) + 1 AS current_pass FROM ${quote(table)}`);
      rows.push({ entity_type: entityType, ...jsonSafe(row) });
    }
    return { status: 200, body: rows };
  }
  return { status: 501, body: { code: "RPC_NOT_MIGRATED", message: `RPC ${name} has not been ported to MySQL` } };
}
