import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Clean Data lifecycle and review workflow", () => {
  const schema = readFileSync(resolve(process.cwd(), "backend/prisma/schema.prisma"), "utf8");
  const cleaner = readFileSync(resolve(process.cwd(), "backend/src/data-cleaner.mjs"), "utf8");
  const admin = readFileSync(resolve(process.cwd(), "src/pages/AdminDataCleaner.tsx"), "utf8");
  const preview = readFileSync(resolve(process.cwd(), "src/pages/AdminDataCleanerPreview.tsx"), "utf8");

  it("tracks attempts separately from successful applied cleanups", () => {
    expect(schema).toMatch(/data_clean_attempts/);
    expect(schema).toMatch(/data_clean_successes/);
    expect(schema).toMatch(/data_clean_state/);
    expect(cleaner).toMatch(/status = !safe \? "skipped"/);
    expect(cleaner).toMatch(/awaiting_review/);
  });

  it("queues only the least-completed pass and blocks a new pass during review", () => {
    expect(cleaner).toMatch(/COALESCE\(t\.\\`data_clean_attempts\\`,0\) = \(SELECT MIN/);
    expect(cleaner).toMatch(/candidate\.\\`data_clean_attempts\\`/);
    expect(cleaner).toMatch(/<> 'awaiting_review'/);
  });

  it("opens a dedicated split before-and-after comparison", () => {
    expect(admin).toMatch(/Open full comparison/);
    expect(admin).toMatch(/target="_blank"/);
    expect(preview).toMatch(/Current database value/);
    expect(preview).toMatch(/AI researched value/);
    expect(preview).toMatch(/grid-cols-2/);
  });

  it("does not show an evidence percentage when no change was supported", () => {
    expect(admin).toMatch(/item\.changed_fields\?\.length > 0/);
    expect(cleaner).toMatch(/changed\.length > 0 && sourceUrls\.length > 0/);
  });
});
