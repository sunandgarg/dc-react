# DekhoCampus SEO implementation

## Public discovery endpoints

- Canonical sitemap index: `https://dekhocampus.com/sitemap.xml`
- Alias sitemap index: `https://dekhocampus.com/sitemap-index.xml`
- Rolling Google News sitemap: `https://dekhocampus.com/news-sitemap.xml`
- RSS distribution feed: `https://dekhocampus.com/news-feed.xml`
- Robots policy: `https://dekhocampus.com/robots.txt`
- AI crawler summary: `https://dekhocampus.com/llms.txt`

## Runtime guarantees

- Cloudflare edge HTML supplies crawler-visible title, description, canonical, robots, Open Graph, Twitter and JSON-LD values.
- Published articles expose their body, hero image, `NewsArticle`, `Organization` and `BreadcrumbList` in the initial response.
- College, course and exam pages expose entity, image, page and breadcrumb schema. `VideoObject` is added only when a real YouTube URL, image and update date are present.
- Unknown public pages and missing article/entity records return HTTP 404. Private SPA routes remain HTTP 200 with `noindex`.
- The sitemap publisher uses immutable S3 generations and swaps the root index only after every chunk is written.
- Homepage AdSense loading is disabled. Article and other eligible public routes retain managed placements.

## Search platform operations

- Submit the root sitemap once to Google Search Console and Bing Webmaster Tools.
- The News sitemap is a rolling two-day feed and may also be submitted directly in Search Console.
- Google News and Discover eligibility is automatic. Do not build Publisher Center registration.
- Bing PubHub is retired. Use Bing Webmaster Tools plus IndexNow.

## Release checks

Run:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
npm --prefix backend test
```

After deployment, verify the four discovery endpoints, a current article, a college page, an indexable filter and an unknown URL.
