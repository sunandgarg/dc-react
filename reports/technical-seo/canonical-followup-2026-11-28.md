# DekhoCampus technical SEO follow-up, 28 November 2026

## What the evidence says

- Search Console's latest Page indexing snapshot inspected in the browser was **last updated 23 November 2026**. It showed 115,345 URLs under “Alternate page with proper canonical tag”, 1,588 soft 404s and 4,667 “Google chose different canonical” URLs. Its example alternate URLs were mostly nested college and course sections. This snapshot predates the 26 November sitemap correction, so none of those counts measures that release.
- The 26 November production sitemap check found 46,630 URLs in 19 category chunks. It found no nested college section aliases. The previous publisher had submitted 16 aliases for each of 13,021 active colleges, or 208,336 nonpreferred URLs. Those routes intentionally use the parent college canonical. Search Console can continue to show previously discovered aliases until Google recrawls them.
- The generic `index.html` used as the Cloudflare Pages SPA fallback declares the homepage canonical. A non-prerendered dynamic route therefore receives the wrong initial canonical before React hydrates. This was observed on college, scholarship, career and study material samples in the 25 November audit CSV. An unknown college URL also returned HTTP 200. These remain unresolved.
- The live sitemap publisher also generated 18 strategy URLs for every exam even though most strategies are generated advice on the same full exam detail page. This is a separate source of thin or near-duplicate URL submissions.

## Change prepared in this follow-up

- Stop automatically submitting the generated exam strategy variants in all three sitemap paths: AWS publisher, build generator and admin preview.
- Keep `/sample-paper` in the sitemap only when the exam record contains a sample paper URL or at least one linked question paper. Existing URLs and navigation remain unchanged.
- Align initial edge metadata and the hydrated exam page: generated strategy routes now canonicalize to the main exam guide; `/sample-paper` remains self-canonical only when a usable paper link exists. This corrects the previous self-canonical/sitemap disagreement without redirecting existing visits.
- Keep the 15 existing exam section URLs for now. Their content quality and search performance need a separate record-level review before changing their canonicals or removing them from the sitemap.

## Verification

- 768 frontend tests passed; TypeScript check passed; lint had one existing React Hook warning and no errors.
- 12 sitemap publisher tests passed, including a new check that empty paper collections are omitted and generated minute-plan variants are absent.
- The offline production build passed. It had no database source, so its 4,370 static build URLs are **not** a measurement of the live 46,630-URL sitemap or the size of the reduction in production.
- Full backend test suite passed when run with localhost binding permitted: 420 passed, 2 skipped.
- The edge SEO regression test checks that generated strategy routes use the main exam canonical, while a real paper collection keeps its own canonical.
- AWS production workflow [#319](https://github.com/sunandgarg/dc-react/actions/runs/46058434478) and Cloudflare Pages production workflow [#258](https://github.com/sunandgarg/dc-react/actions/runs/46059489664) both completed successfully for commit `539ba78`.
- The prior exam generation contained 17,627 XML `loc` elements, including image locations; the new generation contains 8,629. The exact 8,998 reduction comprises 8,748 generated strategy URLs (18 per 486 exams) and 250 `/sample-paper` URLs without a linked paper. Counting only page `<url>` records, the new exam generation has 8,131 URLs across three chunks. The complete current sitemap index has 18 children with 41,221 `<url>` records, including any URLs repeated in specialist sitemap feeds.
- Live HTTP checks returned 200 and one absolute self-canonical in the initial HTML for `/news/iift-mba-2027-registration-payment-before-cat` and `/exams/vitree-30815/sample-paper`. Both URLs occur in the new sitemap. The homepage also returned 200 with one homepage canonical.
- Live checks still found the homepage canonical in the initial HTML of `/exams/jee-mains-30169/tips-and-tricks` and `/colleges/amity-university-noida-14738/courses`. Neither is in the new sitemap. After hydration, the exam strategy route has one parent-exam canonical and the college courses route has one parent-college canonical. This initial-versus-rendered discrepancy is unresolved.
- `/definitely-not-a-page-404-check` still returned HTTP 200 with a homepage canonical. The current Cloudflare Pages workflow explicitly tests for this SPA fallback behavior. It must be replaced with a record-aware 404 design before we can claim soft 404 resolution.

## Remaining work

1. Serve entity-specific initial HTML and real HTTP 404s for dynamic routes without sending every visit through the Cloudflare Free Function quota. Cloudflare Pages Free has a 20,000-file static limit, below the current 41,221 sitemap `<url>` records, and the site previously exceeded its 100,000 daily Function invocations. This requires a capacity-safe serving design, such as an adequately sized origin for HTML responses, followed by a staged rollout and load test.
2. Verify every dynamic route family against live records and Search Console URL Inspection after that serving change. The earlier 14-row CSV and this follow-up's six-row CSV are representative samples, not an exhaustive 41,221-record crawl.
3. Review exam section pages, faceted listings, study material and other database-driven paths for genuinely distinct content. Do not blindly self-canonicalize aliases or remove URLs with demonstrated search value.
4. Compare Search Console's next completed indexing snapshot with its 23 November baseline. A sitemap change does not force Google indexing or instant removal of previously discovered URLs.

Production status for this follow-up: **deployed and verified for the exam sitemap and sampled routes**. The sitewide initial-HTML canonical and soft 404 issues remain open. Search Console's 23 November indexing counts cannot be treated as post-release results; Google must recrawl the affected URLs before those counts can change.
