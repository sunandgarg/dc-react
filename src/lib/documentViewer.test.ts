import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { DocumentNode } from "@/components/admin/DocumentNode";
import { safeDocumentUrl, splitDocumentViewers } from "./documentViewer";

describe("document viewer persistence", () => {
  it("round-trips PDFs and title characters through save and re-edit", () => {
    const editor = new Editor({ extensions: [StarterKit, DocumentNode], content: {
      type: "doc", content: [{ type: "documentViewer", attrs: { pdf: "https://media.example.com/test.pdf", title: '<Admissions & "fees">', images: [] } }],
    } });
    const saved = editor.getHTML();
    expect(saved).toContain('data-pdf="https://media.example.com/test.pdf"');
    expect(saved).not.toContain('<Admissions & "fees">');
    editor.commands.setContent(saved);
    expect(editor.getJSON().content?.[0].attrs?.title).toBe('<Admissions & "fees">');
    expect(editor.getJSON().content?.[0].attrs?.pdf).toBe("https://media.example.com/test.pdf");
    editor.destroy();
  });

  it("preserves legacy image viewers when editing existing content", () => {
    const editor = new Editor({ extensions: [StarterKit, DocumentNode], content: '<p>Before</p><div class="doc-viewer" data-title="Paper"><img src="https://example.com/one.jpg"><img src="/two.jpg"></div><p>After</p>' });
    expect(editor.getJSON().content?.[1].type).toBe("documentViewer");
    expect(editor.getHTML()).toContain('class="doc-viewer"');
    expect(splitDocumentViewers(editor.getHTML())[1]).toEqual({ type: "doc", title: "Paper", pdf: "", images: ["https://example.com/one.jpg", "/two.jpg"] });
    editor.destroy();
  });

  it("rejects executable URLs and safely parses attribute order and escaped titles", () => {
    expect(safeDocumentUrl("javascript:alert(1)")).toBe("");
    expect(safeDocumentUrl("data:application/pdf;base64,abc")).toBe("");
    expect(safeDocumentUrl("//evil.example/file.pdf")).toBe("");
    expect(splitDocumentViewers('<p>Before</p><div data-pdf="javascript:alert(1)" data-title="Exam &amp; paper" class="doc-viewer"><img src="javascript:alert(2)"></div><p>After</p>'))
      .toEqual([{ type: "html", value: "<p>Before</p>" }, { type: "doc", title: "Exam & paper", pdf: "", images: [] }, { type: "html", value: "<p>After</p>" }]);
  });
});
