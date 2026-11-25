# DekhoCampus canonical audit, 25 November 2026

## Evidence and scope

- Google Search Console's 16 November Page indexing snapshot lists 177,807 URLs as “Alternative page with proper canonical tag”. This is a discovery count, not a count of valuable pages that should all be indexed.
- The production database reports 13,021 active colleges. The prior sitemap publisher emitted 16 nested section URLs for each one, in addition to the preferred college URL. That is 208,336 nonpreferred college section URLs eligible for submission. The college UI and edge metadata both canonicalize those section routes to the college's main URL, so these are deliberate consolidation candidates.
- The production root sitemap exposed only five static child files and 12,814 distinct locations in this audit. The AWS origin had a different, much larger 87-child sitemap index. The Pages route configuration bypassed the edge proxy for `/sitemap.xml`, exposing the stale static root to Google.
- Initial HTML for a sampled live college URL, scholarship URL, study-material URL and career URL had the homepage canonical, whereas several rendered React pages had a route-specific canonical. The Pages Function is intentionally limited to news and selected paths because the free daily invocation limit has previously been exhausted. This is a separate, unresolved rendering problem.
- A nonexistent college route returned HTTP 200 with the SPA shell in the sample, a soft-404 risk. Robots.txt allows Googlebot to crawl public paths. No sampled HTTP canonical `Link` header or `X-Robots-Tag` conflict was observed.

## Changes in this release

- Remove nested college section URLs from both the static sitemap generator and the live MySQL sitemap publisher. Keep the existing parent canonical on those sections.
- Publish live sitemap chunks by category (colleges, courses, exams, news, scholarships, study material, other), with 3,000 locations or fewer per chunk.
- Route the root sitemap and immutable child files through the existing edge proxy. This makes the canonical-domain sitemap use the live AWS generation while keeping ordinary page views outside the free Worker quota.
- Ensure the edge HTML transformer emits exactly one canonical link, even when the source shell contains duplicate canonical tags.
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
