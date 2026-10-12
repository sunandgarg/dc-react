import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "./RichTextEditor";

const upload = vi.hoisted(() => vi.fn());
// jsdom has no layout API for the caret scroll triggered by TipTap focus.
Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });
Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => document.body.getBoundingClientRect() });
afterAll(() => {
  delete (Range.prototype as unknown as Record<string, unknown>).getClientRects;
  delete (Range.prototype as unknown as Record<string, unknown>).getBoundingClientRect;
});
vi.mock("@/integrations/backend/client", () => ({ backendClient: { storage: { from: () => ({ upload, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://media.example/${path}` } }) }) } } }));

describe("shared editor PDF uploads", () => {
  beforeEach(() => { upload.mockReset(); upload.mockResolvedValue({ error: null }); });

  it("uploads a PDF with writer-compatible create-only storage and inserts persistent HTML", async () => {
    const change = vi.fn();
    render(<RichTextEditor value="<p>Course details</p>" onChange={change} />);
    fireEvent.click(await screen.findByTitle("Insert document viewer (PDF or images)"));
    fireEvent.change(screen.getByLabelText("Upload document"), { target: { files: [new File(["%PDF-1.7 test"], "Admission.pdf", { type: "application/pdf" })] } });
    await screen.findByText("PDF ready to insert");
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^editor\/documents\/.*\.pdf$/), expect.any(File), { upsert: false, contentType: "application/pdf" });
    fireEvent.click(screen.getByRole("button", { name: "Insert PDF" }));
    await waitFor(() => expect(change).toHaveBeenCalledWith(expect.stringContaining('data-pdf="https://media.example/editor/documents/')));
  });

  it("does not insert or silently succeed when processing fails", async () => {
    upload.mockResolvedValue({ error: new Error("Invalid PDF") });
    const change = vi.fn();
    render(<RichTextEditor value="<p>Existing copy</p>" onChange={change} />);
    fireEvent.click(await screen.findByTitle("Insert document viewer (PDF or images)"));
    fireEvent.change(screen.getByLabelText("Upload document"), { target: { files: [new File(["bad"], "bad.pdf", { type: "application/pdf" })] } });
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole("button", { name: "Insert (0)" })).toBeDisabled());
    expect(change).not.toHaveBeenCalled();
  });

  it("rejects mixed PDF/image selection before uploading anything", async () => {
    render(<RichTextEditor value="" onChange={() => undefined} />);
    fireEvent.click(await screen.findByTitle("Insert document viewer (PDF or images)"));
    fireEvent.change(screen.getByLabelText("Upload document"), { target: { files: [new File(["pdf"], "one.pdf", { type: "application/pdf" }), new File(["img"], "one.jpg", { type: "image/jpeg" })] } });
    expect(upload).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Insert (0)" })).toBeDisabled();
  });
});
