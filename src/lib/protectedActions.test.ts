import { describe, expect, it } from "vitest";
import { classifyProtectedAction, isAdminActionContext, protectedActionCopy } from "./protectedActions";

describe("protected action policy", () => {
  it("recognizes destructive and export controls", () => {
    const deleteButton = document.createElement("button");
    deleteButton.setAttribute("aria-label", "Delete selected leads");
    const exportButton = document.createElement("button");
    exportButton.textContent = "Export CSV";
    expect(classifyProtectedAction(deleteButton)).toBe("delete");
    expect(classifyProtectedAction(exportButton)).toBe("download");
  });

  it("requires an exact typed phrase for counted deletions", () => {
    expect(protectedActionCopy({ kind: "delete", count: 8 }).phrase).toBe("DELETE 8 RECORDS");
    expect(protectedActionCopy({ kind: "download", label: "lead export" }).phrase).toBe("");
  });

  it("protects admin operations without intercepting public downloads", () => {
    expect(isAdminActionContext("/admin/leads")).toBe(true);
    expect(isAdminActionContext("/news")).toBe(false);
    expect(isAdminActionContext("/study-material/downloads")).toBe(false);
  });
});
