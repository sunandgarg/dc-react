import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("storage upload preflight permits the browser upload headers", async () => {
  const source = await readFile(new URL("../src/index.mjs", import.meta.url), "utf8");
  const body = source.match(/function corsHeaders\(request\) \{([\s\S]*?)\n\}/)[1];
  const headers = new Function("request", "allowedOrigins", body)(
    new Request("https://aws-origin.dekhocampus.com/storage/v1/object/admin-uploads/test.pdf", {
      headers: { origin: "https://dekhocampus.com" },
    }), ["https://dekhocampus.com"],
  );
  const allowed = headers["access-control-allow-headers"].split(/,\s*/);
  for (const name of ["authorization", "content-type", "cache-control", "x-upsert"]) assert.ok(allowed.includes(name), name);
  assert.equal(headers["access-control-allow-origin"], "https://dekhocampus.com");
});
