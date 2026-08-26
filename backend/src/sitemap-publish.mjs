import { prisma } from "./db.mjs";

const CORE_TABLES = ["colleges", "courses", "exams", "articles"];
const PUBLISH_TARGET = "https://dekhocampus.com";

function publishError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}
async function activeCount(table, prismaClient) {
  const rows = await prismaClient.$queryRawUnsafe(
    `SELECT COUNT(*) AS \`count\` FROM \`${table}\` WHERE \`is_active\` = 1 AND \`slug\` IS NOT NULL`,
  );
  return Number(rows[0]?.count || 0);
}

export async function publishSitemap(request, options = {}) {
  if (request.method !== "POST") {
    throw publishError(405, "METHOD_NOT_ALLOWED", "Sitemap publishing requires POST");
  }

  const hookUrl = String(options.hookUrl ?? process.env.CLOUDFLARE_PAGES_DEPLOY_HOOK_URL ?? "").trim();
  if (!hookUrl) {
    throw publishError(503, "SITEMAP_PUBLISH_NOT_CONFIGURED", "Cloudflare Pages sitemap publishing is not configured");
  }

  let parsedHook;
  try {
    parsedHook = new URL(hookUrl);
  } catch {
    throw publishError(503, "SITEMAP_PUBLISH_INVALID_CONFIG", "Cloudflare Pages deploy hook is invalid");
  }
  if (parsedHook.protocol !== "https:" || parsedHook.hostname !== "api.cloudflare.com") {
    throw publishError(503, "SITEMAP_PUBLISH_INVALID_CONFIG", "Cloudflare Pages deploy hook must use the Cloudflare API host");
  }

  const body = await request.json().catch(() => ({}));
  if (body.target && body.target !== PUBLISH_TARGET) {
    throw publishError(400, "INVALID_SITEMAP_TARGET", `Sitemaps can only be published for ${PUBLISH_TARGET}`);
  }

  const prismaClient = options.prismaClient || prisma;
  const counts = Object.fromEntries(await Promise.all(
    CORE_TABLES.map(async (table) => [table, await activeCount(table, prismaClient)]),
  ));
  if (Object.values(counts).some((count) => count === 0)) {
    throw publishError(409, "SITEMAP_SOURCE_INCOMPLETE", "Publishing stopped because one or more core public catalogs are empty");
  }

  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(hookUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "DekhoCampus sitemap publisher/1.0" },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw publishError(502, "SITEMAP_DEPLOY_REJECTED", `Cloudflare Pages rejected the deployment request (${response.status})`);
  }

  return {
    success: true,
    status: "queued",
    target: PUBLISH_TARGET,
    source_counts: counts,
    requested_at: new Date().toISOString(),
  };
}
