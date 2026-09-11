import assert from "node:assert/strict";
import test from "node:test";
import { verifyGeneratedDraftFaqs } from "../src/blog-smoke.mjs";

test("draft blog smoke queries every matching FAQ and requires at least four inactive rows", async () => {
  const queries = [];
  const faqModel = {
    async findMany(query) {
      queries.push(query);
      return Array.from({ length: 4 }, () => ({ is_active: false }));
    },
  };

  assert.equal(await verifyGeneratedDraftFaqs(faqModel, "generated-draft"), 4);
  assert.deepEqual(queries, [{
    where: { page: "articles", item_slug: "generated-draft" },
    select: { is_active: true },
  }]);
});

test("draft blog smoke rejects missing or active dedicated FAQs", async () => {
  await assert.rejects(
    verifyGeneratedDraftFaqs({ findMany: async () => Array.from({ length: 3 }, () => ({ is_active: false })) }, "too-few"),
    /stored only 3 dedicated FAQs/,
  );
  await assert.rejects(
    verifyGeneratedDraftFaqs({ findMany: async () => [
      { is_active: false },
      { is_active: false },
      { is_active: false },
      { is_active: true },
    ] }, "active-faq"),
    /Draft article has active dedicated FAQs/,
  );
});
