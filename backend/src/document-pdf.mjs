import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

let activeJobs = 0;

// Parse untrusted compressed objects off the API thread, with bounded memory/time.
export async function optimizeDocumentPdf(bytes) {
  if (activeJobs >= 2) throw Object.assign(new Error("PDF processing is busy; retry shortly"), { status: 503 });
  activeJobs++;
  try {
    return await new Promise((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url), { workerData: bytes, resourceLimits: { maxOldGenerationSizeMb: 192 } });
      const timer = setTimeout(() => {
        void worker.terminate();
        reject(Object.assign(new Error("PDF processing timed out; use a smaller document"), { status: 422 }));
      }, 15000);
      worker.once("message", (result) => {
        clearTimeout(timer);
        if (result.error) reject(Object.assign(new Error(result.error), { status: 422, code: "INVALID_DOCUMENT_PDF" }));
        else resolve(Buffer.from(result.bytes));
      });
      worker.once("error", () => {
        clearTimeout(timer);
        reject(Object.assign(new Error("PDF could not be processed; use a smaller, valid PDF"), { status: 422 }));
      });
      worker.once("exit", () => {
        clearTimeout(timer);
        reject(Object.assign(new Error("PDF processing stopped; retry with a smaller PDF"), { status: 422 }));
      });
    });
  } finally { activeJobs--; }
}

if (!isMainThread) {
  try {
    const { PDFDocument, PDFDict, PDFArray, PDFName, PDFStream } = await import("pdf-lib");
    const bytes = Buffer.from(workerData);
    if (!bytes.subarray(0, 1024).includes(Buffer.from("%PDF-")) || !bytes.subarray(-1024).includes(Buffer.from("%%EOF"))) throw new Error("Upload a complete PDF file");
    const doc = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
    if (!doc.getPageCount() || doc.getPageCount() > 500) throw new Error("PDFs must contain between 1 and 500 pages");
    const visited = new Set();
    let signed = false;
    const inspect = (object) => {
      if (!object || visited.has(object)) return;
      visited.add(object);
      if (visited.size > 200000) throw new Error("PDF is too complex; upload a simpler document");
      if (object instanceof PDFStream) inspect(object.dict);
      if (object instanceof PDFArray) object.asArray().forEach(inspect);
      if (!(object instanceof PDFDict)) return;
      for (const [key, value] of object.entries()) {
        if (["/JS", "/JavaScript", "/Launch", "/EmbeddedFiles", "/XFA", "/RichMediaContent"].includes(key.toString())) throw new Error("PDFs containing scripts, attachments or active content are not supported");
        if (key.toString() === "/Type" && value.toString() === "/EmbeddedFile") throw new Error("PDF attachments are not supported");
        if (key.toString() === "/S" && value instanceof PDFName && ["/JavaScript", "/Launch", "/SubmitForm", "/ImportData", "/GoToR"].includes(value.toString())) throw new Error("PDFs containing active actions are not supported");
        if (["/FT", "/Type"].includes(key.toString()) && value.toString() === "/Sig") signed = true;
        inspect(value);
      }
    };
    doc.context.enumerateIndirectObjects().forEach(([, object]) => inspect(object));
    // Rewriting invalidates digital signatures; preserve those PDFs byte-for-byte.
    const compressed = signed ? bytes : Buffer.from(await doc.save({ useObjectStreams: true, updateFieldAppearances: false, addDefaultPage: false }));
    parentPort.postMessage({ bytes: compressed.length < bytes.length ? compressed : bytes });
  } catch (error) {
    parentPort.postMessage({ error: /encrypt/i.test(error.message) ? "Password-protected PDFs are not supported; upload an unlocked copy" : error.message });
  }
}
