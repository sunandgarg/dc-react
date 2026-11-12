import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('college edits preserve untouched placement and submit explicit clears', async () => {
  const source = await readFile(new URL('../../src/pages/AdminColleges.tsx', import.meta.url), 'utf8');
  const block = source.match(/    if \(baseline\) \{([\s\S]*?)\n    \}\n    saveCollege/)[1];
  const apply = new Function('payload', 'baseline', block);
  const baseline = {id:'college', placement:'12 LPA', brochure_url:'old.pdf', highlights:['One']};
  const payload = {...baseline, brochure_url:'new.pdf'};
  apply(payload, baseline);
  assert.deepEqual(payload, {id:'college', brochure_url:'new.pdf'});
  const clear = {...baseline, placement:''};
  apply(clear, baseline);
  assert.deepEqual(clear, {id:'college', placement:''});
});

for (const page of ['AdminCourses', 'AdminExams']) {
  test(`${page} passes page size and submitted search separately`, async () => {
    const source = await readFile(new URL(`../../src/pages/${page}.tsx`, import.meta.url), 'utf8');
    assert.match(source, /useAdminCatalogList\("(?:courses|exams)", visibleCount, submittedSearch, statusFilter\)/);
  });
}

test('admin article search uses titles and slugs without scanning bodies', async () => {
  const source = await readFile(new URL('../../src/hooks/useArticlesData.ts', import.meta.url), 'utf8');
  const query = source.slice(source.indexOf('export function useAdminArticles'), source.indexOf('export function useAdminArticles') + 2200);
  assert.ok(query.includes('title.ilike.${ilikeTerm},slug.ilike.${ilikeTerm}'));
  assert.ok(!query.includes('content.ilike'));
});
