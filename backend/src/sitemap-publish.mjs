import { randomUUID } from "node:crypto";
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "./db.mjs";
import { storageConfig } from "./storage.mjs";

const CORE_TABLES = ["colleges", "courses", "exams", "articles"];
const PUBLISH_TARGET = "https://dekhocampus.com";
const SITEMAP_PREFIX = "system-sitemaps";
const CHUNK_SIZE = 45_000;
const MIN_FILTER_RESULTS = 3;
const GENERATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const REBUILT_ROOTS = [
  "/colleges/", "/courses/", "/exams/", "/news/", "/careers/", "/scholarships/", "/landing/",
  "/cat-universe/", "/premium-programs/", "/jobs/", "/vacancies/", "/author/", "/legal/",
  "/study-material/", "/college-study-material/",
];

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
  return fields.flatMap((field) => jsonValues(row?.[field])).flatMap((value) => {
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
      `    <changefreq>${entry.changefreq || "weekly"}</changefreq>`,
      `    <priority>${entry.priority || "0.6"}</priority>`,
      ...(entry.images || []).map((location) => `    <image:image><image:loc>${escapeXml(location)}</image:loc></image:image>`),
      "  </url>",
    ].filter(Boolean).join("\n")),
    "</urlset>",
  ].join("\n");
}

function sitemapIndex(generation, count) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...Array.from({ length: count }, (_, index) => `  <sitemap><loc>${PUBLISH_TARGET}/sitemap-files/${generation}/sitemap-${index + 1}.xml</loc></sitemap>`),
    "</sitemapindex>",
  ].join("\n");
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
  if (/^\/sitemap(?:-index|-\d+)?\.xml$/.test(pathname)) return `${SITEMAP_PREFIX}/public/${pathname.slice(1)}`;
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

async function currentSeedEntries(repository) {
  const root = await repository.get(`${SITEMAP_PREFIX}/public/sitemap.xml`);
  if (!root) throw publishError(503, "SITEMAP_SEED_MISSING", "The deployed sitemap seed is missing from AWS S3");
  const documents = [];
  if (/<sitemapindex\b/i.test(root.body)) {
    const locations = [...root.body.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => canonicalPath(match[1])).filter(Boolean);
    for (const location of locations) {
      const object = await repository.get(keyForPublicPath(new URL(location, PUBLISH_TARGET).pathname));
      if (object) documents.push(object.body);
    }
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

async function rows(prismaClient, table, columns, requireSlug = true) {
  return prismaClient.$queryRawUnsafe(`SELECT ${columns.map((column) => `\`${column}\``).join(",")} FROM \`${table}\` WHERE \`is_active\` = 1${requireSlug ? " AND `slug` IS NOT NULL" : ""}`);
}

function canonicalEntity(prefix, row, priority, imageFields = []) {
  const suffix = row.short_id ? `${row.slug}-${row.short_id}` : row.slug;
  return { path: `${prefix}/${suffix}`, lastmod: dateOnly(row.updated_at), changefreq: "weekly", priority, images: imageLocations(row, imageFields) };
}

function simpleEntities(prefix, sourceRows, priority, imageFields = []) {
  return sourceRows.map((row) => ({ path: `${prefix}/${row.slug}`, lastmod: dateOnly(row.updated_at), changefreq: "weekly", priority, images: imageLocations(row, imageFields) }));
}

function filteredPath(base, values) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (String(value || "").trim()) query.set(key, String(value).trim());
  return `${base}?${query}`;
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
  for (const row of courseFees) {
    const group = String(row.course_group || "").trim();
    const collegeSlug = String(row.college_slug || "").trim();
    if (!group || !collegeSlug) continue;
    const groups = groupsByCollege.get(collegeSlug) || new Set();
    groups.add(group);
    groupsByCollege.set(collegeSlug, groups);
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
  }
  return [...buckets.entries()]
    .filter(([, bucket]) => bucket.identities.size >= MIN_FILTER_RESULTS)
    .map(([path, bucket]) => ({ path, lastmod: bucket.lastmod, changefreq: "weekly", priority: bucket.priority }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

async function dynamicEntries(prismaClient) {
  const [colleges, courses, exams, articles, careers, scholarships, landing, catModules, programs, jobs, authors, legal, subjects, chapters, collegePrograms, universities, semesters, collegeSubjects, courseFees] = await Promise.all([
    rows(prismaClient, "colleges", ["slug", "short_id", "updated_at", "state", "city", "type", "category", "image", "logo", "carousel_images", "gallery_images"]),
    rows(prismaClient, "courses", ["slug", "short_id", "updated_at", "category", "mode", "duration", "image"]),
    rows(prismaClient, "exams", ["slug", "short_id", "updated_at", "category", "exam_type", "level", "image", "logo"]),
    rows(prismaClient, "articles", ["slug", "updated_at", "tags", "featured_image"]),
    rows(prismaClient, "career_profiles", ["slug", "updated_at", "image"]),
    rows(prismaClient, "scholarships", ["slug", "updated_at", "image"]),
    rows(prismaClient, "landing_pages", ["slug", "updated_at", "logo_url", "og_image"]),
    rows(prismaClient, "cat_universe_modules", ["slug", "updated_at"]),
    rows(prismaClient, "promoted_programs", ["slug", "updated_at", "image_url", "hero_image", "certificate_image", "degree_image", "institute_logo"]),
    rows(prismaClient, "jobs", ["slug", "updated_at", "company_logo"]),
    rows(prismaClient, "authors", ["slug", "updated_at", "photo"]),
    rows(prismaClient, "legal_pages", ["slug", "updated_at"]),
    rows(prismaClient, "study_subjects", ["id", "slug", "class_num", "board_slug", "updated_at"]),
    rows(prismaClient, "study_chapters", ["slug", "subject_id", "updated_at"]),
    rows(prismaClient, "college_programs", ["slug", "updated_at"]),
    rows(prismaClient, "college_universities", ["slug", "program_slug", "updated_at"]),
    rows(prismaClient, "college_semesters", ["semester_num", "program_slug", "university_slug", "updated_at"], false),
    rows(prismaClient, "college_subjects", ["slug", "semester_num", "program_slug", "university_slug", "updated_at"]),
    prismaClient.$queryRawUnsafe("SELECT `college_slug`,`course_group` FROM `course_fees` WHERE `course_group` IS NOT NULL AND TRIM(`course_group`) <> ''"),
  ]);
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const classBoards = new Map();
  for (const subject of subjects) classBoards.set(`${subject.class_num}/${subject.board_slug}`, { path: `/study-material/class-${subject.class_num}/${subject.board_slug}`, lastmod: dateOnly(subject.updated_at), changefreq: "weekly", priority: "0.62" });
  const tags = new Set();
  for (const article of articles) {
    const values = Array.isArray(article.tags) ? article.tags : (() => { try { return JSON.parse(article.tags || "[]"); } catch { return []; } })();
    for (const tag of values) if (tag) tags.add(String(tag).toLowerCase().trim().replace(/\s+/g, "-"));
  }
  return [
    ...colleges.map((row) => canonicalEntity("/colleges", row, "0.88", ["image", "logo", "carousel_images", "gallery_images"])),
    ...courses.map((row) => canonicalEntity("/courses", row, "0.85", ["image"])),
    ...exams.map((row) => canonicalEntity("/exams", row, "0.85", ["image", "logo"])),
    ...simpleEntities("/news", articles, "0.7", ["featured_image"]),
    ...[...tags].map((tag) => ({ path: `/news/tag/${encodeURIComponent(tag)}`, changefreq: "daily", priority: "0.62" })),
    ...simpleEntities("/careers", careers, "0.72", ["image"]),
    ...simpleEntities("/scholarships", scholarships, "0.72", ["image"]),
    ...simpleEntities("/landing", landing, "0.65", ["logo_url", "og_image"]),
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
}

async function activeCount(table, prismaClient) {
  const result = await prismaClient.$queryRawUnsafe(`SELECT COUNT(*) AS \`count\` FROM \`${table}\` WHERE \`is_active\` = 1 AND \`slug\` IS NOT NULL`);
  return Number(result[0]?.count || 0);
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
    const counts = Object.fromEntries(await Promise.all(CORE_TABLES.map(async (table) => [table, await activeCount(table, prismaClient)])));
    if (Object.values(counts).some((count) => count === 0)) throw publishError(409, "SITEMAP_SOURCE_INCOMPLETE", "Publishing stopped because one or more core public catalogs are empty");
    const [seed, dynamic] = await Promise.all([currentSeedEntries(repository), dynamicEntries(prismaClient)]);
    const seen = new Set();
    const entries = [...seed, ...dynamic].filter((entry) => entry.path && !seen.has(entry.path) && (seen.add(entry.path), true));
    const imageCount = entries.reduce((total, entry) => total + (entry.images?.length || 0), 0);
    const filterUrlCount = entries.filter((entry) => /^\/(colleges|courses|exams)\?/.test(entry.path)).length;
    const generation = randomUUID();
    const chunks = [];
    for (let index = 0; index < entries.length; index += CHUNK_SIZE) chunks.push(entries.slice(index, index + CHUNK_SIZE));
    await Promise.all(chunks.map((chunk, index) => repository.put(`${SITEMAP_PREFIX}/generations/${generation}/sitemap-${index + 1}.xml`, sitemapXml(chunk))));
    const indexXml = sitemapIndex(generation, chunks.length);
    await repository.put(`${SITEMAP_PREFIX}/public/sitemap-index.xml`, indexXml);
    await repository.put(`${SITEMAP_PREFIX}/public/sitemap.xml`, indexXml);
    await repository.put(`${SITEMAP_PREFIX}/public/manifest.json`, JSON.stringify({ generation, url_count: entries.length, image_count: imageCount, filter_url_count: filterUrlCount, chunk_count: chunks.length, source_counts: counts, generated_at: new Date().toISOString() }), "application/json; charset=utf-8");
    let removedObjects = 0;
    if (typeof repository.list === "function" && typeof repository.delete === "function") {
      const currentPrefix = `${SITEMAP_PREFIX}/generations/${generation}/`;
      const retentionCutoff = (options.now || Date.now()) - GENERATION_RETENTION_MS;
      const staleKeys = (await repository.list(`${SITEMAP_PREFIX}/generations/`))
        .map((item) => typeof item === "string" ? { key: item } : item)
        .filter((item) => !item.key.startsWith(currentPrefix) && item.lastModified && new Date(item.lastModified).getTime() < retentionCutoff)
        .map((item) => item.key);
      await repository.delete(staleKeys);
      removedObjects = staleKeys.length;
    }
    return { success: true, status: "published", target: PUBLISH_TARGET, generation, url_count: entries.length, image_count: imageCount, filter_url_count: filterUrlCount, chunk_count: chunks.length, removed_objects: removedObjects, source_counts: counts, sitemap_url: `${PUBLISH_TARGET}/sitemap.xml`, requested_at: new Date().toISOString() };
  } finally {
    publishing = false;
  }
}
