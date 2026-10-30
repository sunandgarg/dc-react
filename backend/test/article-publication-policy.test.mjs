import test from 'node:test';
import assert from 'node:assert/strict';
import { assertArticlePublication } from '../src/article-publication-policy.mjs';
import { ARTICLE_LANGUAGES, hasBodyFaqs, translationTextError } from '../../public/article-languages.js';
const english = { id: 'root', language_code: 'en', site_scope: 'dekhocampus', status: 'Published', content: '<p>Original</p>' };
const hindi = { id: 'child', english_article_id: 'root', language_code: 'hi', site_scope: 'dekhocampus', status: 'Published', slug: 'test-hi', title: 'परीक्षा की जानकारी', description: 'आवेदन की जानकारी', content: '<p>परीक्षा की पूरी जानकारी यहाँ पढ़ें।</p>', meta_title: 'परीक्षा की जानकारी', meta_description: 'आवेदन की पूरी जानकारी', faqs: [{ question: 'आवेदन कैसे करें?', answer: 'आधिकारिक वेबसाइट देखें।' }] };
const tx = (parent = english, duplicate = null) => ({ $queryRawUnsafe: async (sql) => sql.includes('id <>') ? (duplicate ? [duplicate] : []) : (parent ? [parent] : []), faqs: { findMany: async () => [] } });
test('translations require a same-site English root and unique language slot', async () => {
  await assertArticlePublication(tx(), hindi);
  for (const parent of [null, { ...english, site_scope: 'sarkari' }, { ...english, language_code: 'ta' }, { ...english, english_article_id: 'other' }]) await assert.rejects(assertArticlePublication(tx(parent), hindi), /same site/);
  await assert.rejects(assertArticlePublication(tx(english, { id: 'other' }), hindi), /already exists/);
  await assert.rejects(assertArticlePublication(tx(), { ...hindi, english_article_id: null }), /English original/);
  await assert.rejects(assertArticlePublication(tx(), { ...english, english_article_id: 'other' }), /cannot be a translation/);
  await assert.rejects(assertArticlePublication(tx(), { ...hindi, language_code: 'ta' }, hindi), /cannot change/);
});
test('publishing rejects body FAQs across manual save paths, without blocking unrelated legacy edits', async () => {
  const body = '<h2>Questions students are asking</h2><h3>Can I apply?</h3><p>Yes</p>';
  await assert.rejects(assertArticlePublication({}, { ...english, content: body }), /dedicated FAQ/);
  await assertArticlePublication({}, { ...english, content: body, title: 'Changed' }, { ...english, content: body });
  await assertArticlePublication({}, { ...english, content: body, status: 'Draft' });
  assert.equal(hasBodyFaqs('<h2>What is the deadline?</h2><p>Read this.</p>'), false);
  assert.equal(hasBodyFaqs('## FAQs\n### Question?'), true);
  for (const { faq } of ARTICLE_LANGUAGES) assert.equal(hasBodyFaqs(`<h2>${faq}</h2>`), true);
});
test('translations need local-language public fields and dedicated translated FAQs', async () => {
  assert.equal(translationTextError(hindi), null);
  for (const key of ['title', 'description', 'content', 'meta_title', 'meta_description']) await assert.rejects(assertArticlePublication(tx(), { ...hindi, [key]: 'English only' }), /before publishing/);
  await assert.rejects(assertArticlePublication(tx(), { ...hindi, faqs: [] }), /translated FAQs/);
  await assert.rejects(assertArticlePublication(tx(), { ...hindi, faqs: [{question:'English?',answer:'English.'}] }), /Translate every FAQ/);
  await assertArticlePublication(tx(), { ...hindi, content: '', status: 'Draft', faqs: [] });
});

test('anonymous article reads expose language links while retaining publication and site filters', async () => {
  const { handleRequest } = await import('../src/index.mjs');
  const { prisma } = await import('../src/db.mjs');
  const originalQuery = prisma.$queryRawUnsafe;
  let statement, parameters;
  prisma.$queryRawUnsafe = async (sql, ...params) => { statement = sql; parameters = params; return [{id:'root',language_code:'en',english_article_id:null}]; };
  try {
    const response = await handleRequest(new Request('https://aws-origin.dekhocampus.com/v1/rest/articles?status=eq.Draft&is_active=eq.false&or=(id.eq.root,english_article_id.eq.root)', {headers:{'cache-control':'no-store'}}));
    assert.equal(response.status,200);
    assert.match(statement,/`language_code`/);
    assert.match(statement,/`english_article_id`/);
    assert.ok(parameters.includes('Published'));
    assert.ok(parameters.includes('dekhocampus'));
    assert.ok(!parameters.includes('Draft'));
    assert.equal((await response.json())[0].language_code,'en');
  } finally { prisma.$queryRawUnsafe = originalQuery; }
});
