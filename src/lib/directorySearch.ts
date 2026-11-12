import { backendClient } from "@/integrations/backend/client";
import { apiBaseUrl } from "@/lib/backendMode";
import { compactDisplayText } from "@/lib/displayText";
import { rankDirectoryResult } from "@/lib/fuzzySearch";
import { resolveExamLogo } from "@/lib/examBranding";

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
  // Reviewed exam marks are frontend assets, not AWS storage object keys.
  if (path.startsWith("/exam-logos/")) return path;

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
  const examLogo = entityType === "Exam"
    ? resolveDirectoryMediaUrl(resolveExamLogo({ slug: String(row.slug), logo: String(row.logo_url || "") }))
    : "";
  return {
    entity_type: entityType as DirectorySearchResult["entity_type"],
    name: compactDisplayText(row.name, `Untitled ${entityType.toLowerCase()}`, 90),
    slug: String(row.slug),
    subtitle: compactDisplayText(row.subtitle || "", "", 60),
    // Do not reintroduce a generated ring or banner as a missing exam logo.
    image_url: entityType === "Exam" ? examLogo : resolveDirectoryMediaUrl(row.image_url),
    logo_url: entityType === "Exam" ? examLogo : resolveDirectoryMediaUrl(row.logo_url),
    score: Number(row.score || 0),
  };
}

async function requestDirectory(query: string, limit: number) {
  const response = await (backendClient as any).rpc("search_directory_fast", { p_query: query, p_limit: limit });
  if (response.error) throw response.error;
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
