import { describe, expect, it } from "vitest";
import { containsRichArticleHtml, stripVisibleArticleSources } from "./articleContentSanitizer";

describe("containsRichArticleHtml", () => {
  it("detects editor links even when text appears before the first tag", () => {
    expect(containsRichArticleHtml('Start here, then <a href="/courses">browse courses</a>.')).toBe(true);
  });

  it("does not mistake comparison text for HTML", () => {
    expect(containsRichArticleHtml("A score below 50 < 75 is not markup.")).toBe(false);
  });
});

describe("stripVisibleArticleSources", () => {
  it("keeps first-party links while removing external attribution", () => {
    expect(stripVisibleArticleSources('<p>According to a report, read <a href="https://dekhocampus.com/exams/cat">the CAT page</a> and <a href="https://example.com/report">the report</a>.</p>'))
      .toBe('<p>a report, read <a href="/exams/cat">the CAT page</a> and the report.</p>');
  });

  it("removes competitor-credit paragraphs", () => {
    expect(stripVisibleArticleSources("<p>Useful student guidance.</p><p>Shiksha reported this update.</p>"))
      .toBe("<p>Useful student guidance.</p>");
  });
});
