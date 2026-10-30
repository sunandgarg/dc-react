import { useEffect } from "react";
import { absoluteCanonical } from "@/lib/constant";

type SEOOptions = {
  title?: string;
  exactTitle?: boolean;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  jsonLd?: object | object[];
  language?: string;
  alternates?: { language: string; href: string }[];
};

export function useSEO({
  title,
  exactTitle = false,
  description,
  keywords,
  canonical,
  ogImage,
  ogType = "website",
  jsonLd,
  language = "en",
  alternates = [],
}: SEOOptions) {
  const alternatesKey = JSON.stringify(alternates);
  const jsonLdKey = JSON.stringify(jsonLd ?? null);

  useEffect(() => {
    document.documentElement.lang = language;
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((link) => link.remove());
    for (const alternate of JSON.parse(alternatesKey)) {
      const link = document.createElement("link");
      link.rel = "alternate";
      link.hreflang = alternate.language;
      link.href = absoluteCanonical(alternate.href);
      document.head.appendChild(link);
    }
    if (title) {
      document.title = exactTitle || title.includes("DekhoCampus") ? title : `${title} | DekhoCampus`;
    }

    const setNameMeta = (name: string, content?: string) => {
      if (!content) return;
      let meta = document.querySelector(`meta[name="${name}"]`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", name);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    const setPropertyMeta = (property: string, content?: string) => {
      if (!content) return;
      let meta = document.querySelector(`meta[property="${property}"]`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("property", property);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    const canonicalUrl = absoluteCanonical(canonical || window.location.pathname);
    const imageUrl = absoluteCanonical(ogImage);
    setNameMeta("description", description);
    setNameMeta("keywords", keywords);
    setNameMeta("robots", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
    setNameMeta("twitter:card", imageUrl ? "summary_large_image" : "summary");
    setNameMeta("twitter:title", title);
    setNameMeta("twitter:description", description);
    setNameMeta("twitter:url", canonicalUrl);
    setNameMeta("twitter:image", imageUrl);
    setPropertyMeta("og:title", title);
    setPropertyMeta("og:description", description);
    setPropertyMeta("og:url", canonicalUrl);
    setPropertyMeta("og:type", ogType);
    setPropertyMeta("og:image", imageUrl);

    if (canonicalUrl) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = canonicalUrl;
    }

    // The edge response includes one crawler-visible schema block. Once the
    // client owns the route, replace that block instead of leaving two
    // NewsArticle objects in the hydrated document.
    document.querySelectorAll("script[data-dc-edge-schema]").forEach((script) => script.remove());
    document.getElementById("ld-json-page")?.remove();
    if (jsonLdKey !== "null") {
      const script = document.createElement("script");
      script.id = "ld-json-page";
      script.type = "application/ld+json";
      script.text = jsonLdKey;
      document.head.appendChild(script);
    }

    return () => {
      document.title = "DekhoCampus - Find Your Dream College";
      document.documentElement.lang = "en";
      document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((link) => link.remove());
    };
  }, [title, exactTitle, description, keywords, canonical, ogImage, ogType, jsonLdKey, language, alternatesKey]);
}
