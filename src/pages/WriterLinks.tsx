import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { backendClient } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { SITE_URL } from "@/lib/constant";
import { toast } from "sonner";

type WriterLink = { id: string; title: string; original_url: string; short_code: string; created_at: string; clicks: number };

export default function WriterLinks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingCode, setPendingCode] = useState("");
  const { data: links = [] } = useQuery({
    queryKey: ["writer-links", user?.id], enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await backendClient.from("url_mappings")
        .select("id,title,original_url,short_code,created_at,clicks")
        .eq("user_id", user!.id).order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return (data || []) as WriterLink[];
    },
  });

  const submit = async () => {
    if (!title.trim() || !destination.trim()) return toast.error("Enter a name and HTTPS destination");
    setSaving(true);
    try {
      const response = await backendClient.from("url_mappings")
        .insert({ title: title.trim(), original_url: destination.trim() } as any)
        .select("id,short_code").single();
      if (response.error) throw response.error;
      if (response.status === 202) {
        setPendingCode(response.data?.short_code || "");
        toast.success("Link submitted for admin approval. It will work after approval.");
      } else {
        setPendingCode("");
        toast.success("Link created");
      }
      setTitle(""); setDestination("");
      await queryClient.invalidateQueries({ queryKey: ["writer-links", user?.id] });
    } catch (error: any) {
      toast.error(error?.message || "Could not create link");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Create Link">
      <div className="max-w-3xl space-y-5">
        <div className="rounded-2xl border bg-card p-5 sm:p-7">
          <h2 className="text-xl font-bold">New short link</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create only. You cannot change or delete a link after submission. Approval is required unless an admin enables direct publishing for your account.</p>
          <div className="mt-5 space-y-4">
            <div><Label htmlFor="writer-link-title">Link name</Label><Input id="writer-link-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Official exam notice" /></div>
            <div><Label htmlFor="writer-link-destination">HTTPS destination</Label><Input id="writer-link-destination" type="url" value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="https://example.gov.in/notice" /></div>
            <Button onClick={() => void submit()} disabled={saving}>{saving ? "Submitting…" : "Submit link"}</Button>
          </div>
        </div>
        {pendingCode && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Pending approval: {SITE_URL}/s/{pendingCode}. Do not share it until an admin approves it.</p>}
        <div className="rounded-2xl border bg-card p-5 sm:p-7">
          <h2 className="text-lg font-bold">Your approved links</h2>
          {links.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No approved links yet.</p> : (
            <div className="mt-3 divide-y">
              {links.map((link) => <div key={link.id} className="py-3">
                <p className="font-medium">{link.title}</p>
                <a className="text-sm text-primary underline" href={`${SITE_URL}/s/${link.short_code}`} target="_blank" rel="noreferrer">{SITE_URL}/s/{link.short_code}</a>
                <p className="truncate text-xs text-muted-foreground">{link.original_url}</p>
              </div>)}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
