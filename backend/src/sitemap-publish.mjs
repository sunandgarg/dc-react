import { randomUUID } from "node:crypto";
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "./db.mjs";
import { storageConfig } from "./storage.mjs";

const CORE_TABLES = ["colleges", "courses", "exams", "articles"];
const PUBLISH_TARGET = "https://dekhocampus.com";
const SITEMAP_PREFIX = "system-sitemaps";
const CHUNK_SIZE = 45_000;
const COLLEGE_TABS = ["overview", "highlights", "courses-fees", "admission", "placements", "cutoff", "rankings", "scholarship", "hostel", "facilities", "faculty", "gallery", "reviews", "news", "faq"];
const COURSE_TABS = ["overview", "highlights", "eligibility", "syllabus", "fees", "admission", "career", "placements", "specializations", "top-exams", "top-colleges", "cutoff", "faq"];
const EXAM_TABS = ["overview", "dates", "eligibility", "pattern", "syllabus", "application", "admit-card", "result", "counselling", "cutoff", "preparation", "faq"];
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

function sitemapXml(entries) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((entry) => [
      "  <url>",
      `    <loc>${escapeXml(`${PUBLISH_TARGET}${entry.path}`)}</loc>`,
      entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
      `    <changefreq>${entry.changefreq || "weekly"}</changefreq>`,
      `    <priority>${entry.priority || "0.6"}</priority>`,
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
        objects.push(...(result.Contents || []).map((item) => item.Key));
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
  const object = await repository.get(key);
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
      });
    }
  }
  return entries.filter((entry) => !REBUILT_ROOTS.some((rootPath) => entry.path.startsWith(rootPath)));
}

async function rows(prismaClient, table, columns, requireSlug = true) {
  return prismaClient.$queryRawUnsafe(`SELECT ${columns.map((column) => `\`${column}\``).join(",")} FROM \`${table}\` WHERE \`is_active\` = 1${requireSlug ? " AND `slug` IS NOT NULL" : ""}`);
}

function canonicalEntity(prefix, row, priority, tabs = []) {
  const suffix = row.short_id ? `${row.slug}-${row.short_id}` : row.slug;
  const base = `${prefix}/${suffix}`;
  const common = { lastmod: dateOnly(row.updated_at), changefreq: "weekly" };
  return [
    { path: base, ...common, priority },
    ...tabs.map((tab) => ({ path: `${base}/${tab}`, ...common, priority: String(Math.max(0.1, Number(priority) - 0.12)) })),
  ];
}

function simpleEntities(prefix, sourceRows, priority) {
  return sourceRows.map((row) => ({ path: `${prefix}/${row.slug}`, lastmod: dateOnly(row.updated_at), changefreq: "weekly", priority }));
}

async function dynamicEntries(prismaClient) {
  const [colleges, courses, exams, articles, careers, scholarships, landing, catModules, programs, jobs, authors, legal, subjects, chapters, collegePrograms, universities, semesters, collegeSubjects] = await Promise.all([
    rows(prismaClient, "colleges", ["slug", "short_id", "updated_at"]),
    rows(prismaClient, "courses", ["slug", "short_id", "updated_at"]),
    rows(prismaClient, "exams", ["slug", "short_id", "updated_at"]),
    rows(prismaClient, "articles", ["slug", "updated_at", "tags"]),
    rows(prismaClient, "career_profiles", ["slug", "updated_at"]),
    rows(prismaClient, "scholarships", ["slug", "updated_at"]),
    rows(prismaClient, "landing_pages", ["slug", "updated_at"]),
    rows(prismaClient, "cat_universe_modules", ["slug", "updated_at"]),
    rows(prismaClient, "promoted_programs", ["slug", "updated_at"]),
    rows(prismaClient, "jobs", ["slug", "updated_at"]),
    rows(prismaClient, "authors", ["slug", "updated_at"]),
    rows(prismaClient, "legal_pages", ["slug", "updated_at"]),
    rows(prismaClient, "study_subjects", ["id", "slug", "class_num", "board_slug", "updated_at"]),
    rows(prismaClient, "study_chapters", ["slug", "subject_id", "updated_at"]),
    rows(prismaClient, "college_programs", ["slug", "updated_at"]),
    rows(prismaClient, "college_universities", ["slug", "program_slug", "updated_at"]),
    rows(prismaClient, "college_semesters", ["semester_num", "program_slug", "university_slug", "updated_at"], false),
    rows(prismaClient, "college_subjects", ["slug", "semester_num", "program_slug", "university_slug", "updated_at"]),
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
    ...colleges.flatMap((row) => canonicalEntity("/colleges", row, "0.88", COLLEGE_TABS)),
    ...courses.flatMap((row) => canonicalEntity("/courses", row, "0.85", COURSE_TABS)),
    ...exams.flatMap((row) => [
      ...canonicalEntity("/exams", row, "0.85", EXAM_TABS),
      ...EXAM_STRATEGIES.map((strategy) => ({ path: `${canonicalEntity("/exams", row, "0.85")[0].path}/${strategy}`, lastmod: dateOnly(row.updated_at), changefreq: "weekly", priority: "0.64" })),
    ]),
    ...simpleEntities("/news", articles, "0.7"),
    ...[...tags].map((tag) => ({ path: `/news/tag/${encodeURIComponent(tag)}`, changefreq: "daily", priority: "0.62" })),
    ...simpleEntities("/careers", careers, "0.72"),
    ...simpleEntities("/scholarships", scholarships, "0.72"),
    ...simpleEntities("/landing", landing, "0.65"),
    ...simpleEntities("/cat-universe", catModules, "0.75"),
    ...simpleEntities("/premium-programs", programs, "0.86"),
    ...simpleEntities("/jobs", jobs, "0.75"),
    ...simpleEntities("/vacancies", jobs, "0.72"),
    ...simpleEntities("/author", authors, "0.58"),
    ...simpleEntities("/legal", legal, "0.45"),
    ...classBoards.values(),
    ...subjects.map((row) => ({ path: `/study-material/class-${row.class_num}/${row.board_slug}/${row.slug}`, lastmod: dateOnly(row.updated_at), changefreq: "weekly", priority: "0.58" })),
    ...chapters.flatMap((row) => { const subject = subjectById.get(row.subject_id); return subject ? [{ path: `/study-material/class-${subject.class_num}/${subject.board_slug}/${subject.slug}/${row.slug}`, lastmod: dateOnly(row.updated_at), changefreq: "weekly", priority: "0.55" }] : []; }),
    ...simpleEntities("/college-study-material", collegePrograms, "0.62"),
    ...universities.map((row) => ({ path: `/college-study-material/${row.program_slug}/${row.slug}`, lastmod: dateOnly(row.updated_at), changefreq: "weekly", priority: "0.58" })),
    ...semesters.map((row) => ({ path: `/college-study-material/${row.program_slug}/${row.university_slug}/semester-${row.semester_num}`, lastmod: dateOnly(row.updated_at), changefreq: "weekly", priority: "0.55" })),
    ...collegeSubjects.map((row) => ({ path: `/college-study-material/${row.program_slug}/${row.university_slug}/semester-${row.semester_num}/${row.slug}`, lastmod: dateOnly(row.updated_at), changefreq: "weekly", priority: "0.52" })),
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
    const generation = randomUUID();
    const chunks = [];
    for (let index = 0; index < entries.length; index += CHUNK_SIZE) chunks.push(entries.slice(index, index + CHUNK_SIZE));
    await Promise.all(chunks.map((chunk, index) => repository.put(`${SITEMAP_PREFIX}/generations/${generation}/sitemap-${index + 1}.xml`, sitemapXml(chunk))));
    const indexXml = sitemapIndex(generation, chunks.length);
    await repository.put(`${SITEMAP_PREFIX}/public/sitemap-index.xml`, indexXml);
    await repository.put(`${SITEMAP_PREFIX}/public/sitemap.xml`, indexXml);
    await repository.put(`${SITEMAP_PREFIX}/public/manifest.json`, JSON.stringify({ generation, url_count: entries.length, chunk_count: chunks.length, source_counts: counts, generated_at: new Date().toISOString() }), "application/json; charset=utf-8");
    let removedObjects = 0;
    if (typeof repository.list === "function" && typeof repository.delete === "function") {
      const currentPrefix = `${SITEMAP_PREFIX}/generations/${generation}/`;
      const staleKeys = (await repository.list(`${SITEMAP_PREFIX}/generations/`)).filter((key) => !key.startsWith(currentPrefix));
      await repository.delete(staleKeys);
      removedObjects = staleKeys.length;
    }
    return { success: true, status: "published", target: PUBLISH_TARGET, generation, url_count: entries.length, chunk_count: chunks.length, removed_objects: removedObjects, source_counts: counts, sitemap_url: `${PUBLISH_TARGET}/sitemap.xml`, requested_at: new Date().toISOString() };
  } finally {
    publishing = false;
  }
}
