import { createHash } from "node:crypto";
import { extname } from "node:path";

const ACTIVE_IMAGE_TYPES = new Map([
  ["image/avif", "avif"],
  ["image/gif", "gif"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export function canonicalIdentity(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&amp;/gi, "&")
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#0*34;|&quot;/gi, '"')
    .replace(/&nbsp;/gi, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

export function canonicalSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function exactIdentityMatch(legacy, production) {
  return canonicalIdentity(legacy.name) === canonicalIdentity(production.name)
    && canonicalIdentity(legacy.city) === canonicalIdentity(production.city)
    && canonicalIdentity(legacy.state) === canonicalIdentity(production.state);
}

export function buildProductionIndexes(rows) {
  const bySlug = new Map();
  const byIdentity = new Map();
  for (const row of rows) {
    const slug = canonicalSlug(row.slug);
    const identity = [row.name, row.city, row.state].map(canonicalIdentity).join("|");
    if (slug) bySlug.set(slug, [...(bySlug.get(slug) || []), row]);
    if (!identity.startsWith("||")) byIdentity.set(identity, [...(byIdentity.get(identity) || []), row]);
  }
  return { bySlug, byIdentity };
}

export function findStrictProductionMatch(legacy, indexes) {
  const slugCandidates = indexes.bySlug.get(canonicalSlug(legacy.slug)) || [];
  const exactSlugMatches = slugCandidates.filter((row) => exactIdentityMatch(legacy, row));
  if (exactSlugMatches.length === 1) return { row: exactSlugMatches[0], method: "slug+name+city+state" };
  if (exactSlugMatches.length > 1) return { row: null, reason: "ambiguous-slug-identity" };

  const identity = [legacy.name, legacy.city, legacy.state].map(canonicalIdentity).join("|");
  const identityMatches = indexes.byIdentity.get(identity) || [];
  if (identityMatches.length === 1) return { row: identityMatches[0], method: "name+city+state" };
  if (identityMatches.length > 1) return { row: null, reason: "ambiguous-name-city-state" };
  return { row: null, reason: slugCandidates.length ? "slug-identity-mismatch" : "not-found" };
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function detectRasterImage(buffer, declaredType = "", sourceUrl = "") {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  let contentType = "";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) contentType = "image/jpeg";
  else if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) contentType = "image/png";
  else if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))) contentType = "image/gif";
  else if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") contentType = "image/webp";
  else if (bytes.length >= 12 && bytes.subarray(4, 12).toString("ascii").startsWith("ftyp") && /^(avif|avis)$/.test(bytes.subarray(8, 12).toString("ascii"))) contentType = "image/avif";

  if (!contentType) {
    const normalized = String(declaredType).split(";", 1)[0].trim().toLowerCase();
    if (ACTIVE_IMAGE_TYPES.has(normalized)) contentType = normalized;
  }
  if (!ACTIVE_IMAGE_TYPES.has(contentType)) {
    const hint = extname(new URL(sourceUrl || "https://invalid.local/file").pathname).toLowerCase();
    throw new Error(`Unsupported or invalid raster image (${declaredType || hint || "unknown"})`);
  }
  return { contentType, extension: ACTIVE_IMAGE_TYPES.get(contentType) };
}

export function originalMediaKey(kind, digest, extension) {
  if (!/^[a-f0-9]{64}$/.test(String(digest))) throw new Error("A SHA-256 digest is required");
  if (!new Set(ACTIVE_IMAGE_TYPES.values()).has(extension)) throw new Error(`Unsupported extension: ${extension}`);
  const folder = kind === "hero" ? "college-heroes" : kind === "gallery" ? "college-gallery" : null;
  if (!folder) throw new Error(`Unsupported media kind: ${kind}`);
  return `legacy-public-assets/original/${folder}/${digest.slice(0, 2)}/${digest}.${extension}`;
}

export function sanitizedOriginalMediaKey(kind, digest, extension = "jpg", version = "bottom-12-v2") {
  if (!/^[a-f0-9]{64}$/.test(String(digest))) throw new Error("A SHA-256 digest is required");
  if (!/^[a-z0-9-]+$/.test(String(version))) throw new Error(`Unsupported sanitizer version: ${version}`);
  if (!new Set(ACTIVE_IMAGE_TYPES.values()).has(extension)) throw new Error(`Unsupported extension: ${extension}`);
  const folder = kind === "hero" ? "college-heroes" : kind === "gallery" ? "college-gallery" : null;
  if (!folder) throw new Error(`Unsupported media kind: ${kind}`);
  return `legacy-public-assets/sanitized/${version}/${folder}/${digest.slice(0, 2)}/${digest}.${extension}`;
}

export function bottomCropPlan(width, height, cropBottomPercent = 12) {
  const sourceWidth = Number(width);
  const sourceHeight = Number(height);
  const percent = Number(cropBottomPercent);
  if (!Number.isInteger(sourceWidth) || sourceWidth < 1) throw new Error("A positive integer width is required");
  if (!Number.isInteger(sourceHeight) || sourceHeight < 2) throw new Error("An image height of at least 2px is required");
  if (!Number.isFinite(percent) || percent <= 0 || percent >= 50) throw new Error("Crop percent must be between 0 and 50");
  const croppedPixels = Math.max(1, Math.round(sourceHeight * (percent / 100)));
  const outputHeight = sourceHeight - croppedPixels;
  if (outputHeight < 1) throw new Error("Crop would remove the entire image");
  return {
    left: 0,
    top: 0,
    width: sourceWidth,
    height: outputHeight,
    croppedPixels,
  };
}

export function buildSanitizedCollegeManifestRow(
  row,
  replacementByPublicUrl,
  version = "bottom-12-v2",
  { dropUnavailableGallery = false } = {},
) {
  const replace = (value) => replacementByPublicUrl.get(String(value || "")) || "";
  const hasImage = Object.hasOwn(row?.replacement || {}, "image");
  const hasGallery = Object.hasOwn(row?.replacement || {}, "gallery_images");
  const currentImage = hasImage ? String(row.replacement.image || "").trim() : "";
  const currentGallery = hasGallery && Array.isArray(row.replacement.gallery_images) ? row.replacement.gallery_images : [];
  const image = hasImage ? replace(currentImage) : "";
  const galleryImages = hasGallery ? currentGallery.map(replace) : [];
  const unresolvedHero = hasImage && currentImage && !image ? [{ field: "image", url: currentImage }] : [];
  const unresolvedGallery = hasGallery ? currentGallery.flatMap((url, index) => (
    galleryImages[index] ? [] : [{ field: "gallery_images", index, url }]
  )) : [];
  const unresolved = [...unresolvedHero, ...unresolvedGallery];

  // An unavailable hero is never safe to guess. Gallery slots can be omitted
  // only with the explicit migration flag, preserving every resolved slot in
  // its original order and retaining the full current array for CAS checks.
  if (unresolvedHero.length || (unresolvedGallery.length && !dropUnavailableGallery)) {
    return { row: null, unresolved, droppedGallery: [] };
  }
  const expected = { ...(row.expected || {}) };
  const replacement = { ...(row.replacement || {}) };
  if (hasImage) {
    expected.image = currentImage;
    replacement.image = image;
  }
  if (hasGallery) {
    expected.gallery_images = currentGallery;
    replacement.gallery_images = galleryImages.filter(Boolean);
  }
  return {
    row: {
      ...row,
      expected,
      replacement,
      sanitizer: {
        version,
        source_manifest: "original-college-media",
        dropped_unavailable_gallery_assets: unresolvedGallery.length,
      },
    },
    unresolved: [],
    droppedGallery: unresolvedGallery,
  };
}

export function publicMediaUrl(baseUrl, key) {
  return `${String(baseUrl).replace(/\/$/, "")}/${String(key).split("/").map(encodeURIComponent).join("/")}`;
}

export function buildGalleryReplacement(migratedAssets, currentGallery) {
  const migrated = Array.isArray(migratedAssets) ? migratedAssets : [];
  if (!migrated.length) return { urls: null, fallbackCount: 0, reason: "empty-source-gallery" };

  const resolved = migrated.map((asset) => String(asset?.public_url || "").trim());
  if (resolved.every(Boolean)) return { urls: resolved, fallbackCount: 0, reason: null };

  const current = Array.isArray(currentGallery) ? currentGallery : [];
  if (current.length !== migrated.length) {
    return { urls: null, fallbackCount: 0, reason: "current-gallery-length-mismatch" };
  }

  let fallbackCount = 0;
  const urls = resolved.map((url, index) => {
    if (url) return url;
    fallbackCount += 1;
    return String(current[index] || "").trim();
  });
  if (urls.some((url) => !url)) {
    return { urls: null, fallbackCount: 0, reason: "missing-current-gallery-fallback" };
  }
  return { urls, fallbackCount, reason: null };
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
