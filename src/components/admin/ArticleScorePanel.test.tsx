import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleScorePanel } from "@/components/admin/ArticleScorePanel";

describe("ArticleScorePanel", () => {
  it("keeps category checks collapsed until a score is selected", () => {
    render(<ArticleScorePanel article={{ title: "Test article", slug: "test-article", content: "<p>Short content.</p>" }} />);

    expect(screen.queryByText("SEO checks")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /SEO/ }));
    expect(screen.getByText("SEO checks")).toBeInTheDocument();
    expect(screen.getByText("Meta title length")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /GEO/ }));
    expect(screen.getByText("GEO checks")).toBeInTheDocument();
    expect(screen.queryByText("SEO checks")).not.toBeInTheDocument();
  });
});
