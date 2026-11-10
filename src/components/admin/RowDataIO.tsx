import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { rowToCSV, rowToJSON, downloadJSON, buildFilename } from "@/lib/adminIO";
import { downloadCSV } from "@/lib/csv";
import { STRIPPED } from "@/lib/adminIOAuto";

interface Props {
  row: any;
  loadRow?: () => Promise<any>;
  /** Explicit column whitelist, or "*" to include every field present on the row (no field dropped). */
  columns: string[] | "*";
  /** Base filename, e.g. "college", "course". */
  base: string;
  /** Key on the row used to name the export file (usually "slug" or "id"). */
  nameKey?: string;
  size?: "icon" | "sm";
}

/**
 * Per-row Export menu (CSV or JSON). Drop this into any admin row's
 * action area to export a single record. Pass columns="*" to export every
 * field present on the row.
 */
export function RowDataIO({ row, loadRow, columns, base, nameKey = "slug", size = "icon" }: Props) {
  const [open, setOpen] = useState(false);
  const safe = String(row?.[nameKey] || row?.id || "row").replace(/[^a-zA-Z0-9_-]+/g, "-");
  const exportRow = async (format: "json" | "csv" | "copy") => {
    try {
      const record = loadRow ? await loadRow() : row;
      const fields = columns === "*" ? Object.keys(record).filter(k => !STRIPPED.has(k)) : columns;
      if (format === "csv") downloadCSV(buildFilename(base, [safe], "csv"), rowToCSV(record, fields));
      else if (format === "json") downloadJSON(buildFilename(base, [safe], "json"), rowToJSON(record, fields));
      else await navigator.clipboard.writeText(JSON.stringify(rowToJSON(record, fields), null, 2));
      setOpen(false);
    } catch { toast.error("Could not export this record."); }
  };
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={size === "icon" ? "icon" : "sm"}
          className={size === "icon" ? "w-8 h-8" : ""}
          title="Export this row"
        >
          <Download className="w-3.5 h-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void exportRow("csv")}>
          <FileSpreadsheet className="w-3.5 h-3.5 mr-2" /> Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void exportRow("json")}>
          <FileJson className="w-3.5 h-3.5 mr-2" /> Export as JSON
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void exportRow("copy")}>
          Copy JSON to clipboard
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
