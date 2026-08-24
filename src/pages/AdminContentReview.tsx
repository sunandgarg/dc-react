import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileDiff, MessageSquareWarning } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Review = {
  id: string;
  entity_type: "colleges" | "courses" | "exams" | "articles";
  entity_id: string | null;
  entity_slug: string | null;
  entity_name: string | null;
  operation: "create" | "update";
  actor_user_id: string;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown>;
  changed_fields: string[];
  status: "pending" | "approved" | "needs_changes";
  created_at: string;
};

function renderValue(value: unknown) {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">Empty</span>;
  if (typeof value === "object") return <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(value, null, 2)}</pre>;
  return <span className="break-words text-sm">{String(value)}</span>;
}

export default function AdminContentReview() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["content-reviews", status],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("content-reviews", {
        method: "GET",
      });
      if (error) throw error;
      return (data || []) as Review[];
    },
  });

  const filtered = useMemo(() => status === "all" ? reviews : reviews.filter((review) => review.status === status), [reviews, status]);
  const selected = filtered.find((review) => review.id === selectedId) || filtered[0] || null;

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  const reviewItem = async (nextStatus: "approved" | "needs_changes") => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.functions.invoke("content-reviews", {
      method: "PATCH",
      body: { id: selected.id, status: nextStatus, review_notes: notes },
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(nextStatus === "approved" ? "Change reviewed and approved" : "Change marked for correction");
    setNotes("");
    setSelectedId(null);
    await queryClient.invalidateQueries({ queryKey: ["content-reviews"] });
  };

  return (
    <AdminLayout title="Content Review">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Editor change review</h2>
          <p className="text-xs text-muted-foreground">Audit every manual change to colleges, courses, exams and articles.</p>
        </div>
        <div className="flex rounded-lg border bg-card p-1">
          {["pending", "approved", "needs_changes", "all"].map((item) => (
            <button key={item} type="button" onClick={() => { setStatus(item); setSelectedId(null); }} className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${status === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              {item.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-[68vh] overflow-hidden rounded-lg border bg-card lg:grid-cols-[minmax(240px,25%)_1fr]">
        <aside className="border-b bg-muted/20 lg:border-b-0 lg:border-r">
          <div className="border-b px-4 py-3 text-xs font-bold uppercase text-muted-foreground">{filtered.length} changes</div>
          <div className="max-h-[68vh] overflow-y-auto p-2">
            {isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Loading reviews...</p>}
            {!isLoading && !filtered.length && <p className="p-6 text-center text-sm text-muted-foreground">No changes in this view.</p>}
            {filtered.map((review) => (
              <button key={review.id} type="button" onClick={() => { setSelectedId(review.id); setNotes(""); }} className={`mb-1 w-full rounded-md border p-3 text-left transition ${selected?.id === review.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"}`}>
                <div className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{review.entity_name || review.entity_slug || "Untitled"}</strong><Badge variant="outline" className="text-[10px] capitalize">{review.entity_type}</Badge></div>
                <p className="mt-1 text-[11px] text-muted-foreground">{review.operation} - {new Date(review.created_at).toLocaleString("en-IN")}</p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{review.changed_fields.join(", ")}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0 p-4 md:p-6">
          {!selected ? <div className="flex h-full min-h-80 items-center justify-center text-sm text-muted-foreground">Select a change to review.</div> : <>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b pb-4">
              <div><div className="flex items-center gap-2"><FileDiff className="h-5 w-5 text-primary" /><h3 className="text-base font-bold">{selected.entity_name || selected.entity_slug}</h3></div><p className="mt-1 text-xs text-muted-foreground">Changed by {selected.actor_user_id} - {selected.changed_fields.length} field(s)</p></div>
              <Badge variant={selected.status === "pending" ? "secondary" : "outline"} className="capitalize">{selected.status.replace("_", " ")}</Badge>
            </div>

            <div className="space-y-3">
              {selected.changed_fields.map((field) => (
                <div key={field} className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50/30">
                  <div className="border-b border-amber-200 bg-amber-100/70 px-3 py-2 text-xs font-bold text-amber-900">{field.replaceAll("_", " ")}</div>
                  <div className="grid md:grid-cols-2">
                    <div className="min-w-0 border-b p-3 md:border-b-0 md:border-r"><p className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">Before</p>{renderValue(selected.before_json?.[field])}</div>
                    <div className="min-w-0 bg-emerald-50/50 p-3"><p className="mb-2 text-[10px] font-bold uppercase text-emerald-700">After</p>{renderValue(selected.after_json?.[field])}</div>
                  </div>
                </div>
              ))}
            </div>

            {selected.status === "pending" && <div className="mt-6 border-t pt-4">
              <label className="text-xs font-semibold text-foreground">Review note</label>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Optional note for the audit record" className="mt-1 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button variant="outline" disabled={saving} onClick={() => reviewItem("needs_changes")} className="gap-2"><MessageSquareWarning className="h-4 w-4" /> Needs changes</Button>
                <Button disabled={saving} onClick={() => reviewItem("approved")} className="gap-2"><CheckCircle2 className="h-4 w-4" /> Approve review</Button>
              </div>
            </div>}
          </>}
        </section>
      </div>
    </AdminLayout>
  );
}
