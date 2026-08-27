import { randomUUID } from "node:crypto";
import { prisma, quote, schemaMetadata } from "./db.mjs";
import { generateGeminiJson } from "./blog-ai.mjs";

const ENTITIES = {
  colleges: { table: "colleges", name: "name" },
  courses: { table: "courses", name: "name" },
  exams: { table: "exams", name: "name" },
  careers: { table: "career_profiles", name: "name" },
  scholarships: { table: "scholarships", name: "title" },
  articles: { table: "articles", name: "title" },
  study_material: { table: "study_subjects", name: "name" },
  college_study: { table: "college_universities", name: "name" },
  cat_universe: { table: "cat_universe_modules", name: "title" },
};

const SYSTEM_FIELDS = new Set(["id", "created_at", "updated_at", "data_clean_attempts", "data_clean_successes", "data_last_checked_at", "data_clean_state", "data_verified_at", "data_quality_score", "data_source_urls"]);
const terminal = new Set(["completed", "cancelled", "failed"]);

function normalizeDbValue(table, field, value) {
  const meta = schemaMetadata[table]?.fields[field];
  if (!meta) return undefined;
  if (value === null) return null;
  if (meta.type === "Json") return JSON.stringify(value);
  if (meta.type === "Boolean") return value ? 1 : 0;
  if (meta.type === "DateTime") return new Date(value);
  return value;
}

async function applyProposedData(table, entityId, proposed, sourceUrls) {
  const fields = Object.keys(proposed).filter((field) => !SYSTEM_FIELDS.has(field) && schemaMetadata[table]?.fields[field]);
  if (fields.length) {
    const values = fields.map((field) => normalizeDbValue(table, field, proposed[field]));
    await prisma.$executeRawUnsafe(`UPDATE ${quote(table)} SET ${fields.map((field) => `${quote(field)} = ?`).join(",")}, \`data_clean_successes\` = COALESCE(\`data_clean_successes\`,0) + 1, \`data_clean_state\` = 'cleaned', \`data_verified_at\` = ?, \`data_source_urls\` = ?, \`updated_at\` = ? WHERE \`id\` = ?`, ...values, new Date(), JSON.stringify(sourceUrls), new Date(), entityId);
  }
}

async function processItem(job, entityType, row) {
  const config = ENTITIES[entityType];
  const itemId = randomUUID();
  const before = { ...row };
  await prisma.data_cleaning_items.create({ data: { id: itemId, job_id: job.id, entity_type: entityType, entity_id: String(row.id), entity_slug: row.slug || null, entity_name: String(row[config.name] || row.slug || row.id), status: "processing", attempt: Number(row.data_clean_attempts || 0) + 1, source_urls: [], before_data: before, proposed_data: {}, changed_fields: [], warnings: [], started_at: new Date(), cleaning_pass: Number(row.data_clean_attempts || 0) + 1, previous_attempts: Number(row.data_clean_attempts || 0) } });
  try {
    const editableFields = Object.entries(schemaMetadata[config.table].fields).filter(([name]) => !SYSTEM_FIELDS.has(name)).map(([name, meta]) => `${name}:${meta.type}${meta.nullable ? "?" : ""}`);
    const { result } = await generateGeminiJson(`Audit this ${entityType} record against its official website and authoritative regulator/government sources. Current record: ${JSON.stringify(before)}. Allowed fields: ${editableFields.join(", ")}. Return {proposed_data:{only confidently corrected fields},source_urls:[official URLs actually used],confidence:0..1,warnings:[...]}. Never use an aggregator as evidence. Never invent a value. Preserve existing values unless an official source proves a correction.`, "data-cleaner", { research: true });
    const proposed = result.proposed_data && typeof result.proposed_data === "object" ? result.proposed_data : {};
    const sourceUrls = Array.isArray(result.source_urls) ? result.source_urls.filter((url) => /^https?:\/\//i.test(String(url))).slice(0, 20) : [];
    const changed = Object.keys(proposed).filter((field) => schemaMetadata[config.table]?.fields[field] && JSON.stringify(before[field]) !== JSON.stringify(proposed[field]));
    const confidence = Math.max(0, Math.min(1, Number(result.confidence || 0)));
    const safe = changed.length > 0 && sourceUrls.length > 0 && confidence >= 0.75;
    const autoApply = job.apply_mode === "auto" && safe;
    const status = !safe ? "skipped" : autoApply ? "updated" : "review";
    if (autoApply) await applyProposedData(config.table, row.id, proposed, sourceUrls);
    await prisma.data_cleaning_items.update({ where: { id: itemId }, data: { status, official_url: sourceUrls[0] || null, source_urls: sourceUrls, confidence, proposed_data: proposed, changed_fields: changed, warnings: Array.isArray(result.warnings) ? result.warnings : [], error_message: !safe ? "No sufficiently supported official-source change was found" : null, completed_at: new Date(), updated_at: new Date() } });
    await prisma.$executeRawUnsafe(`UPDATE ${quote(config.table)} SET \`data_clean_attempts\` = COALESCE(\`data_clean_attempts\`,0) + 1, \`data_last_checked_at\` = ?, \`data_clean_state\` = ? WHERE \`id\` = ?`, new Date(), status === "review" ? "awaiting_review" : status === "updated" ? "cleaned" : "checked", row.id);
    return status;
  } catch (error) {
    await prisma.data_cleaning_items.update({ where: { id: itemId }, data: { status: "failed", error_message: String(error?.message || error).slice(0, 2000), completed_at: new Date(), updated_at: new Date() } });
    return "failed";
  }
}

let processing = false;
async function processNextJob() {
  if (processing) return;
  const job = await prisma.data_cleaning_jobs.findFirst({ where: { status: { in: ["queued", "running"] } }, orderBy: { created_at: "asc" } });
  if (!job) return;
  processing = true;
  try {
    await prisma.data_cleaning_jobs.update({ where: { id: job.id }, data: { status: "running", started_at: job.started_at || new Date(), message: "Researching official sources", updated_at: new Date() } });
    const types = Array.isArray(job.entity_types) ? job.entity_types : [];
    let processed = Number(job.processed_items || 0);
    const counters = { updated: Number(job.updated_items || 0), review: Number(job.review_items || 0), skipped: Number(job.skipped_items || 0), failed: Number(job.failed_items || 0) };
    const maximum = Math.min(500, Math.max(1, Number(job.max_records || job.batch_size || 50)));
    for (const entityType of types) {
      const current = await prisma.data_cleaning_jobs.findUnique({ where: { id: job.id }, select: { status: true } });
      if (!current || current.status === "paused" || current.status === "cancelled") return;
      const config = ENTITIES[entityType];
      if (!config || processed >= maximum) continue;
      const remaining = maximum - processed;
      const rows = await prisma.$queryRawUnsafe(`SELECT t.* FROM ${quote(config.table)} t LEFT JOIN \`data_cleaning_exclusions\` e ON e.\`entity_type\` = ? AND e.\`entity_id\` = t.\`id\` WHERE e.\`id\` IS NULL AND COALESCE(t.\`data_clean_state\`,'') <> 'awaiting_review' AND COALESCE(t.\`data_clean_attempts\`,0) = (SELECT MIN(COALESCE(candidate.\`data_clean_attempts\`,0)) FROM ${quote(config.table)} candidate WHERE COALESCE(candidate.\`data_clean_state\`,'') <> 'awaiting_review') ORDER BY t.\`updated_at\` ASC LIMIT ${remaining}`, entityType);
      for (const row of rows) {
        const state = await prisma.data_cleaning_jobs.findUnique({ where: { id: job.id }, select: { status: true } });
        if (!state || state.status === "paused" || state.status === "cancelled") return;
        await prisma.data_cleaning_jobs.update({ where: { id: job.id }, data: { current_entity: entityType, current_name: String(row[config.name] || ""), updated_at: new Date() } });
        const result = await processItem(job, entityType, row);
        processed += 1;
        counters[result] += 1;
        await prisma.data_cleaning_jobs.update({ where: { id: job.id }, data: { processed_items: processed, updated_items: counters.updated, review_items: counters.review, skipped_items: counters.skipped, failed_items: counters.failed, updated_at: new Date() } });
        if (processed >= maximum) break;
      }
    }
    await prisma.data_cleaning_jobs.update({ where: { id: job.id }, data: { status: "completed", message: `Checked ${processed} record(s)`, completed_at: new Date(), current_entity: null, current_name: null, updated_at: new Date() } });
  } catch (error) {
    await prisma.data_cleaning_jobs.update({ where: { id: job.id }, data: { status: "failed", message: String(error?.message || error).slice(0, 2000), completed_at: new Date(), updated_at: new Date() } }).catch(() => {});
  } finally {
    processing = false;
  }
}

async function reviewItem(itemId, approved) {
  const item = await prisma.data_cleaning_items.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Cleaning item not found");
  if (approved) {
    const config = ENTITIES[item.entity_type];
    await applyProposedData(config.table, item.entity_id, item.proposed_data || {}, item.source_urls || []);
    await prisma.data_cleaning_items.update({ where: { id: itemId }, data: { status: "updated", updated_at: new Date() } });
  } else {
    await prisma.data_cleaning_items.update({ where: { id: itemId }, data: { status: "skipped", error_message: "Rejected by administrator", updated_at: new Date() } });
  }
}

export async function handleDataCleaner(request, userId) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  if (action === "start") {
    const types = (Array.isArray(body.entity_types) ? body.entity_types : []).filter((type) => ENTITIES[type]);
    if (!types.length) throw new Error("Select at least one entity type");
    const maximum = Math.min(500, Math.max(1, Number(body.max_records || body.batch_size || 50)));
    const id = randomUUID();
    await prisma.data_cleaning_jobs.create({ data: { id, entity_types: types, status: "queued", apply_mode: body.apply_mode === "auto" ? "auto" : "review", batch_size: Math.min(100, Math.max(1, Number(body.batch_size || 50))), max_records: maximum, total_items: maximum, processed_items: 0, updated_items: 0, review_items: 0, skipped_items: 0, failed_items: 0, message: "Queued for durable processing", created_by: userId, cleaning_pass: 1 } });
    setTimeout(() => void processNextJob(), 0);
    return { success: true, job_id: id };
  }
  if (["pause", "resume", "cancel"].includes(action)) {
    const status = action === "resume" ? "queued" : action === "pause" ? "paused" : "cancelled";
    await prisma.data_cleaning_jobs.update({ where: { id: String(body.job_id) }, data: { status, message: action === "resume" ? "Queued to resume" : `${action}d by administrator`, updated_at: new Date(), ...(action === "cancel" ? { completed_at: new Date() } : {}) } });
    if (action === "resume") setTimeout(() => void processNextJob(), 0);
    return { success: true };
  }
  if (["approve", "reject"].includes(action)) { await reviewItem(String(body.item_id), action === "approve"); return { success: true }; }
  if (action === "approve_all") {
    const items = await prisma.data_cleaning_items.findMany({ where: { job_id: String(body.job_id), status: "review" }, select: { id: true } });
    for (const item of items) await reviewItem(item.id, true);
    return { success: true, approved: items.length };
  }
  throw new Error("Unsupported Clean Data action");
}

let timer;
export function startDataCleanerWorker() {
  timer = setInterval(() => void processNextJob(), 10_000);
  timer.unref?.();
  setTimeout(() => void processNextJob(), 5_000).unref?.();
}

export function stopDataCleanerWorker() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
