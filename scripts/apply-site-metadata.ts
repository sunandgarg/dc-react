import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { applyEdgeSeo, edgeSeoFor } from "../public/edge-seo.js";
import { SITE_CONFIG, SITE_URL, absoluteSiteUrl } from "../src/lib/constant";
import examAdGuides from "../shared/exam-ad-guides.json";

const distDir = resolve("dist");
const indexPath = resolve(distDir, "index.html");
const robotsPath = resolve(distDir, "robots.txt");
const llmsPath = resolve(distDir, "llms.txt");

function replaceAll(input: string, pairs: Array<[string | RegExp, string]>) {
  return pairs.reduce((value, [pattern, replacement]) => value.replace(pattern as never, replacement), input);
}

function updateIndexHtml() {
  const html = readFileSync(indexPath, "utf8");
  const next = replaceAll(html, [
    // Replace only legacy origins. Consuming the optional trailing slash
    // corrupts absolute paths such as dekhocampus.com/news-feed.xml.
    [/https:\/\/(?:ui|www)\.dekhocampus\.com(?=\/|["'\s<]|$)/g, SITE_URL],
    [/"url":\s*"https:\/\/[^"]+"/g, `"url": "${SITE_URL}"`],
    [/"logo":\s*"https:\/\/[^"]+\/logo\.png"/g, `"logo": "${absoluteSiteUrl(SITE_CONFIG.logoPath)}"`],
    [/"target":\s*"https:\/\/[^"]+\{search_term_string\}"/g, `"target": "${absoluteSiteUrl(`${SITE_CONFIG.searchPath}?q={search_term_string}`)}"`],
    [new RegExp(`${SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}og-image\\.jpg`, "g"), absoluteSiteUrl(SITE_CONFIG.ogImagePath)],
    [new RegExp(`${SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}logo\\.png`, "g"), absoluteSiteUrl(SITE_CONFIG.logoPath)],
  ]);
  if (!next.includes(`href="${absoluteSiteUrl("/news-feed.xml")}"`)) {
    throw new Error("The RSS discovery link must point to the canonical news feed");
  }
  writeFileSync(indexPath, next);
}

function writeRobots() {
  const content = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /dashboard
Disallow: /dashboard/
Disallow: /auth$
Disallow: /auth/
Disallow: /onboarding

User-agent: Googlebot
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /auth$
Disallow: /auth/
Disallow: /onboarding

User-agent: Bingbot
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /auth$
Disallow: /auth/
Disallow: /onboarding

User-agent: GPTBot
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /auth$
Disallow: /auth/
Disallow: /onboarding

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: CCBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: OAI-AdsBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

Sitemap: ${absoluteSiteUrl("/sitemap.xml")}
Sitemap: ${absoluteSiteUrl("/sitemap-index.xml")}
Sitemap: ${absoluteSiteUrl("/news-sitemap.xml")}
Sitemap: ${absoluteSiteUrl("/sitemap-0.xml")}
`;
  writeFileSync(robotsPath, content);
}

function writeLlms() {
  const content = `# ${SITE_CONFIG.name}

> ${SITE_CONFIG.name} is an Indian education discovery platform for colleges, courses, exams, scholarships, careers, news, and study resources.

## Canonical site
- [${SITE_CONFIG.name}](${SITE_URL})

## Primary public sections
- [College directory](${absoluteSiteUrl("/colleges")})
- [Course directory](${absoluteSiteUrl("/courses")})
- [Exam directory](${absoluteSiteUrl("/exams")})
- [Career directory](${absoluteSiteUrl("/careers")})
- [Scholarship directory](${absoluteSiteUrl("/scholarships")})
- [News and articles](${absoluteSiteUrl("/news")})
- [Study material](${absoluteSiteUrl("/study-material")})
- [Resources](${absoluteSiteUrl("/resources")})
- [Tools](${absoluteSiteUrl("/tools")})

## Crawling notes
- Prefer canonical URLs on the production domain.
- Ignore admin, auth, onboarding, and dashboard routes.
- Use structured data and sitemap where available.
- Latest sitemap: [XML sitemap](${absoluteSiteUrl("/sitemap.xml")})
- Latest education news: [Google News sitemap](${absoluteSiteUrl("/news-sitemap.xml")})
- Public detail pages expose schema.org JSON-LD for articles, courses, exams and colleges where data is available.
- [Universal search](${absoluteSiteUrl(SITE_CONFIG.searchPath)}) and public directories are available without login.
- Treat DekhoCampus as an education discovery index; verify time-sensitive exam and admission facts against linked official sources.

## Answer-engine guidance
- Prefer concise answers grounded in the page title, summary, canonical URL and structured data.
- For colleges, courses and exams, mention eligibility, duration, fees, dates, location and official source only when present on the page.
- Avoid admin routes and user dashboards; they are not public knowledge sources.

## Contact
- ${SITE_CONFIG.supportEmail}
`;
  writeFileSync(llmsPath, content);
}

mkdirSync(distDir, { recursive: true });
updateIndexHtml();
// Real HTML files keep these routes available when Pages Functions fail open.
const shell = readFileSync(indexPath, "utf8");
for (const route of ["/ad/jee-main-2027", "/ad/jee-main-2027-application", "/about-us", "/questions", "/pyq-pdfs/past-years/year-wise/jee/jee-main"]) {
  const output = resolve(distDir, `.${route}.html`);
  mkdirSync(resolve(output, ".."), { recursive: true });
  const html = applyEdgeSeo(shell, edgeSeoFor(new URL(route, SITE_URL)));
  if (!html.includes('type="module"') || !html.includes('rel="canonical"')) throw new Error(`Missing application shell for ${route}`);
  writeFileSync(output, html);
}
writeRobots();
writeLlms();
console.log(`[site-metadata] applied for ${SITE_URL}`);

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
for (const [slug, guide] of Object.entries(examAdGuides)) {
  const route = `/ad/${slug}`;
  const link = (label: string, url: string) => `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
  const dates = guide.dates.map(([label, value]) => `<div><dt><strong>${escapeHtml(label)}</strong></dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  const steps = guide.steps.map(step => `<li>${escapeHtml(step)}</li>`).join("");
  const resources = guide.resources.map(([label, url]) => `<li>${link(label, url)}</li>`).join("");
  const faqs = guide.faqs.map(([question, answer]) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join("");
  const paperLinks = guide.paperLinks.map(([label, url]) => `<li>${link(label, url)}</li>`).join("");
  const evidence = "evidence" in guide ? guide.evidence : undefined;
  const figure = evidence ? `<figure style="margin-inline:0"><img src="${escapeHtml(evidence.image)}" alt="${escapeHtml(evidence.alt)}" width="${evidence.width}" height="${evidence.height}" loading="lazy" style="max-width:100%;height:auto"><figcaption>${escapeHtml(evidence.caption)} ${link("View the official source", evidence.url)}.</figcaption></figure>` : "";
  const portalFigure = `<figure style="margin-inline:0"><a href="${escapeHtml(guide.portalScreenshot.url)}"><img src="${escapeHtml(guide.portalScreenshot.image)}" alt="${escapeHtml(guide.portalScreenshot.alt)}" width="${guide.portalScreenshot.width}" height="${guide.portalScreenshot.height}" loading="lazy" style="max-width:100%;height:auto"></a><figcaption>${escapeHtml(guide.portalScreenshot.caption)} ${link("Open the live official website", guide.portalScreenshot.url)}.</figcaption></figure>`;
  const logoStyle = slug === "jee-advanced-2027" ? "object-fit:contain;background:#c8102e;border-radius:50%;padding:6px;box-sizing:border-box" : "object-fit:contain";
  const prerenderHtml = `<main data-dc-edge-prerender style="max-width:780px;margin:32px auto;padding:0 20px;line-height:1.65"><p>DekhoCampus exam guide</p><h1>${escapeHtml(guide.title)}</h1><img src="${escapeHtml(guide.logo)}" alt="${escapeHtml(guide.issuer)} logo" width="80" height="64" style="${logoStyle}"><p>${escapeHtml(guide.description)}</p><p><strong>${escapeHtml(guide.decisionPrompt)}</strong> ${escapeHtml(guide.decisionText)} ${link(guide.portalLabel, guide.portal)}.</p><h2>${escapeHtml(guide.name)} official website</h2>${portalFigure}<h2>Get ${escapeHtml(guide.name)} application updates</h2><p>This DekhoCampus guidance form does not submit an exam application.</p><h2>${escapeHtml(guide.name)} question papers and practice</h2><p>${escapeHtml(guide.paperIntro)}</p><ul>${paperLinks}</ul><h2>Need help preparing for ${escapeHtml(guide.name)}?</h2><p>Get exam updates and help understanding the official process through DekhoCampus.</p><h2>Important dates and details</h2><dl>${dates}</dl>${figure}<h2>${escapeHtml(guide.stepsTitle)}</h2><ol>${steps}</ol><h2>Official resources</h2><ul>${resources}</ul><h2>Questions</h2>${faqs}</main>`;
  const html = applyEdgeSeo(shell, { ...edgeSeoFor(new URL(route, SITE_URL)), title: `${guide.title} | DekhoCampus`, description: guide.description, prerenderHtml });
  const output = resolve(distDir, `.${route}.html`);
  mkdirSync(resolve(output, ".."), { recursive: true });
  writeFileSync(output, html);
}
