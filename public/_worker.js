import { applyEdgeSeo, articleEdgeSeo, edgeSeoFor } from "./edge-seo.js";

const API_ORIGIN = "https://aws-origin.dekhocampus.com";

const API_PREFIXES = [
  "/auth/v1/",
  "/functions/v1/",
  "/rest/v1/",
  "/storage/v1/",
  "/v1/",
];

const CACHEABLE_PUBLIC_TABLES = new Set([
  "article_categories", "article_links", "articles", "authors", "career_profiles",
  "college_contacts", "college_facilities", "college_programs", "college_reviews", "colleges",
  "course_fees", "course_specializations", "courses", "exams", "faqs", "featured_colleges",
  "jobs", "legal_pages", "placement_records", "programs", "scholarships", "study_boards",
  "study_chapters", "study_resources", "study_subjects", "study_toppers",
]);

const PUBLIC_STORAGE_PATH = /^\/storage\/v1\/object\/public\/(?:admin-uploads|ad-images|legacy-public-assets|study-material)(?:\/|$)/;

function isApiRequest(pathname) {
  return pathname === "/health"
    || /^\/sitemap(?:-index|-\d+)?\.xml$/.test(pathname)
    || pathname.startsWith("/sitemap-files/")
    || API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains; preload");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "SAMEORIGIN");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set("cross-origin-opener-policy", "same-origin-allow-popups");
  headers.set("content-security-policy", "base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self' https:");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function proxyToApi(request) {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, API_ORIGIN);
  const upstreamResponse = await fetch(new Request(upstreamUrl, request));
  const headers = new Headers(upstreamResponse.headers);
  const location = headers.get("location");

  if (location?.startsWith(API_ORIGIN)) {
    headers.set("location", `${incomingUrl.origin}${location.slice(API_ORIGIN.length)}`);
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
}

function edgeCacheTtl(request, pathname) {
  if (request.method !== "GET" || request.headers.has("authorization")) return 0;
  if (PUBLIC_STORAGE_PATH.test(pathname)) return 30 * 24 * 60 * 60;
  if (pathname === "/v1/functions/bootstrap") return 5 * 60;
  const restTable = pathname.match(/^\/v1\/rest\/([A-Za-z0-9_]+)$/)?.[1];
  if (restTable && CACHEABLE_PUBLIC_TABLES.has(restTable)) return 5 * 60;
  if (/^\/sitemap(?:-index|-\d+)?\.xml$/.test(pathname) || pathname.startsWith("/sitemap-files/")) return 300;
  return 0;
}

async function proxyToApiWithCache(request, context) {
  const url = new URL(request.url);
  const ttl = edgeCacheTtl(request, url.pathname);
  if (!ttl) return proxyToApi(request);
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("x-dc-edge-cache", "HIT");
    return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
  }
  const response = await proxyToApi(request);
  if (!response.ok || response.headers.has("set-cookie")) return response;
  const headers = new Headers(response.headers);
  headers.set("cache-control", `public, max-age=${Math.min(ttl, 300)}, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`);
  headers.set("x-dc-edge-cache", "MISS");
  const cacheable = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  context.waitUntil(cache.put(cacheKey, cacheable.clone()));
  return cacheable;
}

async function serveAsset(request, env) {
  const url = new URL(request.url);
  let response = await env.ASSETS.fetch(request);

  if (response.status === 404 && request.method === "GET" && request.headers.get("accept")?.includes("text/html")) {
    response = await env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
  }

  if (request.method === "GET" && response.ok && response.headers.get("content-type")?.includes("text/html")) {
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    let metadata = edgeSeoFor(url);
    const articleMatch = url.pathname.match(/^\/news\/([^/]+)\/?$/);
    if (articleMatch && articleMatch[1] !== "tag") {
      const query = new URLSearchParams({
        select: "status,title,slug,description,content,author,featured_image,meta_title,meta_description,created_at,updated_at",
        slug: `eq.${decodeURIComponent(articleMatch[1])}`,
        status: "eq.Published",
        is_active: "eq.true",
        limit: "1",
      });
      const articleResponse = await fetch(`${API_ORIGIN}/v1/rest/articles?${query}`, {
        headers: { accept: "application/json" },
        cf: { cacheEverything: true, cacheTtl: 300 },
      });
      const payload = articleResponse.ok ? await articleResponse.json().catch(() => []) : [];
      const article = Array.isArray(payload) ? payload[0] : payload?.data?.[0];
      metadata = article
        ? articleEdgeSeo(article, url)
        : { ...metadata, indexable: false };
    }
    response = new Response(applyEdgeSeo(await response.text(), metadata), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const secured = withSecurityHeaders(response);
  if (url.pathname.startsWith("/assets/")) {
    secured.headers.set("cache-control", "public, max-age=31536000, immutable");
  } else if (url.pathname === "/version.json" || secured.headers.get("content-type")?.includes("text/html")) {
    secured.headers.set("cache-control", "no-cache, no-store, must-revalidate");
  }
  return secured;
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (url.hostname === "www.dekhocampus.com") {
      url.hostname = "dekhocampus.com";
      return Response.redirect(url.toString(), 308);
    }
    try {
      return isApiRequest(url.pathname)
        ? withSecurityHeaders(await proxyToApiWithCache(request, context))
        : await serveAsset(request, env);
    } catch (error) {
      console.error(JSON.stringify({ event: "candidate_proxy_error", path: url.pathname, message: error instanceof Error ? error.message : String(error) }));
      return Response.json({ error: "Candidate service is temporarily unavailable" }, { status: 502 });
    }
  },
};
