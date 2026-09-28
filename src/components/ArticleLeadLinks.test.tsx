import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ArticleLeadLinks } from "./ArticleLeadLinks";
import { LeadCaptureLink } from "./admin/LeadCaptureLink";
import { applyEditorLink, RichTextEditor } from "./RichTextEditor";
import { RichText } from "./detail/RichText";
import { stripVisibleArticleSources } from "@/lib/articleContentSanitizer";
import { saveLeadPhase } from "@/lib/twoStepLead";

vi.mock("@/lib/twoStepLead", () => ({ saveLeadPhase: vi.fn() }));
const html = '<p><a href="https://example.org/apply" data-lead-capture="true">Apply here</a> <a href="/exams">Normal link</a></p>';
const proceed = vi.fn();
function setup() {
  render(<ArticleLeadLinks articleSlug="test-article" onContinue={proceed}><RichText html={stripVisibleArticleSources(html)} /></ArticleLeadLinks>);
  fireEvent.click(screen.getByRole("link", { name: "Apply here" }));
}
function fill() {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Test Reader" } });
  fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "9876543210" } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "reader@example.org" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Privacy and terms consent" }));
}
beforeEach(() => { vi.clearAllMocks(); });
describe("article lead links", () => {
  it("round trips the opt-in attribute in the editor", () => {
    const editor = new Editor({ extensions: [StarterKit.configure({ link: false }), LeadCaptureLink], content: html });
    expect(editor.getHTML()).toContain('data-lead-capture="true"');
    editor.commands.setTextSelection(3);
    applyEditorLink(editor, "https://example.org/apply", "", { from: 3, to: 3 }, false);
    expect(editor.getHTML()).not.toContain("data-lead-capture");
    expect(editor.getHTML()).toContain("Apply here");
    applyEditorLink(editor, "https://example.org/apply", "", { from: 3, to: 3 }, true);
    expect(editor.getHTML()).toContain('data-lead-capture="true"');
    editor.destroy();
  });
  it("offers the per-link checkbox in the article editor", () => {
    render(<RichTextEditor value="<p>Article text</p>" onChange={vi.fn()} allowLeadLinks />);
    fireEvent.click(screen.getByTitle("Insert / edit link"));
    expect(screen.getByRole("checkbox", { name: /Show a small lead form/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: /Show a small lead form/ }));
    expect(screen.getByRole("checkbox", { name: /Show a small lead form/ })).toBeChecked();
  });
  it("saves lead context before continuing and requires explicit consent", async () => {
    vi.mocked(saveLeadPhase).mockResolvedValue({ success: true, lead_id: "test-id", phase: "complete" });
    setup();
    expect(screen.getByRole("button", { name: "Save & continue" })).toBeDisabled();
    expect(proceed).not.toHaveBeenCalled();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Save & continue" }));
    await waitFor(() => expect(proceed).toHaveBeenCalledWith("https://example.org/apply"));
    expect(saveLeadPhase).toHaveBeenCalledWith(expect.objectContaining({ source: "article_link_test-article", consent_terms_accepted: true, otp_verified: false, initial_query: "Requested link: https://example.org/apply" }));
  });
  it("keeps the form open after a save failure and allows retry", async () => {
    vi.mocked(saveLeadPhase).mockRejectedValue(new Error("Please try again"));
    setup(); fill();
    fireEvent.click(screen.getByRole("button", { name: "Save & continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again");
    expect(proceed).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save & continue" })).toBeEnabled();
  });
  it("does not intercept ordinary links", () => {
    render(<ArticleLeadLinks articleSlug="test" onContinue={proceed}><a href="#normal">Normal link</a></ArticleLeadLinks>);
    fireEvent.click(screen.getByRole("link", { name: "Normal link" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(saveLeadPhase).not.toHaveBeenCalled();
  });
});
