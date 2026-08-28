import { createHash } from "node:crypto";
import { prisma } from "./db.mjs";

const CLARITY_ENDPOINT = "https://www.clarity.ms/export-data/api/v1/project-live-insights";
const DAILY_LIMIT = 10;
const CACHE_TTL_MS = 60 * 60 * 1000;

async function ensureClarityTables() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS clarity_export_cache (
    cache_key VARCHAR(191) PRIMARY KEY,
    request_day DATE NOT NULL,
    response_json JSON NOT NULL,
    fetched_at DATETIME(3) NOT NULL,
    INDEX ix_clarity_export_cache_day (request_day, fetched_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS clarity_export_daily_usage (
    request_day DATE PRIMARY KEY,
    request_count INT NOT NULL DEFAULT 0,
    updated_at DATETIME(3) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

function normalizeRequest(body) {
  const numOfDays = Math.min(3, Math.max(1, Math.floor(Number(body?.numOfDays) || 1)));
  const dimensions = Array.isArray(body?.dimensions)
    ? body.dimensions.map((value) => String(value || "").trim()).filter((value) => /^[A-Za-z][A-Za-z /-]{0,50}$/.test(value)).slice(0, 3)
    : [];
  return { numOfDays, dimensions };
}

export async function handleClarityExport(request) {
  const token = String(process.env.CLARITY_DATA_EXPORT_TOKEN || "").trim();
  if (!token) throw Object.assign(new Error("Microsoft Clarity export token is not configured in AWS"), { status: 503, code: "CLARITY_NOT_CONFIGURED" });
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const normalized = normalizeRequest(body);
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = createHash("sha256").update(`${today}:${JSON.stringify(normalized)}`).digest("hex");
  await ensureClarityTables();

  const cached = await prisma.$queryRawUnsafe(
    "SELECT response_json AS responseJson, fetched_at AS fetchedAt FROM clarity_export_cache WHERE cache_key = ? LIMIT 1",
    cacheKey,
  );
  if (cached[0] && Date.now() - new Date(cached[0].fetchedAt).getTime() < CACHE_TTL_MS) {
    const usage = await prisma.$queryRawUnsafe("SELECT request_count AS requestCount FROM clarity_export_daily_usage WHERE request_day = ? LIMIT 1", today);
    const used = Number(usage[0]?.requestCount || 0);
    return { data: cached[0].responseJson, cached: true, fetched_at: cached[0].fetchedAt, requests_used_today: used, requests_remaining_today: Math.max(0, DAILY_LIMIT - used) };
  }

  const lockRows = await prisma.$queryRawUnsafe("SELECT GET_LOCK('dc_clarity_export', 10) AS acquired");
  if (Number(lockRows[0]?.acquired) !== 1) throw Object.assign(new Error("Clarity export is busy; try again shortly"), { status: 409 });
  try {
    const usage = await prisma.$queryRawUnsafe("SELECT request_count AS requestCount FROM clarity_export_daily_usage WHERE request_day = ? LIMIT 1", today);
    const used = Number(usage[0]?.requestCount || 0);
    if (used >= DAILY_LIMIT) throw Object.assign(new Error("Microsoft Clarity daily export limit reached (10/10)"), { status: 429, code: "CLARITY_DAILY_LIMIT" });

    const url = new URL(CLARITY_ENDPOINT);
    url.searchParams.set("numOfDays", String(normalized.numOfDays));
    for (const dimension of normalized.dimensions) url.searchParams.append("dimensions", dimension);
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    const text = await response.text();
    if (!response.ok) throw Object.assign(new Error(`Microsoft Clarity export failed (${response.status}): ${text.slice(0, 300)}`), { status: response.status });
    const data = JSON.parse(text);
    await prisma.$executeRawUnsafe(
      "INSERT INTO clarity_export_daily_usage (request_day, request_count, updated_at) VALUES (?, 1, NOW(3)) ON DUPLICATE KEY UPDATE request_count = request_count + 1, updated_at = NOW(3)",
      today,
    );
    await prisma.$executeRawUnsafe(
      "INSERT INTO clarity_export_cache (cache_key, request_day, response_json, fetched_at) VALUES (?, ?, ?, NOW(3)) ON DUPLICATE KEY UPDATE response_json = VALUES(response_json), fetched_at = NOW(3)",
      cacheKey,
      today,
      JSON.stringify(data),
    );
    return { data, cached: false, fetched_at: new Date().toISOString(), requests_used_today: used + 1, requests_remaining_today: Math.max(0, DAILY_LIMIT - used - 1) };
  } finally {
    await prisma.$queryRawUnsafe("SELECT RELEASE_LOCK('dc_clarity_export')").catch(() => {});
  }
}
