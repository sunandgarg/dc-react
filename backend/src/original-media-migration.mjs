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

export function buildCarouselCutoverManifestRow(originalRow, sanitizedRow) {
  const originalId = String(originalRow?.production?.id || "").trim();
  const sanitizedId = String(sanitizedRow?.production?.id || "").trim();
  if (!originalId || originalId !== sanitizedId) {
    throw new Error("Original and sanitized rows must identify the same production college");
  }

  const expected = [];
  if (Object.hasOwn(originalRow?.expected || {}, "image")) {
    const image = String(originalRow.expected.image || "").trim();
    if (image) expected.push(image);
  }
  if (Object.hasOwn(originalRow?.expected || {}, "gallery_images")) {
    if (!Array.isArray(originalRow.expected.gallery_images)) throw new Error("Original gallery_images must be an array");
    expected.push(...originalRow.expected.gallery_images.map((value) => String(value || "").trim()).filter(Boolean));
  }

  const replacement = [];
  if (Object.hasOwn(sanitizedRow?.replacement || {}, "image")) {
    const image = String(sanitizedRow.replacement.image || "").trim();
    if (image) replacement.push(image);
  }
  if (Object.hasOwn(sanitizedRow?.replacement || {}, "gallery_images")) {
    if (!Array.isArray(sanitizedRow.replacement.gallery_images)) throw new Error("Sanitized gallery_images must be an array");
    replacement.push(...sanitizedRow.replacement.gallery_images.map((value) => String(value || "").trim()).filter(Boolean));
  }

  if (!expected.length || !replacement.length) return null;
  return {
    production: { ...(sanitizedRow.production || originalRow.production) },
    expected: { carousel_images: expected },
    replacement: { carousel_images: replacement },
    sanitizer: {
      ...(sanitizedRow.sanitizer || {}),
      source_manifest: "original-and-sanitized-college-media",
      carousel_cutover: true,
    },
  };
}

function canonicalMediaReference(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    const match = decodeURIComponent(url.pathname).match(/^\/storage\/v1\/object\/public\/(.+)$/);
    if (match) return match[1].replace(/^\/+/, "");
  } catch { /* stored object key */ }
  return text.replace(/^\/+/, "");
}

export function buildCurrentCarouselCutoverManifestRow(originalRow, sanitizedRow, currentCollege) {
  const originalId = String(originalRow?.production?.id || "").trim();
  const sanitizedId = String(sanitizedRow?.production?.id || "").trim();
  const currentId = String(currentCollege?.id || "").trim();
  if (!originalId || originalId !== sanitizedId || originalId !== currentId) {
    throw new Error("Original, sanitized, and current rows must identify the same production college");
  }

  const aliasToTarget = new Map();
  const targetByKey = new Map();
  const droppedAliases = new Set();
  const addTarget = (value) => {
    const target = String(value || "").trim();
    const key = canonicalMediaReference(target);
    if (key) targetByKey.set(key, target);
  };
  const addAliases = (target, ...aliases) => {
    addTarget(target);
    for (const alias of aliases) {
      const key = canonicalMediaReference(alias);
      if (key) aliasToTarget.set(key, String(target || "").trim());
    }
  };

  const targetImage = String(sanitizedRow?.replacement?.image || "").trim();
  const sanitizedExpectedImage = String(sanitizedRow?.expected?.image || "").trim();
  const originalImage = String(originalRow?.replacement?.image || "").trim();
  if (targetImage) {
    addAliases(targetImage, sanitizedExpectedImage);
    if (canonicalMediaReference(originalImage) === canonicalMediaReference(sanitizedExpectedImage)) {
      addAliases(targetImage, originalRow?.expected?.image, originalImage);
    }
  }

  const oldGallery = Array.isArray(originalRow?.expected?.gallery_images) ? originalRow.expected.gallery_images : [];
  const originalGallery = Array.isArray(originalRow?.replacement?.gallery_images) ? originalRow.replacement.gallery_images : [];
  const sanitizedExpectedGallery = Array.isArray(sanitizedRow?.expected?.gallery_images) ? sanitizedRow.expected.gallery_images : [];
  const targetGallery = Array.isArray(sanitizedRow?.replacement?.gallery_images) ? sanitizedRow.replacement.gallery_images : [];
  const droppedIndexes = new Set((Array.isArray(sanitizedRow?.failed_assets) ? sanitizedRow.failed_assets : [])
    .filter((asset) => asset?.kind === "gallery" && Number.isInteger(Number(asset.gallery_index)))
    .map((asset) => Number(asset.gallery_index)));
  const targetBySource = new Map();
  const droppedSources = new Set();
  let targetIndex = 0;
  for (let index = 0; index < sanitizedExpectedGallery.length; index += 1) {
    const source = sanitizedExpectedGallery[index];
    const sourceKey = canonicalMediaReference(source);
    if (droppedIndexes.has(index)) {
      if (sourceKey) droppedSources.add(sourceKey);
      if (sourceKey) droppedAliases.add(sourceKey);
      continue;
    }
    const target = String(targetGallery[targetIndex] || "").trim();
    if (!target) throw new Error(`Sanitized gallery mapping is incomplete at source index ${index}`);
    addAliases(target, source);
    if (sourceKey) targetBySource.set(sourceKey, target);
    targetIndex += 1;
  }
  if (targetIndex !== targetGallery.length) {
    throw new Error(`Sanitized gallery mapping has ${targetGallery.length - targetIndex} unpaired targets`);
  }

  // The source and sanitized manifests can be generated at different times.
  // Pair their immutable original S3 keys instead of assuming equal array
  // length or order, then retain the old live URL as an alias for CAS cutover.
  const originalSlots = Math.max(oldGallery.length, originalGallery.length);
  for (let index = 0; index < originalSlots; index += 1) {
    const oldAlias = oldGallery[index];
    const originalSource = originalGallery[index];
    const sourceKey = canonicalMediaReference(originalSource);
    const target = targetBySource.get(sourceKey);
    if (target) {
      addAliases(target, oldAlias, originalSource);
      continue;
    }
    if (droppedSources.has(sourceKey)) {
      for (const alias of [oldAlias, originalSource]) {
        const key = canonicalMediaReference(alias);
        if (key) droppedAliases.add(key);
      }
    }
  }

  const current = Array.isArray(currentCollege?.carousel_images) ? currentCollege.carousel_images : [];
  const replacement = [];
  const unmapped = [];
  let dropped = 0;
  for (const value of current) {
    const key = canonicalMediaReference(value);
    const alreadySanitized = targetByKey.get(key);
    if (alreadySanitized) {
      replacement.push(alreadySanitized);
      continue;
    }
    const target = aliasToTarget.get(key);
    if (target) {
      replacement.push(target);
      continue;
    }
    if (droppedAliases.has(key)) {
      dropped += 1;
      continue;
    }
    unmapped.push(String(value || ""));
  }
  if (unmapped.length) return { row: null, unmapped, dropped };

  return {
    row: {
      production: {
        id: currentCollege.id,
        slug: currentCollege.slug,
        name: currentCollege.name,
        city: currentCollege.city,
        state: currentCollege.state,
      },
      expected: { carousel_images: current },
      replacement: { carousel_images: replacement },
      sanitizer: {
        ...(sanitizedRow.sanitizer || {}),
        source_manifest: "current-original-and-sanitized-college-media",
        carousel_cutover: true,
        preserved_live_carousel_shape: true,
        dropped_unavailable_carousel_assets: dropped,
      },
    },
    unmapped: [],
    dropped,
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
