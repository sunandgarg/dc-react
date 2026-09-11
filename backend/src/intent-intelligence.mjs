import { randomUUID } from "node:crypto";
import { prisma, jsonSafe } from "./db.mjs";
import { generateGeminiJson } from "./blog-ai.mjs";

const SITE_SCOPES = new Set(["dekhocampus", "sarkari"]);
const SUBJECT_TYPES = new Set(["user", "visitor"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMPORTANT_EVENTS = new Set([
  "download_brochure", "apply_now", "call_institute", "whatsapp_institute",
  "compare_colleges", "counselling_request",
]);

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

export function normalizeIntentSiteScope(value) {
  const normalized = value === undefined || value === null || value === ""
    ? "dekhocampus"
    : String(value).trim().toLowerCase();
  if (!SITE_SCOPES.has(normalized)) {
    throw httpError(400, "INVALID_SITE_SCOPE", "site_scope must be dekhocampus or sarkari");
  }
  return normalized;
}

export function intentCategory(score) {
  const value = Number(score || 0);
  if (value <= 30) return "cold";
  if (value <= 70) return "warm";
  if (value <= 120) return "hot";
  return "admission_ready";
}

function objectValue(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function jsonScopePredicate(alias, column) {
  return `COALESCE(JSON_UNQUOTE(JSON_EXTRACT(${alias}.\`${column}\`, '$.site_scope')), 'dekhocampus') = ?`;
}

function topCounts(events, field) {
  const counts = new Map();
  for (const event of events) {
    const value = event?.[field];
    if (value) counts.set(String(value), (counts.get(String(value)) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const total = sorted.reduce((sum, [, count]) => sum + count, 0) || 1;
  return sorted.slice(0, 3).map(([value, count]) => ({ value, confidence: Math.round((count / total) * 100) }));
}

export function buildIntentHeuristic(score, events = []) {
  const scholarshipHits = events.filter((event) => event.event_type === "scholarship_viewed").length;
  const feeHits = events.filter((event) => event.event_type === "fee_viewed").length;
  const total = events.length;
  return {
    top_colleges: topCounts(events, "college_slug"),
    top_courses: topCounts(events, "course_slug"),
    location_preference: topCounts(events, "city"),
    admission_probability: Math.max(0, Math.min(95, Math.round((Number(score || 0) / 150) * 100))),
    scholarship_sensitivity: total ? Math.round((scholarshipHits / total) * 100) : 0,
    fee_sensitivity: total ? Math.round((feeHits / total) * 100) : 0,
    sample_size: total,
  };
}

function scoreSubject(event) {
  const userId = String(event?.user_id || "").trim();
  const visitorId = String(event?.visitor_id || "").trim();
  if (UUID_RE.test(userId)) return { subjectType: "user", subjectId: userId };
  if (UUID_RE.test(visitorId)) return { subjectType: "visitor", subjectId: visitorId };
  return null;
}

export async function prepareIntentEvents(rows, rawSiteScope, database = prisma) {
  const siteScope = normalizeIntentSiteScope(rawSiteScope);
  const eventTypes = [...new Set(rows.map((row) => String(row?.event_type || "").slice(0, 191)).filter(Boolean))];
  const weights = new Map();
  if (eventTypes.length) {
    const placeholders = eventTypes.map(() => "?").join(",");
    const weightRows = await database.$queryRawUnsafe(
      `SELECT \`event_type\`, \`weight\` FROM \`intent_event_weights\` WHERE \`is_active\` = 1 AND \`event_type\` IN (${placeholders})`,
      ...eventTypes,
    );
    for (const row of weightRows) weights.set(String(row.event_type), Number(row.weight || 0));
  }
  return rows.map((row) => ({
    ...row,
    metadata: { ...objectValue(row.metadata), site_scope: siteScope },
    score_delta: weights.get(String(row.event_type || "")) || 0,
  }));
}

export function stampTrackingSiteScope(rows, rawSiteScope) {
  const siteScope = normalizeIntentSiteScope(rawSiteScope);
  return rows.map((row) => ({
    ...row,
    metadata: { ...objectValue(row.metadata), site_scope: siteScope },
  }));
}

async function topSubjectValue(database, subjectType, subjectId, siteScope, column) {
  const idColumn = subjectType === "user" ? "user_id" : "visitor_id";
  const rows = await database.$queryRawUnsafe(
    `SELECT e.\`${column}\` AS value, COUNT(*) AS frequency
       FROM \`intent_events\` e
      WHERE e.\`${idColumn}\` = ?
        AND ${jsonScopePredicate("e", "metadata")}
        AND e.\`${column}\` IS NOT NULL
        AND e.\`occurred_at\` > DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 30 DAY)
      GROUP BY e.\`${column}\`
      ORDER BY frequency DESC, value ASC
      LIMIT 1`,
    subjectId,
    siteScope,
  );
  return rows[0]?.value ? String(rows[0].value) : null;
}

async function scopedLeadId(database, candidateId, siteScope) {
  if (!UUID_RE.test(String(candidateId || ""))) return null;
  const rows = await database.$queryRawUnsafe(
    "SELECT `id` FROM `leads` WHERE `id` = ? AND `site_scope` = ? LIMIT 1",
    String(candidateId),
    siteScope,
  );
  return rows[0]?.id || null;
}

async function findLeadForSubject(database, subjectType, subjectId, siteScope, events) {
  for (const event of events) {
    const leadId = await scopedLeadId(database, objectValue(event.metadata).lead_id, siteScope);
    if (leadId) return leadId;
  }

  const sessionIds = [...new Set(events.map((event) => String(event.session_id || "").trim()).filter(Boolean))].slice(0, 20);
  if (sessionIds.length) {
    const placeholders = sessionIds.map(() => "?").join(",");
    const rows = await database.$queryRawUnsafe(
      `SELECT us.\`lead_id\`
         FROM \`user_sessions\` us
         INNER JOIN \`leads\` l ON l.\`id\` = us.\`lead_id\` AND l.\`site_scope\` = ?
        WHERE us.\`session_id\` IN (${placeholders})
        ORDER BY us.\`last_seen_at\` DESC
        LIMIT 1`,
      siteScope,
      ...sessionIds,
    );
    if (rows[0]?.lead_id) return rows[0].lead_id;
  }

  if (subjectType === "user") {
    const rows = await database.$queryRawUnsafe(
      `SELECT l.\`id\`
         FROM \`profiles\` p
         INNER JOIN \`leads\` l
           ON l.\`site_scope\` = ?
          AND ((p.\`phone\` IS NOT NULL AND p.\`phone\` <> '' AND l.\`phone\` = p.\`phone\`)
            OR (p.\`email\` IS NOT NULL AND p.\`email\` <> '' AND LOWER(l.\`email\`) = LOWER(p.\`email\`)))
        WHERE p.\`user_id\` = ?
        ORDER BY l.\`created_at\` DESC
        LIMIT 1`,
      siteScope,
      subjectId,
    );
    if (rows[0]?.id) return rows[0].id;
  }
  return null;
}

async function refreshIntentScore(database, subjectType, subjectId, siteScope, events = [], recompute = false) {
  if (!SUBJECT_TYPES.has(subjectType) || !UUID_RE.test(subjectId)) return false;
  const signals = { site_scope: siteScope, scoring_engine: "node-mysql-v1" };
  await database.$executeRawUnsafe(
    `INSERT INTO \`intent_lead_scores\`
      (\`id\`, \`subject_type\`, \`subject_id\`, \`score\`, \`category\`, \`event_count\`, \`signals\`, \`created_at\`, \`updated_at\`)
     VALUES (?, ?, ?, 0, 'cold', 0, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE \`id\` = \`id\``,
    randomUUID(),
    subjectType,
    subjectId,
    JSON.stringify(signals),
  );
  const existingRows = await database.$queryRawUnsafe(
    "SELECT `score`, `category`, `lead_id`, `signals` FROM `intent_lead_scores` WHERE `subject_type` = ? AND `subject_id` = ? LIMIT 1 FOR UPDATE",
    subjectType,
    subjectId,
  );
  const existing = existingRows[0] || { score: 0, category: "cold", lead_id: null, signals: {} };
  const existingSignals = objectValue(existing.signals);
  const existingScope = SITE_SCOPES.has(String(existingSignals.site_scope || "").toLowerCase())
    ? String(existingSignals.site_scope).toLowerCase()
    : "dekhocampus";
  if (existingScope !== siteScope) return false;

  const idColumn = subjectType === "user" ? "user_id" : "visitor_id";
  const aggregateRows = await database.$queryRawUnsafe(
    `SELECT COUNT(*) AS event_count, MIN(e.\`occurred_at\`) AS first_event_at, MAX(e.\`occurred_at\`) AS last_event_at,
            COALESCE(SUM(COALESCE(w.\`weight\`, e.\`score_delta\`, 0)), 0) AS recalculated_score
       FROM \`intent_events\` e
       LEFT JOIN \`intent_event_weights\` w ON w.\`event_type\` = e.\`event_type\` AND w.\`is_active\` = 1
      WHERE e.\`${idColumn}\` = ? AND ${jsonScopePredicate("e", "metadata")}`,
    subjectId,
    siteScope,
  );
  const lastRows = await database.$queryRawUnsafe(
    `SELECT e.\`event_type\`, e.\`occurred_at\` FROM \`intent_events\` e
      WHERE e.\`${idColumn}\` = ? AND ${jsonScopePredicate("e", "metadata")}
      ORDER BY e.\`occurred_at\` DESC, e.\`id\` DESC LIMIT 1`,
    subjectId,
    siteScope,
  );
  const topCollege = await topSubjectValue(database, subjectType, subjectId, siteScope, "college_slug");
  const topCourse = await topSubjectValue(database, subjectType, subjectId, siteScope, "course_slug");
  const topExam = await topSubjectValue(database, subjectType, subjectId, siteScope, "exam_slug");
  const aggregate = aggregateRows[0] || {};
  const batchDelta = events.reduce((sum, event) => sum + Number(event.score_delta || 0), 0);
  const score = recompute ? Number(aggregate.recalculated_score || 0) : Number(existing.score || 0) + batchDelta;
  const category = intentCategory(score);
  const leadId = existing.lead_id || await findLeadForSubject(database, subjectType, subjectId, siteScope, events);
  await database.$executeRawUnsafe(
    `UPDATE \`intent_lead_scores\`
        SET \`score\` = ?, \`category\` = ?, \`top_college_slug\` = ?, \`top_course_slug\` = ?, \`top_exam_slug\` = ?,
            \`event_count\` = ?, \`last_event_type\` = ?, \`last_event_at\` = ?, \`first_event_at\` = ?,
            \`lead_id\` = COALESCE(?, \`lead_id\`), \`signals\` = ?, \`updated_at\` = CURRENT_TIMESTAMP(3)
      WHERE \`subject_type\` = ? AND \`subject_id\` = ?`,
    score,
    category,
    topCollege,
    topCourse,
    topExam,
    Number(aggregate.event_count || 0),
    lastRows[0]?.event_type || null,
    lastRows[0]?.occurred_at || null,
    aggregate.first_event_at || null,
    leadId,
    JSON.stringify({ ...existingSignals, ...signals }),
    subjectType,
    subjectId,
  );

  const latestImportant = events.find((event) => IMPORTANT_EVENTS.has(String(event.event_type || "")));
  const crossedThreshold = existing.category !== category && ["hot", "admission_ready"].includes(category);
  if (crossedThreshold || latestImportant) {
    const alertType = crossedThreshold ? "threshold_crossed" : String(latestImportant.event_type);
    await database.$executeRawUnsafe(
      `INSERT INTO \`intent_alerts\`
        (\`id\`, \`subject_type\`, \`subject_id\`, \`alert_type\`, \`score\`, \`college_slug\`, \`course_slug\`, \`payload\`, \`delivered\`, \`delivery_attempts\`, \`created_at\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP(3))`,
      randomUUID(), subjectType, subjectId, alertType, score,
      latestImportant?.college_slug || topCollege,
      latestImportant?.course_slug || topCourse,
      JSON.stringify({ site_scope: siteScope, lead_id: leadId, event_type: latestImportant?.event_type || null }),
    );
  }
  return true;
}

export async function updateIntentScoresForEvents(rows, rawSiteScope, database = prisma) {
  const siteScope = normalizeIntentSiteScope(rawSiteScope);
  const groups = new Map();
  for (const event of rows) {
    const subject = scoreSubject(event);
    if (!subject) continue;
    const key = `${subject.subjectType}:${subject.subjectId}`;
    const group = groups.get(key) || { ...subject, events: [] };
    group.events.push(event);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (typeof database.$transaction === "function") {
      await database.$transaction((tx) => refreshIntentScore(tx, group.subjectType, group.subjectId, siteScope, group.events));
    } else {
      await refreshIntentScore(database, group.subjectType, group.subjectId, siteScope, group.events);
    }
  }
}

export async function linkIntentActivityToLead({ leadId, visitorId, sessionId, siteScope: rawSiteScope }, database = prisma) {
  const siteScope = normalizeIntentSiteScope(rawSiteScope);
  const leadRows = await database.$queryRawUnsafe(
    "SELECT `id`, `name`, `email`, `phone` FROM `leads` WHERE `id` = ? AND `site_scope` = ? LIMIT 1",
    leadId,
    siteScope,
  );
  const lead = leadRows[0];
  if (!lead) throw httpError(404, "LEAD_NOT_FOUND", "The saved lead does not belong to this workspace");

  const subjects = [];
  if (UUID_RE.test(String(visitorId || ""))) subjects.push({ subjectType: "visitor", subjectId: String(visitorId) });
  const safeSessionId = String(sessionId || "").trim().slice(0, 250);
  if (safeSessionId) {
    const existingSessions = await database.$queryRawUnsafe(
      `SELECT us.\`lead_id\`, l.\`site_scope\`
         FROM \`user_sessions\` us
         LEFT JOIN \`leads\` l ON l.\`id\` = us.\`lead_id\`
        WHERE us.\`session_id\` = ? LIMIT 1`,
      safeSessionId,
    );
    if (existingSessions[0]?.lead_id && existingSessions[0]?.site_scope !== siteScope) {
      throw httpError(409, "SESSION_SCOPE_CONFLICT", "This browser session is already linked to another workspace");
    }
    const observedScopes = await database.$queryRawUnsafe(
      `SELECT DISTINCT observed.\`site_scope\` FROM (
         SELECT COALESCE(JSON_UNQUOTE(JSON_EXTRACT(ue.\`metadata\`, '$.site_scope')), 'dekhocampus') AS site_scope
           FROM \`user_events\` ue WHERE ue.\`session_id\` = ?
         UNION
         SELECT COALESCE(JSON_UNQUOTE(JSON_EXTRACT(ie.\`metadata\`, '$.site_scope')), 'dekhocampus') AS site_scope
           FROM \`intent_events\` ie WHERE ie.\`session_id\` = ?
       ) observed`,
      safeSessionId,
      safeSessionId,
    );
    if (observedScopes.some((row) => row.site_scope !== siteScope)) {
      throw httpError(409, "SESSION_SCOPE_CONFLICT", "This browser session contains activity from another workspace");
    }
    const eventSubjects = await database.$queryRawUnsafe(
      `SELECT DISTINCT e.\`user_id\`, e.\`visitor_id\`
         FROM \`intent_events\` e
        WHERE e.\`session_id\` = ? AND ${jsonScopePredicate("e", "metadata")}`,
      safeSessionId,
      siteScope,
    );
    for (const row of eventSubjects) {
      if (UUID_RE.test(String(row.user_id || ""))) subjects.push({ subjectType: "user", subjectId: String(row.user_id) });
      else if (UUID_RE.test(String(row.visitor_id || ""))) subjects.push({ subjectType: "visitor", subjectId: String(row.visitor_id) });
    }
    const sessionProven = observedScopes.some((row) => row.site_scope === siteScope)
      || existingSessions[0]?.site_scope === siteScope;
    if (sessionProven) {
      await database.$executeRawUnsafe(
        `UPDATE \`user_sessions\`
            SET \`lead_id\` = ?, \`lead_name\` = COALESCE(\`lead_name\`, ?), \`lead_email\` = COALESCE(\`lead_email\`, ?),
                \`lead_phone\` = COALESCE(\`lead_phone\`, ?), \`conversion\` = 1
          WHERE \`session_id\` = ?`,
        lead.id, lead.name || null, lead.email || null, lead.phone || null, safeSessionId,
      );
    }
  }

  const uniqueSubjects = new Map(subjects.map((subject) => [`${subject.subjectType}:${subject.subjectId}`, subject]));
  for (const subject of uniqueSubjects.values()) {
    await database.$executeRawUnsafe(
      `UPDATE \`intent_lead_scores\` s
       LEFT JOIN \`leads\` current_lead ON current_lead.\`id\` = s.\`lead_id\`
          SET s.\`lead_id\` = ?, s.\`updated_at\` = CURRENT_TIMESTAMP(3)
        WHERE s.\`subject_type\` = ? AND s.\`subject_id\` = ?
          AND ${jsonScopePredicate("s", "signals")}
          AND (current_lead.\`id\` IS NULL OR current_lead.\`site_scope\` = ?)`,
      lead.id,
      subject.subjectType,
      subject.subjectId,
      siteScope,
      siteScope,
    );
  }
}

export async function mergeIntentVisitor(visitorId, userId, rawSiteScope, database = prisma) {
  const siteScope = normalizeIntentSiteScope(rawSiteScope);
  if (!UUID_RE.test(String(visitorId || "")) || !UUID_RE.test(String(userId || ""))) {
    throw httpError(400, "INVALID_INTENT_IDENTITY", "A valid visitor and user ID are required");
  }
  await database.$executeRawUnsafe(
    `UPDATE \`intent_events\` e SET e.\`user_id\` = ?
      WHERE e.\`visitor_id\` = ? AND e.\`user_id\` IS NULL AND ${jsonScopePredicate("e", "metadata")}`,
    userId,
    visitorId,
    siteScope,
  );
  await database.$executeRawUnsafe(
    "UPDATE `intent_visitors` SET `merged_user_id` = ?, `updated_at` = CURRENT_TIMESTAMP(3) WHERE `visitor_id` = ?",
    userId,
    visitorId,
  );
  let merged;
  if (typeof database.$transaction === "function") {
    merged = await database.$transaction((tx) => refreshIntentScore(tx, "user", userId, siteScope, [], true));
  } else {
    merged = await refreshIntentScore(database, "user", userId, siteScope, [], true);
  }
  if (merged) {
    await database.$executeRawUnsafe(
      `DELETE FROM \`intent_lead_scores\` WHERE \`subject_type\` = 'visitor' AND \`subject_id\` = ? AND ${jsonScopePredicate("intent_lead_scores", "signals")}`,
      visitorId,
      siteScope,
    );
  }
}

async function readBody(request) {
  if (request.method === "GET") return Object.fromEntries(new URL(request.url).searchParams);
  return request.json().catch(() => {
    throw httpError(400, "INVALID_JSON", "A valid JSON request body is required");
  });
}

export async function handlePredictLeadIntent(request, database = prisma) {
  const body = await readBody(request);
  const scoreId = String(body.lead_score_id || "").trim();
  const siteScope = normalizeIntentSiteScope(body.site_scope);
  if (!UUID_RE.test(scoreId)) throw httpError(400, "LEAD_SCORE_ID_REQUIRED", "A valid lead_score_id is required");
  const scores = await database.$queryRawUnsafe(
    `SELECT s.*
       FROM \`intent_lead_scores\` s
       INNER JOIN \`leads\` l ON l.\`id\` = s.\`lead_id\` AND l.\`site_scope\` = ?
      WHERE s.\`id\` = ? AND ${jsonScopePredicate("s", "signals")}
      LIMIT 1`,
    siteScope,
    scoreId,
    siteScope,
  );
  const score = scores[0];
  if (!score) throw httpError(404, "INTENT_SCORE_NOT_FOUND", "No intent score is linked to a lead in this workspace");
  const idColumn = score.subject_type === "user" ? "user_id" : "visitor_id";
  const events = await database.$queryRawUnsafe(
    `SELECT e.* FROM \`intent_events\` e
      WHERE e.\`${idColumn}\` = ? AND ${jsonScopePredicate("e", "metadata")}
      ORDER BY e.\`occurred_at\` DESC, e.\`id\` DESC LIMIT 500`,
    score.subject_id,
    siteScope,
  );
  const safeEvents = jsonSafe(events);
  const heuristic = buildIntentHeuristic(score.score, safeEvents);
  const timeline = safeEvents.slice(0, 200).map((event) => ({
    occurred_at: event.occurred_at,
    event_type: event.event_type,
    college_slug: event.college_slug,
    course_slug: event.course_slug,
    page_url: event.page_url,
    city: event.city,
    state: event.state,
  }));
  if (String(body.mode || "heuristic").toLowerCase() !== "ai") return { mode: "heuristic", ...heuristic, timeline };

  try {
    const generated = await generateGeminiJson(
      `Analyze this behavioral timeline for an Indian education or government-job information portal. Do not invent facts.
Return an object with exactly these fields: most_interested_course (string or null), most_interested_college (string or null), admission_probability_percent (integer 0-100), scholarship_sensitivity (integer 0-100), location_preference (string or null), reasoning (one or two short sentences).
Score: ${Number(score.score || 0)} (${score.category}). Heuristic: ${JSON.stringify(heuristic)}. Recent events: ${JSON.stringify(timeline.slice(0, 60))}`,
      "lead-intelligence",
      {
        siteScope,
        maxOutputTokens: 1_200,
        responseSchema: {
          type: "OBJECT",
          properties: {
            most_interested_course: { type: "STRING", nullable: true },
            most_interested_college: { type: "STRING", nullable: true },
            admission_probability_percent: { type: "INTEGER" },
            scholarship_sensitivity: { type: "INTEGER" },
            location_preference: { type: "STRING", nullable: true },
            reasoning: { type: "STRING" },
          },
          required: ["most_interested_course", "most_interested_college", "admission_probability_percent", "scholarship_sensitivity", "location_preference", "reasoning"],
        },
      },
    );
    return { mode: "ai", heuristic, ai: generated.result, model_used: generated.model, timeline };
  } catch (error) {
    console.error("predict-lead-intent AI analysis failed", error);
    return { mode: "heuristic", ...heuristic, timeline, ai_error: String(error?.message || "AI analysis failed") };
  }
}

function boundedNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, number));
}

function validDate(value, endOfDay = false) {
  if (!value) return null;
  const raw = String(value).trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`)
    : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (character) => `\\${character}`);
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  const text = /^[\s\p{Cc}]*[=+\-@]/u.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const EXPORT_COLUMNS = [
  "student_name", "mobile", "email", "city", "state", "course_interest", "interested_colleges",
  "lead_score", "lead_category", "last_activity", "last_activity_at", "timeline", "source_channel", "registered_at",
];

export async function handleIntentExport(request, requestedBy, database = prisma) {
  const body = await readBody(request);
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const filters = { ...query, ...body };
  const siteScope = normalizeIntentSiteScope(filters.site_scope);
  const format = String(filters.format || "csv").toLowerCase() === "json" ? "json" : "csv";
  const where = [jsonScopePredicate("s", "signals")];
  const params = [siteScope];
  const category = String(filters.category || "").trim().toLowerCase();
  if (["cold", "warm", "hot", "admission_ready"].includes(category)) {
    where.push("s.`category` = ?"); params.push(category);
  }
  const college = String(filters.top_college_slug || filters.college || "").trim();
  const course = String(filters.top_course_slug || filters.course || "").trim();
  if (college) { where.push("s.`top_college_slug` = ?"); params.push(college); }
  if (course) { where.push("s.`top_course_slug` = ?"); params.push(course); }
  const minScore = filters.min_score ?? filters.min;
  const maxScore = filters.max_score ?? filters.max;
  if (minScore !== undefined && minScore !== "") { where.push("s.`score` >= ?"); params.push(boundedNumber(minScore, 0, -100_000, 100_000)); }
  if (maxScore !== undefined && maxScore !== "") { where.push("s.`score` <= ?"); params.push(boundedNumber(maxScore, 100_000, -100_000, 100_000)); }
  const from = validDate(filters.from);
  const to = validDate(filters.to, true);
  if (from) { where.push("s.`updated_at` >= ?"); params.push(from); }
  if (to) { where.push("s.`updated_at` <= ?"); params.push(to); }
  if (filters.city) { where.push("l.`city` LIKE ? ESCAPE '\\\\'"); params.push(`%${escapeLike(filters.city)}%`); }
  if (filters.state) { where.push("l.`state` LIKE ? ESCAPE '\\\\'"); params.push(`%${escapeLike(filters.state)}%`); }
  if (filters.q) {
    const term = `%${escapeLike(String(filters.q).trim())}%`;
    where.push("(l.`name` LIKE ? ESCAPE '\\\\' OR l.`email` LIKE ? ESCAPE '\\\\' OR l.`phone` LIKE ? ESCAPE '\\\\' OR l.`city` LIKE ? ESCAPE '\\\\' OR l.`state` LIKE ? ESCAPE '\\\\' OR s.`top_college_slug` LIKE ? ESCAPE '\\\\' OR s.`top_course_slug` LIKE ? ESCAPE '\\\\')");
    params.push(term, term, term, term, term, term, term);
  }
  const scores = await database.$queryRawUnsafe(
    `SELECT s.*, l.\`name\` AS lead_name, l.\`email\` AS lead_email, l.\`phone\` AS lead_phone,
            l.\`city\` AS lead_city, l.\`state\` AS lead_state, l.\`interested_college_slug\`,
            l.\`interested_course_slug\`, l.\`source\` AS lead_source, l.\`created_at\` AS lead_created_at
       FROM \`intent_lead_scores\` s
       INNER JOIN \`leads\` l ON l.\`id\` = s.\`lead_id\` AND l.\`site_scope\` = ?
      WHERE ${where.join(" AND ")}
      ORDER BY s.\`score\` DESC, s.\`updated_at\` DESC
      LIMIT 5000`,
    siteScope,
    ...params,
  );

  const timelineBySubject = new Map();
  for (let offset = 0; offset < scores.length; offset += 500) {
    const chunk = scores.slice(offset, offset + 500);
    const userIds = chunk.filter((score) => score.subject_type === "user").map((score) => score.subject_id);
    const visitorIds = chunk.filter((score) => score.subject_type === "visitor").map((score) => score.subject_id);
    const clauses = [];
    const eventParams = [siteScope];
    if (userIds.length) { clauses.push(`e.\`user_id\` IN (${userIds.map(() => "?").join(",")})`); eventParams.push(...userIds); }
    if (visitorIds.length) { clauses.push(`e.\`visitor_id\` IN (${visitorIds.map(() => "?").join(",")})`); eventParams.push(...visitorIds); }
    if (!clauses.length) continue;
    const eventRows = await database.$queryRawUnsafe(
      `SELECT e.\`occurred_at\`, e.\`event_type\`, e.\`college_slug\`, e.\`course_slug\`, e.\`page_url\`, e.\`user_id\`, e.\`visitor_id\`
         FROM \`intent_events\` e
        WHERE ${jsonScopePredicate("e", "metadata")} AND (${clauses.join(" OR ")})
        ORDER BY e.\`occurred_at\` DESC LIMIT 5000`,
      ...eventParams,
    );
    for (const event of eventRows) {
      const subjectId = event.user_id || event.visitor_id;
      if (!subjectId) continue;
      const timeline = timelineBySubject.get(subjectId) || [];
      if (timeline.length < 10) timeline.push(event);
      timelineBySubject.set(subjectId, timeline);
    }
  }

  const rows = scores.map((score) => ({
    student_name: score.lead_name || "",
    mobile: score.lead_phone || "",
    email: score.lead_email || "",
    city: score.lead_city || "",
    state: score.lead_state || "",
    course_interest: score.top_course_slug || score.interested_course_slug || "",
    interested_colleges: score.top_college_slug || score.interested_college_slug || "",
    lead_score: Number(score.score || 0),
    lead_category: score.category,
    last_activity: score.last_event_type,
    last_activity_at: score.last_event_at,
    timeline: (timelineBySubject.get(score.subject_id) || []).map((event) =>
      `${new Date(event.occurred_at).toISOString()} | ${event.event_type} | ${event.college_slug || ""} | ${event.course_slug || ""}`,
    ).join(" || "),
    source_channel: score.lead_source || "organic",
    registered_at: score.lead_created_at || score.created_at,
  }));
  await database.$executeRawUnsafe(
    "INSERT INTO `intent_crm_exports` (`id`, `requested_by`, `filters`, `row_count`, `format`, `created_at`) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3))",
    randomUUID(),
    requestedBy || null,
    JSON.stringify({ ...filters, site_scope: siteScope }),
    rows.length,
    format,
  );
  if (format === "json") {
    return new Response(JSON.stringify({ rows: jsonSafe(rows), site_scope: siteScope }), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "private, no-store" },
    });
  }
  const csv = [EXPORT_COLUMNS.join(","), ...rows.map((row) => EXPORT_COLUMNS.map((column) => csvEscape(row[column])).join(","))].join("\n");
  const prefix = siteScope === "sarkari" ? "sarkari-dekhocampus" : "dekhocampus";
  return new Response(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${prefix}-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}

async function requireScopedSession(database, sessionId, siteScope) {
  const sessions = await database.$queryRawUnsafe("SELECT * FROM `user_sessions` WHERE `session_id` = ? LIMIT 1", sessionId);
  const session = sessions[0];
  if (!session) throw httpError(404, "SESSION_NOT_FOUND", "Session not found");
  if (session.lead_id) {
    const lead = await scopedLeadId(database, session.lead_id, siteScope);
    if (!lead) throw httpError(404, "SESSION_NOT_FOUND", "Session is not linked to this workspace");
    return session;
  }
  const identityFilters = [];
  const params = [];
  if (session.lead_phone) { identityFilters.push("`phone` = ?"); params.push(session.lead_phone); }
  if (session.lead_email) { identityFilters.push("LOWER(`email`) = LOWER(?)"); params.push(session.lead_email); }
  if (identityFilters.length) {
    const matches = await database.$queryRawUnsafe(
      `SELECT \`site_scope\` FROM \`leads\` WHERE (${identityFilters.join(" OR ")}) ORDER BY \`created_at\` DESC LIMIT 10`,
      ...params,
    );
    if (matches.some((lead) => lead.site_scope === siteScope)) return session;
    if (matches.length || siteScope === "sarkari") throw httpError(404, "SESSION_NOT_FOUND", "Session is not linked to this workspace");
  }
  if (siteScope === "sarkari") throw httpError(404, "SESSION_NOT_FOUND", "Sarkari summaries require a linked Sarkari lead");
  return session;
}

export async function handleSummarizeUserSession(request, database = prisma) {
  const body = await readBody(request);
  const sessionId = String(body.session_id || "").trim();
  const siteScope = normalizeIntentSiteScope(body.site_scope);
  if (!sessionId || sessionId.length > 250) throw httpError(400, "SESSION_ID_REQUIRED", "A valid session_id is required");
  const session = await requireScopedSession(database, sessionId, siteScope);
  const events = await database.$queryRawUnsafe(
    `SELECT e.\`event_type\`, e.\`path\`, e.\`element\`, e.\`metadata\`, e.\`created_at\`
       FROM \`user_events\` e
      WHERE e.\`session_id\` = ? AND ${jsonScopePredicate("e", "metadata")}
      ORDER BY e.\`created_at\` ASC LIMIT 500`,
    sessionId,
    siteScope,
  );
  const safeSession = jsonSafe(session);
  const safeEvents = jsonSafe(events).slice(-200);
  const generated = await generateGeminiJson(
    `You are a senior conversion-rate and sales analyst for ${siteScope === "sarkari" ? "Sarkari DekhoCampus" : "DekhoCampus"}.
Produce a factual, concise markdown brief for the inside-sales team. Do not invent any detail.
Use exactly these headings: **Identity & Context**, **Top Page Intents**, **Likely Goals**, **Funnel Stage**, **Friction & Drop-offs**, **Best Next Action for Sales**, **Lead Score (0-100)**.
Return JSON with one field named summary_markdown.
Session: ${JSON.stringify(safeSession)}
Events in chronological order: ${JSON.stringify(safeEvents)}`,
    "user-session-summary",
    {
      siteScope,
      maxOutputTokens: 1_600,
      responseSchema: {
        type: "OBJECT",
        properties: { summary_markdown: { type: "STRING" } },
        required: ["summary_markdown"],
      },
    },
  );
  const summary = String(generated.result?.summary_markdown || "").trim();
  if (!summary) throw httpError(502, "AI_SUMMARY_EMPTY", "The AI provider returned an empty summary");
  await database.$executeRawUnsafe(
    "UPDATE `user_sessions` SET `ai_summary` = ?, `ai_summary_at` = CURRENT_TIMESTAMP(3) WHERE `session_id` = ?",
    summary,
    sessionId,
  );
  return { summary, model_used: generated.model, site_scope: siteScope };
}

export const intentIntelligenceInternals = { objectValue, csvEscape, validDate, scoreSubject };
