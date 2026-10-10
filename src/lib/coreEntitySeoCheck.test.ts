import { describe, expect, it } from "vitest";
import { verifyCoreEntityInitialHtml } from "../../scripts/core-entity-seo-check.mjs";

const expectedUrl = "https://dekhocampus.com/news/test-article";
const marker = "Verified article text";
const html = `<head><link rel="canonical" href="${expectedUrl}"><meta name="robots" content="index, follow"></head><body>${marker}</body>`;
const verify = (overrides = {}) => verifyCoreEntityInitialHtml({ status: 200, html, expectedUrl, marker, ...overrides });

describe("Release initial-HTML checks", () => {
  it("accepts content with the correct canonical and indexable robots", () => expect(() => verify()).not.toThrow());
  it("accepts equivalent attribute ordering", () => expect(() => verify({ html: `<link href="${expectedUrl}" rel="canonical"><meta content="index, follow" name="robots">${marker}` })).not.toThrow());
  it.each([404, 503])("rejects a rendered page served with HTTP %s", (status) => expect(() => verify({ status })).toThrow("returned HTTP"));
  it("rejects a shell lacking actual page content", () => expect(() => verify({ html: html.replace(marker, "") })).toThrow("content marker"));
  it("rejects the homepage canonical on an article", () => expect(() => verify({ html: html.replace(expectedUrl, "https://dekhocampus.com") })).toThrow("canonical"));
  it("rejects noindex or missing robots", () => {
    expect(() => verify({ html: html.replace("index, follow", "noindex, follow") })).toThrow("robots");
    expect(() => verify({ html: html.replace(/<meta[^>]+>/, "") })).toThrow("robots");
  });
});
