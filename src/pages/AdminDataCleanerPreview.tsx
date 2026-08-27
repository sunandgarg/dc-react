import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, ExternalLink, Loader2, ShieldCheck, X } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { backendClient } from "@/integrations/backend/client";
import { toast } from "sonner";

const MEDIA_FIELDS = new Set([
  "image", "logo", "cover_image", "featured_image", "banner_ad_image",
  "square_ad_image", "brochure_url", "sample_paper_url", "syllabus_pdf_url",
]);

async function invokeCleaner(body: Record<string, unknown>) {
  const { data, error } = await backendClient.functions.invoke("admin-data-cleaner", { body });
  if (error) {
    let message = error.message;
    try {
      const response = (error as any).context as Response | undefined;
      if (response) message = (await response.clone().json())?.error || message;
    } catch { /* keep SDK message */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

function isEmpty(value: unknown) {
  return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

function valueText(value: unknown) {
  if (isEmpty(value)) return "No value";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function ValuePanel({ field, value, side }: { field: string; value: unknown; side: "before" | "after" }) {
  const text = valueText(value);
  const isUrl = typeof value === "string" && /^https?:\/\//i.test(value);
  const isImage = isUrl && MEDIA_FIELDS.has(field) && !/\.pdf(?:$|\?)/i.test(String(value));
  return (
    <div className={`min-h-28 rounded-2xl border p-4 ${side === "after" ? "border-emerald-200 bg-emerald-50/50" : "bg-slate-50"}`}>
      {isImage && <img src={String(value)} alt="" className="mb-3 max-h-44 w-full rounded-xl object-contain" loading="lazy" />}
      {isUrl
        ? <a href={String(value)} target="_blank" rel="noreferrer" className="inline-flex break-all text-sm font-medium text-primary hover:underline">{text}<ExternalLink className="ml-1 mt-0.5 h-3.5 w-3.5 shrink-0" /></a>
        : <pre className={`whitespace-pre-wrap break-words font-sans text-sm leading-6 ${isEmpty(value) ? "italic text-muted-foreground" : "text-foreground"}`}>{text}</pre>}
    </div>
  );
}

export default function AdminDataCleanerPreview() {
  const { itemId = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const item = useQuery({
    queryKey: ["data-cleaning-preview", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const { data, error } = await (backendClient as any).from("data_cleaning_items").select("*").eq("id", itemId).single();
      if (error) throw error;
      return data;
    },
  });

  const action = useMutation({
    mutationFn: (actionName: "approve" | "reject") => invokeCleaner({ action: actionName, item_id: itemId }),
    onSuccess: async (_data, actionName) => {
      await Promise.all([
        item.refetch(),
        qc.invalidateQueries({ queryKey: ["data-cleaning-items"] }),
        qc.invalidateQueries({ queryKey: ["data-cleaning-jobs"] }),
        qc.invalidateQueries({ queryKey: ["data-cleaner-counts"] }),
      ]);
      toast.success(actionName === "approve" ? "Changes approved and applied" : "Changes rejected");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const comparison = useMemo(() => {
    const before = item.data?.before_data || {};
    const proposed = item.data?.proposed_data || {};
    const after = { ...before, ...proposed };
    const fields = [...new Set(
      (item.data?.changed_fields?.length ? item.data.changed_fields : Object.keys(proposed))
        .filter((field: string) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
    )] as string[];
    return { before, after, fields };
  }, [item.data]);

  if (item.isLoading) {
    return <AdminLayout title="Clean Data comparison"><div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AdminLayout>;
  }

  if (item.isError || !item.data) {
    return <AdminLayout title="Clean Data comparison"><div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-800">This comparison could not be loaded.</div></AdminLayout>;
  }

  const row = item.data;
  return (
    <AdminLayout title={`Before / After - ${row.entity_name}`}>
      <div className="space-y-5">
        <div className="sticky top-0 z-20 rounded-3xl border bg-white/95 p-4 shadow-sm backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Button variant="outline" size="icon" className="shrink-0 rounded-xl" onClick={() => navigate("/admin/clean-data")} aria-label="Back to Clean Data"><ArrowLeft className="h-4 w-4" /></Button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-black">{row.entity_name}</h1>
                  <Badge variant="outline">{row.entity_type}</Badge>
                  <Badge variant="outline">Pass {row.cleaning_pass || 1}</Badge>
                  <Badge variant={row.status === "updated" ? "default" : "secondary"}>{row.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{comparison.fields.length} field{comparison.fields.length === 1 ? "" : "s"} changed. Left is the stored value before research; right is the proposed or applied value.</p>
              </div>
            </div>
            {row.status === "review" && <div className="flex gap-2">
              <Button variant="outline" disabled={action.isPending} onClick={() => action.mutate("reject")}><X className="mr-2 h-4 w-4" />Reject</Button>
              <Button disabled={action.isPending} onClick={() => action.mutate("approve")}>{action.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Approve and apply</Button>
            </div>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-1">
          <div className="rounded-2xl bg-slate-900 p-4 text-white"><p className="text-xs font-bold uppercase tracking-wider text-slate-300">Before</p><p className="mt-1 font-bold">Current database value</p></div>
          <div className="rounded-2xl bg-emerald-700 p-4 text-white"><p className="text-xs font-bold uppercase tracking-wider text-emerald-100">After</p><p className="mt-1 font-bold">AI researched value</p></div>
        </div>

        {comparison.fields.map((field) => {
          const before = comparison.before[field];
          const after = comparison.after[field];
          const changeType = isEmpty(before) ? "Added" : isEmpty(after) ? "Removed" : "Changed";
          return <Card key={field} className="overflow-hidden rounded-3xl">
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-5 py-3">
                <p className="font-black">{field.replace(/_/g, " ")}</p>
                <Badge className={changeType === "Added" ? "bg-emerald-600" : changeType === "Removed" ? "bg-red-600" : "bg-blue-600"}>{changeType}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 p-3 md:p-5">
                <ValuePanel field={field} value={before} side="before" />
                <ValuePanel field={field} value={after} side="after" />
              </div>
            </CardContent>
          </Card>;
        })}

        {!comparison.fields.length && <div className="rounded-3xl border border-dashed p-12 text-center text-muted-foreground">This research pass did not produce a supported field change.</div>}

        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950">
          <div className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4" />Evidence used</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(row.source_urls || []).map((url: string) => <a key={url} href={url} target="_blank" rel="noreferrer" className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium hover:underline">{new URL(url).hostname}</a>)}
            {!row.source_urls?.length && <span className="text-xs text-blue-800">No external source was accepted for this pass.</span>}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
