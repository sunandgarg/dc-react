const VISIBLE_SOURCE_LABEL =
  "(?:sources?|references?|citations?|bibliography|source\\s+links?|credits?)";

const COMPETITOR_TERMS = [
  "collegedekho",
  "college dekho",
  "collegedunia",
  "college dunia",
  "shiksha",
  "careers360",
  "careers 360",
  "kollegeapply",
  "kollege apply",
  "getmyuni",
  "pagalguy",
  "sarvgyan",
];

const COMPETITOR_PATTERN = COMPETITOR_TERMS
  .map((term) => term.replace(/\s+/g, "\\s*"))
  .join("|");

const RICH_ARTICLE_HTML_PATTERN = /<(?:a|blockquote|br|div|figure|h[1-6]|hr|img|li|ol|p|pre|section|table|ul)\b[^>]*>/i;

export function containsRichArticleHtml(value?: string | null) {
  return RICH_ARTICLE_HTML_PATTERN.test(String(value || ""));
}

export function stripVisibleArticleSources(value?: string | null) {
  let output = String(value || "");
  if (!output.trim()) return "";

  const sourceLabel = VISIBLE_SOURCE_LABEL;
  const competitor = COMPETITOR_PATTERN;

  // Remove a trailing visible source/credit block in common HTML formats:
  // <h2>Sources</h2>..., <p><strong>Sources</strong><br>..., etc.
  output = output
    .replace(new RegExp(`<h[1-6][^>]*>\\s*(?:<[^>]+>\\s*)*${sourceLabel}(?:\\s*<\\/[^>]+>)*\\s*<\\/h[1-6]>[\\s\\S]*$`, "i"), "")
    .replace(new RegExp(`<p[^>]*>\\s*(?:<strong>|<b>)?\\s*${sourceLabel}\\s*(?:<\\/strong>|<\\/b>)?(?:\\s*<br\\s*\\/?>)?[\\s\\S]*$`, "i"), "")
    .replace(new RegExp(`<div[^>]*>\\s*(?:<strong>|<b>)?\\s*${sourceLabel}\\s*(?:<\\/strong>|<\\/b>)?(?:\\s*<br\\s*\\/?>)?[\\s\\S]*$`, "i"), "");

  // Remove Markdown-style blocks:
  // **Sources**
  // **WBJEEB:** ...
  output = output.replace(new RegExp(`(?:^|\\n)\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?\\s*${sourceLabel}\\s*(?:\\*\\*)?\\s*(?:\\n|<br\\s*\\/?>)[\\s\\S]*$`, "i"), "");

  // If a model wrote competitor credits without a "Sources" heading, remove
  // the affected paragraph/list item instead of exposing the brand.
  output = output
    .replace(new RegExp(`<p[^>]*>(?:(?!<\\/p>)[\\s\\S])*(?:${competitor})(?:(?!<\\/p>)[\\s\\S])*<\\/p>\\s*`, "gi"), "")
    .replace(new RegExp(`<li[^>]*>(?:(?!<\\/li>)[\\s\\S])*(?:${competitor})(?:(?!<\\/li>)[\\s\\S])*<\\/li>\\s*`, "gi"), "")
    .replace(new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?(?:\\*\\*)?[^\\n]*(?:${competitor})[^\\n]*(?:\\*\\*)?\\s*(?=\\n|$)`, "gim"), "");

  // Keep verified first-party navigation, but never expose third-party links or
  // attribution language in public article copy.
  output = output
    .replace(/href=(["'])https?:\/\/(?:www\.)?dekhocampus\.com(\/[^"']*)\1/gi, 'href="$2"')
    .replace(/<a\b[^>]*href=["']https?:\/\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi, "$1")
    .replace(/\bhttps?:\/\/[^\s<]+|\bwww\.[^\s<]+/gi, "")
    .replace(/\s*\[(?:source|citation|reference)?\s*\d+\]/gi, "")
    .replace(/\s*\((?:source|citation|reference)\s*:[^)]+\)/gi, "")
    .replace(/\baccording to\b\s*/gi, "")
    .replace(/\bas reported by\b\s*/gi, "")
    .replace(/\bsources? (?:say|says|suggest|suggests|indicate|indicates)\b[:,]?\s*/gi, "")
    .replace(/[\u2013\u2014]/g, "-");

  return output.trim();
}
