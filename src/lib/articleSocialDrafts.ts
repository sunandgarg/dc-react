import { SITE_URL } from "./constant";
import { plainText } from "./plainText";
import { slugify } from "./slugify";
import type { SiteScope } from "./siteScope";

export function articleSocialDrafts(article: { title: string; slug: string; description: string }, siteScope: SiteScope) {
  const slug = slugify(article.slug);
  if (!slug) return [];
  const title = plainText(article.title);
  const summary = plainText(article.description).slice(0, 500);
  const origin = siteScope === "sarkari" ? "https://sarkari.dekhocampus.com" : SITE_URL;
  return ["LinkedIn", "Facebook", "Instagram"].map((platform) => {
    const url = new URL(`/news/${slug}`, origin);
    url.searchParams.set("utm_source", platform.toLowerCase());
    url.searchParams.set("utm_medium", "social");
    url.searchParams.set("utm_campaign", "article");
    return { platform, url: url.href, caption: [title, summary, `Read the full article: ${url.href}`, "#DekhoCampus #Education"].filter(Boolean).join("\n\n") };
  });
}
