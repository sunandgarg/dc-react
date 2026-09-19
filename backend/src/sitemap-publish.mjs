import { randomUUID } from "node:crypto";
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "./db.mjs";
import { storageConfig } from "./storage.mjs";
import { queueIndexNowUrls } from "./indexnow.mjs";

const PUBLISH_TARGET = "https://dekhocampus.com";
const SITEMAP_PREFIX = "system-sitemaps";
const BUILD_SEED_PREFIX = `${SITEMAP_PREFIX}/build-seeds`;
const CHUNK_SIZE = 3_000;
const MIN_FILTER_RESULTS = 3;
const GENERATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const DB_QUERY_CONCURRENCY = 2;
const OBJECT_IO_CONCURRENCY = 4;
const NEWS_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const NEWS_SITEMAP_LIMIT = 1_000;
const COLLEGE_FEE_RANGES = [
  "Less than 1 Lakh", "1 - 2 Lakh", "2 - 3 Lakh", "3 - 5 Lakh", "5 - 7 Lakh",
  "7 - 10 Lakh", "15 - 20 Lakh", "20 - 25 Lakh", "Above 25 Lakh",
];
const COLLEGE_EXAMS = [
  "JEE Main", "GATE", "CAT", "NEET", "CMAT", "XAT", "CUET", "MHT CET", "KCET", "CLAT",
  "NATA", "COMEDK UGET", "WBJEE", "JEE Advanced", "BITSAT", "VITEEE", "SRMJEEE", "MAH MBA CET",
  "AP EAMCET", "OJEE", "IPU CET", "NIFT", "NID DAT", "SNAP",
];
const COLLEGE_APPROVALS = ["AICTE", "UGC", "NAAC", "MCI", "BCI", "AACSB", "EQUIS"];
const COLLEGE_NAAC_GRADES = ["A++", "A+", "A", "B++", "B+", "B"];
const COURSE_GROUPS = [
  "B.E. / B.Tech", "B.Sc.", "Ph.D.", "M.Sc.", "MBA/PGDM", "B.A.", "M.E./M.Tech", "UG Diploma",
  "PG Diploma", "M.A.", "Certificate", "M.Tech", "BBA", "B.Com", "B.Tech", "MBA", "MD", "M.Phil",
  "After 10th Diploma", "B.Ed", "B.Sc(Hons.)", "M.Com", "Diploma", "LL.M.", "M.Pharma", "B.A. (Hons)",
  "MS", "B.Des", "BFA", "BCA", "PGDM", "B.Pharma", "LL.B.", "MCA", "Other",
];
const COURSE_GROUPS_BY_CATEGORY = new Map(Object.entries({
  Engineering: ["B.E. / B.Tech", "B.Tech", "M.E./M.Tech", "M.Tech"],
  Science: ["B.Sc.", "M.Sc."],
  Management: ["MBA/PGDM", "MBA", "PGDM", "BBA"],
  Commerce: ["B.Com"],
  Law: ["LL.B."],
  Research: ["Ph.D."],
  "Computer Applications": ["BCA", "MCA"],
  "IT and Software": ["BCA", "MCA"],
}));
const COURSE_SPECIALIZATIONS = [
  "Computer Science", "Mechanical Engineering", "Civil Engineering", "Electrical Engineering",
  "Electronics & Communication Engineering", "Chemical Engineering", "Information Technology", "Biotechnology",
  "Finance", "Marketing", "Human Resources", "Operations", "General Management", "International Business",
  "Business Analytics", "Data Science", "Artificial Intelligence", "Psychology", "Economics", "Political Science",
  "Sociology", "History", "English", "Mathematics", "Physics", "Chemistry", "Biology", "Fashion Design",
  "Interior Design", "Hotel / Hospitality Management", "Journalism", "Photography", "Pharmacy",
  "Nursing & Midwifery", "Public Health & Management",
];
const EXAM_GROUPS = ["B.E. / B.Tech", "MBA/PGDM", "LL.B.", "M.E./M.Tech", "PGPM", "MBA", "MBBS", "MD", "A.M.E."];
const EXAM_GROUPS_BY_CATEGORY = new Map(Object.entries({
  Engineering: ["B.E. / B.Tech", "M.E./M.Tech"],
  Management: ["MBA/PGDM", "PGPM", "MBA"],
  Law: ["LL.B."],
  Medical: ["MBBS", "MD"],
  Aviation: ["A.M.E."],
}));
const COLLEGE_TABS = ["overview", "highlights", "courses", "admissions", "placements", "cutoff", "rankings", "reviews", "infrastructure", "gallery", "scholarships", "hostel", "compare", "faculty", "recruiters", "contact", "news", "faq"];
const COURSE_TABS = ["overview", "highlights", "eligibility", "syllabus", "fees", "admission", "career", "placements", "specializations", "top-exams", "top-colleges", "cutoff", "faq"];
const EXAM_TABS = ["overview", "highlights", "dates", "application", "eligibility", "syllabus", "pattern", "preparation", "admit-card", "answer-key", "results", "counselling", "cutoff", "colleges", "faq"];
const EXAM_STRATEGIES = [
  "sample-paper", "tips-and-tricks", "last-1-month-preparation-strategy", "15-days-preparation-strategy",
  "7-days-preparation-strategy", "3-days-preparation-strategy", "2-days-preparation-strategy", "1-day-preparation-strategy",
  "18-hours-preparation-strategy", "12-hours-preparation-strategy", "8-hours-preparation-strategy", "6-hours-preparation-strategy",
  "3-hours-preparation-strategy", "1-hour-preparation-strategy", "30-minute-preparation-tips", "15-minute-preparation-tips",
  "10-minute-preparation-tips", "5-minute-preparation-tips", "last-2-minute-preparation-tips",
];
const REBUILT_ROOTS = [
  "/colleges/", "/courses/", "/exams/", "/news/", "/careers/", "/scholarships/", "/landing/",
  "/cat-universe/", "/premium-programs/", "/jobs/", "/vacancies/", "/author/", "/legal/",
  "/study-material/", "/college-study-material/",
];
const CAT_EXPERIENCE_ENTRIES = [
  { path: "/cat-universe/cat-2026-preparation-kit", changefreq: "weekly", priority: "0.86" },
  { path: "/cat-universe/ai-interview-practice", changefreq: "weekly", priority: "0.82" },
  { path: "/cat-universe/ai-coach", changefreq: "weekly", priority: "0.82" },
];
const CURATED_DISCOVERY_ENTRIES = [
  "/colleges/top-engineering-colleges-in-india",
  "/colleges/top-btech-colleges-in-india",
  "/colleges/top-engineering-colleges-in-delhi-ncr",
  "/colleges/top-engineering-colleges-in-bangalore",
  "/colleges/top-engineering-colleges-in-pune",
  "/colleges/top-engineering-colleges-in-hyderabad",
  "/colleges/top-management-colleges-in-india",
  "/colleges/top-mba-colleges-in-india",
  "/colleges/top-bba-colleges-in-india",
  "/colleges/top-mba-colleges-in-delhi-ncr",
  "/colleges/top-mba-colleges-in-mumbai",
  "/colleges/top-mba-colleges-in-bangalore",
  "/colleges/top-medical-colleges-in-india",
  "/colleges/top-mbbs-colleges-in-india",
  "/colleges/top-medical-colleges-in-karnataka",
  "/colleges/top-law-colleges-in-india",
  "/colleges/top-llb-colleges-in-india",
  "/colleges/top-pharmacy-colleges-in-india",
  "/courses/top-btech-courses-in-india",
  "/courses/top-mba-courses-in-india",
  "/courses/top-bca-courses-in-india",
  "/courses/top-mca-courses-in-india",
  "/courses/top-online-courses-in-india",
  "/courses/top-distance-courses-in-india",
  "/exams/top-engineering-entrance-exams-in-india",
  "/exams/top-medical-entrance-exams-in-india",
  "/exams/top-management-entrance-exams-in-india",
  "/exams/top-law-entrance-exams-in-india",
  "/exams/top-national-entrance-exams-in-india",
  "/exams/top-state-entrance-exams-in-india",
].map((path) => ({ path, changefreq: "weekly", priority: "0.72" }));

async function boundedMap(values, concurrency, mapper) {
  const output = new Array(values.length);
  let cursor = 0;
  let terminalError;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), values.length) }, async () => {
    while (!terminalError) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      try {
        output[index] = await mapper(values[index], index);
      } catch (error) {
        terminalError = error;
      }
    }
  });
  await Promise.all(workers);
  if (terminalError) throw terminalError;
  return output;
}

function publishError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function decodeXml(value) {
  return String(value).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function dateOnly(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

function tagSlug(value) {
  const tag = String(value || "").trim();
  if (!tag || tag.length > 80 || /(?:https?:\/\/|\/storage\/|@)/i.test(tag)) return null;
  const slug = tag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug && slug.length <= 80 ? slug : null;
}

function canonicalPath(value) {
  try {
    const url = new URL(decodeXml(value), PUBLISH_TARGET);
    if (!/(^|\.)dekhocampus\.com$/i.test(url.hostname)) return null;
    return `${url.pathname || "/"}${url.search}`;
  } catch {
    return null;
  }
}

function jsonValues(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(jsonValues);
  if (typeof value === "object") {
    const preferredKeys = ["url", "src", "image", "image_url", "imageUrl", "path", "publicUrl"];
    const preferred = preferredKeys.flatMap((key) => jsonValues(value[key]));
    return preferred.length ? preferred : Object.values(value).flatMap(jsonValues);
  }
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (/^[\[{]/.test(trimmed)) {
    try { return jsonValues(JSON.parse(trimmed)); } catch { /* use the raw value */ }
  }
  return [trimmed];
}

function facetValues(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(facetValues);
  if (typeof value === "object") return Object.values(value).flatMap(facetValues);
  const trimmed = String(value).trim();
  if (!trimmed) return [];
  if (/^[\[{]/.test(trimmed)) {
    try { return facetValues(JSON.parse(trimmed)); } catch { /* use the raw value */ }
  }
  return [trimmed];
}

function embeddedImageValues(value) {
  if (typeof value !== "string" || !value.trim()) return [];
  return [
    ...[...value.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]),
    ...[...value.matchAll(/!\[[^\]]*\]\(([^\s)]+)(?:\s+["'][^"']*["'])?\)/g)].map((match) => match[1]),
  ];
}

function canonicalImageLocation(value) {
  try {
    const url = new URL(value, PUBLISH_TARGET);
    if (!/^https?:$/.test(url.protocol) || !/\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(url.pathname)) return null;
    if (/^\/storage\/v1\/object\/public\//.test(url.pathname)) return `${PUBLISH_TARGET}${url.pathname}${url.search}`;
    if (!value.includes("://") && !value.startsWith("/")) {
      return `${PUBLISH_TARGET}/storage/v1/object/public/${url.pathname.replace(/^\/+/, "")}${url.search}`;
    }
    return url.href;
  } catch {
    return null;
  }
}

function imageLocations(row, fields) {
  const seen = new Set();
  return fields.flatMap((field) => [
    ...jsonValues(row?.[field]),
    ...embeddedImageValues(row?.[field]),
  ]).flatMap((value) => {
    const location = canonicalImageLocation(value);
    if (!location || seen.has(location)) return [];
    seen.add(location);
    return [location];
  });
}

function sitemapXml(entries) {
  const hasImages = entries.some((entry) => entry.images?.length);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${hasImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ""}>`,
    ...entries.map((entry) => [
      "  <url>",
      `    <loc>${escapeXml(`${PUBLISH_TARGET}${entry.path}`)}</loc>`,
      entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
      ...(entry.images || []).map((location) => `    <image:image><image:loc>${escapeXml(location)}</image:loc></image:image>`),
      "  </url>",
    ].filter(Boolean).join("\n")),
    "</urlset>",
  ].join("\n");
}

function newsSitemapEntries(articles, now = Date.now()) {
  const cutoff = now - NEWS_WINDOW_MS;
  return articles
    .flatMap((article) => {
      const publishedAt = new Date(article.created_at || article.updated_at || 0);
      const title = String(article.title || "").trim();
      if (!article.slug || !title || Number.isNaN(publishedAt.getTime()) || publishedAt.getTime() < cutoff) return [];
      return [{ path: `/news/${article.slug}`, title, publicationDate: publishedAt.toISOString() }];
    })
    .sort((left, right) => right.publicationDate.localeCompare(left.publicationDate))
    .slice(0, NEWS_SITEMAP_LIMIT);
}

function newsSitemapXml(entries) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    ...entries.map((entry) => [
      "  <url>",
      `    <loc>${escapeXml(`${PUBLISH_TARGET}${entry.path}`)}</loc>`,
      "    <news:news>",
      "      <news:publication>",
      "        <news:name>DekhoCampus</news:name>",
      "        <news:language>en</news:language>",
      "      </news:publication>",
      `      <news:publication_date>${escapeXml(entry.publicationDate)}</news:publication_date>`,
      `      <news:title>${escapeXml(entry.title)}</news:title>`,
      "    </news:news>",
      "  </url>",
    ].join("\n")),
    "</urlset>",
  ].join("\n");
}

function sitemapIndex(generation, count) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <sitemap><loc>${PUBLISH_TARGET}/news-sitemap.xml</loc></sitemap>`,
    ...Array.from({ length: count }, (_, index) => `  <sitemap><loc>${PUBLISH_TARGET}/sitemap-files/${generation}/sitemap-${index + 1}.xml</loc></sitemap>`),
    "</sitemapindex>",
  ].join("\n");
}

function isFilterLanding(path) {
  return /^\/(?:colleges|courses|exams)\?/.test(path || "");
}

function mergeEntries(seed, dynamic) {
  const entries = new Map();
  for (const entry of seed) {
    // Filter pages are rebuilt from live MySQL records below. Keeping static
    // permutations here would reintroduce empty or near-duplicate crawl pages.
    if (entry.path && !isFilterLanding(entry.path)) entries.set(entry.path, entry);
  }
  for (const entry of dynamic) {
    if (!entry.path) continue;
    const current = entries.get(entry.path);
    if (!current) {
      entries.set(entry.path, entry);
      continue;
    }
    entries.set(entry.path, {
      ...current,
      ...entry,
      lastmod: [current.lastmod, entry.lastmod].filter(Boolean).sort().at(-1),
      images: [...new Set([...(current.images || []), ...(entry.images || [])])].slice(0, 1_000),
    });
  }
  return [...entries.values()];
}

function objectRepository() {
  const config = storageConfig();
  if (config.provider !== "s3") throw publishError(503, "SITEMAP_STORAGE_NOT_CONFIGURED", "AWS S3 sitemap storage is not configured");
  return {
    async get(key) {
      try {
        const result = await config.client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
        return { body: await result.Body.transformToString(), contentType: result.ContentType, cacheControl: result.CacheControl, etag: result.ETag };
      } catch (error) {
        if (error?.$metadata?.httpStatusCode === 404 || ["NoSuchKey", "NotFound"].includes(error?.name)) return null;
        throw error;
      }
    },
    async put(key, body, contentType = "application/xml; charset=utf-8") {
      await config.client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public,max-age=300,must-revalidate",
        ServerSideEncryption: "AES256",
      }));
    },
    async list(prefix) {
      const objects = [];
      let continuationToken;
      do {
        const result = await config.client.send(new ListObjectsV2Command({ Bucket: config.bucket, Prefix: prefix, ContinuationToken: continuationToken }));
        objects.push(...(result.Contents || []).map((item) => ({ key: item.Key, lastModified: item.LastModified })));
        continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
      } while (continuationToken);
      return objects;
    },
    async delete(keys) {
      if (!keys.length) return;
      for (let index = 0; index < keys.length; index += 1000) {
        await config.client.send(new DeleteObjectsCommand({ Bucket: config.bucket, Delete: { Objects: keys.slice(index, index + 1000).map((Key) => ({ Key })) } }));
      }
    },
  };
}

function publicKey(pathname) {
  if (/^\/(?:news-sitemap|sitemap(?:-index|-\d+)?)\.xml$/.test(pathname)) return `${SITEMAP_PREFIX}/public/${pathname.slice(1)}`;
  const generationMatch = pathname.match(/^\/sitemap-files\/([a-f0-9-]{36})\/(sitemap-\d+\.xml)$/);
  return generationMatch ? `${SITEMAP_PREFIX}/generations/${generationMatch[1]}/${generationMatch[2]}` : null;
}

export async function readPublishedSitemap(request, options = {}) {
  if (!["GET", "HEAD"].includes(request.method)) return null;
  const key = publicKey(new URL(request.url).pathname);
  if (!key) return null;
  const repository = options.repository || objectRepository();
  let object = await repository.get(key);
  if (!object && key.startsWith(`${SITEMAP_PREFIX}/generations/`)) {
    const filename = key.split("/").at(-1);
    const root = await repository.get(`${SITEMAP_PREFIX}/public/sitemap.xml`);
    const currentPath = root?.body.match(new RegExp(`<loc>[^<]*/sitemap-files/[a-f0-9-]{36}/(${filename.replace(".", "\\.")})</loc>`, "i"))?.[0]
      ?.match(/<loc>([^<]+)<\/loc>/i)?.[1];
    const currentKey = currentPath ? publicKey(new URL(currentPath, PUBLISH_TARGET).pathname) : null;
    if (currentKey) object = await repository.get(currentKey);
  }
  if (!object) return new Response("Sitemap not generated", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(request.method === "HEAD" ? null : object.body, {
    status: 200,
    headers: {
      "content-type": object.contentType || "application/xml; charset=utf-8",
      "cache-control": object.cacheControl || "public,max-age=300,must-revalidate",
      ...(object.etag ? { etag: object.etag } : {}),
    },
  });
}

function keyForPublicPath(pathname) {
  return publicKey(pathname) || `${SITEMAP_PREFIX}/public/${pathname.replace(/^\//, "")}`;
}

async function currentSeedEntries(repository, buildSeedSha) {
  const requestedSeed = String(buildSeedSha || "").trim();
  if (requestedSeed && !/^[0-9a-f]{40}$/.test(requestedSeed)) {
    throw publishError(400, "INVALID_SITEMAP_SEED", "The build sitemap seed must be identified by a full commit SHA");
  }
  const seedPrefix = requestedSeed ? `${BUILD_SEED_PREFIX}/${requestedSeed}` : `${SITEMAP_PREFIX}/public`;
  const root = await repository.get(`${seedPrefix}/sitemap.xml`);
  if (!root) throw publishError(503, "SITEMAP_SEED_MISSING", "The deployed sitemap seed is missing from AWS S3");
  const documents = [];
  if (/<sitemapindex\b/i.test(root.body)) {
    const locations = [...root.body.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => canonicalPath(match[1]));
    if (!locations.length || locations.some((location) => !location)) {
      throw publishError(503, "SITEMAP_SEED_INCOMPLETE", "The deployed sitemap seed index is empty or invalid");
    }
    const loaded = await boundedMap(locations, OBJECT_IO_CONCURRENCY, async (location) => {
      const pathname = new URL(location, PUBLISH_TARGET).pathname;
      const filename = pathname.split("/").at(-1);
      if (requestedSeed && !/^(?:news-sitemap|sitemap-\d+)\.xml$/.test(filename || "")) {
        throw publishError(503, "SITEMAP_SEED_INCOMPLETE", "The immutable build seed references an invalid child sitemap");
      }
      const key = requestedSeed ? `${seedPrefix}/${filename}` : keyForPublicPath(pathname);
      const object = await repository.get(key);
      if (!object) throw publishError(503, "SITEMAP_SEED_INCOMPLETE", `The deployed sitemap seed is missing ${filename || "a child sitemap"}`);
      return object.body;
    });
    documents.push(...loaded);
  } else {
    documents.push(root.body);
  }
  const entries = [];
  for (const xml of documents) {
    for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
      const location = match[1].match(/<loc>([\s\S]*?)<\/loc>/i)?.[1];
      const path = location ? canonicalPath(location) : null;
      if (!path) continue;
      entries.push({
        path,
        lastmod: match[1].match(/<lastmod>([\s\S]*?)<\/lastmod>/i)?.[1]?.slice(0, 10),
        changefreq: match[1].match(/<changefreq>([\s\S]*?)<\/changefreq>/i)?.[1] || "weekly",
        priority: match[1].match(/<priority>([\s\S]*?)<\/priority>/i)?.[1] || "0.6",
        images: [...match[1].matchAll(/<image:loc>([\s\S]*?)<\/image:loc>/gi)].map((image) => decodeXml(image[1].trim())),
      });
    }
  }
  return entries.filter((entry) => !REBUILT_ROOTS.some((rootPath) => entry.path.startsWith(rootPath)));
}

async function rows(prismaClient, table, columns, requireSlug = true, extraWhere = "") {
  return prismaClient.$queryRawUnsafe(`SELECT ${columns.map((column) => `\`${column}\``).join(",")} FROM \`${table}\` WHERE \`is_active\` = 1${requireSlug ? " AND `slug` IS NOT NULL" : ""}${extraWhere}`);
}

function canonicalEntity(prefix, row, priority, imageFields = [], tabs = []) {
  const suffix = row.short_id ? `${row.slug}-${row.short_id}` : row.slug;
  const base = `${prefix}/${suffix}`;
  const common = { lastmod: dateOnly(row.updated_at), changefreq: "weekly" };
  const images = imageLocations(row, imageFields);
  return [
    { path: base, ...common, priority, images },
    ...tabs.map((tab) => ({ path: `${base}/${tab}`, ...common, priority: String(Math.max(0.1, Number(priority) - 0.12)) })),
  ];
}

function simpleEntities(prefix, sourceRows, priority, imageFields = []) {
  return sourceRows.map((row) => ({ path: `${prefix}/${row.slug}`, lastmod: dateOnly(row.updated_at), changefreq: "weekly", priority, images: imageLocations(row, imageFields) }));
}

function filteredPath(base, values) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (String(value || "").trim()) query.set(key, String(value).trim());
  return `${base}?${query}`;
}

function facetKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function exactFacetKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s./_-]+/g, "");
}

function allowedFacetValues(value, allowed) {
  const canonical = new Map(allowed.map((item) => [exactFacetKey(item), item]));
  return [...new Set(facetValues(value).map((item) => canonical.get(exactFacetKey(item))).filter(Boolean))];
}

function feeBoundsInLakhs(value) {
  const text = String(value ?? "");
  const fallbackUnit = /crore|\bcr\b/i.test(text) ? "crore" : /lakh|lac/i.test(text) ? "lakh" : "";
  const amounts = [...text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(crore|cr|lakh|lakhs|lac|lacs)?/gi)]
    .map((match) => {
      const amount = Number(match[1].replace(/,/g, ""));
      const unit = (match[2] || fallbackUnit).toLowerCase();
      if (!Number.isFinite(amount)) return Number.NaN;
      if (unit === "crore" || unit === "cr") return amount * 100;
      if (unit.startsWith("la")) return amount;
      return amount >= 1_000 ? amount / 100_000 : amount;
    })
    .filter(Number.isFinite);
  return amounts.length ? { min: Math.min(...amounts), max: Math.max(...amounts) } : null;
}

function matchingFeeRanges(value) {
  const bounds = feeBoundsInLakhs(value);
  if (!bounds) return [];
  return COLLEGE_FEE_RANGES.filter((range) => {
    if (range === "Less than 1 Lakh") return bounds.min < 1;
    if (range === "Above 25 Lakh") return bounds.max > 25;
    const [low, high] = range.match(/[0-9]+/g)?.map(Number) ?? [];
    return Number.isFinite(low) && Number.isFinite(high) && bounds.max >= low && bounds.min <= high;
  });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchingNamedFacets(values, allowed) {
  const candidates = facetValues(values);
  return allowed.filter((value) => {
    const needle = facetKey(value);
    const tokens = String(value).toLowerCase().match(/[a-z0-9]+/g) || [];
    if (needle.length < 3 || tokens.length === 0) return false;
    const phrase = new RegExp(`(?:^|[^a-z0-9])${tokens.map(escapeRegex).join("[^a-z0-9]*")}(?:$|[^a-z0-9])`, "i");
    return candidates.some((candidate) => facetKey(candidate) === needle || phrase.test(String(candidate)));
  });
}

function filterEntries(colleges, courses, exams, courseFees) {
  const buckets = new Map();
  const add = (path, identity, updatedAt, priority = "0.58") => {
    if (!path || !identity) return;
    const bucket = buckets.get(path) || { identities: new Set(), lastmod: undefined, priority };
    bucket.identities.add(String(identity));
    const changed = dateOnly(updatedAt);
    if (changed && (!bucket.lastmod || changed > bucket.lastmod)) bucket.lastmod = changed;
    buckets.set(path, bucket);
  };
  const groupsByCollege = new Map();
  const groupsByCourse = new Map();
  const specializationsByCourse = new Map();
  for (const row of courseFees) {
    const group = allowedFacetValues(row.course_group, COURSE_GROUPS)[0] || "";
    const collegeSlug = String(row.college_slug || "").trim();
    const courseSlug = String(row.course_slug || "").trim();
    const specialization = String(row.specialization || "").trim();
    if (group && collegeSlug) {
      const groups = groupsByCollege.get(collegeSlug) || new Set();
      groups.add(group);
      groupsByCollege.set(collegeSlug, groups);
    }
    if (group && courseSlug) {
      const groups = groupsByCourse.get(courseSlug) || new Set();
      groups.add(group);
      groupsByCourse.set(courseSlug, groups);
    }
    if (specialization && courseSlug) {
      const specializations = specializationsByCourse.get(courseSlug) || new Set();
      specializations.add(specialization);
      specializationsByCourse.set(courseSlug, specializations);
    }
  }
  for (const row of colleges) {
    const state = String(row.state || "").trim();
    const city = String(row.city || "").trim();
    const stream = String(row.category || "").trim();
    const type = String(row.type || "").trim();
    const id = row.slug;
    if (state) add(filteredPath("/colleges", { state }), id, row.updated_at);
    if (city) add(filteredPath("/colleges", { ...(state ? { state } : {}), city }), id, row.updated_at);
    if (stream) add(filteredPath("/colleges", { stream }), id, row.updated_at);
    if (type) add(filteredPath("/colleges", { type }), id, row.updated_at);
    for (const approval of allowedFacetValues(row.approvals, COLLEGE_APPROVALS)) add(filteredPath("/colleges", { approval }), id, row.updated_at);
    const naac = allowedFacetValues(row.naac_grade, COLLEGE_NAAC_GRADES)[0] || "";
    if (naac) add(filteredPath("/colleges", { naac }), id, row.updated_at);
    for (const fee of matchingFeeRanges(row.fees)) add(filteredPath("/colleges", { fee }), id, row.updated_at);
    for (const exam of matchingNamedFacets([row.name, row.category, ...facetValues(row.tags)], COLLEGE_EXAMS)) add(filteredPath("/colleges", { exam }), id, row.updated_at);
    if (stream && state) add(filteredPath("/colleges", { stream, state }), id, row.updated_at, "0.62");
    if (stream && city) add(filteredPath("/colleges", { stream, ...(state ? { state } : {}), city }), id, row.updated_at, "0.64");
    if (type && state) add(filteredPath("/colleges", { type, state }), id, row.updated_at, "0.6");
    if (type && city) add(filteredPath("/colleges", { type, ...(state ? { state } : {}), city }), id, row.updated_at, "0.62");
    for (const group of groupsByCollege.get(row.slug) || []) {
      add(filteredPath("/colleges", { group }), id, row.updated_at, "0.6");
      if (state) add(filteredPath("/colleges", { group, state }), id, row.updated_at, "0.64");
      if (city) add(filteredPath("/colleges", { group, ...(state ? { state } : {}), city }), id, row.updated_at, "0.66");
      if (type && state) add(filteredPath("/colleges", { group, type, state }), id, row.updated_at, "0.63");
    }
  }
  for (const row of courses) {
    const stream = String(row.category || "").trim();
    const mode = String(row.mode || "").trim();
    const duration = String(row.duration || "").trim();
    if (stream) add(filteredPath("/courses", { stream }), row.slug, row.updated_at);
    if (mode) add(filteredPath("/courses", { mode }), row.slug, row.updated_at);
    if (duration) add(filteredPath("/courses", { duration }), row.slug, row.updated_at);
    if (stream && mode) add(filteredPath("/courses", { stream, mode }), row.slug, row.updated_at, "0.6");
    const groups = new Set([
      ...(groupsByCourse.get(row.slug) || []),
      ...(COURSE_GROUPS_BY_CATEGORY.get(stream) || []),
      ...matchingNamedFacets([row.name, row.full_name], COURSE_GROUPS),
    ]);
    for (const group of groups) {
      add(filteredPath("/courses", { group }), row.slug, row.updated_at, "0.6");
      if (mode) add(filteredPath("/courses", { group, mode }), row.slug, row.updated_at, "0.59");
    }
    const specializations = new Set([
      ...allowedFacetValues(row.specializations, COURSE_SPECIALIZATIONS),
      ...allowedFacetValues([...(specializationsByCourse.get(row.slug) || [])], COURSE_SPECIALIZATIONS),
    ]);
    for (const specialization of specializations) add(filteredPath("/courses", { specialization }), row.slug, row.updated_at);
  }
  for (const row of exams) {
    const stream = String(row.category || "").trim();
    const category = String(row.exam_type || "").trim();
    const level = String(row.level || "").trim();
    if (stream) add(filteredPath("/exams", { stream }), row.slug, row.updated_at);
    if (category) add(filteredPath("/exams", { category }), row.slug, row.updated_at);
    if (level) add(filteredPath("/exams", { level }), row.slug, row.updated_at);
    if (stream && level) add(filteredPath("/exams", { stream, level }), row.slug, row.updated_at, "0.6");
    if (category && stream) add(filteredPath("/exams", { category, stream }), row.slug, row.updated_at, "0.6");
    const groups = new Set([
      ...allowedFacetValues(row.categories, EXAM_GROUPS),
      ...(EXAM_GROUPS_BY_CATEGORY.get(stream) || []),
    ]);
    for (const group of groups) add(filteredPath("/exams", { group }), row.slug, row.updated_at, "0.59");
  }
  return [...buckets.entries()]
    .filter(([, bucket]) => bucket.identities.size >= MIN_FILTER_RESULTS)
    .map(([path, bucket]) => ({ path, lastmod: bucket.lastmod, changefreq: "weekly", priority: bucket.priority }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

async function dynamicEntries(prismaClient, now = Date.now()) {
  const queryLoaders = [
    () => rows(prismaClient, "colleges", ["slug", "short_id", "updated_at", "name", "state", "city", "type", "category", "fees", "tags", "approvals", "naac_grade", "image", "logo", "carousel_images", "gallery_images"]),
    () => rows(prismaClient, "courses", ["slug", "short_id", "updated_at", "name", "full_name", "category", "mode", "duration", "specializations", "image"]),
    () => rows(prismaClient, "exams", ["slug", "short_id", "updated_at", "category", "exam_type", "level", "categories", "image", "logo"]),
    () => rows(prismaClient, "articles", ["slug", "title", "created_at", "updated_at", "tags", "featured_image", "content"], true, " AND LOWER(TRIM(`status`)) = 'published' AND `site_scope` = 'dekhocampus'"),
    () => rows(prismaClient, "career_profiles", ["slug", "updated_at", "image"]),
    () => rows(prismaClient, "scholarships", ["slug", "updated_at", "image"]),
    () => rows(prismaClient, "landing_pages", ["slug", "updated_at", "logo_url", "og_image"]),
    () => rows(prismaClient, "cat_universe_modules", ["slug", "updated_at"]),
    () => rows(prismaClient, "promoted_programs", ["slug", "updated_at", "image_url", "hero_image", "certificate_image", "degree_image", "institute_logo"]),
    () => rows(prismaClient, "jobs", ["slug", "updated_at", "company_logo"]),
    () => rows(prismaClient, "authors", ["slug", "updated_at", "photo"]),
    () => rows(prismaClient, "legal_pages", ["slug", "updated_at"]),
    () => rows(prismaClient, "study_subjects", ["id", "slug", "class_num", "board_slug", "updated_at"]),
    () => rows(prismaClient, "study_chapters", ["slug", "subject_id", "updated_at"]),
    () => rows(prismaClient, "college_programs", ["slug", "updated_at"]),
    () => rows(prismaClient, "college_universities", ["slug", "program_slug", "updated_at"]),
    () => rows(prismaClient, "college_semesters", ["semester_num", "program_slug", "university_slug", "updated_at"], false),
    () => rows(prismaClient, "college_subjects", ["slug", "semester_num", "program_slug", "university_slug", "updated_at"]),
    () => prismaClient.$queryRawUnsafe("SELECT `college_slug`,`course_slug`,`course_group`,`specialization` FROM `course_fees` WHERE (`course_group` IS NOT NULL AND TRIM(`course_group`) <> '') OR (`specialization` IS NOT NULL AND TRIM(`specialization`) <> '')"),
  ];
  const [colleges, courses, exams, articles, careers, scholarships, landing, catModules, programs, jobs, authors, legal, subjects, chapters, collegePrograms, universities, semesters, collegeSubjects, courseFees] = await boundedMap(
    queryLoaders,
    DB_QUERY_CONCURRENCY,
    (load) => load(),
  );
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const classBoards = new Map();
  for (const subject of subjects) classBoards.set(`${subject.class_num}/${subject.board_slug}`, { path: `/study-material/class-${subject.class_num}/${subject.board_slug}`, lastmod: dateOnly(subject.updated_at), changefreq: "weekly", priority: "0.62" });
  const tags = new Set();
  for (const article of articles) {
    const values = Array.isArray(article.tags) ? article.tags : (() => { try { return JSON.parse(article.tags || "[]"); } catch { return []; } })();
    for (const tag of values) {
      const slug = tagSlug(tag);
      if (slug) tags.add(slug);
    }
  }
  const entries = [
    ...colleges.flatMap((row) => canonicalEntity("/colleges", row, "0.88", ["image", "logo", "carousel_images", "gallery_images"], COLLEGE_TABS)),
    ...courses.flatMap((row) => canonicalEntity("/courses", row, "0.85", ["image"], COURSE_TABS)),
    ...exams.flatMap((row) => [
      ...canonicalEntity("/exams", row, "0.85", ["image", "logo"], EXAM_TABS),
      ...EXAM_STRATEGIES.map((strategy) => ({
        path: `${canonicalEntity("/exams", row, "0.85")[0].path}/${strategy}`,
        lastmod: dateOnly(row.updated_at),
        changefreq: "weekly",
        priority: "0.64",
      })),
    ]),
    ...simpleEntities("/news", articles, "0.7", ["featured_image", "content"]),
    ...[...tags].map((tag) => ({ path: `/news/tag/${encodeURIComponent(tag)}`, changefreq: "daily", priority: "0.62" })),
    ...simpleEntities("/careers", careers, "0.72", ["image"]),
    ...simpleEntities("/scholarships", scholarships, "0.72", ["image"]),
    ...simpleEntities("/landing", landing, "0.65", ["logo_url", "og_image"]),
    ...CAT_EXPERIENCE_ENTRIES,
    ...CURATED_DISCOVERY_ENTRIES,
    ...simpleEntities("/cat-universe", catModules, "0.75"),
    ...simpleEntities("/premium-programs", programs, "0.86", ["image_url", "hero_image", "certificate_image", "degree_image", "institute_logo"]),
    ...simpleEntities("/jobs", jobs, "0.75", ["company_logo"]),
    ...simpleEntities("/vacancies", jobs, "0.72", ["company_logo"]),
    ...simpleEntities("/author", authors, "0.58", ["photo"]),
    ...simpleEntities("/legal", legal, "0.45"),
    ...classBoards.values(),
    ...subjects.map((row) => ({ path: `/study-material/class-${row.class_num}/${row.board_slug}/${row.slug}`, lastmod: dateOnly(row.updated_at), changefreq: "weekly", priority: "0.58" })),
    ...chapters.flatMap((row) => { const subject = subjectById.get(row.subject_id); return subject ? [{ path: `/study-material/class-${subject.class_num}/${subject.board_slug}/${subject.slug}/${row.slug}`, lastmod: dateOnly(row.updated_at), changefreq: "weekly", priority: "0.55" }] : []; }),
    ...simpleEntities("/college-study-material", collegePrograms, "0.62"),
    ...universities.map((row) => ({ path: `/college-study-material/${row.program_slug}/${row.slug}`, lastmod: dateOnly(row.updated_at), changefreq: "weekly", priority: "0.58" })),
    ...semesters.map((row) => ({ path: `/college-study-material/${row.program_slug}/${row.university_slug}/semester-${row.semester_num}`, lastmod: dateOnly(row.updated_at), changefreq: "weekly", priority: "0.55" })),
    ...collegeSubjects.map((row) => ({ path: `/college-study-material/${row.program_slug}/${row.university_slug}/semester-${row.semester_num}/${row.slug}`, lastmod: dateOnly(row.updated_at), changefreq: "weekly", priority: "0.52" })),
    ...filterEntries(colleges, courses, exams, courseFees),
  ];
  return {
    entries,
    newsEntries: newsSitemapEntries(articles, now),
    sourceCounts: {
      colleges: colleges.length,
      courses: courses.length,
      exams: exams.length,
      articles: articles.length,
    },
  };
}

let publishing = false;
export async function publishSitemap(request, options = {}) {
  if (request.method !== "POST") throw publishError(405, "METHOD_NOT_ALLOWED", "Sitemap publishing requires POST");
  if (publishing && !options.allowConcurrent) throw publishError(409, "SITEMAP_PUBLISH_IN_PROGRESS", "A sitemap generation is already running");
  const body = await request.json().catch(() => ({}));
  if (body.target && body.target !== PUBLISH_TARGET) throw publishError(400, "INVALID_SITEMAP_TARGET", `Sitemaps can only be published for ${PUBLISH_TARGET}`);
  const prismaClient = options.prismaClient || prisma;
  const repository = options.repository || objectRepository();
  publishing = true;
  try {
    const now = options.now || Date.now();
    const [seed, dynamicResult] = await Promise.all([currentSeedEntries(repository, body.build_seed_sha), dynamicEntries(prismaClient, now)]);
    const counts = dynamicResult.sourceCounts;
    if (Object.values(counts).some((count) => count === 0)) throw publishError(409, "SITEMAP_SOURCE_INCOMPLETE", "Publishing stopped because one or more core public catalogs are empty");
    const entries = mergeEntries(seed, dynamicResult.entries);
    const newsEntries = dynamicResult.newsEntries;
    const imageCount = entries.reduce((total, entry) => total + (entry.images?.length || 0), 0);
    const filterUrlCount = entries.filter((entry) => /^\/(colleges|courses|exams)\?/.test(entry.path)).length;
    const generation = randomUUID();
    const chunks = [];
    for (let index = 0; index < entries.length; index += CHUNK_SIZE) chunks.push(entries.slice(index, index + CHUNK_SIZE));
    await boundedMap(chunks, OBJECT_IO_CONCURRENCY, (chunk, index) => repository.put(`${SITEMAP_PREFIX}/generations/${generation}/sitemap-${index + 1}.xml`, sitemapXml(chunk)));
    await repository.put(`${SITEMAP_PREFIX}/public/news-sitemap.xml`, newsSitemapXml(newsEntries));
    const indexXml = sitemapIndex(generation, chunks.length);
    const manifest = JSON.stringify({ generation, url_count: entries.length, news_url_count: newsEntries.length, image_count: imageCount, filter_url_count: filterUrlCount, chunk_count: chunks.length, source_counts: counts, generated_at: new Date().toISOString() });
    await repository.put(`${SITEMAP_PREFIX}/public/sitemap-index.xml`, indexXml);
    await repository.put(`${SITEMAP_PREFIX}/public/manifest.json`, manifest, "application/json; charset=utf-8");
    // The canonical root is the single-object publication pointer. Keep it
    // unchanged unless all immutable chunks and publication metadata exist.
    await repository.put(`${SITEMAP_PREFIX}/public/sitemap.xml`, indexXml);
    if (options.submitIndexNow !== false && !options.repository) {
      queueIndexNowUrls(newsEntries.map((entry) => `${PUBLISH_TARGET}${entry.path}`));
    }
    let removedObjects = 0;
    if (typeof repository.list === "function" && typeof repository.delete === "function") {
      const currentPrefix = `${SITEMAP_PREFIX}/generations/${generation}/`;
      const retentionCutoff = now - GENERATION_RETENTION_MS;
      const staleKeys = (await repository.list(`${SITEMAP_PREFIX}/generations/`))
        .map((item) => typeof item === "string" ? { key: item } : item)
        .filter((item) => !item.key.startsWith(currentPrefix) && item.lastModified && new Date(item.lastModified).getTime() < retentionCutoff)
        .map((item) => item.key);
      await repository.delete(staleKeys);
      removedObjects = staleKeys.length;
    }
    return { success: true, status: "published", target: PUBLISH_TARGET, generation, url_count: entries.length, news_url_count: newsEntries.length, image_count: imageCount, filter_url_count: filterUrlCount, chunk_count: chunks.length, removed_objects: removedObjects, source_counts: counts, sitemap_url: `${PUBLISH_TARGET}/sitemap.xml`, news_sitemap_url: `${PUBLISH_TARGET}/news-sitemap.xml`, requested_at: new Date().toISOString() };
  } finally {
    publishing = false;
  }
}
