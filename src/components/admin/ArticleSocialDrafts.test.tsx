import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ArticleSocialDrafts } from "./ArticleSocialDrafts";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => vi.restoreAllMocks());

describe("ArticleSocialDrafts", () => {
  const article = { title: "Current guide", slug: "current-guide", description: "Current summary" };
  it("copies a caption without publishing anything", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<ArticleSocialDrafts article={article} siteScope="dekhocampus" />);
    fireEvent.click(screen.getByText("Social caption previews"));
    expect(screen.getByText(/Nothing is posted automatically/)).toBeInTheDocument();
    expect(screen.getByText(/caption links are not clickable/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy LinkedIn caption" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0][0]).toContain("utm_source=linkedin");
  });
  it("keeps previews current and offers a manual fallback when copying fails", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }, configurable: true });
    const { rerender } = render(<ArticleSocialDrafts article={article} siteScope="dekhocampus" />);
    rerender(<ArticleSocialDrafts article={{ ...article, title: "Edited guide" }} siteScope="dekhocampus" />);
    fireEvent.click(screen.getByText("Social caption previews"));
    expect((screen.getByLabelText("Facebook") as HTMLTextAreaElement).value).toContain("Edited guide");
    fireEvent.click(screen.getByRole("button", { name: "Copy Facebook caption" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Select and copy")));
  });
});
