import assert from "node:assert/strict";
import test from "node:test";
import { applyEdgeSeo, edgeSeoFor } from "../public/edge-seo.js";

const origin = "https://dekhocampus.com";

test("document routes declare one absolute preferred canonical", () => {
  const cases = [
    ["/", "/"],
    ["/colleges/example-10001", "/colleges/example-10001"],
    ["/colleges/example-10001/fees", "/colleges/example-10001"],
    ["/courses/example-10001/eligibility", "/courses/example-10001"],
    ["/exams/example-10001/syllabus", "/exams/example-10001/syllabus"],
    ["/scholarships/example", "/scholarships/example"],
    ["/news/example", "/news/example"],
    ["/study-material/class-12/cbse/physics", "/study-material/class-12/cbse/physics"],
    ["/colleges/example-10001?utm_source=test", "/colleges/example-10001"],
  ];
  const shell = '<html><head><link rel="canonical" href="https://dekhocampus.com/"><link href="https://bad.example" rel="canonical"></head><body></body></html>';
  for (const [path, preferred] of cases) {
    const metadata = edgeSeoFor(`${origin}${path}`);
    const canonical = preferred === "/" ? origin : `${origin}${preferred}`;
    assert.equal(metadata.canonical, canonical);
    const html = applyEdgeSeo(shell, metadata);
    assert.deepEqual([...html.matchAll(/<link\b[^>]*\brel="canonical"[^>]*>/gi)].map((match) => match[0]), [`<link rel="canonical" href="${canonical}">`]);
  }
});
