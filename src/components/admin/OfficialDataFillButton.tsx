import { useState } from "react";
import { Loader2, ShieldCheck, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { backendClient } from "@/integrations/backend/client";
import { Button } from "@/components/ui/button";

type SupportedEntity = "colleges" | "courses" | "exams";

type OfficialDataFillButtonProps = {
  entityType: SupportedEntity;
  record: Record<string, unknown>;
  onApply: (updates: Record<string, unknown>) => void;
};

export function OfficialDataFillButton({ entityType, record, onApply }: OfficialDataFillButtonProps) {
  const [loading, setLoading] = useState(false);
  const name = String(record.name || "").trim();

  const fill = async () => {
    if (!name) return toast.error("Enter the name first");
    setLoading(true);
    try {
      const { data, error } = await backendClient.functions.invoke("admin-data-cleaner", {
        body: { action: "enrich_draft", entity_type: entityType, record },
      });
      if (error) {
        let message = error.message;
        try {
          const response = (error as any).context as Response | undefined;
          if (response) message = (await response.clone().json())?.error || message;
        } catch { /* keep SDK message */ }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      const changedFields = Array.isArray(data?.changed_fields) ? data.changed_fields : [];
      if (!changedFields.length) {
        toast.info("No supported field produced a cited improvement. Existing values were preserved.");
        return;
      }
      onApply(data.proposed_data || {});
      toast.success(`Filled ${changedFields.length} cited field${changedFields.length === 1 ? "" : "s"} from trusted sources`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cited data fill failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2 rounded-2xl border border-blue-200 bg-blue-50/50 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-xs font-bold text-foreground">Cited multi-source AI fill</p>
            <p className="text-[11px] leading-4 text-muted-foreground">
              Uses official, regulator and corroborated secondary sources, then maps supported facts to the exact database columns.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={loading || !name} onClick={fill} className="shrink-0 rounded-xl bg-white">
          {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="mr-2 h-3.5 w-3.5" />}
          {loading ? "Researching trusted sources..." : "Fill cited details"}
        </Button>
      </div>
    </div>
  );
}
