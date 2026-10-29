import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentViewer } from "./DocumentViewer";

vi.mock("@/components/LeadGateDialog", () => ({ LeadGateDialog: ({ onSuccess, onOpenChange, forceShow }: { onSuccess: (id?: string) => void; onOpenChange: (open: boolean) => void; forceShow: boolean }) => <div role="dialog" aria-label="Lead form">
  <span>{forceShow ? "Always capture" : "Silent capture"}</span>
  <button onClick={() => onSuccess("saved-lead")}>Complete lead</button>
  <button onClick={() => onSuccess()}>Missing lead</button>
  <button onClick={() => onOpenChange(false)}>Cancel lead</button>
</div> }));
vi.mock("./PdfPage", () => ({ default: () => <div>Rendered PDF page</div> }));

describe("PDF access", () => {
  it.each(["View PDF document", "View full size PDF", "Download PDF"])("requires a saved lead for %s and cancel never loads the PDF", (name) => {
    render(<DocumentViewer images={[]} pdf="https://example.org/paper.pdf" title="Exam paper" />);
    fireEvent.click(screen.getByRole("button", { name, exact: true }));
    expect(screen.getByRole("dialog", { name: "Lead form" })).toHaveTextContent("Always capture");
    fireEvent.click(screen.getByText("Missing lead"));
    expect(screen.queryByText("Rendered PDF page")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel lead"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Rendered PDF page")).not.toBeInTheDocument();
  });
  it("renders inline after success and asks again for full size and download", async () => {
    render(<DocumentViewer images={[]} pdf="https://example.org/paper.pdf" />);
    fireEvent.click(screen.getByText("View PDF document"));
    fireEvent.click(screen.getByText("Complete lead"));
    expect(await screen.findByText("Rendered PDF page")).toBeVisible();
    for (const name of ["View full size PDF", "Download PDF"]) {
      fireEvent.click(screen.getByRole("button", { name }));
      expect(screen.getByRole("dialog", { name: "Lead form" })).toBeVisible();
      fireEvent.click(screen.getByText("Cancel lead"));
    }
  });
  it("opens and closes the accessible full-size reader after capture", async () => {
    render(<DocumentViewer images={[]} pdf="https://example.org/paper.pdf" title="Full paper" />);
    fireEvent.click(screen.getByRole("button", { name: "View full size PDF" }));
    fireEvent.click(screen.getByText("Complete lead"));
    expect(await screen.findByRole("dialog", { name: "Full paper" })).toBeVisible();
    expect(await screen.findByText("Rendered PDF page")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Rendered PDF page")).toBeVisible();
  });
  it("only starts the download after a saved lead", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<DocumentViewer images={[]} pdf="https://example.org/paper.pdf" />);
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(click).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Complete lead"));
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });
  it("keeps legacy image documents readable", () => {
    render(<DocumentViewer images={["/page.jpg"]} title="Image paper" />);
    expect(screen.getByRole("img", { name: "Image paper page 1" })).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
