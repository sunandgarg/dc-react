import { resolveNativeIdentity } from "./auth.mjs";

function storageConfig() {
  const baseUrl = String(process.env.SUPABASE_STORAGE_URL || "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_STORAGE_SERVICE_KEY || "");
  if (!baseUrl || !serviceKey) {
    throw Object.assign(new Error("Supabase Storage is not configured"), { status: 503, code: "STORAGE_NOT_CONFIGURED" });
  }
  return { baseUrl, serviceKey };
}

async function requireUser(request) {
  const identity = await resolveNativeIdentity(request);
  if (!identity) throw Object.assign(new Error("A valid user session is required for uploads"), { status: 401, code: "AUTH_REQUIRED" });
}

async function proxyStorage(request) {
  const { baseUrl, serviceKey } = storageConfig();
  const sourceUrl = new URL(request.url);
  const headers = new Headers();
  for (const name of ["cache-control", "content-type", "range", "x-upsert"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("apikey", serviceKey);
  headers.set("authorization", `Bearer ${serviceKey}`);

  const response = await fetch(`${baseUrl}${sourceUrl.pathname}${sourceUrl.search}`, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : Buffer.from(await request.arrayBuffer()),
  });
  const responseHeaders = new Headers();
  for (const name of ["cache-control", "content-disposition", "content-length", "content-range", "content-type", "etag", "last-modified"]) {
    const value = response.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers: responseHeaders });
}

export async function handleStorage(request) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/storage/v1/")) return null;
  const decodedPath = decodeURIComponent(url.pathname);
  const isObjectRoute = /^\/storage\/v1\/object\/(?:public\/|list\/|sign\/)?[A-Za-z0-9._-]+(?:\/.*)?$/.test(decodedPath);
  if (!isObjectRoute || decodedPath.split("/").includes("..")) {
    throw Object.assign(new Error("Unsupported storage route"), { status: 404, code: "STORAGE_ROUTE_NOT_FOUND" });
  }
  const isPublicRead = request.method === "GET" && url.pathname.startsWith("/storage/v1/object/public/");
  if (!isPublicRead) await requireUser(request);
  return proxyStorage(request);
}
