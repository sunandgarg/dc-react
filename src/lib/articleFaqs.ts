export type ArticleFaqDraft = {
  id?: string;
  question: string;
  answer: string;
  display_order?: number;
  is_active?: boolean;
};

/** MySQL may return saved Boolean flags as 0/1; normalize old editor drafts too. */
export function normalizeArticleFaqDrafts(faqs: ArticleFaqDraft[] | undefined) {
  return faqs?.map((faq) => {
    const active = (faq as { is_active?: unknown }).is_active;
    return { ...faq, is_active: active !== false && active !== 0 && active !== "0" };
  });
}

export function validateArticleFaqs(faqs: ArticleFaqDraft[] | undefined) {
  if (!faqs) return null; // An unopened existing FAQ section is left unchanged.
  if (faqs.length > 50) return "An article can have at most 50 FAQs.";
  for (let index = 0; index < faqs.length; index += 1) {
    const faq = faqs[index];
    if (!faq.question.trim() || !faq.answer.trim()) return `FAQ ${index + 1} needs both a question and an answer.`;
    if (faq.question.length > 2000 || faq.answer.length > 20000) return `FAQ ${index + 1} is too long.`;
  }
  return null;
}
