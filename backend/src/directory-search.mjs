import { prisma, jsonSafe } from "./db.mjs";

const CACHE_TTL_MS = 5 * 60 * 1000;

let directoryRows = [];
let loadedAt = 0;
let refreshPromise = null;

export function normalizeDirectoryText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function acronym(value) {
  return normalizeDirectoryText(value)
    .split(" ")
    .filter((word) => word && !["of", "the", "and", "in", "at", "for"].includes(word))
    .map((word) => word[0])
    .join("");
}

function prepareRow(row) {
  const normalizedName = normalizeDirectoryText(row.name);
  const normalizedAlias = normalizeDirectoryText(row.search_alias);
  const normalizedSlug = normalizeDirectoryText(String(row.slug || "").replaceAll("-", " "));
  const searchable = normalizeDirectoryText(`${row.name} ${row.search_alias} ${row.slug} ${row.subtitle}`);
  return {
    ...row,
    _normalizedName: normalizedName,
    _normalizedAlias: normalizedAlias,
    _normalizedSlug: normalizedSlug,
    _searchable: searchable,
    _compactSearchable: searchable.replaceAll(" ", ""),
    _acronym: acronym(row.name),
  };
}

function rankPreparedDirectoryRow(normalizedQuery, compactQuery, row) {
  const normalizedName = row._normalizedName ?? normalizeDirectoryText(row.name);
  const normalizedAlias = row._normalizedAlias ?? normalizeDirectoryText(row.search_alias);
  const normalizedSlug = row._normalizedSlug ?? normalizeDirectoryText(String(row.slug || "").replaceAll("-", " "));
  const searchable = row._searchable ?? normalizeDirectoryText(`${row.name} ${row.search_alias} ${row.slug} ${row.subtitle}`);
  const compactSearchable = row._compactSearchable ?? searchable.replaceAll(" ", "");

  if (!normalizedQuery || (!searchable.includes(normalizedQuery) && !compactSearchable.includes(compactQuery))) return -1;

  let score = 100;
  if (normalizedName === normalizedQuery) score += 1_000;
  if (normalizedAlias === normalizedQuery) score += 980;
  if ((row._acronym ?? acronym(row.name)) === compactQuery) score += 960;
  if (normalizedName.startsWith(normalizedQuery)) score += 800;
  if (normalizedAlias.startsWith(normalizedQuery)) score += 780;
  if (normalizedSlug.startsWith(normalizedQuery)) score += 740;
  if (normalizedName.includes(normalizedQuery)) score += 500;
  if (normalizedAlias.includes(normalizedQuery)) score += 480;
  if (compactSearchable.includes(compactQuery)) score += 300;
  return score;
}

export function rankDirectoryRow(query, row) {
  const normalizedQuery = normalizeDirectoryText(query);
  return rankPreparedDirectoryRow(normalizedQuery, normalizedQuery.replaceAll(" ", ""), row);
}

async function loadDirectoryRows() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT entity_type, name, slug, subtitle, image_url, logo_url, search_alias
    FROM (
      SELECT 'College' AS entity_type, name, slug, COALESCE(NULLIF(city, ''), NULLIF(state, ''), '') AS subtitle,
             COALESCE(NULLIF(image, ''), logo, '') AS image_url, COALESCE(NULLIF(logo, ''), image, '') AS logo_url,
             COALESCE(short_name, '') AS search_alias
      FROM colleges WHERE is_active = 1
      UNION ALL
      SELECT 'Course', name, slug, COALESCE(NULLIF(level, ''), NULLIF(category, ''), 'Course'),
             COALESCE(image, ''), COALESCE(image, ''), COALESCE(full_name, '')
      FROM courses WHERE is_active = 1
      UNION ALL
      SELECT 'Exam', name, slug, COALESCE(NULLIF(exam_type, ''), NULLIF(category, ''), 'Exam'),
             COALESCE(NULLIF(logo, ''), image, ''), COALESCE(NULLIF(logo, ''), image, ''), CONCAT_WS(' ', short_name, full_name)
      FROM exams WHERE is_active = 1
      UNION ALL
      SELECT 'Career', name, slug, COALESCE(domain, 'Career'), COALESCE(image, ''), COALESCE(image, ''), ''
      FROM career_profiles WHERE is_active = 1
    ) directory
  `);
  directoryRows = jsonSafe(rows).map(prepareRow);
  loadedAt = Date.now();
  return directoryRows;
}

export async function warmDirectorySearchCache() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = loadDirectoryRows().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export function invalidateDirectorySearchCache() {
  loadedAt = 0;
  if (directoryRows.length) void warmDirectorySearchCache().catch((error) => console.error("Directory search refresh failed", error));
}

export async function searchDirectory(query, limit = 10) {
  if (!directoryRows.length) await warmDirectorySearchCache();
  else if (Date.now() - loadedAt > CACHE_TTL_MS) void warmDirectorySearchCache().catch((error) => console.error("Directory search refresh failed", error));

  const normalizedQuery = normalizeDirectoryText(query);
  const compactQuery = normalizedQuery.replaceAll(" ", "");
  return directoryRows
    .map((row) => ({ row, score: rankPreparedDirectoryRow(normalizedQuery, compactQuery, row) }))
    .filter(({ score }) => score >= 0)
    .sort((left, right) => right.score - left.score || String(left.row.name).length - String(right.row.name).length || String(left.row.name).localeCompare(String(right.row.name)))
    .slice(0, limit)
    .map(({ row, score }) => ({
      entity_type: row.entity_type,
      name: row.name,
      slug: row.slug,
      subtitle: row.subtitle,
      image_url: row.image_url,
      logo_url: row.logo_url,
      score,
    }));
}
