import { applyEdgeSeo, entityEdgeSeo } from "../../public/edge-seo.js";

const SITE_URL = "https://dekhocampus.com";
const SHELL_URL = "https://dekhocampus-aws-candidate.pages.dev/";
const SHELL_TTL_MS = 5 * 60_000;
const DETAIL_TABS = {
  colleges: new Set(["overview", "highlights", "courses", "admissions", "placements", "cutoff", "rankings", "infrastructure", "gallery", "faculty", "recruiters", "scholarships", "hostel", "compare", "faq", "news"]),
  courses: new Set(["overview", "highlights", "eligibility", "syllabus", "fees", "admission", "career", "placements", "specializations", "top-exams", "top-colleges", "cutoff", "faq"]),
  exams: new Set(["overview", "highlights", "dates", "application", "eligibility", "syllabus", "pattern", "preparation", "admit-card", "answer-key", "results", "counselling", "cutoff", "colleges", "faq", "sample-paper"]),
};

let shellCache;
let shellPromise;

async function frontendShell(fetchImpl, now) {
  if (shellCache && now() - shellCache.time < SHELL_TTL_MS) return shellCache.html;
  if (!shellPromise) {
    shellPromise = (async () => {
      const response = await fetchImpl(SHELL_URL, { headers: { accept: "text/html" }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`Frontend shell returned ${response.status}`);
      const html = await response.text();
      if (!html.includes('<div id="root"') || !html.includes("/assets/")) throw new Error("Frontend shell is incomplete");
      shellCache = { html, time: now() };
      return html;
    })().finally(() => { shellPromise = undefined; });
  }
  try { return await shellPromise; } catch (error) {
    if (shellCache) return shellCache.html;
    throw error;
  }
}

function parseEntityPath(pathname) {
  const match = pathname.match(/^\/(colleges|courses|exams)\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?\/?$/i);
  if (!match) return null;
  const [, type, publicSlug, tab] = match;
  if (tab && !DETAIL_TABS[type].has(tab)) return { missing: true };
  const withId = publicSlug.match(/^(.*)-(\d+)$/);
  return { type, publicSlug, tab, slug: withId ? withId[1] : publicSlug, shortId: withId ? Number(withId[2]) : null };
}

const clientRow = (row) => JSON.parse(JSON.stringify(row, (_key, value) => {
  if (typeof value !== "bigint") return value;
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) ? numeric : value.toString();
}));

const missing = () => new Response("Page not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex", "cache-control": "public, max-age=60" } });

export async function serveEntityPage(request, { prismaClient, fetchImpl = fetch, now = Date.now } = {}) {
  const incoming = new URL(request.url);
  const parsed = parseEntityPath(incoming.pathname);
  if (!parsed) return null;
  if (!["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
  if (parsed.missing || !Number.isSafeInteger(parsed.shortId ?? 0)) return missing();

  // The frontend also has named catalog landing pages under these roots.
  // Keep their existing static Pages response instead of treating them as missing records.
  try {
    if (!parsed.shortId) {
      const response = await fetchImpl(new URL(`${incoming.pathname}${incoming.search}`, SHELL_URL), { signal: AbortSignal.timeout(8000) });
      return new Response(request.method === "HEAD" ? null : response.body, { status: response.status, headers: response.headers });
    }
    const row = await prismaClient[parsed.type].findFirst({
      where: { short_id: parsed.type === "colleges" ? BigInt(parsed.shortId) : parsed.shortId, is_active: true },
    });
    if (!row?.slug) return missing();
    const entity = clientRow(row);
    const preferredSlug = `${entity.slug}${entity.short_id ? `-${entity.short_id}` : ""}`;
    if (parsed.publicSlug !== preferredSlug) {
      return new Response(null, { status: 308, headers: { location: `${SITE_URL}/${parsed.type}/${preferredSlug}${parsed.tab ? `/${parsed.tab}` : ""}${incoming.search}`, "cache-control": "public, max-age=300" } });
    }
    const publicUrl = new URL(`${incoming.pathname}${incoming.search}`, SITE_URL);
    const metadata = entityEdgeSeo(entity, publicUrl, parsed.type);
    metadata.initialData = { table: parsed.type, routeSlug: parsed.publicSlug, row: entity };
    const html = applyEdgeSeo(await frontendShell(fetchImpl, now), metadata);
    const headers = { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=300", "x-content-type-options": "nosniff" };
    return new Response(request.method === "HEAD" ? null : html, { status: 200, headers });
  } catch (error) {
    console.error("Entity HTML unavailable", error);
    return new Response(request.method === "HEAD" ? null : "Entity page temporarily unavailable", { status: 503, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "retry-after": "60" } });
  }
}
