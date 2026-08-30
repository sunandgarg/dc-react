import { applyEdgeSeo, edgeSeoFor } from "./edge-seo.js";

const API_ORIGIN = "https://aws-origin.dekhocampus.com";

const API_PREFIXES = [
  "/auth/v1/",
  "/functions/v1/",
  "/rest/v1/",
  "/storage/v1/",
  "/v1/",
];

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
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
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
  if (pathname.startsWith("/storage/v1/object/public/")) return 60 * 60;
  if (pathname === "/v1/functions/bootstrap") return 60;
  if (pathname.startsWith("/v1/rest/")) return 60;
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
    response = new Response(applyEdgeSeo(await response.text(), edgeSeoFor(url)), {
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
