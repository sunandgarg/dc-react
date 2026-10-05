import { useQuery } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";

export type ArticleCategory = { slug: string; name: string };

export function useArticleCategories(enabled = true) {
  return useQuery({
    queryKey: ["article_categories"],
    staleTime: 5 * 60 * 1000,
    enabled,
    queryFn: async () => {
      const { data, error } = await backendClient
        .from("article_categories")
        .select("slug,name,display_order,is_active")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return (data || []) as ArticleCategory[];
    },
  });
}
