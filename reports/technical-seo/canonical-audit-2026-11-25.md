# DekhoCampus canonical audit, 25 November 2026

## Evidence and scope

- Google Search Console's 16 November Page indexing snapshot lists 177,807 URLs as “Alternative page with proper canonical tag”. This is a discovery count, not a count of valuable pages that should all be indexed.
- The production database reports 13,021 active colleges. The prior sitemap publisher emitted 16 nested section URLs for each one, in addition to the preferred college URL. That is 208,336 nonpreferred college section URLs eligible for submission. The college UI and edge metadata both canonicalize those section routes to the college's main URL, so these are deliberate consolidation candidates.
- The production root sitemap exposed only five static child files and 12,814 distinct locations in this audit. The AWS origin had a different, much larger 87-child sitemap index. The Pages route configuration bypassed the edge proxy for `/sitemap.xml`, exposing the stale static root to Google.
- Initial HTML for a sampled live college URL, scholarship URL, study-material URL and career URL had the homepage canonical, whereas several rendered React pages had a route-specific canonical. The Pages Function is intentionally limited to news and selected paths because the free daily invocation limit has previously been exhausted. This is a separate, unresolved rendering problem.
- A nonexistent college route returned HTTP 200 with the SPA shell in the sample, a soft-404 risk. Robots.txt allows Googlebot to crawl public paths. No sampled HTTP canonical `Link` header or `X-Robots-Tag` conflict was observed.
- The mixed-case `/news/tag/Affiliation` URL initially declared a mixed-case canonical, while the hydrated page declared the lower-case tag URL. The sitemap uses lower-case tag slugs.

## Changes in this release

- Remove nested college section URLs from both the static sitemap generator and the live MySQL sitemap publisher. Keep the existing parent canonical on those sections.
- Publish live sitemap chunks by category (colleges, courses, exams, news, scholarships, study material, other), with 3,000 locations or fewer per chunk.
- Route the root sitemap and immutable child files through the existing edge proxy. This makes the canonical-domain sitemap use the live AWS generation while keeping ordinary page views outside the free Worker quota.
- Ensure the edge HTML transformer emits exactly one canonical link, even when the source shell contains duplicate canonical tags.
- Canonicalize mixed-case news tag URLs to their existing lower-case tag path in initial HTML, matching the hydrated page and sitemap.
- Add canonical, routing and category sitemap regression checks.

## Verification before deployment

- Frontend: 763 tests passed; lint exited successfully with one pre-existing React Hook dependency warning.
- Sitemap publisher: 12 tests passed, including category separation and immutable-file serving.
- Canonical transform: 1 additional route matrix test passed.
- Production build passed and generated 46,751 URLs across 16 static seed files. No nested college section URL appears in the new seed.
- The linked CSV contains 14 representative live URLs. Its rendered-canonical column is marked “not measured” where browser hydration was not conclusively observed. The CSV is a sample, not a claim that 200,000+ URLs were individually fetched.

## Remaining work and risk

- Many dynamic entity pages still serve generic initial HTML. Making all of them server rendered requires a capacity-safe architecture change; routing every page through the current free Cloudflare Function would risk another quota outage. Do not treat the sitemap correction as a fix for this issue.
- Some indexable routes may have thin, empty or duplicate main content. The 14-URL sample found one nonexistent college route returning HTTP 200. A full record-quality review and real 404 handling remain necessary.
- Search Console counts lag deployments and will change only as Google recrawls. The 177,807 figure cannot be marked resolved immediately after release.

## Production verification, 26 November 2026 IST

- AWS deployment `45607747872` and Cloudflare deployment `45661028964` both completed successfully. The Cloudflare release used commit `0c6958e`.
- The canonical-domain root sitemap now serves the live AWS index: 21 child files, including 19 category chunks. The category chunks contain 46,630 URLs: 16,192 college, 988 course, 17,129 exam, 8,566 news, 120 scholarship, 2,674 study-material and 961 other URLs. No college section alias was found in these chunks. The largest chunk has 3,000 URLs, below Google's 50,000-URL limit.
- All 19 category child URLs returned HTTP 200 with XML content type on verification. Three concurrent HEAD probes timed out initially; each passed when retried sequentially. This is a performance observation, not an indexing confirmation.
- `/news/tag/Affiliation` now declares a single lower-case `/news/tag/affiliation` canonical in initial HTML. The root sitemap returns HTTP 200 as `application/xml` with a path-specific edge cache response.
- The 14-row CSV remains a **pre-deployment** representative snapshot. Its problems column records the original response, including unresolved generic initial HTML on non-news dynamic routes. Google Search Console's old exclusion totals must not be presented as post-deployment counts.
