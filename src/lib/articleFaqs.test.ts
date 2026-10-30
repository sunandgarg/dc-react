import { describe, it, expect } from 'vitest';
import { extractBodyFaqs } from './articleFaqs';
import { newTranslationDraft } from '@/components/admin/ArticleLanguageEditor';
import { articleEdgeSeo, applyEdgeSeo } from '../../public/edge-seo.js';
describe('dedicated FAQs', () => {
  it('moves only the FAQ block, preserving later content and official links', () => {
    const result = extractBodyFaqs('<p>Intro</p><h2>Questions students are asking</h2><h3>When?</h3><p>Read <a href="https://example.gov/notice">the notice</a>.</p><h2>Next steps</h2><p>Keep this.</p>');
    expect(result.content).toContain('Next steps');
    expect(result.content).not.toContain('When?');
    expect(result.faqs[0].answer).toContain('https://example.gov/notice');
    expect(result.faqs[0].question).toBe('When?');
  });
  it('refuses to discard unsupported content or overwrite a different saved answer', () => {
    expect(() => extractBodyFaqs('<h2>FAQs</h2><h3>When?</h3><p><img src="notice.png"></p>')).toThrow(/preserve/);
    expect(() => extractBodyFaqs('<h2>FAQs</h2><h3>When?</h3><p>New answer</p>', [{question:'When?', answer:'Old answer'}])).toThrow(/different/);
    expect(() => extractBodyFaqs('<h2>FAQs</h2><h3>When?</h3>')).toThrow(/answer/);
  });
});
it('creates a blank linked translation with shared cover and byline, never copied English content', () => {
  const result = newTranslationDraft({id:'root', slug:'exam', title:'English', content:'English', author:'Author', featured_image:'cover.png'}, 'ta');
  expect(result).toMatchObject({english_article_id:'root', language_code:'ta', slug:'exam-ta', title:'',content:'',author:'Author',featured_image:'cover.png',status:'Draft',is_active:false});
  expect(result.id).toBeUndefined();
});
it('renders self canonical, native language and reciprocal alternates in initial HTML', () => {
  const versions = [{id:'root',slug:'exam',language_code:'en'}, {id:'child',slug:'exam-hi',language_code:'hi'}];
  const metadata = articleEdgeSeo({ title:'परीक्षा की जानकारी',slug:'exam-hi',language_code:'hi',content:'<p>जानकारी</p>',language_versions:versions },new URL('https://dekhocampus.com/news/exam-hi'));
  const html = applyEdgeSeo('<html lang="en"><head><title>Old</title></head><body><div id="root"></div></body></html>',metadata);
  expect(html).toContain('<html lang="hi">');
  expect(html).toContain('rel="canonical" href="https://dekhocampus.com/news/exam-hi"');
  expect(html).toContain('hreflang="en" href="https://dekhocampus.com/news/exam"');
  expect(html).toContain('hreflang="hi" href="https://dekhocampus.com/news/exam-hi"');
  expect(html).toContain('hreflang="x-default"');
  expect(html).toContain('हिन्दी');
  expect(html).toContain('"inLanguage":"hi"');
});

it('puts English first in the shared language navigation without mutating records', async () => {
  const { orderedArticleVersions } = await import('../../public/article-languages.js');
  const versions = [{id:'ta',slug:'exam-ta',language_code:'ta'}, {id:'en',slug:'exam',language_code:'en'}, {id:'hi',slug:'exam-hi',language_code:'hi'}];
  expect(orderedArticleVersions(versions).map(v => v.language_code)).toEqual(['en', 'ta', 'hi']);
  expect(versions[0].language_code).toBe('ta');
  const html = articleEdgeSeo({title:'Exam', slug:'exam-ta', language_code:'ta', language_versions:versions}, new URL('https://dekhocampus.com/news/exam-ta')).prerenderHtml;
  expect(html).toContain('<nav aria-label="Article languages"><a href="/news/exam" hreflang="en"');
});
