import { useDeferredValue, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAllTrustedPartners, useUpsertTrustedPartner, useDeleteTrustedPartner, type TrustedPartner } from "@/hooks/useTrustedPartners";
import { useAdminCollegeList, type AdminCollegeListItem } from "@/hooks/useCollegesData";
import { Plus, Trash2, Save, GraduationCap, Search, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { UploadOrUrlField } from "@/components/UploadOrUrlField";
import { InstitutionLogo } from "@/components/InstitutionLogo";

import { CSVTools } from "@/components/CSVTools";
import { useDraftState } from "@/hooks/useDraftState";
const empty: Partial<TrustedPartner> & { name: string } = {
  name: "", logo_url: "", college_slug: "", display_order: 0, is_active: true,
};

function CollegePartnerPicker({ onSelect }: { onSelect: (college: AdminCollegeListItem) => void }) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const { data, isFetching } = useAdminCollegeList({
    page: 1,
    pageSize: 20,
    search: deferredSearch,
    status: "all",
  });

  return (
    <div className="space-y-2 sm:col-span-2">
      <div>
        <label className="text-xs font-medium text-foreground">Choose from all colleges</label>
        <p className="text-xs text-muted-foreground">Selecting a college fills its short name, logo and public link. You can still adjust them below.</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search all colleges by name, short name, city or slug"
          className="rounded-xl pl-10 pr-10"
          aria-label="Search all colleges for homepage partner bar"
        />
        {isFetching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-background">
        {(data?.rows ?? []).length === 0 && !isFetching ? (
          <p className="p-4 text-center text-sm text-muted-foreground">No matching colleges found.</p>
        ) : (data?.rows ?? []).map((college) => {
          const logo = college.logo || college.image;
          const displayName = college.short_name || college.name;
          return (
            <button
              key={college.id}
              type="button"
              onClick={() => { onSelect(college); setSearch(""); }}
              className="flex w-full items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left last:border-0 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <InstitutionLogo src={logo} alt={`${college.name} logo`} className="h-10 w-10 rounded-lg border bg-card" imageClassName="p-1" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{displayName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {college.name}{college.city ? ` · ${college.city}` : ""}{college.state ? `, ${college.state}` : ""}
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground">{college.status}</span>
            </button>
          );
        })}
      </div>
      {data && <p className="text-[11px] text-muted-foreground">Showing {data.rows.length} of {data.total.toLocaleString("en-IN")} colleges. Search to find any college.</p>}
    </div>
  );
}

export default function AdminPartners() {
  const { data: partners, isLoading } = useAllTrustedPartners();
  const upsert = useUpsertTrustedPartner();
  const deleteFn = useDeleteTrustedPartner();
  const [editing, setEditing] = useDraftState<(Partial<TrustedPartner> & { name: string }) | null>('admin.partners.editing.v1', null);

  const handleSave = async () => {
    if (!editing?.name) { toast.error("Name is required"); return; }
    try {
      await upsert.mutateAsync(editing);
      toast.success("Partner saved!");
      setEditing(null);
    } catch { toast.error("Failed to save"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this partner?")) return;
    try { await deleteFn.mutateAsync(id); toast.success("Deleted"); } catch { toast.error("Failed"); }
  };

  return (
    <AdminLayout title="Trusted Partners">
      <div className="mb-4">
        <CSVTools table="trusted_partners" filename="trusted_partners.csv" columns="*" upsertKey="id" />
      </div>

      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">Manage the "Partnered with India's top institutions" carousel on the homepage.</p>
        <Button onClick={() => setEditing({ ...empty })} className="gradient-primary text-primary-foreground rounded-xl gap-2">
          <Plus className="w-4 h-4" /> Add Partner
        </Button>
      </div>

      {editing && (
        <div className="bg-card rounded-2xl border border-border p-5 mb-6 space-y-4">
          <h3 className="font-semibold text-foreground">{editing.id ? "Edit Partner" : "New Partner"}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <CollegePartnerPicker
              onSelect={(college) => setEditing({
                ...editing,
                college_slug: college.slug,
                name: college.short_name?.trim() || college.name,
                logo_url: college.logo?.trim() || college.image?.trim() || "",
              })}
            />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Homepage Short Name *</label>
              <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="IIT Delhi" className="rounded-xl" />
              <p className="mt-1 text-[11px] text-muted-foreground">This compact name appears beside the logo on the homepage.</p>
            </div>
            <UploadOrUrlField
              label="Logo"
              value={editing.logo_url || ""}
              onChange={(logo_url) => setEditing({ ...editing, logo_url })}
              folder="partners"
              preset="partnerLogo"
              maxSizeMb={5}
            />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">College Slug (public link)</label>
              <Input value={editing.college_slug} onChange={e => setEditing({ ...editing, college_slug: e.target.value })} placeholder="iit-delhi" className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Display Order</label>
              <Input type="number" value={editing.display_order} onChange={e => setEditing({ ...editing, display_order: parseInt(e.target.value) || 0 })} className="rounded-xl" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">Visible on homepage</p>
                <p className="text-[11px] text-muted-foreground">Inactive partners stay saved but are hidden.</p>
              </div>
              <Switch checked={editing.is_active !== false} onCheckedChange={(is_active) => setEditing({ ...editing, is_active })} aria-label="Show partner on homepage" />
            </div>
          </div>
          {(editing.logo_url || editing.college_slug) && (
            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
              <InstitutionLogo src={editing.logo_url} alt={`${editing.name || "Partner"} logo preview`} className="h-12 w-12 rounded-lg border bg-card" imageClassName="p-1" />
              <div className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">{editing.name || "Partner short name"}</span>
                <span className="block truncate text-xs text-muted-foreground">/colleges/{editing.college_slug || "college-slug"}</span>
              </div>
              <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-primary" />
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={upsert.isPending} className="gradient-primary text-primary-foreground rounded-xl gap-2">
              <Save className="w-4 h-4" /> {upsert.isPending ? "Saving..." : "Save"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)} className="rounded-xl">Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : (partners ?? []).length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">No Partners Yet</h3>
          <p className="text-sm text-muted-foreground">Add institutions that will display on the homepage carousel</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(partners ?? []).map(p => (
            <div key={p.id} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
              <InstitutionLogo src={p.logo_url} alt={`${p.name} logo`} className="h-12 w-12 rounded-lg border bg-card" imageClassName="p-1" />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground text-sm truncate">{p.name}</h4>
                <p className="text-xs text-muted-foreground">{p.is_active ? "Active" : "Inactive"} • Order: {p.display_order}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setEditing(p)} className="rounded-lg text-xs h-8 px-2">Edit</Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(p.id)} className="rounded-lg text-xs h-8 px-2 text-destructive">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
