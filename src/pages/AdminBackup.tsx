import { useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { backendClient } from "@/integrations/backend/client";
import { Download, Upload, Database, AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { downloadJSON } from "@/lib/adminIO";

async function fetchPinnedFullDatabaseExport(pin: string) {
  const { data, error } = await (backendClient.rpc as any)("admin_full_database_export", {
    input_pin: pin,
  });
  if (error) throw error;
  return data;
}

export default function AdminBackup() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [exportPin, setExportPin] = useState("");

  const append = (line: string) => setLog((p) => [...p, line]);

  const handleExport = async () => {
    setExporting(true);
    setLog([]);
    try {
      if (!exportPin.trim()) {
        throw new Error("Enter the database export PIN before downloading.");
      }

      append("Requesting admin PIN-gated full export...");
      const payload = await fetchPinnedFullDatabaseExport(exportPin.trim());
      append(
        `Ready: ${(payload?.total_rows ?? 0).toLocaleString()} rows across ${
          payload?.table_count ?? Object.keys(payload?.tables || {}).length
        } public tables.`
      );

      downloadJSON(
        `dekhocampus-full-database-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`,
        payload
      );
      toast.success("Backup downloaded");
    } catch (e: any) {
      toast.error(e.message || "Export failed");
      append(`ERROR: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setLog([]);
    try {
      append(`Reading ${file.name}...`);
      const text = await file.text();
      const json = JSON.parse(text);
      const data: Record<string, any[]> = json.tables
        ? Object.fromEntries(
            Object.entries(json.tables).map(([table, value]: [string, any]) => [
              table,
              Array.isArray(value) ? value : value?.rows || [],
            ])
          )
        : json.data || json;
      const SKIP_TABLES = new Set(["version", "schema", "exported_at", "table_count", "total_rows"]);
      const tableNames = Object.keys(data).filter((t) => !SKIP_TABLES.has(t));
      append(`File contains ${tableNames.length} tables.`);

      if (mode === "replace") {
        if (!confirm("REPLACE mode will DELETE all existing rows in the listed tables before importing. Continue?")) {
          setImporting(false);
          return;
        }
      }

      for (const t of tableNames) {
        const rows = data[t] || [];
        if (rows.length === 0) {
          append(`• ${t}: (empty, skipped)`);
          continue;
        }

        if (mode === "replace") {
          append(`Clearing ${t}...`);
          // Try delete with id filter, fall back to a universally-true predicate for tables without id
          let delErr = (await backendClient.from(t as any).delete().not("id", "is", null)).error;
          if (delErr) {
            const alt = await backendClient.from(t as any).delete().gte("created_at", "1900-01-01");
            delErr = alt.error;
          }
          if (delErr) {
            append(`  ✗ clear ${t} failed: ${delErr.message}`);
          }
        }

        // chunk inserts/upserts. Detect if rows have an "id" for upsert; otherwise plain insert.
        const hasId = rows[0] && Object.prototype.hasOwnProperty.call(rows[0], "id");
        const chunkSize = 500;
        let inserted = 0;
        let failed = 0;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const op = hasId
            ? backendClient.from(t as any).upsert(chunk, { onConflict: "id", ignoreDuplicates: false })
            : backendClient.from(t as any).insert(chunk);
          const { error } = await op;
          if (error) {
            const { error: insErr } = await backendClient.from(t as any).insert(chunk);
            if (insErr) {
              failed += chunk.length;
              append(`  ✗ ${t} chunk: ${insErr.message}`);
            } else {
              inserted += chunk.length;
            }
          } else {
            inserted += chunk.length;
          }
        }
        append(`  ✓ ${t}: ${inserted} rows imported${failed ? `, ${failed} failed` : ""}`);
      }
      toast.success("Import complete");
    } catch (e: any) {
      toast.error(e.message || "Import failed");
      append(`ERROR: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <AdminLayout title="Backup & Restore">
      <div className="max-w-4xl space-y-6">
        <div className="bg-card rounded-2xl border border-border p-6">
          <div className="flex items-center gap-3 mb-2">
            <Database className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Full Database Export</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Downloads every row and every column from every public table in a single JSON file.
            New tables you create later are automatically included. Admin login and the export PIN
            are both required.
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={exportPin}
                onChange={(event) => setExportPin(event.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="Enter download PIN"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="h-11 rounded-xl pl-10"
              />
            </div>
            <Button onClick={handleExport} disabled={exporting || exportPin.trim().length === 0} className="h-11 rounded-xl">
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" /> Export Full Database
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6">
          <div className="flex items-center gap-3 mb-2">
            <Upload className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Import / Restore</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Upload a previously exported JSON file. Choose how rows should be applied:
          </p>

          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setMode("merge")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                mode === "merge"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground"
              }`}
            >
              Merge (upsert by id)
            </button>
            <button
              onClick={() => setMode("replace")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                mode === "replace"
                  ? "bg-destructive text-destructive-foreground border-destructive"
                  : "bg-card border-border text-muted-foreground"
              }`}
            >
              Replace (wipe + insert)
            </button>
          </div>

          {mode === "replace" && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs mb-4">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Replace mode permanently deletes all existing rows in each imported table before
                inserting. Make sure you have a current export before doing this.
              </span>
            </div>
          )}

          <input
            type="file"
            accept="application/json,.json"
            disabled={importing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = "";
            }}
            className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-primary file:text-primary-foreground file:font-semibold hover:file:opacity-90 file:cursor-pointer"
          />
        </div>

        {log.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Activity Log</h3>
            </div>
            <pre className="text-xs font-mono bg-muted/40 rounded-xl p-3 max-h-96 overflow-auto whitespace-pre-wrap">
              {log.join("\n")}
            </pre>
          </div>
        )}

        <div className="text-xs text-muted-foreground p-4 bg-muted/30 rounded-xl">
          <strong>What's included:</strong> Every public table, every row, every column - including
          user roles, permissions, leads, and content. Auth login accounts (passwords) live in a
          separate managed system and are not part of this file. Storage bucket files (images,
          documents) are referenced by URL - re-upload those separately if needed.
        </div>
      </div>
    </AdminLayout>
  );
}
