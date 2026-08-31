import { backendClient } from "@/integrations/backend/client";
import { apiBaseUrl } from "@/lib/backendMode";
import { compactDisplayText } from "@/lib/displayText";
import { buildIlikeOr, buildSearchVariants, rankDirectoryResult } from "@/lib/fuzzySearch";

export type DirectorySearchResult = {
  entity_type: "College" | "Course" | "Exam" | "Career";
  name: string;
  slug: string;
  subtitle: string;
  image_url: string;
  logo_url: string;
  score?: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 60;
const resultCache = new Map<string, { expiresAt: number; results: DirectorySearchResult[] }>();
const inFlight = new Map<string, Promise<DirectorySearchResult[]>>();

export function resolveDirectoryMediaUrl(value: unknown) {
  const path = String(value || "").trim();
  if (!path || /^(?:https?:|data:|blob:)/i.test(path)) return path;

  const apiBase = apiBaseUrl();
  const normalizedPath = path.replace(/^\/+/, "");
  if (normalizedPath.startsWith("storage/v1/object/public/")) {
    return `${apiBase}/${normalizedPath}`;
  }
  return `${apiBase}/storage/v1/object/public/${normalizedPath}`;
}

function normalizeResult(row: Record<string, unknown>): DirectorySearchResult | null {
  const entityType = String(row.entity_type || "");
  if (!["College", "Course", "Exam", "Career"].includes(entityType) || !row.slug) return null;
  return {
    entity_type: entityType as DirectorySearchResult["entity_type"],
    name: compactDisplayText(row.name, `Untitled ${entityType.toLowerCase()}`, 90),
    slug: String(row.slug),
    subtitle: compactDisplayText(row.subtitle || "", "", 60),
    image_url: resolveDirectoryMediaUrl(row.image_url),
    logo_url: resolveDirectoryMediaUrl(row.logo_url),
    score: Number(row.score || 0),
  };
}

async function fallbackSearch(query: string, limit: number) {
  const variants = buildSearchVariants(query).slice(0, 3);
  const orFor = (column: string) => buildIlikeOr(column, variants);
  const [colleges, courses, exams] = await Promise.all([
    backendClient.from("colleges").select("name,short_name,slug,city,state,logo,image").eq("is_active", true)
      .or([orFor("name"), orFor("short_name"), orFor("slug"), orFor("city"), orFor("state")].filter(Boolean).join(",")).limit(5),
    backendClient.from("courses").select("name,full_name,slug,level,category,image").eq("is_active", true)
      .or([orFor("name"), orFor("full_name"), orFor("slug"), orFor("category")].filter(Boolean).join(",")).limit(5),
    backendClient.from("exams").select("name,short_name,full_name,slug,logo,image,exam_type,category").eq("is_active", true)
      .or([orFor("name"), orFor("short_name"), orFor("full_name"), orFor("slug"), orFor("category")].filter(Boolean).join(",")).limit(5),
  ]);
  return [
    ...(colleges.data || []).map((row: any) => ({ entity_type: "College", name: row.name, slug: row.slug, subtitle: [row.short_name, row.city].filter(Boolean).join(" · "), image_url: row.image || "", logo_url: row.logo || "" })),
    ...(courses.data || []).map((row: any) => ({ entity_type: "Course", name: row.name, slug: row.slug, subtitle: row.level || row.category || "Course", image_url: row.image || "", logo_url: "" })),
    ...(exams.data || []).map((row: any) => ({ entity_type: "Exam", name: row.name, slug: row.slug, subtitle: row.exam_type || row.category || "Exam", image_url: row.image || "", logo_url: row.logo || "" })),
  ]
    .map((row) => normalizeResult(row as Record<string, unknown>))
    .filter((row): row is DirectorySearchResult => Boolean(row))
    .sort((left, right) => rankDirectoryResult(query, right.name, right.subtitle) - rankDirectoryResult(query, left.name, left.subtitle))
    .slice(0, limit);
}

async function requestDirectory(query: string, limit: number) {
  const response = await (backendClient as any).rpc("search_directory_fast", { p_query: query, p_limit: limit });
  if (response.error) return fallbackSearch(query, limit);
  return (response.data || [])
    .map((row: Record<string, unknown>) => normalizeResult(row))
    .filter((row: DirectorySearchResult | null): row is DirectorySearchResult => Boolean(row))
    .sort((left: DirectorySearchResult, right: DirectorySearchResult) =>
      rankDirectoryResult(query, right.name, right.subtitle) - rankDirectoryResult(query, left.name, left.subtitle));
}

export function searchDirectory(query: string, limit = 10): Promise<DirectorySearchResult[]> {
  const normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120);
  if (normalizedQuery.length < 2) return Promise.resolve([]);
  const safeLimit = Math.max(1, Math.min(limit, 15));
  const key = `${normalizedQuery}:${safeLimit}`;
  const cached = resultCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.results);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = requestDirectory(normalizedQuery, safeLimit)
    .then((results) => {
      if (resultCache.size >= MAX_CACHE_ENTRIES) resultCache.delete(resultCache.keys().next().value as string);
      resultCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, results });
      return results;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

export function clearDirectorySearchCache() {
  resultCache.clear();
  inFlight.clear();
}
