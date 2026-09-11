import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { applyBlockHeading } from "./RichTextEditor";

function createEditor() {
  return new Editor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } })],
    content: "<p>First paragraph</p><p>Second paragraph</p>",
  });
}

describe("RichTextEditor heading commands", () => {
  it("turns only the paragraph containing the caret into a heading", () => {
    const editor = createEditor();
    const secondParagraphPosition = editor.state.doc.child(0).nodeSize + 1;

    editor.commands.setTextSelection(secondParagraphPosition);
    applyBlockHeading(editor, 3);

    expect(editor.getHTML()).toMatch(/^<p>First paragraph<\/p><h3>Second paragraph<\/h3>/);
    expect(editor.getHTML().match(/<h3>/g)).toHaveLength(1);
    editor.destroy();
  });

  it("converts a partially selected text block without injecting nested heading markup", () => {
    const editor = createEditor();

    editor.commands.setTextSelection({ from: 2, to: 6 });
    applyBlockHeading(editor, 3);

    expect(editor.getHTML()).toBe("<h3>First paragraph</h3><p>Second paragraph</p>");
    editor.destroy();
  });
});
