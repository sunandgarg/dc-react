import { resolveNativeIdentity } from "./auth.mjs";
import { prisma } from "./db.mjs";

const DEFAULT_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const USER_DOCUMENT_BUCKET = "user-documents";
const ADMIN_UPLOAD_BUCKET = "admin-uploads";
const userAvatarTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);
const userDocumentTypes = new Set([
  "application/msword",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ...userAvatarTypes,
]);
const allowedUploadTypes = new Set([
  "application/msword",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
  "text/csv",
]);

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
  return identity;
}

async function isAdmin(userId) {
  const rows = await prisma.$queryRawUnsafe("SELECT 1 FROM `user_roles` WHERE `user_id` = ? AND `role` = 'admin' LIMIT 1", userId);
  return rows.length > 0;
}

function routeDetails(pathname) {
  const parts = decodeURIComponent(pathname).split("/").filter(Boolean);
  const modifier = ["public", "list", "sign"].includes(parts[3]) ? parts[3] : null;
  const bucketIndex = modifier ? 4 : 3;
  return {
    modifier,
    bucket: parts[bucketIndex] || "",
    objectPath: parts.slice(bucketIndex + 1).join("/"),
  };
}

function ownsPath(identity, bucket, objectPath) {
  if (bucket === USER_DOCUMENT_BUCKET) return objectPath.startsWith(`${identity.id}/`);
  if (bucket === ADMIN_UPLOAD_BUCKET) return objectPath.startsWith(`user-avatars/${identity.id}/`);
  return false;
}

async function requestedPaths(request, route) {
  if (route.objectPath) return [route.objectPath];
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return [];
  const body = await request.clone().json().catch(() => ({}));
  if (Array.isArray(body.prefixes)) return body.prefixes.map(String);
  if (typeof body.prefix === "string") return [body.prefix];
  return [];
}

async function authorizeStorage(request, route) {
  const identity = await requireUser(request);
  if (await isAdmin(identity.id)) return;

  const paths = await requestedPaths(request, route);
  const ownsEveryPath = paths.length > 0 && paths.every((path) => ownsPath(identity, route.bucket, path));
  const isUpload = ["POST", "PUT"].includes(request.method) && route.modifier === null;
  const contentType = String(request.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  if (route.bucket === USER_DOCUMENT_BUCKET && ownsEveryPath) {
    if (!isUpload || userDocumentTypes.has(contentType)) return;
    throw Object.assign(new Error("This file type is not allowed for user documents"), { status: 415, code: "STORAGE_TYPE_NOT_ALLOWED" });
  }
  if (route.bucket === ADMIN_UPLOAD_BUCKET && route.modifier !== "list" && ownsEveryPath) {
    if (!isUpload || userAvatarTypes.has(contentType)) return;
    throw Object.assign(new Error("Profile photos must use a safe raster image type"), { status: 415, code: "STORAGE_TYPE_NOT_ALLOWED" });
  }

  throw Object.assign(new Error("Administrator access or object ownership is required"), { status: 403, code: "STORAGE_ACCESS_DENIED" });
}

async function checkedBody(request) {
  if (["GET", "HEAD"].includes(request.method)) return undefined;
  const contentTypeHeader = String(request.headers.get("content-type") || "");
  const contentType = contentTypeHeader.split(";", 1)[0].trim().toLowerCase();
  const isObjectUpload = ["POST", "PUT"].includes(request.method) && !contentType.includes("application/json");
  const maxBytes = Number(process.env.STORAGE_MAX_UPLOAD_BYTES || DEFAULT_MAX_UPLOAD_BYTES);
  const declaredBytes = Number(request.headers.get("content-length") || 0);
  const isMultipartUpload = isObjectUpload && contentType === "multipart/form-data";
  if (isObjectUpload && !isMultipartUpload && !allowedUploadTypes.has(contentType)) {
    throw Object.assign(new Error(`File type ${contentType || "unknown"} is not allowed`), { status: 415, code: "STORAGE_TYPE_NOT_ALLOWED" });
  }
  if (declaredBytes > maxBytes) {
    throw Object.assign(new Error(`Uploads cannot exceed ${Math.floor(maxBytes / 1024 / 1024)} MB`), { status: 413, code: "STORAGE_FILE_TOO_LARGE" });
  }
  if (isMultipartUpload) {
    const form = await request.clone().formData().catch(() => null);
    const files = form
      ? [...form.values()].filter((value) => typeof value === "object" && typeof value.arrayBuffer === "function")
      : [];
    if (!files.length || files.some((file) => !allowedUploadTypes.has(String(file.type || "").toLowerCase()))) {
      throw Object.assign(new Error("The multipart upload contains an unsupported file type"), { status: 415, code: "STORAGE_TYPE_NOT_ALLOWED" });
    }
    if (files.some((file) => Number(file.size || 0) > maxBytes)) {
      throw Object.assign(new Error(`Uploads cannot exceed ${Math.floor(maxBytes / 1024 / 1024)} MB`), { status: 413, code: "STORAGE_FILE_TOO_LARGE" });
    }
  }
  const body = Buffer.from(await request.arrayBuffer());
  if (body.byteLength > maxBytes) {
    throw Object.assign(new Error(`Uploads cannot exceed ${Math.floor(maxBytes / 1024 / 1024)} MB`), { status: 413, code: "STORAGE_FILE_TOO_LARGE" });
  }
  return body;
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
    body: await checkedBody(request),
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
  const route = routeDetails(url.pathname);
  const isPublicRead = request.method === "GET" && url.pathname.startsWith("/storage/v1/object/public/");
  if (!isPublicRead) await authorizeStorage(request, route);
  return proxyStorage(request);
}

export const storagePolicyInternals = { checkedBody, ownsPath, routeDetails };
