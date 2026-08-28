import { useEffect } from "react";
import { absoluteCanonical } from "@/lib/constant";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  jsonLd?: object | object[];
}

/** Lightweight SEO updater - no extra deps. Sets document.title + meta tags + OG/Twitter + JSON-LD. */
export function SEO({
  title,
  description,
  keywords,
  canonical,
  ogImage,
  ogType = "website",
  twitterCard = "summary_large_image",
  jsonLd,
}: SEOProps) {
  const jsonLdText = JSON.stringify(jsonLd ?? null);

  useEffect(() => {
    const canonicalUrl = absoluteCanonical(canonical || window.location.pathname);
    const ogImageUrl = absoluteCanonical(ogImage);
    if (title) document.title = title;

    const setNameMeta = (name: string, content?: string) => {
      if (!content) return;
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.name = name;
        document.head.appendChild(el);
      }
      el.content = content;
    };

    const setPropMeta = (property: string, content?: string) => {
      if (!content) return;
      let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    if (description) setNameMeta("description", description);
    if (keywords) setNameMeta("keywords", keywords);
    setNameMeta("robots", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");

    if (canonicalUrl) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = canonicalUrl;
    }

    // OpenGraph
    if (title) setPropMeta("og:title", title);
    if (description) setPropMeta("og:description", description);
    if (canonicalUrl) setPropMeta("og:url", canonicalUrl);
    setPropMeta("og:type", ogType);
    if (ogImageUrl) setPropMeta("og:image", ogImageUrl);

    // Twitter
    setNameMeta("twitter:card", twitterCard);
    if (title) setNameMeta("twitter:title", title);
    if (description) setNameMeta("twitter:description", description);
    if (canonicalUrl) setNameMeta("twitter:url", canonicalUrl);
    if (ogImageUrl) setNameMeta("twitter:image", ogImageUrl);

    // JSON-LD
    const id = "ld-json-page";
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    if (jsonLdText !== "null") {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = id;
      script.text = jsonLdText;
      document.head.appendChild(script);
    }
  }, [title, description, keywords, canonical, ogImage, ogType, twitterCard, jsonLdText]);
  return null;
}
