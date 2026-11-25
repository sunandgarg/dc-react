import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Mathematics } from "@tiptap/extension-mathematics";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText } from "@/components/detail/RichText";
import { normalizePastedMathHtml } from "./articleMath";

describe("article equations", () => {
  it("keeps three pasted formulas editable and renders them after a save round trip", () => {
    const formulas = [
      String.raw`F = G\frac{m_1m_2}{r^2}`,
      String.raw`\frac{1}{f} = (n-1)\left(\frac{1}{R_1}-\frac{1}{R_2}\right)`,
      String.raw`y = x\tan(\theta)-\frac{gx^2}{2u^2\cos^2(\theta)}`,
    ];
    const copied = formulas.map((latex) => `<div class="katex-display"><span class="katex"><math display="block"><semantics><mrow></mrow><annotation encoding="application/x-tex">${latex}</annotation></semantics></math></span></div>`).join("");
    const editor = new Editor({ extensions: [StarterKit, Mathematics], content: normalizePastedMathHtml(copied) });
    const saved = editor.getHTML();
    expect(saved.match(/data-type="block-math"/g)).toHaveLength(3);
    expect(saved).toContain("m_1m_2");
    const reopened = new Editor({ extensions: [StarterKit, Mathematics], content: saved });
    expect(reopened.getHTML()).toContain("cos^2");
    const { container } = render(<RichText html={reopened.getHTML()} />);
    expect(container.querySelectorAll(".article-math .katex")).toHaveLength(3);
    expect(container.querySelectorAll(".article-math math")).toHaveLength(3);
    editor.destroy();
    reopened.destroy();
  });

  it("does not render executable HTML from an equation attribute", () => {
    const { container } = render(<RichText html={'<div data-type="block-math" data-latex="\\href{javascript:alert(1)}{x}"></div>'} />);
    expect(container.querySelector("script, a[href^='javascript:']")).toBeNull();
  });
});
