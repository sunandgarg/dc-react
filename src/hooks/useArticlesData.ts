import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";
import { toast } from "sonner";

function isPendingReview(response: { status?: number | null }) {
  return response.status === 202;
}

export type DbArticle = {
  id: string;
  status: string;
  title: string;
  slug: string;
  description: string;
  content: string;
  vertical: string;
  category: string;
  author: string;
  featured_image: string;
  views: number;
  tags: string[];
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  is_active: boolean;
  featured_rank?: number | null;
  created_at: string;
  updated_at: string;
};

export function useDbArticles() {
  return useQuery({
    queryKey: ["db-articles"],
    queryFn: async () => {
      const { data, error } = await backendClient
        .from("articles")
        .select("id,status,title,slug,description,vertical,category,author,featured_image,views,tags,is_active,featured_rank,created_at,updated_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DbArticle[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

const normalizeArticleSearch = (value: string | undefined) =>
  (value || "")
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function useAdminArticles(search: string | undefined, page: number, pageSize: number) {
  const normalizedSearch = normalizeArticleSearch(search);
  const safePage = Math.max(1, Math.floor(page || 1));
  const safePageSize = Math.min(500, Math.max(1, Math.floor(pageSize || 20)));

  return useQuery({
    queryKey: ["db-articles-admin", normalizedSearch, safePage, safePageSize],
    queryFn: async () => {
      let query = backendClient
        .from("articles")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (normalizedSearch) {
        const ilikeTerm = `%${normalizedSearch.replace(/\s+/g, "%")}%`;
        query = query.or(
          [
            `title.ilike.${ilikeTerm}`,
            `slug.ilike.${ilikeTerm}`,
            `author.ilike.${ilikeTerm}`,
            `category.ilike.${ilikeTerm}`,
            `vertical.ilike.${ilikeTerm}`,
            `description.ilike.${ilikeTerm}`,
            `content.ilike.${ilikeTerm}`,
            `meta_title.ilike.${ilikeTerm}`,
            `meta_description.ilike.${ilikeTerm}`,
            `meta_keywords.ilike.${ilikeTerm}`,
          ].join(",")
        );
      }

      const from = (safePage - 1) * safePageSize;
      const { data, error, count } = await query.range(from, from + safePageSize - 1);
      if (error) throw error;
      return { rows: (data || []) as DbArticle[], total: count ?? 0 };
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useDbArticle(slug: string | undefined) {
  return useQuery({
    queryKey: ["db-article", slug],
    queryFn: async () => {
      const { data, error } = await backendClient
        .from("articles")
        .select("*")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data as DbArticle | null;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (article: Partial<DbArticle> & { slug: string; title: string }) => {
      let pendingReview = false;
      // Normalize slug: lowercase, spaces & special chars -> dashes
      const cleanSlug = (article.slug || "")
        .toString()
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const normalized = { ...article, slug: cleanSlug || article.slug };
      if (normalized.id) {
        const { id, created_at, updated_at, ...rest } = normalized;
        const response = await backendClient.from("articles").update(rest).eq("id", id);
        const { error } = response;
        if (error) throw error;
        pendingReview = isPendingReview(response);
      } else {
        const { id, created_at, updated_at, ...rest } = normalized;
        const response = await backendClient.from("articles").insert(rest);
        const { error } = response;
        if (error) throw error;
        pendingReview = isPendingReview(response);
      }
      return { pendingReview };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["db-articles"] });
      qc.invalidateQueries({ queryKey: ["db-articles-admin"] });
      toast.success(result.pendingReview ? "Article draft submitted for admin review." : "Article saved!");
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
}

export function useDeleteArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await backendClient.from("articles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["db-articles"] });
      qc.invalidateQueries({ queryKey: ["db-articles-admin"] });
      toast.success("Article deleted!");
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
}
