import { resolveNativeIdentity } from "./auth.mjs";
import { prisma } from "./db.mjs";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

let s3Client;

export function storageConfig() {
  const bucket = String(process.env.AWS_S3_BUCKET || "").trim();
  const region = String(process.env.AWS_REGION || "ap-south-1").trim();
  const mediaBaseUrl = String(process.env.MEDIA_BASE_URL || "").replace(/\/$/, "");
  if (!bucket || !mediaBaseUrl) {
    throw Object.assign(new Error("Object storage is not configured"), { status: 503, code: "STORAGE_NOT_CONFIGURED" });
  }
  s3Client ||= new S3Client({ region });
  return { provider: "s3", bucket, region, mediaBaseUrl, client: s3Client };
}

export function storageObjectKey(bucket, objectPath) {
  return `${String(bucket).replace(/^\/+|\/+$/g, "")}/${String(objectPath).replace(/^\/+/, "")}`;
}

export function publicMediaUrl(bucket, objectPath) {
  const config = storageConfig();
  return `${config.mediaBaseUrl}/${storageObjectKey(bucket, objectPath).split("/").map(encodeURIComponent).join("/")}`;
}

export async function uploadStorageObject(bucket, objectPath, body, contentType, options = {}) {
  const config = storageConfig();
  const key = storageObjectKey(bucket, objectPath);
  if (!options.upsert) {
    try {
      await config.client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
      throw Object.assign(new Error("Object already exists"), { status: 409, code: "STORAGE_OBJECT_EXISTS" });
    } catch (error) {
      if (error?.$metadata?.httpStatusCode !== 404 && error?.name !== "NotFound") throw error;
    }
  }
  await config.client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: options.cacheControl || (String(contentType).startsWith("image/") ? "public,max-age=31536000,immutable" : "public,max-age=3600"),
    ServerSideEncryption: "AES256",
  }));
  return { key: storageObjectKey(bucket, objectPath), publicUrl: publicMediaUrl(bucket, objectPath) };
}

export async function deleteStorageObjectKeys(keys) {
  const normalized = [...new Set((keys || []).map((key) => String(key || "").replace(/^\/+/, "")).filter(Boolean))];
  if (!normalized.length) return;
  const config = storageConfig();
  await config.client.send(new DeleteObjectsCommand({
    Bucket: config.bucket,
    Delete: { Objects: normalized.map((Key) => ({ Key })) },
  }));
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
  if (request.method === "DELETE" && !ownsEveryPath) {
    throw Object.assign(new Error("Only an administrator can permanently delete website files"), { status: 403, code: "ADMIN_REQUIRED" });
  }
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

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function s3Storage(request, route, config) {
  const key = route.objectPath ? storageObjectKey(route.bucket, route.objectPath) : "";
  if (["POST", "PUT"].includes(request.method) && route.modifier === null && route.objectPath) {
    const contentType = String(request.headers.get("content-type") || "application/octet-stream").split(";", 1)[0];
    const result = await uploadStorageObject(route.bucket, route.objectPath, await checkedBody(request), contentType, {
      upsert: request.method === "PUT" || request.headers.get("x-upsert") === "true",
      cacheControl: request.headers.get("cache-control") || undefined,
    });
    return jsonResponse(200, { Key: result.key, key: result.key });
  }
  if (request.method === "POST" && route.modifier === "list") {
    const body = await request.json().catch(() => ({}));
    const prefix = storageObjectKey(route.bucket, String(body.prefix || "").replace(/\/$/, ""));
    const normalizedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
    const response = await config.client.send(new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: normalizedPrefix,
      Delimiter: "/",
      MaxKeys: Math.min(1000, Math.max(1, Number(body.limit || 100))),
    }));
    const files = (response.Contents || []).filter((object) => object.Key !== normalizedPrefix).map((object) => ({
      id: object.ETag?.replaceAll('"', "") || object.Key,
      name: object.Key.slice(normalizedPrefix.length),
      created_at: object.LastModified?.toISOString() || null,
      updated_at: object.LastModified?.toISOString() || null,
      metadata: { size: object.Size || 0, eTag: object.ETag || null },
    }));
    const folders = (response.CommonPrefixes || []).map((item) => ({ name: String(item.Prefix || "").slice(normalizedPrefix.length).replace(/\/$/, ""), id: null, metadata: null }));
    return jsonResponse(200, [...folders, ...files]);
  }
  if (request.method === "DELETE" && route.modifier === null) {
    const body = await request.json().catch(() => ({}));
    const paths = route.objectPath ? [route.objectPath] : Array.isArray(body.prefixes) ? body.prefixes.map(String) : [];
    if (!paths.length) return jsonResponse(400, { message: "At least one object path is required" });
    await config.client.send(new DeleteObjectsCommand({ Bucket: config.bucket, Delete: { Objects: paths.map((path) => ({ Key: storageObjectKey(route.bucket, path) })) } }));
    return jsonResponse(200, paths.map((path) => ({ name: path })));
  }
  if (request.method === "POST" && route.modifier === "sign" && key) {
    const body = await request.json().catch(() => ({}));
    const expiresIn = Math.min(3600, Math.max(60, Number(body.expiresIn || 300)));
    const signedUrl = await getSignedUrl(config.client, new GetObjectCommand({ Bucket: config.bucket, Key: key }), { expiresIn });
    return jsonResponse(200, { signedUrl, signedURL: signedUrl });
  }
  if (["GET", "HEAD"].includes(request.method) && key) {
    const result = await config.client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key, Range: request.headers.get("range") || undefined }));
    const headers = new Headers({
      "content-type": result.ContentType || "application/octet-stream",
      "cache-control": result.CacheControl || "private,max-age=60",
      etag: result.ETag || "",
    });
    if (result.ContentLength !== undefined) headers.set("content-length", String(result.ContentLength));
    if (result.ContentRange) headers.set("content-range", result.ContentRange);
    return new Response(request.method === "HEAD" ? null : result.Body?.transformToWebStream(), { status: result.ContentRange ? 206 : 200, headers });
  }
  return jsonResponse(405, { message: "Storage method is not supported" });
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
  const isPublicRead = ["GET", "HEAD"].includes(request.method) && url.pathname.startsWith("/storage/v1/object/public/");
  if (!isPublicRead) await authorizeStorage(request, route);
  const config = storageConfig();
  return s3Storage(request, route, config);
}

export const storagePolicyInternals = { checkedBody, ownsPath, routeDetails };
