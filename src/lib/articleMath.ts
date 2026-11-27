import katex from "katex";

// KaTeX copies include a TeX annotation; turn it into an editable TipTap node.
export function normalizePastedMathHtml(html: string): string {
  if (!/<math\b/i.test(html) || typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("math").forEach((math) => {
    const latex = math.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim();
    if (!latex) return;
    const display = math.getAttribute("display") === "block" || Boolean(math.closest(".katex-display"));
    const node = doc.createElement(display ? "div" : "span");
    node.setAttribute("data-type", display ? "block-math" : "inline-math");
    node.setAttribute("data-latex", latex);
    (math.closest(".katex-display") || math.closest(".katex") || math).replaceWith(node);
  });
  return doc.body.innerHTML;
}

function decodeAttribute(value: string): string {
  return value.replace(/&(?:amp|quot|lt|gt|#39|#x27);/gi, (entity) => {
    const key = entity.toLowerCase();
    return key === "&amp;" ? "&" : key === "&quot;" ? '"' : key === "&lt;" ? "<" : key === "&gt;" ? ">" : "'";
  });
}

export function renderArticleMath(html: string): string {
  return html.replace(/<(div|span)\b([^>]*)>\s*<\/\1>/gi, (original, tag: string, attrs: string) => {
    const type = attrs.match(/\bdata-type="(block-math|inline-math)"/i)?.[1];
    const latex = attrs.match(/\bdata-latex="([^"]*)"/i)?.[1];
    if (!type || !latex) return original;
    const math = katex.renderToString(decodeAttribute(latex), {
      displayMode: type === "block-math",
      output: "htmlAndMathml",
      throwOnError: false,
      trust: false,
      maxExpand: 1000,
    });
    return `<${tag} class="article-math ${type}">${math}</${tag}>`;
  });
}

export function renderDelimitedArticleMath(html: string): string {
  if (!/\\\(|\\\[/.test(html) || typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => {
    if (node.parentElement?.closest("code, pre, script, style, .katex, [data-type$='-math']")) return;
    const value = node.textContent || "";
    const pattern = /\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;
    if (!pattern.test(value)) return;
    pattern.lastIndex = 0;
    const fragment = doc.createDocumentFragment();
    let offset = 0;
    for (const match of value.matchAll(pattern)) {
      fragment.append(doc.createTextNode(value.slice(offset, match.index)));
      const displayMode = match[2] !== undefined;
      const span = doc.createElement("span");
      span.className = `article-math ${displayMode ? "block-math" : "inline-math"}`;
      span.innerHTML = katex.renderToString((match[1] || match[2]).trim(), {
        displayMode, output: "htmlAndMathml", throwOnError: false, trust: false, maxExpand: 1000,
      });
      fragment.append(span);
      offset = match.index + match[0].length;
    }
    fragment.append(doc.createTextNode(value.slice(offset)));
    node.replaceWith(fragment);
  });
  return doc.body.innerHTML;
}
