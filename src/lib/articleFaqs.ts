import { isFaqHeading } from "../../public/article-languages.js";

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

export function extractBodyFaqs(content: string, existing: ArticleFaqDraft[] = []) {
  const doc = new DOMParser().parseFromString(content, "text/html");
  const heading = [...doc.body.querySelectorAll("h2,h3")].find((node) => isFaqHeading(node.textContent));
  if (!heading || heading.parentElement !== doc.body) throw new Error("Move this FAQ section manually into the dedicated fields; its structure cannot be converted safely.");
  const level = Number(heading.tagName.slice(1));
  const nodes: Element[] = [heading];
  const extracted: ArticleFaqDraft[] = [];
  let current: ArticleFaqDraft | undefined;
  for (let node = heading.nextElementSibling; node; node = node.nextElementSibling) {
    const nextLevel = /^H[1-6]$/.test(node.tagName) ? Number(node.tagName.slice(1)) : 0;
    if (nextLevel && nextLevel <= level) break;
    if (nextLevel) {
      current = { question: (node.textContent || "").trim(), answer: "", is_active: true };
      extracted.push(current);
    } else {
      if (!current || !["P", "UL", "OL"].includes(node.tagName) || node.querySelector("img,iframe,table,video")) throw new Error("This FAQ block includes other content. Move it manually to preserve all details.");
      const copy = node.cloneNode(true) as Element;
      copy.querySelectorAll("a[href]").forEach((link) => { link.textContent = `${link.textContent} (${link.getAttribute("href")})`; });
      copy.querySelectorAll("li,br").forEach((element) => element.append("\n"));
      current.answer += `${current.answer ? "\n\n" : ""}${(copy.textContent || "").trim()}`;
    }
    nodes.push(node);
  }
  if (!extracted.length || extracted.some(({ question, answer }) => !question || !answer)) throw new Error("Each body FAQ needs a question heading and an answer before it can be moved.");
  const faqs = [...existing];
  for (const faq of extracted) {
    const match = existing.find(({ question }) => question.trim().toLocaleLowerCase() === faq.question.toLocaleLowerCase());
    if (match && match.answer.trim() !== faq.answer.trim()) throw new Error("A matching FAQ has a different saved answer. Resolve it manually before moving this section.");
    if (!match) faqs.push(faq);
  }
  const error = validateArticleFaqs(faqs);
  if (error) throw new Error(error);
  nodes.forEach((node) => node.remove());
  return { content: doc.body.innerHTML, faqs: faqs.map((faq, index) => ({ ...faq, display_order: index })) };
}
