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
});
