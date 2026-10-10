import { afterEach, describe, expect, it } from "vitest";
import { initialPageData } from "./initialPageData";

const article = { id: "a1", slug: "test-news", title: "News", is_active: true, status: "Published", site_scope: "dekhocampus" };
function embed(row: unknown = article, table = "articles", routeSlug = "test-news") {
  const element = document.createElement("script");
  element.id = "dc-initial-page-data";
  element.type = "application/json";
  element.textContent = JSON.stringify({ table, routeSlug, row });
  document.head.append(element);
  return element;
}
afterEach(() => document.getElementById("dc-initial-page-data")?.remove());

describe("public initial page data", () => {
  it("reuses only the matching detail, including numeric entity URLs", () => {
    embed();
    expect(initialPageData("articles", "test-news")).toEqual(article);
    expect(initialPageData("articles", "other-news")).toBeUndefined();
    expect(initialPageData("exams", "test-news")).toBeUndefined();
    document.getElementById("dc-initial-page-data")?.remove();
    embed({ id: "e1", slug: "jee", is_active: true }, "exams", "jee-12345");
    expect(initialPageData("exams", "jee-12345")).toMatchObject({ id: "e1" });
  });
  it.each([
    { ...article, status: "Draft" }, { ...article, is_active: false },
    { ...article, site_scope: "sarkari" }, { ...article, id: "" }, null,
  ])("rejects unavailable or cross-site rows", (row) => {
    embed(row);
    expect(initialPageData("articles", "test-news")).toBeUndefined();
  });
  it("falls back safely for static previews and malformed data", () => {
    expect(initialPageData("articles", "test-news")).toBeUndefined();
    embed().textContent = "broken JSON";
    expect(initialPageData("articles", "test-news")).toBeUndefined();
  });
});
