import Link from "@tiptap/extension-link";

export const LeadCaptureLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      leadCapture: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-lead-capture") === "true",
        renderHTML: (attributes) => attributes.leadCapture ? { "data-lead-capture": "true" } : {},
      },
    };
  },
});
