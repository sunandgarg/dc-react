import { describe, expect, it } from "vitest";
import { escapeCSVCell, neutralizeSpreadsheetFormula, sanitizeCSVText, toCSV, toCSVRows } from "./csv";

describe("CSV spreadsheet safety", () => {
  it.each([
    "=2+2",
    "+cmd|' /C calc'!A0",
    "-1+2",
    "@SUM(1,2)",
    "  =HYPERLINK(\"https://example.test\")",
    "\t@SUM(1,2)",
    "\u0000-cmd",
    "\u00a0=SUM(1,2)",
    "\ufeff+SUM(1,2)",
    "\u200b@SUM(1,2)",
  ])("neutralizes formula-like text %j", (value) => {
    expect(neutralizeSpreadsheetFormula(value)).toBe(`'${value}`);
  });

  it("does not turn real numeric values or ordinary text into text", () => {
    expect(neutralizeSpreadsheetFormula(-42)).toBe("-42");
    expect(neutralizeSpreadsheetFormula("Sarkari result")).toBe("Sarkari result");
  });

  it("neutralizes before quoting and escapes embedded quotes", () => {
    expect(escapeCSVCell('  =HYPERLINK("https://example.test")')).toBe(
      '"\'  =HYPERLINK(""https://example.test"")"',
    );
  });

  it("protects both dynamic headers and values", () => {
    expect(toCSV([{ "=header": "\n+payload" }], ["=header"])).toBe(
      "'=header\n\"'\n+payload\"",
    );
  });

  it("provides the same protection for array-shaped exports", () => {
    expect(toCSVRows([["Name", "Email"], ["@attacker", " safe@example.test"]])).toBe(
      "Name,Email\n'@attacker, safe@example.test",
    );
  });

  it("safely re-encodes configured CSV text before download", () => {
    expect(sanitizeCSVText('name,note\n" =2+2","hello, world"')).toBe(
      'name,note\n\' =2+2,"hello, world"',
    );
  });
});
