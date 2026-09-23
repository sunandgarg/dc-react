import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDefaultFaqs } from "@/lib/defaultFaqs";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("exam conducting authority", () => {
  it("uses a verified authority in fallback answers without assuming NTA", () => {
    const verified = buildDefaultFaqs("exam", {
      name: "Example Entrance Test",
      conducting_authority: "Example University",
    });
    const unknown = buildDefaultFaqs("exam", { name: "Example Entrance Test" });

    expect(verified[0].answer).toContain("announced by Example University");
    expect(unknown[0].answer).toContain("announced by the conducting authority");
    expect(unknown.map((item) => item.answer).join(" ")).not.toContain("NTA");
  });

  it("does not present an unannounced placeholder as a real exam date", () => {
    const faqs = buildDefaultFaqs("exam", {
      name: "Example Entrance Test",
      exam_date: "Not announced",
      conducting_authority: "Example University",
    });

    expect(faqs[0].answer).toContain("dates are announced by Example University");
    expect(faqs[0].answer).not.toContain("scheduled around Not announced");
  });

  it("only renders the authority row and highlight when a value is present", () => {
    const detail = read("src/pages/ExamDetail.tsx");

    expect(detail).toContain('const conductingAuthority = exam.conducting_authority?.trim() || "";');
    expect(detail).toContain('...(conductingAuthority ? [{ label: "Conducting Authority", value: conductingAuthority }] : [])');
    expect(detail).toContain('...(conductingAuthority ? [`${exam.name} is conducted by ${conductingAuthority}`] : [])');
    expect(detail).not.toContain('{ label: "Conducting Body", value: "NTA" }');
    expect(detail).not.toContain("is conducted by NTA (National Testing Agency)");
  });

  it("exposes the nullable field in the exam editor", () => {
    const admin = read("src/pages/AdminExams.tsx");
    expect(admin).toContain("Conducting Authority");
    expect(admin).toContain('update("conducting_authority"');
    expect(admin).toContain("The public exam page will omit this field");
  });
});
