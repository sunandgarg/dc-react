import { applyEdgeSeo, applyHomeCriticalCssDelivery, articleEdgeSeo, edgeSeoFor, entityEdgeSeo, newsListingEdgeSeo } from "./edge-seo.js";

const API_ORIGIN = "https://aws-origin.dekhocampus.com";
const PUBLIC_LOOKUP_TIMEOUT_MS = 8_000;

// Keep this bounded route set in sync with the sitemap publisher (covered by a parity test).
const CURATED_LISTINGS = {
  colleges: {
    "top-engineering-colleges-in-india": { category: "eq.Engineering" },
    "top-btech-colleges-in-india": { category: "eq.Engineering" },
    "top-engineering-colleges-in-delhi-ncr": { category: "eq.Engineering", state: "eq.Delhi NCR" },
    "top-engineering-colleges-in-bangalore": { category: "eq.Engineering", state: "eq.Karnataka", city: "eq.Bangalore" },
    "top-engineering-colleges-in-pune": { category: "eq.Engineering", state: "eq.Maharashtra", city: "eq.Pune" },
    "top-engineering-colleges-in-hyderabad": { category: "eq.Engineering", state: "eq.Telangana", city: "eq.Hyderabad" },
    "top-management-colleges-in-india": { category: "eq.Management" },
    "top-mba-colleges-in-india": { category: "eq.Management" },
    "top-bba-colleges-in-india": { category: "eq.Management" },
    "top-mba-colleges-in-delhi-ncr": { category: "eq.Management", state: "eq.Delhi NCR" },
    "top-mba-colleges-in-mumbai": { category: "eq.Management", state: "eq.Maharashtra", city: "eq.Mumbai" },
    "top-mba-colleges-in-bangalore": { category: "eq.Management", state: "eq.Karnataka", city: "eq.Bangalore" },
    "top-medical-colleges-in-india": { category: "eq.Medical" },
    "top-mbbs-colleges-in-india": { category: "eq.Medical" },
    "top-medical-colleges-in-karnataka": { category: "eq.Medical", state: "eq.Karnataka" },
    "top-law-colleges-in-india": { category: "eq.Law" },
    "top-llb-colleges-in-india": { category: "eq.Law" },
    "top-pharmacy-colleges-in-india": { category: "eq.Pharmacy" },
  },
  courses: {
    "top-btech-courses-in-india": { category: "eq.Engineering" },
    "top-mba-courses-in-india": { category: "eq.Management" },
    "top-bca-courses-in-india": { category: "in.(Computer Applications,IT and Software,IT & Computing)" },
    "top-mca-courses-in-india": { category: "in.(Computer Applications,IT and Software,IT & Computing)" },
    "top-online-courses-in-india": { mode: "eq.Online" },
    "top-distance-courses-in-india": { mode: "eq.Distance" },
  },
  exams: {
    "top-engineering-entrance-exams-in-india": { exam_streams: 'ov.["Engineering"]' },
    "top-medical-entrance-exams-in-india": { exam_streams: 'ov.["Medical"]' },
    "top-management-entrance-exams-in-india": { exam_streams: 'ov.["Management"]' },
    "top-law-entrance-exams-in-india": { exam_streams: 'ov.["Law"]' },
    "top-national-entrance-exams-in-india": { level: "eq.National" },
    "top-state-entrance-exams-in-india": { level: "eq.State" },
  },
};

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
    || /^\/(?:news-(?:sitemap|feed)|sitemap(?:-index|-\d+)?)\.xml$/.test(pathname)
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
  if (upstreamResponse.status >= 500) return temporarilyUnavailable(request);
  const headers = new Headers(upstreamResponse.headers);
  if (!upstreamResponse.ok) headers.set("cache-control", "no-store");
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

function temporarilyUnavailable(request) {
  const headers = { "cache-control": "no-store", "retry-after": "60" };
  if (isApiRequest(new URL(request.url).pathname)) {
    return withSecurityHeaders(Response.json({ error: "Service temporarily unavailable. Please try again shortly." }, { status: 503, headers }));
  }
  return withSecurityHeaders(new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fonts/site-font.css"><title>Temporarily unavailable | DekhoCampus</title></head><body style="font-family:var(--font-site,sans-serif)"><main><h1>This page is temporarily unavailable</h1><p>Your content has not been removed. Please reload this page shortly.</p></main></body></html>', {
    status: 503,
    headers: { ...headers, "content-type": "text/html; charset=utf-8" },
  }));
}

async function fetchPublicRows(table, query, cacheTtl = 300) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PUBLIC_LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_ORIGIN}/v1/rest/${table}?${query}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
      cf: { cacheEverything: true, cacheTtlByStatus: { "200-299": cacheTtl, "300-599": 0 } },
    });
    if (!response.ok) throw new Error(`${table} API returned ${response.status}`);
    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : payload?.data;
    const requiredFields = table === "articles" ? ["slug", "title"] : table === "authors" ? ["name"] : ["slug", "name"];
    if (payload?.error || !Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row) || requiredFields.some((field) => typeof row[field] !== "string" || !row[field].trim()))) {
      throw new Error(`${table} API returned invalid rows`);
    }
    return rows;
  } finally {
    clearTimeout(timeout);
  }
}

function edgeCacheTtl(request, pathname) {
  if (request.method !== "GET" || request.headers.has("authorization")) return 0;
  if (PUBLIC_STORAGE_PATH.test(pathname)) return 30 * 24 * 60 * 60;
  if (pathname === "/v1/functions/bootstrap") return 5 * 60;
  if (pathname === "/news-sitemap.xml" || pathname === "/sitemap-0.xml") return 30;
  const restTable = pathname.match(/^\/v1\/rest\/([A-Za-z0-9_]+)$/)?.[1];
  if (restTable && CACHEABLE_PUBLIC_TABLES.has(restTable)) return 5 * 60;
  if (/^\/(?:news-(?:sitemap|feed)|sitemap(?:-index|-\d+)?)\.xml$/.test(pathname) || pathname.startsWith("/sitemap-files/")) return 300;
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

async function fetchPublicEntity(entityType, publicSlug) {
  const fetchRows = async (filter) => {
    const query = new URLSearchParams({
      // This anonymous response is the same public detail row consumed by the page.
      select: "*",
      is_active: "eq.true",
      ...filter,
      limit: "1",
    });
    return fetchPublicRows(entityType, query, 30);
  };

  const shortId = publicSlug.match(/-(\d+)$/)?.[1];
  if (shortId) {
    const [candidate] = await fetchRows({ short_id: `eq.${shortId}`, slug: `eq.${publicSlug.slice(0, -(shortId.length + 1))}` });
    if (candidate && `${candidate.slug}-${candidate.short_id}` === publicSlug) return candidate;
  }
  const [legacyCandidate] = await fetchRows({ slug: `eq.${publicSlug}` });
  return legacyCandidate;
}

async function curatedListingMetadata(url, metadata, entityType, filters) {
  const select = entityType === "colleges" ? "name,slug,short_id,category,city,state" : "name,slug,short_id,category";
  const query = new URLSearchParams({ select, is_active: "eq.true", ...filters, order: "priority.asc.nullslast,name.asc", limit: "18" });
  if (entityType === "courses") {
    const group = url.pathname.match(/^\/courses\/top-(btech|mba|bca|mca)-/)?.[1];
    const aliases = {
      btech: ["B.Tech", "BTech", "Bachelor of Technology"],
      mba: ["MBA", "Master of Business Administration", "Management"],
      bca: ["BCA", "Bachelor of Computer Applications", "Computer Applications", "IT"],
      mca: ["MCA", "Master of Computer Applications", "Computer Applications", "IT"],
    };
    if (group) query.set("or", `(${["name", "full_name", "category", "level", "description"].flatMap((field) => aliases[group].map((term) => `${field}.ilike.%${term}%`)).join(",")})`);
  }
  const rows = await fetchPublicRows(entityType, query);
  const escape = (value) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const heading = metadata.title.split(" | ")[0];
  const description = entityType === "colleges"
    ? "Explore colleges and compare their courses, fees and admission information. Open a college to check its available details."
    : entityType === "courses"
      ? "Explore courses and compare eligibility, duration, fees and career information. Open a course to check its available details."
      : "Explore entrance exams and compare eligibility, applications and preparation resources. Open an exam to check its available details.";
  const items = rows.filter((row) => row.slug && row.name).map((row) => {
    const href = `/${entityType}/${encodeURIComponent(row.slug)}${row.short_id ? `-${encodeURIComponent(row.short_id)}` : ""}`;
    const detail = [row.category, row.city, row.state].filter(Boolean).map(escape).join(" · ");
    return `<li><a href="${href}">${escape(row.name)}</a>${detail ? `<p>${detail}</p>` : ""}</li>`;
  }).join("");
  return {
    ...metadata,
    title: `${heading} | DekhoCampus`,
    description,
    prerenderHtml: `<main data-dc-edge-prerender><h1>${escape(heading)}</h1><p>${description}</p>${items ? `<ul>${items}</ul>` : "<p>No matching active entries are currently available.</p>"}<p><a href="/${entityType}">Explore all ${entityType}</a></p></main>`,
  };
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
    if (/^\/news\/?$/.test(url.pathname) && metadata.indexable) {
      const page = Number(url.searchParams.get("page") || 1);
      const query = new URLSearchParams({
        select: "slug,title,created_at",
        site_scope: "eq.dekhocampus",
        status: "eq.Published",
        is_active: "eq.true",
        order: "created_at.desc",
        offset: String((page - 1) * 12),
        limit: "13",
      });
      const articles = await fetchPublicRows("articles", query);
      if (page > 1 && articles.length === 0) metadata = { ...metadata, indexable: false, notFound: true };
      else metadata = newsListingEdgeSeo(articles.slice(0, 12), url, page, articles.length > 12);
    }
    const articleMatch = url.pathname.match(/^\/news\/([^/]+)\/?$/);
    if (articleMatch && articleMatch[1] !== "tag") {
      const query = new URLSearchParams({
        select: "*",
        site_scope: "eq.dekhocampus",
        slug: `eq.${decodeURIComponent(articleMatch[1])}`,
        status: "eq.Published",
        is_active: "eq.true",
        limit: "1",
      });
      const [article] = await fetchPublicRows("articles", query, 30);
      if (article?.author_id) {
        const authorQuery = new URLSearchParams({ select: "name,slug", id: `eq.${article.author_id}`, limit: "1" });
        try {
          [article.resolved_author] = await fetchPublicRows("authors", authorQuery);
        } catch (error) {
          console.error(JSON.stringify({ event: "article_author_lookup_failed", message: error instanceof Error ? error.message : String(error) }));
        }
      }
      metadata = article
        ? articleEdgeSeo(article, url)
        : { ...metadata, indexable: false, notFound: true };
      if (article) metadata.initialData = { table: "articles", routeSlug: decodeURIComponent(articleMatch[1]), row: article };
    }
    const entityMatch = metadata.indexable
      ? url.pathname.match(/^\/(colleges|courses|exams)\/([^/]+)(?:\/[^/]+)?\/?$/)
      : null;
    if (entityMatch) {
      const [, entityType, publicSlug] = entityMatch;
      const decodedSlug = decodeURIComponent(publicSlug);
      const listingFilters = Object.hasOwn(CURATED_LISTINGS[entityType], decodedSlug) ? CURATED_LISTINGS[entityType][decodedSlug] : null;
      if (listingFilters && /^\/(colleges|courses|exams)\/[^/]+\/?$/.test(url.pathname)) {
        metadata = await curatedListingMetadata(url, metadata, entityType, listingFilters);
      } else {
        const entity = await fetchPublicEntity(entityType, decodedSlug);
        if (entity) {
          metadata = entityEdgeSeo(entity, url, entityType);
          metadata.initialData = { table: entityType, routeSlug: decodedSlug, row: entity };
        }
        else metadata = { ...metadata, indexable: false, notFound: true };
      }
    }
    let html = applyEdgeSeo(await response.text(), metadata);
    if (url.pathname === "/" || metadata.initialData) html = applyHomeCriticalCssDelivery(html);
    response = new Response(html, {
      status: metadata.notFound ? 404 : response.status,
      statusText: metadata.notFound ? "Not Found" : response.statusText,
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
    let response;
    try {
      const assetRequest = request.method === "HEAD" ? new Request(request.url, { method: "GET", headers: request.headers }) : request;
      response = isApiRequest(url.pathname)
        ? withSecurityHeaders(await proxyToApiWithCache(request, context))
        : await serveAsset(assetRequest, env);
    } catch (error) {
      console.error(JSON.stringify({ event: "candidate_proxy_error", path: url.pathname, message: error instanceof Error ? error.message : String(error) }));
      response = temporarilyUnavailable(request);
    }
    return request.method === "HEAD" ? new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers }) : response;
  },
};
