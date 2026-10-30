import { ARTICLE_LANGUAGES, hasBodyFaqs, translationTextError } from "../../public/article-languages.js";
const invalid = (message) => Object.assign(new Error(message), { status: 400, code: "INVALID_ARTICLE_PUBLICATION" });

/** Validate inside the article write lock, including manual JSON and review approvals. */
export async function assertArticlePublication(tx, article, previous = null) {
  const language = article.language_code || "en";
  const parentId = article.english_article_id || null;
  if (!ARTICLE_LANGUAGES.some(({ code }) => code === language)) throw invalid("Choose a supported article language.");
  if (language === "en" && parentId) throw invalid("An English original cannot be a translation.");
  if (language !== "en" && !parentId) throw invalid("Select the English original for this translation.");
  if (previous && ((previous.language_code || "en") !== language || (previous.english_article_id || null) !== parentId)) {
    throw invalid("The language and English original cannot change after saving. Create a linked version instead.");
  }
  if (parentId) {
    const [parent] = await tx.$queryRawUnsafe("SELECT id, language_code, english_article_id, site_scope FROM articles WHERE id = ? LIMIT 1", parentId);
    if (!parent || parent.id === article.id || (parent.language_code || "en") !== "en" || parent.english_article_id || parent.site_scope !== article.site_scope) {
      throw invalid("The translation must link to an English original on the same site.");
    }
    const [duplicate] = await tx.$queryRawUnsafe("SELECT id FROM articles WHERE site_scope = ? AND english_article_id = ? AND language_code = ? AND id <> ? LIMIT 1", article.site_scope, parentId, language, article.id || "");
    if (duplicate) throw invalid("This language version already exists. Open it in the article editor.");
  }
  const publishing = article.status === "Published" && article.is_active !== false && article.is_active !== 0;
  const contentChanged = !previous || previous.status !== "Published" || previous.is_active === false || previous.is_active === 0 || previous.content !== article.content;
  if (publishing && contentChanged && hasBodyFaqs(article.content)) throw invalid("Move the FAQ section out of the article body into the dedicated FAQ fields before publishing.");
  if (publishing && language !== "en") {
    const faqs = article.faqs ?? await tx.faqs.findMany({ where: { page: article.site_scope === "sarkari" ? "sarkari_articles" : "articles", item_slug: article.slug } });
    const error = translationTextError({ ...article, faqs });
    if (error) throw invalid(error);
    if (!faqs.length) throw invalid("Add the translated FAQs in the dedicated FAQ fields before publishing.");
  }
}
