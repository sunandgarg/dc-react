import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CAT_KIT_RESOURCES } from "@/lib/catExperience";

describe("CAT 2026 preparation kit campaign", () => {
  const page = readFileSync(resolve(process.cwd(), "src/pages/CatPreparationKit.tsx"), "utf8");
  const gate = readFileSync(resolve(process.cwd(), "src/components/cat/CatAccessGate.tsx"), "utf8");

  it("advertises the exact 16-resource collection", () => {
    expect(CAT_KIT_RESOURCES).toHaveLength(16);
    expect(CAT_KIT_RESOURCES.filter((item) => item.group === "Actual CAT papers")).toHaveLength(9);
  });

  it("opens the lead gate for every campaign download CTA", () => {
    expect(page).not.toMatch(/readCatAccess/);
    expect(page).toMatch(/setGateOpen\(true\)/);
    expect(page).toMatch(/requestDownload\("hero"\)/);
    expect(page).toMatch(/requestDownload\("resource_library"\)/);
    expect(page).toMatch(/requestDownload\("final_cta"\)/);
    expect(page).toMatch(/onGranted=\{\(leadId\) => void beginDownload\(leadId\)\}/);
  });

  it("uses the focused two-step CAT lead experience", () => {
    expect(gate).toMatch(/forceShow/);
    expect(gate).toMatch(/simple/);
    expect(gate).toMatch(/theme="cat-kit"/);
    expect(gate).toMatch(/complete 16-resource ZIP starts downloading/);
  });
});
