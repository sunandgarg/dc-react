import assert from "node:assert/strict";

export async function verifyGeneratedDraftFaqs(faqModel, articleSlug) {
  const rows = await faqModel.findMany({
    where: { page: "articles", item_slug: articleSlug },
    select: { is_active: true },
  });
  assert.ok(rows.length >= 4, `Generated article stored only ${rows.length} dedicated FAQs`);
  assert.equal(
    rows.every((faq) => faq.is_active === false),
    true,
    "Generated Draft article has active dedicated FAQs",
  );
  return rows.length;
}
