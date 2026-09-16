import { isIP } from "node:net";
import { prisma } from "./db.mjs";

export const SARKARI_HOME_CATEGORIES = Object.freeze([
  "Latest Jobs",
  "Results",
  "Admit Card",
  "Answer Key",
  "Admissions",
  "Syllabus",
  "Scholarships",
]);

export const SARKARI_HOME_FEED_MAX_ITEMS = 9;
export const SARKARI_HOME_FEED_MAX_BYTES = 256 * 1024;
export const SARKARI_HOME_FEED_READ_LIMIT = 120;
const SARKARI_HOME_FEED_READ_WINDOW_MS = 60_000;
const SARKARI_HOME_FEED_MAX_RATE_BUCKETS = 50_000;
const SARKARI_HOME_FEED_QUERY_COUNT = SARKARI_HOME_CATEGORIES.length + 2;
const SARKARI_HOME_FEED_MAX_ROWS = SARKARI_HOME_FEED_QUERY_COUNT * SARKARI_HOME_FEED_MAX_ITEMS;
const PINNED_BUCKET = "__pinned";
const LATEST_BUCKET = "__latest";
const encoder = new TextEncoder();
const readBuckets = new Map();

const cardColumns = `
    LEFT(\`id\`, 65) AS \`id\`,
    LEFT(\`slug\`, 181) AS \`slug\`,
    LEFT(\`title\`, 2000) AS \`title\`,
    LEFT(\`description\`, 8000) AS \`description\`,
    LEFT(\`category\`, 256) AS \`category\`,
    LEFT(\`vertical\`, 256) AS \`vertical\`,
    \`created_at\` AS \`createdAt\`,
    \`featured_rank\` AS \`featuredRank\``;

const publicPredicate = `\`site_scope\` = 'sarkari'
    AND \`is_active\` = 1
    AND \`status\` = 'Published'`;

// Keep application-deadline content indexable on its detail URL, but do not
// promote it as a current opportunity after its India-local closing date.
// Missing JobPosting data remains eligible so older/non-job content is not
// accidentally hidden. Malformed structured job data fails closed here.
const currentJobPredicate = `(\`job_posting\` IS NULL
      OR JSON_TYPE(\`job_posting\`) = 'NULL'
      OR JSON_EXTRACT(\`job_posting\`, '$.validThrough') IS NULL
      OR JSON_UNQUOTE(JSON_EXTRACT(\`job_posting\`, '$.validThrough')) = ''
      OR STR_TO_DATE(
        LEFT(JSON_UNQUOTE(JSON_EXTRACT(\`job_posting\`, '$.validThrough')), 10),
        '%Y-%m-%d'
      ) >= DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30')))`;

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function boundedSelect({ bucket, index, predicate = "", order }) {
  return `(SELECT${cardColumns},
    ${sqlLiteral(bucket)} AS \`feedBucket\`
  FROM \`articles\` FORCE INDEX (\`${index}\`)
  WHERE ${publicPredicate}${predicate ? `\n    AND ${predicate}` : ""}
  ORDER BY ${order}
  LIMIT ${SARKARI_HOME_FEED_MAX_ITEMS})`;
}

// Each UNION arm is independently indexable and capped before combination.
// This avoids a table-wide window/sort while retaining the existing homepage
// contract: pinned cards first, followed by newest cards, plus seven exact
// category equality rails. The query is fixed at module initialization and
// accepts no caller-controlled values.
export const SARKARI_HOME_FEED_SQL = [
  boundedSelect({
    bucket: PINNED_BUCKET,
    index: "ix_articles_site_featured_public",
    predicate: `\`featured_rank\` IS NOT NULL AND ${currentJobPredicate}`,
    order: "`featured_rank` ASC",
  }),
  boundedSelect({
    bucket: LATEST_BUCKET,
    index: "ix_articles_site_public",
    predicate: currentJobPredicate,
    order: "`created_at` DESC",
  }),
  ...SARKARI_HOME_CATEGORIES.map((category) => boundedSelect({
    bucket: category,
    index: "ix_articles_site_category_public",
    predicate: `\`category\` = ${sqlLiteral(category)}${category === "Latest Jobs"
      ? ` AND ${currentJobPredicate}`
      : ""}`,
    order: "`created_at` DESC",
  })),
].join("\nUNION ALL\n");

function truncateUtf8(value, maxBytes) {
  let bytes = 0;
  let output = "";
  for (const character of String(value || "")) {
    const characterBytes = encoder.encode(character).byteLength;
    if (bytes + characterBytes > maxBytes) break;
    output += character;
    bytes += characterBytes;
  }
  return output;
}

function decodeHtmlEntities(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
    if (entity[0] !== "#") return named[entity.toLowerCase()] ?? match;
    const hexadecimal = entity[1]?.toLowerCase() === "x";
    const codePoint = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return " ";
    try { return String.fromCodePoint(codePoint); } catch { return " "; }
  });
}

function plainText(value, rawCharacterLimit, maxBytes) {
  const source = String(value ?? "").slice(0, rawCharacterLimit);
  return truncateUtf8(
    decodeHtmlEntities(source)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    maxBytes,
  ).trim();
}

export function normalizeSarkariHomeCategory(value) {
  const category = String(value || "").toLowerCase();
  if (category.includes("result")) return "Results";
  if (category.includes("admit") || category.includes("hall ticket")) return "Admit Card";
  if (category.includes("answer")) return "Answer Key";
  if (category.includes("admission") || category.includes("counselling")) return "Admissions";
  if (category.includes("syllabus") || category.includes("pattern")) return "Syllabus";
  if (category.includes("scholar")) return "Scholarships";
  return "Latest Jobs";
}

function normalizedEntry(row) {
  const rawId = String(row?.id ?? "").trim();
  const id = plainText(rawId, 65, 65);
  if (!id || encoder.encode(id).byteLength > 64 || id !== rawId) return null;

  // SQL returns at most max + 1 characters. Rejecting that sentinel character
  // prevents an overlength database slug from silently becoming a different
  // public URL after truncation.
  const rawSlug = String(row?.slug ?? "");
  const slug = rawSlug.trim().toLowerCase();
  if (rawSlug.length > 180 || rawSlug !== slug) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;

  const title = plainText(row?.title, 2_000, 240);
  const description = plainText(row?.description, 8_000, 800);
  const parsedDate = row?.createdAt instanceof Date ? row.createdAt : new Date(row?.createdAt);
  const feedBucket = String(row?.feedBucket ?? "");
  if (!title || Number.isNaN(parsedDate.getTime())
    || ![PINNED_BUCKET, LATEST_BUCKET, ...SARKARI_HOME_CATEGORIES].includes(feedBucket)) return null;

  const numericRank = row?.featuredRank === null || row?.featuredRank === undefined
    ? null
    : Number(row.featuredRank);
  if (feedBucket === PINNED_BUCKET && !Number.isFinite(numericRank)) return null;

  return {
    card: {
      id,
      slug,
      title,
      description,
      // The fixed SQL equality is authoritative for rail membership and uses
      // the same database collation as the existing REST `.eq` request. Stamp
      // the canonical bucket label so case/trailing-space equivalents do not
      // disappear after already consuming one of the query's nine slots.
      category: SARKARI_HOME_CATEGORIES.includes(feedBucket)
        ? feedBucket
        : normalizeSarkariHomeCategory(row?.category || row?.vertical),
      createdAt: parsedDate.toISOString(),
    },
    featuredRank: Number.isFinite(numericRank) ? numericRank : null,
    feedBucket,
  };
}

function responseTooLarge() {
  const error = new Error("The Sarkari homepage feed exceeded its safe response limit");
  error.status = 500;
  error.code = "SARKARI_HOME_FEED_TOO_LARGE";
  return error;
}

function chronological(left, right) {
  return right.card.createdAt.localeCompare(left.card.createdAt)
    || left.card.id.localeCompare(right.card.id);
}

function uniqueCards(entries, maxItems = SARKARI_HOME_FEED_MAX_ITEMS) {
  const ids = new Set();
  const slugs = new Set();
  const cards = [];
  for (const entry of entries) {
    if (ids.has(entry.card.id) || slugs.has(entry.card.slug)) continue;
    ids.add(entry.card.id);
    slugs.add(entry.card.slug);
    cards.push(entry.card);
    if (cards.length === maxItems) break;
  }
  return cards;
}

export function buildSarkariHomeFeed(rows) {
  if (!Array.isArray(rows)) {
    const error = new Error("The Sarkari homepage feed query returned an invalid result");
    error.status = 500;
    error.code = "SARKARI_HOME_FEED_INVALID_RESULT";
    throw error;
  }

  const entries = rows.slice(0, SARKARI_HOME_FEED_MAX_ROWS).map(normalizedEntry).filter(Boolean);
  const pinned = entries
    .filter((entry) => entry.feedBucket === PINNED_BUCKET)
    .sort((left, right) => left.featuredRank - right.featuredRank || chronological(left, right));
  const newest = entries
    .filter((entry) => entry.feedBucket === LATEST_BUCKET)
    .sort(chronological);
  const latest = uniqueCards([...pinned, ...newest]);

  const byCategory = Object.fromEntries(SARKARI_HOME_CATEGORIES.map((category) => [
    category,
    uniqueCards(entries
      .filter((entry) => entry.feedBucket === category)
      .sort(chronological)),
  ]));
  const payload = { version: 1, latest, byCategory };
  if (encoder.encode(JSON.stringify(payload)).byteLength > SARKARI_HOME_FEED_MAX_BYTES) throw responseTooLarge();
  return payload;
}

export async function loadSarkariHomeFeed(client = prisma) {
  const rows = await client.$queryRawUnsafe(SARKARI_HOME_FEED_SQL);
  return buildSarkariHomeFeed(rows);
}

function normalizedClientKey(value) {
  const candidate = String(value || "").trim();
  return isIP(candidate) ? candidate : "unknown";
}

function pruneReadBuckets(now) {
  if (readBuckets.size < SARKARI_HOME_FEED_MAX_RATE_BUCKETS) return;
  for (const [key, bucket] of readBuckets) {
    if (bucket.resetAt <= now) readBuckets.delete(key);
  }
  while (readBuckets.size >= SARKARI_HOME_FEED_MAX_RATE_BUCKETS) {
    readBuckets.delete(readBuckets.keys().next().value);
  }
}

export function consumeSarkariHomeFeedReadLimit(clientKey, now = Date.now()) {
  const key = normalizedClientKey(clientKey);
  const current = readBuckets.get(key);
  const bucket = current && current.resetAt > now
    ? current
    : { used: 0, resetAt: now + SARKARI_HOME_FEED_READ_WINDOW_MS };
  if (bucket.used >= SARKARI_HOME_FEED_READ_LIMIT) {
    throw Object.assign(new Error("Too many Sarkari homepage feed requests. Please retry shortly."), {
      status: 429,
      code: "SARKARI_HOME_FEED_RATE_LIMIT",
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    });
  }
  pruneReadBuckets(now);
  bucket.used += 1;
  readBuckets.set(key, bucket);
  return {
    limit: SARKARI_HOME_FEED_READ_LIMIT,
    remaining: SARKARI_HOME_FEED_READ_LIMIT - bucket.used,
    resetAt: bucket.resetAt,
  };
}

export const sarkariHomeFeedInternals = {
  PINNED_BUCKET,
  LATEST_BUCKET,
  MAX_ROWS: SARKARI_HOME_FEED_MAX_ROWS,
  READ_WINDOW_MS: SARKARI_HOME_FEED_READ_WINDOW_MS,
  normalizeClientKey: normalizedClientKey,
  resetReadLimit() { readBuckets.clear(); },
};
