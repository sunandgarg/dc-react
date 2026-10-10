import { describe, expect, it } from "vitest";
import { coreEntityRoute, verifyCoreEntityInitialHtml } from "../../scripts/core-entity-seo-check.mjs";
import { buildCollegeHref, buildCourseHref, buildExamHref } from "./entityUrls";

const expectedUrl = "https://dekhocampus.com/news/test-article";
const marker = "Verified article text";
const html = `<head><link rel="canonical" href="${expectedUrl}"><meta name="robots" content="index, follow"></head><body>${marker}</body>`;
const verify = (overrides = {}) => verifyCoreEntityInitialHtml({ status: 200, html, expectedUrl, marker, ...overrides });

describe("Release initial-HTML checks", () => {
  it.each([
    ["colleges", buildCollegeHref],
    ["courses", buildCourseHref],
    ["exams", buildExamHref],
  ] as const)("uses the website's canonical %s fixture route, including after edits", (table, buildHref) => {
    for (const slug of ["test-entity", "test-entity-edited"]) for (const short_id of [undefined, 210031]) {
      const entity = { slug, short_id };
      expect(coreEntityRoute(table, entity)).toBe(buildHref(entity));
    }
  });
  it("keeps article fixture URLs slug-only", () => {
    expect(coreEntityRoute("articles", { slug: "test-article", short_id: 210031 })).toBe("/news/test-article");
  });
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
