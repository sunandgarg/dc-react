import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { apiBaseUrl } from "@/lib/backendMode";

export default function PdfPage({ url, page, zoom, onLoad }: { url: string; page: number; zoom: number; onLoad: (pages: number) => void }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [width, setWidth] = useState(640);
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | undefined;
    setPdf(null); setError(""); setLoading(true);
    void import("pdfjs-dist").then(async (library) => {
      if (cancelled) return;
      library.GlobalWorkerOptions.workerSrc = workerUrl;
      // Our API already supports public S3 reads; avoid depending on CDN CORS.
      const path = new URL(url, window.location.origin).pathname;
      const ownedPath = path.match(/\/(admin-uploads\/editor\/documents\/[a-f0-9-]+\.pdf)$/i)?.[1];
      const source = ownedPath ? `${apiBaseUrl()}/storage/v1/object/public/${ownedPath}` : url;
      const assets = `/assets/pdfjs/${library.version}/`;
      task = library.getDocument({ url: source, useSystemFonts: true, disableAutoFetch: true,
        cMapUrl: `${assets}cmaps/`, cMapPacked: true, standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/` });
      const document = await task.promise;
      if (cancelled) return;
      onLoad(document.numPages);
      setPdf(document);
    }).catch(() => { if (!cancelled) { setError("Preview could not load. Open or download the PDF below."); setLoading(false); } });
    return () => { cancelled = true; void task?.destroy(); };
  }, [url, onLoad]);

  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth || 640));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let cancelled = false;
    let render: RenderTask | undefined;
    setLoading(true);
    setError("");
    void pdf.getPage(page + 1).then(async (documentPage) => {
      if (cancelled || !canvas.current) return;
      const base = documentPage.getViewport({ scale: 1 });
      const displayWidth = Math.max(1, width * zoom / 100);
      const viewport = documentPage.getViewport({ scale: displayWidth / base.width });
      const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8000000 / (viewport.width * viewport.height)));
      canvas.current.width = Math.ceil(viewport.width * ratio);
      canvas.current.height = Math.ceil(viewport.height * ratio);
      canvas.current.style.width = `${viewport.width}px`;
      canvas.current.style.height = `${viewport.height}px`;
      render = documentPage.render({ canvas: canvas.current, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      await render.promise;
      if (!cancelled) setLoading(false);
    }).catch((failure) => {
      if (!cancelled && failure.name !== "RenderingCancelledException") { setError("This page could not render. Open the PDF below."); setLoading(false); }
    });
    return () => { cancelled = true; render?.cancel(); };
  }, [pdf, page, zoom, width]);

  return <div ref={container} className="w-full min-w-0 overflow-auto bg-muted/30">
    {loading && <p role="status" className="p-4 text-center text-sm">Loading PDF page…</p>}
    {error && <p role="alert" className="p-4 text-center text-sm">{error}</p>}
    <canvas ref={canvas} aria-label={`Document page ${page + 1}`} className="mx-auto block" />
  </div>;
}
