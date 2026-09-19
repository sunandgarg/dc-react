import test from "node:test";
import assert from "node:assert/strict";
import { articleCoverAudit, articleCoverRepairReason, articleImageHost } from "../src/article-cover-maintenance.mjs";

test("article cover repair targets only missing, placeholder and retired CMS images", () => {
  assert.equal(articleCoverRepairReason(""), "missing");
  assert.equal(articleCoverRepairReason("   "), "missing");
  assert.equal(articleCoverRepairReason("/placeholder.svg"), "placeholder");
  assert.equal(articleCoverRepairReason("https://cms.dekhocampus.com/assets/old-id"), "retired-cms-host");
  assert.equal(articleCoverRepairReason("https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/blog-covers/live.webp"), null);
});

test("article cover audit groups hosts and keeps working S3 covers untouched", () => {
  const rows = [
    { id: "1", featured_image: "" },
    { id: "2", featured_image: "https://cms.dekhocampus.com/assets/legacy" },
    { id: "3", featured_image: "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/blog-covers/live.webp" },
  ];
  const audit = articleCoverAudit(rows);
  assert.deepEqual(audit.reasonCounts, { missing: 1, "retired-cms-host": 1 });
  assert.deepEqual(audit.candidates.map((row) => row.id), ["1", "2"]);
  assert.equal(audit.hostCounts["aws-origin.dekhocampus.com"], 1);
  assert.equal(articleImageHost("not a url"), "(invalid)");
});
