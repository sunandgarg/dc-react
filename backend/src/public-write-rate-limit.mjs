const WINDOW_MS = 60_000;
const MAX_BUCKETS = 50_000;
const GLOBAL_UNITS_PER_MINUTE = 600;
const TABLE_UNITS_PER_MINUTE = new Map([
  ["save-lead", 20],
  ["intent_events", 60],
  ["user_events", 300],
  ["intent_visitors", 120],
  ["cta_events", 180],
  ["ad_analytics_events", 180],
  ["url_clicks", 180],
  ["user_consent", 30],
  ["college_applications", 20],
  ["job_applications", 20],
  ["landing_page_leads", 20],
]);

const buckets = new Map();

function normalizedClientKey(value) {
  return String(value || "unknown").trim().slice(0, 128) || "unknown";
}

function bucketState(key, now) {
  const current = buckets.get(key);
  if (current && current.resetAt > now) return current;
  return { used: 0, resetAt: now + WINDOW_MS };
}

function prune(now) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, value] of buckets) {
    if (value.resetAt <= now) buckets.delete(key);
  }
  while (buckets.size >= MAX_BUCKETS) buckets.delete(buckets.keys().next().value);
}

export function consumePublicWriteLimit({ clientKey, table, units = 1, now = Date.now() }) {
  const safeClient = normalizedClientKey(clientKey);
  const safeUnits = Math.max(1, Math.min(100, Math.trunc(Number(units) || 1)));
  const tableLimit = TABLE_UNITS_PER_MINUTE.get(table) || 30;
  const globalKey = `${safeClient}:*`;
  const tableKey = `${safeClient}:${table}`;
  const global = bucketState(globalKey, now);
  const scoped = bucketState(tableKey, now);
  const globalExceeded = global.used + safeUnits > GLOBAL_UNITS_PER_MINUTE;
  const tableExceeded = scoped.used + safeUnits > tableLimit;
  if (globalExceeded || tableExceeded) {
    const resetAt = Math.max(globalExceeded ? global.resetAt : 0, tableExceeded ? scoped.resetAt : 0);
    const error = Object.assign(new Error("Too many anonymous submissions. Please wait before trying again."), {
      status: 429,
      code: "PUBLIC_WRITE_RATE_LIMIT",
      retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    });
    throw error;
  }
  prune(now);
  global.used += safeUnits;
  scoped.used += safeUnits;
  buckets.set(globalKey, global);
  buckets.set(tableKey, scoped);
  return {
    limit: tableLimit,
    remaining: Math.max(0, tableLimit - scoped.used),
    resetAt: scoped.resetAt,
  };
}

export const publicWriteRateLimitInternals = {
  reset() { buckets.clear(); },
  WINDOW_MS,
  GLOBAL_UNITS_PER_MINUTE,
  TABLE_UNITS_PER_MINUTE,
};
