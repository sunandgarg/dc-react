import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Maximize2, X, Download, FileText } from "lucide-react";
import { LeadGateDialog } from "@/components/LeadGateDialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface Props { images: string[]; title?: string; pdf?: string }
type PdfAction = "view" | "fullscreen" | "download";
const PdfPage = lazy(() => import("./PdfPage"));
const control = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] disabled:opacity-35";

/** Shared article document reader. PDFs load only after a completed lead form. */
export function DocumentViewer({ images, title, pdf = "" }: Props) {
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [fs, setFs] = useState(false);
  const [pdfPages, setPdfPages] = useState(0);
  const [opened, setOpened] = useState(false);
  const [pending, setPending] = useState<PdfAction | null>(null);
  const total = pdf ? pdfPages : images.length;
  const onPdfLoad = useCallback((pages: number) => setPdfPages(pages), []);

  useEffect(() => {
    setPage(0); setZoom(100); setOpened(false); setPdfPages(0); setFs(false); setPending(null);
  }, [pdf]);

  const request = (action: PdfAction) => {
    if (pdf) { setPending(action); return; }
    if (action === "fullscreen") setFs(true);
  };
  const complete = (leadId?: string) => {
    if (!leadId || !pending) return;
    if (pending === "download") {
      // Detached links avoid re-entering the site-wide lead gate after saving.
      const link = document.createElement("a");
      link.href = pdf; link.download = ""; link.target = "_blank"; link.rel = "noopener noreferrer";
      link.click();
    } else {
      setOpened(true);
      if (pending === "fullscreen") setFs(true);
    }
    setPending(null);
  };

  if (!images.length && !pdf) return null;
  const ready = !pdf || opened;
  const frame = <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
    <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
      <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 break-words text-xs font-semibold leading-5 sm:text-sm">{title || "PDF document"}</span>
      <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{pdf ? "PDF" : "DOCUMENT"}</span>
    </div>
    {ready ? <>
      <div tabIndex={0} role="region" aria-label="Document pages" className={`overflow-auto bg-muted/30 ${fs ? "max-h-[75dvh]" : "max-h-[320px] sm:max-h-[440px]"}`}>
        {pdf ? <Suspense fallback={<p role="status" className="p-4 text-center text-sm">Loading PDF viewer…</p>}>
          <PdfPage url={pdf} page={page} zoom={zoom} onLoad={onPdfLoad} />
        </Suspense> : <img src={images[page]} alt={`${title || "Document"} page ${page + 1}`} loading="lazy" className="mx-auto block" style={{ width: `${zoom}%`, maxWidth: "none" }} />}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-0 bg-slate-800 px-1 text-xs text-white">
        <button type="button" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || !total} className={control} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
        <span aria-live="polite" className="px-1 tabular-nums">{total ? `${page + 1} / ${total}` : "PDF"}</span>
        <button type="button" onClick={() => setPage(p => Math.min(total - 1, p + 1))} disabled={!total || page === total - 1} className={control} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
        <button type="button" onClick={() => setZoom(z => Math.max(50, z - 25))} disabled={zoom === 50} className={control} aria-label="Zoom out"><Minus className="h-4 w-4" /></button>
        <span className="min-w-8 text-center tabular-nums">{zoom}%</span>
        <button type="button" onClick={() => setZoom(z => Math.min(300, z + 25))} disabled={zoom === 300} className={control} aria-label="Zoom in"><Plus className="h-4 w-4" /></button>
        <button type="button" onClick={() => fs ? setFs(false) : request("fullscreen")} className={control} aria-label={fs ? "Exit full screen" : "View full size PDF"}>{fs ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
        {pdf ? <button type="button" onClick={() => request("download")} className={control} aria-label="Download PDF"><Download className="h-4 w-4" /></button>
          : <a href={images[page]} download target="_blank" rel="noopener noreferrer" className={control} aria-label="Download current page"><Download className="h-4 w-4" /></a>}
      </div>
    </> : <div className="px-3 py-3 sm:py-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={() => request("view")} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><FileText className="h-4 w-4" />View PDF document</button>
        <button type="button" onClick={() => request("fullscreen")} className="inline-flex h-11 w-11 items-center justify-center rounded-lg border hover:bg-muted" aria-label="View full size PDF"><Maximize2 className="h-4 w-4" /></button>
        <button type="button" onClick={() => request("download")} className="inline-flex h-11 w-11 items-center justify-center rounded-lg border hover:bg-muted" aria-label="Download PDF"><Download className="h-4 w-4" /></button>
      </div>
      <div className="mt-2 text-center text-xs text-muted-foreground">Complete the short form to read this PDF here.</div>
    </div>}
  </div>;

  return <div className="not-prose mx-auto my-4 w-full max-w-3xl min-w-0">
    {!fs && frame}
    <Dialog open={fs && !pending} onOpenChange={setFs}>
      <DialogContent aria-describedby={undefined} className="w-[calc(100%-1rem)] max-w-5xl gap-2 p-2 pt-10 sm:p-3 sm:pt-10">
        <DialogTitle className="sr-only">{title || "PDF document"}</DialogTitle>
        {frame}
      </DialogContent>
    </Dialog>
    {pending && <LeadGateDialog open onOpenChange={open => { if (!open) setPending(null); }} forceShow simple
      title={pending === "download" ? "Download PDF" : "Read PDF"}
      subtitle="Share your details and study preferences to continue to this document."
      source={`pdf_${pending}_${encodeURIComponent(title || pdf).slice(0, 150)}`} onSuccess={complete} />}
  </div>;
}
