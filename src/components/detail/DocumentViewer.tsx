import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Maximize2, X, Download } from "lucide-react";

interface Props {
  images: string[];
  title?: string;
  pdf?: string;
}

const PdfPage = lazy(() => import("./PdfPage"));

/** PDF-style multi-page image viewer used inside article content. */
export function DocumentViewer({ images, title, pdf = "" }: Props) {
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [fs, setFs] = useState(false);
  const [pdfPages, setPdfPages] = useState(0);
  const [opened, setOpened] = useState(false);
  const total = pdf ? pdfPages : images.length;
  const onPdfLoad = useCallback((pages: number) => setPdfPages(pages), []);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fs) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFs(false);
      if (total && e.key === "ArrowRight") setPage((p) => Math.min(total - 1, p + 1));
      if (total && e.key === "ArrowLeft") setPage((p) => Math.max(0, p - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fs, total]);

  if (!images.length && !pdf) return null;

  const Frame = (
    <div className="relative bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      {title && (
        <div className="px-4 py-2.5 border-b border-border bg-muted/40 text-center text-[13px] sm:text-sm font-semibold text-foreground">
          {title}
        </div>
      )}
      <div className="relative bg-muted/30 flex items-center justify-center overflow-auto max-h-[70vh]">
        {pdf ? opened ? <Suspense fallback={<p role="status" className="p-4">Loading PDF viewer…</p>}><PdfPage url={pdf} page={page} zoom={zoom} onLoad={onPdfLoad} /></Suspense>
          : <button type="button" onClick={() => setOpened(true)} className="m-5 rounded-lg border px-5 py-3 text-sm font-semibold text-primary">View PDF document</button> : <img
          src={images[page]}
          alt={`${title || "Document"} page ${page + 1}`}
          loading="lazy"
          className="block mx-auto transition-transform duration-200"
          style={{ width: `${zoom}%`, maxWidth: "none" }}
        />}
      </div>
      {/* Keep controls outside the page so they cannot cover document text. */}
      <div className="bg-foreground/90 text-background px-2 py-2 flex flex-wrap justify-center items-center gap-1 shadow-lg text-xs">
        <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || !total}
          className="p-1 rounded-full hover:bg-white/15 disabled:opacity-40" aria-label="Previous page">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-medium tabular-nums px-1">{total ? `${page + 1} of ${total}` : "PDF"}</span>
        <button type="button" onClick={() => setPage((p) => Math.min(total - 1, p + 1))} disabled={!total || page === total - 1}
          className="p-1 rounded-full hover:bg-white/15 disabled:opacity-40" aria-label="Next page">
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="w-px h-4 bg-white/30 mx-1" />
        <button type="button" onClick={() => setZoom((z) => Math.max(50, z - 25))} className="p-1 rounded-full hover:bg-white/15" aria-label="Zoom out">
          <Minus className="w-4 h-4" />
        </button>
        <span className="font-medium tabular-nums px-0.5 min-w-[40px] text-center">{zoom}%</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(300, z + 25))} className="p-1 rounded-full hover:bg-white/15" aria-label="Zoom in">
          <Plus className="w-4 h-4" />
        </button>
        <span className="w-px h-4 bg-white/30 mx-1" />
        <button type="button" onClick={() => { setOpened(true); setFs((v) => !v); }} className="p-1 rounded-full hover:bg-white/15" aria-label="Fullscreen">
          {fs ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <a href={pdf || images[page]} download target="_blank" rel="noopener noreferrer"
          className="p-1 rounded-full hover:bg-white/15" aria-label={pdf ? "Open or download PDF" : "Download current page"}>
          <Download className="w-4 h-4" />
        </a>
      </div>
    </div>
  );

  return (
    <div className="my-5 not-prose" ref={containerRef}>
      {!fs && Frame}
      {fs && (
        <div className="fixed inset-0 z-[120] bg-black/90 p-3 sm:p-6 flex flex-col" onClick={() => setFs(false)}>
          <div className="flex-1 min-h-0 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full max-w-5xl">{Frame}</div>
          </div>
        </div>
      )}
    </div>
  );
}
