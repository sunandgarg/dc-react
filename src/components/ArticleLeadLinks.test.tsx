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

vi.mock("@/components/LeadGateDialog", () => ({ LeadGateDialog: ({ onSuccess, forceShow }: { onSuccess: (id?: string) => void; forceShow: boolean }) => <div role="dialog">{forceShow ? "PDF lead form" : "Silent"}<button onClick={() => onSuccess("pdf-lead")}>Complete PDF lead</button></div> }));
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
    expect(saveLeadPhase).toHaveBeenCalledWith(expect.objectContaining({ source: "article_link_test-article", consent_terms_accepted: true, otp_verified: false, initial_query: "Requested link site: example.org" }));
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
  it("gates external links site-wide but leaves DekhoCampus links alone", () => {
    render(<><ArticleLeadLinks articleSlug="site" siteWide onContinue={proceed} /><a href="https://example.org/notice">Official notice</a><a href="https://sarkari.dekhocampus.com/jobs" onClick={(event) => event.preventDefault()}>Sarkari jobs</a><a href="/exams" data-lead-capture="true">Apply inside site</a></>);
    fireEvent.click(screen.getByRole("link", { name: "Official notice" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("example.org");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("link", { name: "Sarkari jobs" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Apply inside site" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it.each(["/files/paper.PDF?download=1", "https://dekhocampus.com/paper.pdf", "https://media.dekhocampus.com/paper.pdf", "https://example.org/paper.pdf#page=2"])("always gates PDF link %s with the standard form", (url) => {
    render(<><ArticleLeadLinks articleSlug="site" siteWide onContinue={proceed} /><a href={url}>PDF resource</a></>);
    fireEvent.click(screen.getByRole("link", { name: "PDF resource" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("PDF lead form");
    expect(proceed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Complete PDF lead"));
    expect(proceed).toHaveBeenCalledWith(new URL(url, window.location.href).href);
  });
  it("opens social destinations without a lead form, including opted-in links", () => {
    const socialUrls = [
      "https://x.com/dekhocampus", "https://twitter.com/intent/tweet", "https://www.facebook.com/dekhocampus",
      "https://instagram.com/dekhocampus", "https://m.youtube.com/watch?v=123", "https://youtu.be/123",
      "https://www.linkedin.com/company/dekhocampus", "https://wa.me/919876543210", "https://t.me/dekhocampus",
    ];
    render(<><ArticleLeadLinks articleSlug="site" siteWide onContinue={proceed} />
      {socialUrls.map((url) => <a key={url} href={url} data-lead-capture="true" onClick={(event) => event.preventDefault()}>{url}</a>)}
      <a href="https://notfacebook.com/notice" onClick={(event) => event.preventDefault()}>Lookalike domain</a>
    </>);
    for (const url of socialUrls) {
      fireEvent.click(screen.getByRole("link", { name: url }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("link", { name: "Lookalike domain" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("notfacebook.com");
  });
});
