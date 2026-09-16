import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useSEO } from "./useSEO";

describe("useSEO structured data", () => {
  afterEach(() => {
    cleanup();
    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => script.remove());
  });

  it("replaces edge structured data with one client-owned page schema", () => {
    const edgeSchema = document.createElement("script");
    edgeSchema.type = "application/ld+json";
    edgeSchema.dataset.dcEdgeSchema = "";
    edgeSchema.text = JSON.stringify({ "@type": "NewsArticle", headline: "Edge headline" });
    document.head.appendChild(edgeSchema);

    renderHook(() => useSEO({
      title: "Client headline",
      canonical: "/news/client-headline",
      jsonLd: { "@context": "https://schema.org", "@type": "NewsArticle", headline: "Client headline" },
    }));

    expect(document.querySelector('script[data-dc-edge-schema]')).toBeNull();
    const schemas = document.querySelectorAll('script[type="application/ld+json"]');
    expect(schemas).toHaveLength(1);
    expect(schemas[0]).toHaveAttribute("id", "ld-json-page");
    expect(JSON.parse(schemas[0].textContent || "{}")).toMatchObject({
      "@type": "NewsArticle",
      headline: "Client headline",
    });
  });
});
