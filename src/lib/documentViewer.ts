export function safeDocumentUrl(value: string): string {
  const url = String(value || "").trim();
  return /^(?:https?:\/\/|\/(?!\/))/i.test(url) ? url : "";
}

export type DocumentSegment = { type: "html"; value: string } | { type: "doc"; title: string; images: string[]; pdf: string };

export function splitDocumentViewers(html: string): DocumentSegment[] {
  if (typeof document === "undefined" || !/doc-viewer/i.test(html)) return [{ type: "html", value: html }];
  const template = document.createElement("template");
  template.innerHTML = html;
  const documents: Extract<DocumentSegment, { type: "doc" }>[] = [];
  const marker = `dc-document-${Math.random().toString(36).slice(2)}-`;
  template.content.querySelectorAll("div.doc-viewer").forEach((node) => {
    documents.push({ type: "doc", title: node.getAttribute("data-title") || "", pdf: safeDocumentUrl(node.getAttribute("data-pdf") || ""),
      images: Array.from(node.querySelectorAll("img")).map((image) => safeDocumentUrl(image.getAttribute("src") || "")).filter(Boolean) });
    node.replaceWith(document.createComment(`${marker}${documents.length - 1}`));
  });
  const segments: DocumentSegment[] = [];
  const pattern = new RegExp(`<!--${marker}(\\d+)-->`, "g");
  const serialized = template.innerHTML;
  let last = 0;
  for (const match of serialized.matchAll(pattern)) {
    if (match.index > last) segments.push({ type: "html", value: serialized.slice(last, match.index) });
    segments.push(documents[Number(match[1])]);
    last = match.index + match[0].length;
  }
  if (last < serialized.length) segments.push({ type: "html", value: serialized.slice(last) });
  return segments;
}

export function isPdfUrl(value: string): boolean {
  try { return /\.pdf$/i.test(new URL(value, "https://dekhocampus.com").pathname); }
  catch { return false; }
}
