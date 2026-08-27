const DEFAULT_BUCKETS = [
  "admin-uploads",
  "ad-images",
  "legacy-public-assets",
  "study-material",
  "user-documents",
];

function mediaBaseUrl() {
  return String(process.env.MEDIA_BASE_URL || "").replace(/\/$/, "");
}

function knownBuckets() {
  return new Set([
    ...DEFAULT_BUCKETS,
    ...String(process.env.MEDIA_BUCKET_PREFIXES || "").split(",").map((value) => value.trim()).filter(Boolean),
  ]);
}

function mapDeep(value, transform) {
  if (typeof value === "string") return transform(value);
  if (Array.isArray(value)) return value.map((item) => mapDeep(item, transform));
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapDeep(item, transform)]));
  }
  return value;
}

export function toStoredMediaKeys(value) {
  const base = mediaBaseUrl();
  return mapDeep(value, (text) => {
    if (base && text.startsWith(`${base}/`)) return decodeURIComponent(text.slice(base.length + 1));
    try {
      const url = new URL(text);
      const match = decodeURIComponent(url.pathname).match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
      if (match) return `${match[1]}/${match[2]}`;
    } catch { /* ordinary text */ }
    return text;
  });
}

export function toPublicMediaUrls(value) {
  const base = mediaBaseUrl();
  if (!base) return value;
  const buckets = knownBuckets();
  return mapDeep(value, (text) => {
    const [bucket] = text.split("/", 1);
    if (!buckets.has(bucket) || text.includes("://")) return text;
    return `${base}/${text.split("/").map(encodeURIComponent).join("/")}`;
  });
}

export const mediaValueInternals = { knownBuckets, mapDeep };
