const RICH_ARTICLE_HTML_PATTERN = /<(?:a|blockquote|br|div|figure|h[1-6]|hr|img|li|ol|p|pre|section|table|ul)\b[^>]*>/i;

export function containsRichArticleHtml(value?: string | null) {
  return RICH_ARTICLE_HTML_PATTERN.test(String(value || ""));
}

/** Preserve authored citations; RichText/ReactMarkdown still enforce HTML and URL safety. */
export function prepareArticleContent(value?: string | null) {
  let content = String(value || "");
  // Decode legacy CMS fragments before choosing the HTML or Markdown renderer.
  // The resulting HTML still goes through RichText's unchanged DOMPurify policy.
  if (typeof document !== "undefined") {
    for (let pass = 0; pass < 3 && /&(?:amp;)?(?:lt|#0*60|#x0*3c);/i.test(content); pass += 1) {
      const textarea = document.createElement("textarea");
      textarea.innerHTML = content;
      const next = textarea.value;
      if (next === content) break;
      content = next;
    }
  }
  return content
    // Older imports escaped attribute quotes as if the HTML were still JSON.
    .replace(/<[^>]+>/g, (tag) => tag.replace(/\\+(["'])/g, "$1"))
    .replace(/<h1(\s[^>]*)?>/gi, "<h2$1>")
    .replace(/<\/h1\s*>/gi, "</h2>")
    .trim();
}

// Compatibility for existing lead-link callers; sources are no longer stripped.
export const stripVisibleArticleSources = prepareArticleContent;
