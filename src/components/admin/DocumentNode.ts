import { Node } from "@tiptap/core";
import { safeDocumentUrl } from "@/lib/documentViewer";

export const DocumentNode = Node.create({
  name: "documentViewer",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      title: { default: "" },
      pdf: { default: "" },
      images: { default: [] },
    };
  },
  parseHTML() {
    return [{ tag: "div.doc-viewer", getAttrs: (element) => ({
      title: element.getAttribute("data-title") || "",
      pdf: safeDocumentUrl(element.getAttribute("data-pdf") || ""),
      images: Array.from(element.querySelectorAll("img")).map((image) => safeDocumentUrl(image.getAttribute("src") || "")).filter(Boolean),
    }) }];
  },
  renderHTML({ node }) {
    const pdf = safeDocumentUrl(node.attrs.pdf);
    return ["div", { class: "doc-viewer", "data-title": node.attrs.title, ...(pdf ? { "data-pdf": pdf } : {}) },
      ...(pdf ? [["a", { href: pdf }, node.attrs.title || "View PDF document"]] : node.attrs.images.map((url: string) => ["img", { src: safeDocumentUrl(url), alt: "Document page" }]))];
  },
});
