import assert from "node:assert/strict";
import test from "node:test";
import { storagePolicyInternals } from "../src/storage.mjs";

const { checkedBody, ownsPath, routeDetails } = storagePolicyInternals;
const identity = { id: "12d8b889-5ab9-4f9d-8725-b73444f418d5" };

test("parses public, list, and direct storage routes", () => {
  assert.deepEqual(routeDetails("/storage/v1/object/public/admin-uploads/college/a.webp"), {
    modifier: "public", bucket: "admin-uploads", objectPath: "college/a.webp",
  });
  assert.deepEqual(routeDetails("/storage/v1/object/list/user-documents"), {
    modifier: "list", bucket: "user-documents", objectPath: "",
  });
  assert.deepEqual(routeDetails("/storage/v1/object/user-documents/user/file.pdf"), {
    modifier: null, bucket: "user-documents", objectPath: "user/file.pdf",
  });
});

test("scopes normal user uploads to their document and avatar folders", () => {
  assert.equal(ownsPath(identity, "user-documents", `${identity.id}/marksheet.pdf`), true);
  assert.equal(ownsPath(identity, "user-documents", `another-user/marksheet.pdf`), false);
  assert.equal(ownsPath(identity, "admin-uploads", `user-avatars/${identity.id}/avatar.webp`), true);
  assert.equal(ownsPath(identity, "admin-uploads", "college-images/banner.webp"), false);
  assert.equal(ownsPath(identity, "ad-images", `${identity.id}/ad.webp`), false);
});

test("rejects unsafe upload types", async () => {
  const request = new Request("http://localhost/storage/v1/object/admin-uploads/file.html", {
    method: "POST", headers: { "content-type": "text/html" }, body: "<script>alert(1)</script>",
  });
  await assert.rejects(() => checkedBody(request), (error) => error.status === 415 && error.code === "STORAGE_TYPE_NOT_ALLOWED");
});

test("accepts safe files wrapped by the browser multipart uploader", async () => {
  const form = new FormData();
  form.append("file", new Blob(["safe image"], { type: "image/svg+xml" }), "qa.svg");
  const request = new Request("http://localhost/storage/v1/object/admin-uploads/qa.svg", {
    method: "POST", body: form,
  });
  const body = await checkedBody(request);
  assert.ok(body.byteLength > 0);
});

test("rejects unsafe files inside multipart uploads", async () => {
  const form = new FormData();
  form.append("file", new Blob(["<script></script>"], { type: "text/html" }), "qa.html");
  const request = new Request("http://localhost/storage/v1/object/admin-uploads/qa.html", {
    method: "POST", body: form,
  });
  await assert.rejects(() => checkedBody(request), (error) => error.status === 415 && error.code === "STORAGE_TYPE_NOT_ALLOWED");
});

test("rejects upload bodies over the configured limit", async () => {
  const previous = process.env.STORAGE_MAX_UPLOAD_BYTES;
  process.env.STORAGE_MAX_UPLOAD_BYTES = "4";
  try {
    const request = new Request("http://localhost/storage/v1/object/admin-uploads/file.png", {
      method: "POST", headers: { "content-type": "image/png" }, body: "12345",
    });
    await assert.rejects(() => checkedBody(request), (error) => error.status === 413 && error.code === "STORAGE_FILE_TOO_LARGE");
  } finally {
    if (previous === undefined) delete process.env.STORAGE_MAX_UPLOAD_BYTES;
    else process.env.STORAGE_MAX_UPLOAD_BYTES = previous;
  }
});
