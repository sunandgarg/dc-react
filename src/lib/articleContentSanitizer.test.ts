import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { render } from "@testing-library/react";
import { RichText } from "@/components/detail/RichText";
import { containsRichArticleHtml, prepareArticleContent, stripVisibleArticleSources } from "./articleContentSanitizer";

describe("containsRichArticleHtml", () => {
  it("detects editor links even when text appears before the first tag", () => {
    expect(containsRichArticleHtml('Start here, then <a href="/courses">browse courses</a>.')).toBe(true);
  });

  it("does not mistake comparison text for HTML", () => {
    expect(containsRichArticleHtml("A score below 50 < 75 is not markup.")).toBe(false);
  });
});

describe("prepareArticleContent", () => {
  it("preserves safe source links and attribution instead of silently stripping evidence", () => {
    const content = '<p>According to NTA, read <a href="https://dekhocampus.com/exams/cat">the CAT page</a>.</p><h2>Sources</h2><ul><li><a href="https://nta.ac.in/notice">Official notice</a></li></ul>';
    expect(prepareArticleContent(content)).toBe(content);
    expect(stripVisibleArticleSources(content)).toBe(content);
    const { container } = render(createElement(RichText, { html: prepareArticleContent(content) }));
    expect(container.querySelector('a[href="https://nta.ac.in/notice"]')).toHaveTextContent("Official notice");
    expect(container.querySelector("h2")).toHaveTextContent("Sources");
  });

  it("does not remove factual copy solely because it mentions a source or a competitor", () => {
    const content = "<p>Useful student guidance.</p><p>Shiksha reported this update.</p>\n## References\nhttps://nta.ac.in/";
    expect(prepareArticleContent(content)).toBe(content);
  });

  it("normalizes imported escaped hrefs and body H1s while preserving table text", () => {
    const content = '<h1>Eligibility</h1><table><tbody><tr><th>Authority</th><td><p><a href=\\"https://josaa.nic.in/\\">JoSAA</a></p></td></tr></tbody></table>';
    const prepared = prepareArticleContent(content);
    expect(prepared).toContain("<h2>Eligibility</h2>");
    const { container } = render(createElement(RichText, { html: prepared }));
    expect(container.querySelector("h1")).toBeNull();
    expect(container.querySelector("th")).toHaveTextContent("Authority");
    expect(container.querySelector('td a[href="https://josaa.nic.in/"]')).toHaveTextContent("JoSAA");
  });

  it("routes legacy encoded HTML through the safe HTML renderer and normalizes its headings", () => {
    const content = '&amp;lt;h1&amp;gt;Fees&amp;lt;/h1&amp;gt;&amp;lt;table&amp;gt;&amp;lt;tr&amp;gt;&amp;lt;td&amp;gt;₹5,000&amp;lt;/td&amp;gt;&amp;lt;/tr&amp;gt;&amp;lt;/table&amp;gt;';
    const prepared = prepareArticleContent(content);
    expect(containsRichArticleHtml(prepared)).toBe(true);
    expect(prepared).toContain("<h2>Fees</h2>");
    const { container } = render(createElement(RichText, { html: prepared }));
    expect(container.querySelector("td")).toHaveTextContent("₹5,000");
    expect(container.querySelector("h1")).toBeNull();
  });

  it.each([
    "javascript:alert(1)", "jav&#x61;script:alert(1)", "java&#10;script:alert(1)",
    "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)",
  ])("keeps URL security enforced after citation preservation: %s", (href) => {
    const content = `<h2>Sources</h2><a href="${href}" onclick="alert(1)">Unsafe</a><script>alert(1)</script><img src="x" onerror="alert(2)">`;
    const { container } = render(createElement(RichText, { html: prepareArticleContent(content) }));
    expect(container.querySelector("a")).not.toHaveAttribute("href");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onclick], [onerror]")).toBeNull();
  });

  it("retains the opt-in lead-link attribute without bypassing its renderer sanitizer", () => {
    const { container } = render(createElement(RichText, { html: prepareArticleContent('<a href="https://example.org/apply" data-lead-capture="true">Apply</a>') }));
    expect(container.querySelector("a")).toHaveAttribute("data-lead-capture", "true");
    expect(container.querySelector("a")).toHaveAttribute("rel", "noopener noreferrer");
  });
});
