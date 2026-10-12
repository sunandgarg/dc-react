import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PDFDocument, PDFName } from "pdf-lib";
import { optimizeDocumentPdf } from "../src/document-pdf.mjs";
import { storagePolicyInternals } from "../src/storage.mjs";

async function fixture(options = {}) {
  const doc = await PDFDocument.create();
  for (let index = 0; index < 8; index++) doc.addPage().drawText(`Admission document page ${index + 1}`);
  if (options.active) doc.addJavaScript("bad", "app.alert('unsafe')");
  if (options.signed) doc.context.register(doc.context.obj({ Type: PDFName.of("Sig"), ByteRange: [0, 100, 200, 300] }));
  return Buffer.from(await doc.save({ useObjectStreams: !!options.compressed }));
}

test("losslessly reduces object overhead without losing pages or form fields", async () => {
  const original = await fixture();
  const doc = await PDFDocument.load(original);
  const field = doc.getForm().createTextField("student");
  field.setText("Neha");
  field.addToPage(doc.getPage(0));
  const source = Buffer.from(await doc.save({ useObjectStreams: false }));
  const optimized = await optimizeDocumentPdf(source);
  assert.ok(optimized.length < source.length);
  const result = await PDFDocument.load(optimized);
  assert.equal(result.getPageCount(), 8);
  assert.equal(result.getForm().getTextField("student").getText(), "Neha");
});

test("never increases an already optimized file", async () => {
  const original = await fixture({ compressed: true });
  assert.ok((await optimizeDocumentPdf(original)).length <= original.length);
});

test("preserves signature bytes instead of invalidating a signed PDF", async () => {
  const original = await fixture({ signed: true });
  assert.deepEqual(await optimizeDocumentPdf(original), original);
});

test("rejects invalid, truncated, script-bearing and excessive-page PDFs", async () => {
  await assert.rejects(() => optimizeDocumentPdf(Buffer.from("not a PDF")), /complete PDF/);
  const valid = await fixture();
  await assert.rejects(() => optimizeDocumentPdf(valid.subarray(0, valid.length - 20)), /complete PDF/);
  await assert.rejects(() => optimizeDocumentPdf(Buffer.from("%PDF-1.7\ninvalid\n%%EOF")));
  const active = await fixture({ active: true });
  await assert.rejects(() => optimizeDocumentPdf(active), /scripts|active/);
  const many = await PDFDocument.create();
  for (let i = 0; i < 501; i++) many.addPage();
  const manyBytes = Buffer.from(await many.save());
  await assert.rejects(() => optimizeDocumentPdf(manyBytes), /500 pages/);
});

test("storage processing is confined to document-viewer PDFs and enforces upload limits", async () => {
  const { documentUploadBody } = storagePolicyInternals;
  const original = await fixture();
  const route = { bucket: "admin-uploads", objectPath: "editor/documents/test.pdf" };
  const request = (type, body) => new Request("http://localhost/upload", { method: "POST", headers: { "content-type": type }, body });
  const optimized = await documentUploadBody(request("application/pdf", original), route);
  assert.ok(optimized.length < original.length);
  await assert.rejects(() => documentUploadBody(request("image/png", "image"), route), error => error.status === 415);
  await assert.rejects(() => documentUploadBody(request("application/pdf", "fake pdf"), route), error => error.status === 422);
  assert.deepEqual(await documentUploadBody(request("application/pdf", original), { bucket: "user-documents", objectPath: "user/signed.pdf" }), original);
});

test("deployment enables the PDF limit only on the authenticated upload route", async () => {
  const snippet = await readFile(new URL("../nginx/document-uploads.conf", import.meta.url), "utf8");
  const workflow = await readFile(new URL("../../.github/workflows/deploy-aws-lightsail.yml", import.meta.url), "utf8");
  assert.match(snippet, /location \^~ \/storage\/v1\/object\/admin-uploads\/editor\/documents\//);
  assert.match(snippet, /client_max_body_size 20m;/);
  assert.match(snippet, /proxy_set_header X-Real-IP \$remote_addr;/);
  assert.match(workflow, /install -m 0644 .*backend\/nginx\/document-uploads.conf/);
  assert.match(workflow, /include \/etc\/nginx\/snippets\/dc-document-uploads.conf;/);
});
