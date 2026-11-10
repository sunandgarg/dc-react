import { useEffect, useRef } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { backendClient } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";

export const catalogTables = ["exams", "courses", "colleges", "articles"] as const;
type Table = typeof catalogTables[number];
type Entry = { id: string; name: string; table: Table; scope?: string };
export async function fetchCatalogNames(tables: readonly Table[], signal: AbortSignal, includeSarkari = false) {
  const rows: Entry[] = [];
  for (const table of tables) {
    for (let offset = 0; ; offset += 1000) {
      let query = backendClient.from(table)
        .select(table === "articles" ? "id,title,site_scope" : "id,name")
        .order("id").range(offset, offset + 999).abortSignal(signal);
      if (table === "articles" && !includeSarkari) query = query.eq("site_scope", "dekhocampus");
      const { data, error } = await query;
      if (error) throw error;
      for (const row of data) rows.push({ id: row.id, name: row.name || row.title, table, scope: row.site_scope });
      if (data.length < 1000) break;
    }
  }
  return rows;
}

export function useAdminCatalog(includeSarkari: boolean) {
  const { user, isAdmin, canAccess, roles } = useAuth();
  const tables = catalogTables.filter(t => isAdmin || canAccess(t));
  return useQuery({
    queryKey: ["admin-catalog-names", user?.id, roles, tables, includeSarkari],
    enabled: !!user && tables.length > 0,
    queryFn: ({ signal }) => fetchCatalogNames(tables, signal, includeSarkari),
    staleTime: 10 * 60_000,
  });
}

export async function fetchCatalogRecord(table: Table, id: string, scope?: string, signal?: AbortSignal) {
  let q = backendClient.from(table).select("*").eq("id", id);
  if (scope) q = q.eq("site_scope", scope);
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q.single();
  if (error || !data) throw new Error(error?.message || "Record not found");
  return data;
}

// A URL selection works from the global search and the list. Discard late responses when switching records.
export function useCatalogEditor(table: Table, canEdit: boolean, open: (row: any) => void, scope?: string) {
  const [params, setParams] = useSearchParams();
  const id = params.get("record");
  const callbacks = useRef({ open, setParams });
  callbacks.current = { open, setParams };
  useEffect(() => {
    if (!id || !canEdit) return;
    const controller = new AbortController();
    void fetchCatalogRecord(table, id, scope, controller.signal).then(row => {
      if (!controller.signal.aborted) callbacks.current.open(row);
    }).catch(error => { if (!controller.signal.aborted) toast.error("Could not open record: " + error.message); })
      .finally(() => { if (!controller.signal.aborted) callbacks.current.setParams(current => {
        const next = new URLSearchParams(current); next.delete("record"); return next;
      }, { replace: true }); });
    return () => controller.abort();
  }, [id, canEdit, scope, table]);
  return { loadingEditId: id, openRecord: (value: string) => setParams(current => {
    const next = new URLSearchParams(current); next.set("record", value); return next;
  }, { replace: true }) };
}

const listFields = {
  exams: "id,name,short_name,full_name,slug,logo,category,level,listing_category,status,exam_date",
  courses: "id,name,full_name,slug,category,level,status,priority,duration,mode",
};
export function useAdminCatalogList(table: keyof typeof listFields, size: number, search: string, status: string) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: [`db-${table}-all`, "pages", user?.id, size, search, status],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      let q = backendClient.from(table).select(listFields[table], pageParam === 0 ? { count: "exact" } : {})
        .order("priority").order("updated_at", { ascending: false }).order("name").order("id");
      if (search) {
        const term = search.replace(/[(),]/g, " ").trim();
        q = q.or(["name", "slug", "full_name"].map(key => key + ".ilike.%" + term + "%").join(","));
      }
      if (status === "__missing_filters") q = q.or("listing_category.is.null,listing_category.eq.,exam_streams.is.null,exam_streams.eq.[],course_groups.is.null,course_groups.eq.[],education_levels.is.null,education_levels.eq.[]");
      else if (status !== "all") q = q.eq("status", status);
      const { data, error, count } = await q.range(pageParam, pageParam + size - 1).abortSignal(signal);
      if (error) throw error;
      return { rows: data || [], total: count, offset: pageParam };
    },
    getNextPageParam: (last, pages) => {
      const next = last.offset + last.rows.length;
      return last.rows.length === size && next < (pages[0].total ?? Infinity) ? next : undefined;
    },
    staleTime: 120_000,
  });
}
