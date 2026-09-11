/**
 * CSV utilities - no extra dependencies.
 * Handles quoted values, commas, newlines and spreadsheet-formula injection.
 */

// Excel, Numbers and LibreOffice can execute a text cell as a formula even when
// the formula marker follows whitespace or a control character. Keep the
// original value visible, but force spreadsheet applications to treat it as
// text. This must happen before RFC 4180 quoting.
const SPREADSHEET_FORMULA_PREFIX = /^[\s\p{Cc}\p{Cf}]*[=+\-@]/u;

export function neutralizeSpreadsheetFormula(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return typeof value === "string" && SPREADSHEET_FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

export function escapeCSVCell(value: unknown): string {
  const text = neutralizeSpreadsheetFormula(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCSVRows(rows: readonly (readonly unknown[])[]): string {
  return rows.map((row) => row.map(escapeCSVCell).join(",")).join("\n");
}

export function toCSV(rows: Record<string, any>[], columns?: string[]): string {
  if (!rows.length) return "";
  const cols = columns || Object.keys(rows[0]);
  const head = cols.map(escapeCSVCell).join(",");
  const body = rows.map(r => cols.map(c => escapeCSVCell(r[c])).join(",")).join("\n");
  return head + "\n" + body;
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQ = false;
      else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { cur.push(field); field = ""; }
      else if (ch === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (ch === "\r") { /* skip */ }
      else field += ch;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

/** Re-encodes an existing CSV so configured/sample files are safe to open. */
export function sanitizeCSVText(text: string): string {
  return toCSVRows(parseCSVRows(text));
}

export function parseCSV(text: string): Record<string, string>[] {
  const rows = parseCSVRows(text);
  if (!rows.length) return [];
  const headers = rows.shift()!.map((h, index) => (index === 0 ? h.replace(/^\uFEFF/, "") : h).trim());
  return rows.filter(r => r.some(c => c.length)).map(r => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = r[i] ?? ""; });
    return o;
  });
}

/** Coerces CSV strings into proper types based on a hint map. */
export function coerceRow(row: Record<string, string>, hints: Record<string, "number" | "boolean" | "array" | "json">) {
  const out: Record<string, any> = { ...row };
  for (const [k, t] of Object.entries(hints)) {
    if (out[k] === undefined || out[k] === "") { delete out[k]; continue; }
    const v = out[k];
    if (t === "number") out[k] = Number(v);
    else if (t === "boolean") out[k] = /^(1|true|yes|y)$/i.test(v);
    else if (t === "array") out[k] = String(v).split("|").map(s => s.trim()).filter(Boolean);
    else if (t === "json") { try { out[k] = JSON.parse(v); } catch { /* leave */ } }
  }
  return out;
}
