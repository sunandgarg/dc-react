import { randomUUID } from "node:crypto";

const invalid = (message) => Object.assign(new Error(message), { status: 400, code: "INVALID_ARTICLE_FAQS" });

export function normalizeArticleFaqs(value) {
  if (!Array.isArray(value) || value.length > 50) throw invalid("Provide at most 50 article FAQs");
  const ids = new Set();
  return value.map((faq, index) => {
    if (!faq || typeof faq !== "object" || Array.isArray(faq)) throw invalid(`FAQ ${index + 1} is invalid`);
    const question = typeof faq.question === "string" ? faq.question.trim() : "";
    const answer = typeof faq.answer === "string" ? faq.answer.trim() : "";
    if (!question || !answer) throw invalid(`FAQ ${index + 1} needs both a question and an answer`);
    if (question.length > 2000 || answer.length > 20000) throw invalid(`FAQ ${index + 1} is too long`);
    const id = faq.id;
    if (id !== undefined && (typeof id !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id) || ids.has(id))) {
      throw invalid(`FAQ ${index + 1} has an invalid or repeated ID`);
    }
    if (id) ids.add(id);
    if (faq.is_active !== undefined && typeof faq.is_active !== "boolean") throw invalid(`FAQ ${index + 1} has an invalid active flag`);
    // Identity, page, slug and order are server-owned, never accepted from the form.
    return { ...(id ? { id } : {}), question, answer, display_order: index, is_active: faq.is_active !== false };
  });
}

/** Call only inside the same transaction as the authorised parent-article write. */
export async function saveArticleFaqs(tx, article, { previousSlug = article.slug, allowDelete = false, isNewArticle = false } = {}) {
  const hasFaqs = Object.hasOwn(article, "faqs");
  if (!hasFaqs && previousSlug === article.slug) return;
  const faqs = hasFaqs ? normalizeArticleFaqs(article.faqs) : [];
  if (isNewArticle && faqs.some((faq) => faq.id)) throw invalid("New articles cannot attach existing FAQ IDs");
  const page = article.site_scope === "sarkari" ? "sarkari_articles" : "articles";
  const where = { page, item_slug: previousSlug };
  const existing = await tx.faqs.findMany({ where });
  const existingIds = new Set(existing.map(({ id }) => id));
  for (const faq of faqs) {
    if (faq.id && !existingIds.has(faq.id)) throw invalid("An FAQ does not belong to this article");
  }
  if (previousSlug !== article.slug) {
    const target = await tx.faqs.findFirst({ where: { page, item_slug: article.slug } });
    if (target) throw invalid("The new article slug already has FAQs attached; choose another slug");
    await tx.faqs.updateMany({ where, data: { item_slug: article.slug } });
  }
  const nextWhere = { page, item_slug: article.slug };
  for (const { id, ...fields } of faqs) {
    const data = { ...fields, ...nextWhere, updated_at: new Date() };
    if (id) {
      await tx.faqs.updateMany({ where: { ...nextWhere, id }, data });
    } else {
      await tx.faqs.create({ data: { ...data, id: randomUUID() } });
    }
  }
  // Managers can edit/add, but only an admin can delete already persisted FAQs.
  if (hasFaqs && allowDelete && !isNewArticle) {
    const kept = new Set(faqs.map(({ id }) => id).filter(Boolean));
    const removed = existing.filter(({ id }) => !kept.has(id)).map(({ id }) => id);
    if (removed.length) await tx.faqs.deleteMany({ where: { ...nextWhere, id: { in: removed } } });
  }
}
