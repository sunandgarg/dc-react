import { useInfiniteQuery } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";
import type { SearchGroup } from "@/lib/listingFilters";

const BATCH_SIZE = 18;

interface InfiniteConfig {
  table: "courses" | "exams";
  columns: string;
  queryKey: string[];
  orderBy?: string;
  ascending?: boolean;
  nullsFirst?: boolean;
  /** Additional ORDER BY clauses applied after the primary `orderBy`. */
  extraOrders?: { column: string; ascending?: boolean; nullsFirst?: boolean }[];
  filters?: Record<string, string | string[] | undefined>;
  arrayFilters?: Record<string, string[] | undefined>;
  search?: string;
  searchFields?: string[];
  searchGroups?: SearchGroup[];
  /** Request an exact server count for the current filtered result set. */
  includeCount?: boolean;
  enabled?: boolean;
}

export function useInfiniteData({
  table, columns,
  queryKey,
  orderBy = "rating",
  ascending = false,
  nullsFirst,
  extraOrders = [],
  filters = {},
  arrayFilters = {},
  search,
  searchFields = ["name"],
  searchGroups = [],
  includeCount = false,
  enabled = true,
}: InfiniteConfig) {


  const query = useInfiniteQuery({
    queryKey: [
      ...queryKey, columns,
      orderBy,
      ascending,
      nullsFirst,
      JSON.stringify(filters),
      JSON.stringify(arrayFilters),
      search ?? "",
      JSON.stringify(searchGroups),
      JSON.stringify(extraOrders),
      includeCount,
    ],
    queryFn: async ({ pageParam = 0, signal }) => {
      let q: any = backendClient
        .from(table)
        .select(columns, includeCount && pageParam === 0 ? { count: "exact" } : {})
        .eq("is_active", true)
        .order(orderBy, { ascending, nullsFirst });
      for (const o of extraOrders) {
        q = q.order(o.column, { ascending: o.ascending ?? false, nullsFirst: o.nullsFirst });
      }
      q = q.order("id").range(pageParam, pageParam + BATCH_SIZE - 1);

      // Apply filters
      for (const [key, value] of Object.entries(filters)) {
        if (!value) continue;
        if (Array.isArray(value) && value.length > 0) {
          q = q.in(key, value);
        } else if (typeof value === "string" && value) {
          q = q.eq(key, value);
        }
      }

      // Postgres array columns (for example course specializations) need an
      // overlap operation rather than scalar IN semantics.
      for (const [key, value] of Object.entries(arrayFilters)) {
        if (value?.length) q = q.overlaps(key, value);
      }

      // Apply search
      if (search && searchFields.length > 0) {
        const orClause = searchFields.map(f => `${f}.ilike.%${search}%`).join(",");
        q = q.or(orClause);
      }

      for (const group of searchGroups) {
        const terms = group.terms.filter(Boolean);
        if (terms.length === 0) continue;
        const fields = group.fields?.length ? group.fields : searchFields;
        const orClause = fields.flatMap((field) => terms.map((term) => `${field}.ilike.%${term}%`)).join(",");
        if (orClause) q = q.or(orClause);
      }

      const { data, error, count } = await q.abortSignal(signal);
      if (error) throw error;
      return { items: data ?? [], offset: pageParam, totalCount: count };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const total = pages[0].totalCount;
      if (typeof total === "number" && lastPage.offset + lastPage.items.length >= total) return undefined;
      if (lastPage.items.length < BATCH_SIZE) return undefined;
      return lastPage.offset + BATCH_SIZE;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    placeholderData: undefined,
  });
  const items = query.data?.pages.flatMap(p => p.items) ?? [];
  const totalCount = query.data?.pages[0]?.totalCount ?? items.length;

  return {
    items,
    totalCount,
    loadMore: () => query.fetchNextPage({ cancelRefetch: false }),
    isLoading: query.isLoading,
    isFetchingMore: query.isFetchingNextPage,
    hasMore: query.hasNextPage ?? false,
    error: query.error,
  };
}
