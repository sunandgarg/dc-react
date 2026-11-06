import { useQuery } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";
import type { DbArticle } from "@/hooks/useArticlesData";
import { ARTICLE_LANGUAGES, articleLanguage } from "../../../public/article-languages.js";
import { Button } from "@/components/ui/button";

export function newTranslationDraft(original: Partial<DbArticle>, language: string): Partial<DbArticle> {
  return {
    language_code: language, english_article_id: original.id, site_scope: original.site_scope,
    slug: `${original.slug}-${language}`, title: "", description: "", content: "", meta_title: "", meta_description: "", meta_keywords: "",
    status: "Draft", is_active: false, author: original.author, author_id: original.author_id,
    featured_image: original.featured_image, source_logo: original.source_logo,
    vertical: original.vertical, category: original.category, tags: [], views: 0,
  };
}
export function ArticleLanguageEditor({ article, canCreate, onOpen }: {
  article: Partial<DbArticle>; canCreate: boolean; onOpen: (article: Partial<DbArticle>, isNew: boolean) => void;
}) {
  const rootId = article.english_article_id || article.id;
  const versions = useQuery({
    queryKey: ["admin-article-languages", rootId, article.site_scope],
    enabled: Boolean(rootId),
    queryFn: async () => {
      const { data, error } = await backendClient.from("articles").select("*")
        .eq("site_scope", article.site_scope || "dekhocampus")
        .or(`id.eq.${rootId},english_article_id.eq.${rootId}`).limit(10);
      if (error) throw error;
      return data as DbArticle[];
    },
  });
  const original = versions.data?.find((version) => version.id === rootId);
  const translationQueue = useQuery({
    queryKey: ["admin-article-languages", rootId, article.site_scope, "queue"],
    enabled: Boolean(rootId) && (article.site_scope || "dekhocampus") === "dekhocampus",
    queryFn: async () => {
      const { data, error } = await backendClient.functions.invoke("article-translation-queue", {
        body: { article_id: rootId, site_scope: "dekhocampus" },
      });
      if (error) throw error;
      return data as { engine_status: "not_connected"; slots: { language_code: string; status: "waiting_engine" | "paused_original" | "published" | "existing_draft" }[] };
    },
  });
  return <div className="space-y-3">
    <p className="text-sm">Article language: <strong>{articleLanguage(article.language_code).label}</strong></p>
    {article.english_article_id && <p className="text-xs text-muted-foreground">English original: {original?.title || "Loading…"}</p>}
    {(article.site_scope || "dekhocampus") === "dekhocampus" && <p className="text-sm text-muted-foreground">
      Publishing a new English article queues Hindi, Tamil, Telugu, Kannada, Malayalam, Gujarati, Marathi, Bengali and Punjabi versions automatically.
      Translation is paused until a free or self-hosted engine is connected. No API credits are used. You can still add or finish translations manually.
    </p>}
    {!rootId ? <p className="text-xs text-muted-foreground">Save this English article first to add linked translations.</p> : <>
      <p className="text-xs text-muted-foreground">Save your changes before opening another version. Each translation has its own title, content, metadata and FAQs. Only published versions appear to readers.</p>
      {translationQueue.isError && <p role="alert" className="text-sm">Translation queue could not be loaded. <Button type="button" variant="outline" onClick={() => void translationQueue.refetch()}>Retry queue</Button></p>}
      {versions.isError ? <p role="alert">Language versions could not be loaded. <Button variant="outline" onClick={() => void versions.refetch()}>Retry</Button></p> :
        <div className="flex flex-wrap gap-2">{ARTICLE_LANGUAGES.map(({ code, label }) => {
          const existing = versions.data?.find((version) => (version.language_code || "en") === code);
          const slot = translationQueue.data?.slots.find((slot) => slot.language_code === code);
          const queueLabel = slot?.status === "waiting_engine" ? "Queued · awaiting engine" : slot?.status === "paused_original" ? "Paused · English unpublished" : "Add";
          return <Button key={code} type="button" size="sm" variant={code === (article.language_code || "en") ? "secondary" : "outline"}
            disabled={versions.isFetching || !original || existing?.id === article.id || (!existing && (!canCreate || code === "en"))}
            onClick={() => onOpen(existing || newTranslationDraft(original!, code), !existing)}>
            {label}{existing ? ` · ${existing.status}${existing.is_active === false ? " (inactive)" : ""}` : ` · ${queueLabel}`}
          </Button>;
        })}</div>}
    </>}
  </div>;
}
