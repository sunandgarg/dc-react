import { useQuery } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";
import type { DbArticle, ArticleLanguageVersion } from "@/hooks/useArticlesData";

export function useArticleLanguages(article?: Partial<DbArticle> | null) {
  const rootId = article?.english_article_id || article?.id;
  return useQuery({
    queryKey: ["article-languages", article?.site_scope, rootId],
    enabled: Boolean(rootId && article?.language_code),
    initialData: article?.language_versions,
    queryFn: async () => {
      const { data, error } = await backendClient.from("articles")
        .select("id,title,slug,language_code")
        .eq("site_scope", article!.site_scope || "dekhocampus")
        .eq("status", "Published").eq("is_active", true)
        .or(`id.eq.${rootId},english_article_id.eq.${rootId}`).limit(10);
      if (error) throw error;
      return data as ArticleLanguageVersion[];
    },
    staleTime: 30_000,
  });
}
