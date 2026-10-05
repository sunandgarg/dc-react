const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

/** Find a mid-article ad boundary without cutting an HTML table (or any nested block) in half. */
export function splitAtEditorialBoundary(content: string, richHtml: boolean): readonly [string, string] {
  if (!content.trim()) return [content, ""];

  const candidates: number[] = [];
  if (richHtml) {
    const openTags: string[] = [];
    const tags = /<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi;
    let match: RegExpExecArray | null;
    while ((match = tags.exec(content))) {
      const tag = match[1].toLowerCase();
      if (VOID_TAGS.has(tag) || /\/>$/.test(match[0])) continue;
      if (!match[0].startsWith("</")) {
        openTags.push(tag);
        continue;
      }
      // Malformed imported HTML is left unsplit; the sanitised renderer can repair it.
      if (openTags.at(-1) !== tag) return [content, ""];
      openTags.pop();
      if (openTags.length === 0 && /^(?:p|h[1-6]|div|section|article|table|ul|ol|blockquote|figure)$/.test(tag)) {
        candidates.push(tags.lastIndex);
      }
    }
    if (openTags.length) return [content, ""];
  } else {
    const boundaries = /\n(?=#{2,3}\s)|\n\s*\n/g;
    let match: RegExpExecArray | null;
    while ((match = boundaries.exec(content))) candidates.push(match.index);
  }

  const useful = candidates.filter((index) => index > content.length * 0.28 && index < content.length * 0.72);
  const splitIndex = useful.sort((a, b) => Math.abs(a - content.length / 2) - Math.abs(b - content.length / 2))[0];
  return splitIndex ? [content.slice(0, splitIndex), content.slice(splitIndex)] : [content, ""];
}
