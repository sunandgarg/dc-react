const API_ORIGIN = "http://ec2-3-7-27-134.ap-south-1.compute.amazonaws.com";

const API_PREFIXES = [
  "/auth/v1/",
  "/functions/v1/",
  "/rest/v1/",
  "/storage/v1/",
  "/v1/",
];

function isApiRequest(pathname) {
  return pathname === "/health" || API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
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

async function serveAsset(request, env) {
  const url = new URL(request.url);
  let response = await env.ASSETS.fetch(request);

  if (response.status === 404 && request.method === "GET" && request.headers.get("accept")?.includes("text/html")) {
    response = await env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
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
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      return isApiRequest(url.pathname) ? await proxyToApi(request) : await serveAsset(request, env);
    } catch (error) {
      console.error(JSON.stringify({ event: "candidate_proxy_error", path: url.pathname, message: error instanceof Error ? error.message : String(error) }));
      return Response.json({ error: "Candidate service is temporarily unavailable" }, { status: 502 });
    }
  },
};
