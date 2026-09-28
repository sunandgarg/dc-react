# Writer profile repair

## Causes

- Public author profiles requested the same columns from seven different tables. An actual public college query returned `Unknown column colleges.title`; authenticated article reads also reject the invalid article columns. Errors were silently rendered as empty lists.
- Contributions were limited to 50 rows, without ordering or pagination.
- Legacy articles saved with a text byline but no author ID were excluded.
- The Authors admin screen's Dashboard link opened the logged-in user's dashboard, not that author's profile.
- The local preview `/auth` API proxy also matched `/author/...` and returned an API 404 instead of the page.

## Changes

- Correct per-table selections, explicit visibility filters, newest-first stable ordering, exact totals and paginated Load more.
- Articles match the explicit author ID, or an exact legacy byline only when the author ID is null. Another author's explicit assignment is never overridden.
- Article queries explicitly require active, Published, DekhoCampus records, including for admin visitors. Other entities require active records and exclude Draft statuses where present.
- Search operates on all matching database rows, not only the currently loaded cards. Content-type filters, dates and retry actions are visible.
- Authors admin links now open the public profile and published work. My Writer Profile links to published work and the existing Articles/drafts screen. Profile load failure no longer offers a blank editable form.
- Local login proxy now matches `/auth/v1` API calls only, leaving both `/auth` login and `/author/...` pages to the frontend router.

## Verification

- All 412 frontend tests passed across 86 files, including 19 new profile/query/navigation regression tests.
- Lint: no errors; existing unrelated `App.tsx` hook dependency warning remains.
- Production build and sitemap generation passed with network access. The sandboxed build's sitemap fetch was blocked, then passed on the network-enabled build.
- The separate repository-wide TypeScript check reports errors in untouched modules; no errors were reported in the changed profile/query files. These unrelated errors were not repaired in this scoped change.
- Local browser using live public data: Geethika Reddy showed 131 articles and 4 colleges; 72 article cards loaded successfully, including a 13 July 2026 article. Searching Chemical Kinetics returned that older article. All seven contribution queries completed without visible errors.

## Scope

No production database writes, author reassignment, permission changes, AI-blog changes or AWS backend changes. Old articles without an author ID or an exact matching byline cannot safely be attributed automatically.

Navigation: content writer → Admin → My Writer Profile → View my published work / My articles and drafts. Administrator → Authors / Team → Profile / Published work.
