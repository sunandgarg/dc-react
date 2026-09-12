import { slugify } from "@/lib/slugify";

type ArticleSaveFields = {
  title?: string | null;
  slug?: string | null;
  description?: string | null;
  content?: string | null;
  status?: string | null;
};

export const normalizeArticleSlug = (value: string | null | undefined) => slugify(value || "");

export function visibleArticleText(value: string | null | undefined) {
  return String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;|&#34;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateArticleSave(article: ArticleSaveFields, canPublish: boolean) {
  if (!String(article.title || "").trim()) return "Add an article title.";
  if (!normalizeArticleSlug(article.slug)) return "Add a valid article slug.";
  if (article.status === "Published" && !canPublish) return "You do not have permission to publish this article.";
  if (article.status !== "Published") return null;
  if (visibleArticleText(article.description).length < 10) return "Add a useful article description before publishing.";
  if (visibleArticleText(article.content).length < 20) return "Add article content before publishing.";
  return null;
}
