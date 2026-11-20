/** Reuse only the matching anonymous public row embedded in the edge response. */
export function initialPageData<T>(table: "articles" | "colleges" | "courses" | "exams", routeSlug: string | undefined): T | undefined {
  if (!routeSlug || typeof document === "undefined") return undefined;
  try {
    const data = JSON.parse(document.getElementById("dc-initial-page-data")?.textContent || "null");
    const row = data?.row;
    if (data?.table !== table || data.routeSlug !== routeSlug || !row?.id || !row.slug || row.is_active !== true) return undefined;
    if (table === "articles" && (row.status !== "Published" || row.site_scope !== "dekhocampus")) return undefined;
    return row as T;
  } catch {
    // Static previews or old deployments simply use the existing API request.
    return undefined;
  }
}

export function initialNewsListingData<T>(): { pinned: T[]; latest: T[]; total: number } | undefined {
  if (typeof document === "undefined" || window.location.pathname !== "/news" || window.location.search) return undefined;
  try {
    const data = JSON.parse(document.getElementById("dc-initial-page-data")?.textContent || "null");
    if (data?.table !== "news-listing" || !Array.isArray(data.pinned) || !Array.isArray(data.latest) || !Number.isFinite(data.total)) return undefined;
    return { pinned: data.pinned, latest: data.latest, total: data.total };
  } catch {
    return undefined;
  }
}
