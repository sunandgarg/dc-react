import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText } from "./RichText";

describe("RichText", () => {
  it("decodes legacy encoded markup and wraps tables for mobile scrolling", () => {
    const encoded = "&amp;lt;p&amp;gt;Syllabus intro&amp;lt;/p&amp;gt;&amp;lt;table&amp;gt;&amp;lt;tbody&amp;gt;&amp;lt;tr&amp;gt;&amp;lt;td&amp;gt;Topic&amp;lt;/td&amp;gt;&amp;lt;/tr&amp;gt;&amp;lt;/tbody&amp;gt;&amp;lt;/table&amp;gt;";
    const { container } = render(<RichText html={encoded} />);

    expect(screen.getByText("Syllabus intro")).toBeInTheDocument();
    expect(screen.getByText("Topic")).toBeInTheDocument();
    expect(container.querySelector(".rt-table-wrap > table")).not.toBeNull();
  });

  it("renders non-HTML text as readable text instead of injecting markup", () => {
    render(<RichText html={"Eligibility varies by programme."} />);
    expect(screen.getByText("Eligibility varies by programme.")).toBeInTheDocument();
  });

  it("preserves article heading levels on the public page", () => {
    const { container } = render(<RichText html="<h2>Admissions overview</h2><p>Start here.</p><h3>Eligibility details</h3>" />);

    expect(container.querySelector("h2")?.textContent).toBe("Admissions overview");
    expect(container.querySelector("h3")?.textContent).toBe("Eligibility details");
  });

  it("preserves safe editor image size and alignment on public pages", () => {
    const { container } = render(
      <RichText html={'<img src="https://example.com/campus.webp" alt="Campus" data-width="60" data-align="right">'} />,
    );
    const image = container.querySelector("img") as HTMLImageElement;

    expect(image.dataset.width).toBe("60");
    expect(image.dataset.align).toBe("right");
    expect(image.style.width).toBe("60%");
    expect(image.style.marginLeft).toBe("auto");
    expect(image.style.marginRight).toBe("0px");
  });

  it("clamps unsafe image layout values", () => {
    const { container } = render(
      <RichText html={'<img src="https://example.com/campus.webp" data-width="500" data-align="sideways">'} />,
    );
    const image = container.querySelector("img") as HTMLImageElement;

    expect(image.dataset.width).toBe("100");
    expect(image.dataset.align).toBe("center");
    expect(image.style.marginLeft).toBe("auto");
    expect(image.style.marginRight).toBe("auto");
  });

  it("preserves safe hyperlinks and makes external links safe and visible", () => {
    const { container } = render(
      <RichText html={'<p>Read the <a href="https://example.com/guide"><strong style="color: black">admission guide</strong></a> or <a href="/colleges">browse colleges</a>.</p>'} />,
    );
    const links = container.querySelectorAll("a");

    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "https://example.com/guide");
    expect(links[0]).toHaveAttribute("target", "_blank");
    expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
    expect(links[0].querySelector("strong")).not.toHaveStyle({ color: "black" });
    expect(links[1]).toHaveAttribute("href", "/colleges");
    expect(links[1]).not.toHaveAttribute("target");
    expect(container.firstElementChild?.className).toContain("prose-a:underline");
  });

  it("removes unsafe hyperlink protocols", () => {
    const { container } = render(<RichText html={'<a href="javascript:alert(1)">Unsafe link</a>'} />);
    expect(container.querySelector("a")).not.toHaveAttribute("href");
  });
});
