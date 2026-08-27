import { useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useAllFeaturedColleges } from "@/hooks/useFeaturedColleges";
import { backendClient } from "@/integrations/backend/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Eye, GraduationCap, Plus, Save, Trash2, X, GripVertical } from "lucide-react";
import { collegeCategories, collegeStates } from "@/data/colleges";
import { CSVTools } from "@/components/CSVTools";
import { AdEntitySearchSelect } from "@/components/admin/AdEntitySearchSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FeaturedForm {
  college_slug: string;
  category: string;
  state: string;
  display_order: number;
  is_active: boolean;
}

interface CollegeMeta {
  name: string;
  short_name?: string | null;
  city?: string | null;
  state?: string | null;
  logo?: string | null;
  image?: string | null;
  status?: string | null;
  is_active?: boolean | null;
}

const emptyForm: FeaturedForm = {
  college_slug: "",
  category: "",
  state: "",
  display_order: 50,
  is_active: true,
};

export default function AdminFeatured() {
  const { data: featured, isLoading } = useAllFeaturedColleges();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FeaturedForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [priorityDraft, setPriorityDraft] = useState<Record<string, number>>({});

  const featuredSlugs = (featured || []).map((item) => item.college_slug);
  const { data: collegeMeta = {} } = useQuery<Record<string, CollegeMeta>>({
    queryKey: ["admin-featured-college-names", featuredSlugs],
    enabled: featuredSlugs.length > 0,
    queryFn: async () => {
      const { data, error } = await backendClient
        .from("colleges")
        .select("slug,name,short_name,city,state,logo,image,status,is_active")
        .in("slug", featuredSlugs);
      if (error) throw error;
      return Object.fromEntries((data || []).map((college: any) => [college.slug, college]));
    },
  });

  const handleSave = async () => {
    if (!form.college_slug) {
      toast({ title: "Select a college", variant: "destructive" });
      return;
    }
    if (!Number.isInteger(form.display_order) || form.display_order < 1 || form.display_order > 999) {
      toast({ title: "Priority must be a whole number from 1 to 999", variant: "destructive" });
      return;
    }
    setSaving(true);

    try {
      const { data: existing, error: lookupError } = await backendClient
        .from("featured_colleges")
        .select("id")
        .eq("college_slug", form.college_slug)
        .order("display_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (lookupError) throw lookupError;

      const payload = {
        college_slug: form.college_slug,
        category: form.category || null,
        state: form.state || null,
        display_order: form.display_order,
        is_active: form.is_active,
      };

      const { error } = existing?.id
        ? await backendClient.from("featured_colleges").update(payload).eq("id", existing.id)
        : await backendClient.from("featured_colleges").insert(payload);
      if (error) throw error;
      toast({ title: existing?.id ? "Featured college updated" : "Featured college added" });
      queryClient.invalidateQueries({ queryKey: ["admin-featured-colleges"] });
      queryClient.invalidateQueries({ queryKey: ["featured-colleges"] });
      setShowForm(false);
      setForm(emptyForm);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this featured college?")) return;
    const { error } = await backendClient.from("featured_colleges").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Removed" });
      queryClient.invalidateQueries({ queryKey: ["admin-featured-colleges"] });
      queryClient.invalidateQueries({ queryKey: ["featured-colleges"] });
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    await backendClient.from("featured_colleges").update({ is_active: active }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-featured-colleges"] });
    queryClient.invalidateQueries({ queryKey: ["featured-colleges"] });
  };

  const handlePrioritySave = async (id: string, current: number) => {
    const next = priorityDraft[id] ?? current;
    if (!Number.isInteger(next) || next < 1 || next > 999) {
      toast({ title: "Priority must be a whole number from 1 to 999", variant: "destructive" });
      return;
    }
    const { error } = await backendClient.from("featured_colleges").update({ display_order: next }).eq("id", id);
    if (error) {
      toast({ title: "Could not save priority", description: error.message, variant: "destructive" });
      return;
    }
    setPriorityDraft((currentDraft) => {
      const updated = { ...currentDraft };
      delete updated[id];
      return updated;
    });
    queryClient.invalidateQueries({ queryKey: ["admin-featured-colleges"] });
    queryClient.invalidateQueries({ queryKey: ["featured-colleges"] });
    toast({ title: "Featured priority saved" });
  };

  const getCollegeName = (slug: string) => collegeMeta[slug]?.short_name || collegeMeta[slug]?.name || slug;
  const getCollegeLocation = (slug: string) => [collegeMeta[slug]?.city, collegeMeta[slug]?.state].filter(Boolean).join(", ");
  const getCollegeLogo = (slug: string) => collegeMeta[slug]?.logo || collegeMeta[slug]?.image || "";

  // Filter categories/states without "All"
  const categories = collegeCategories.filter((c) => c !== "All");
  const states = collegeStates.filter((s) => s !== "All");

  return (
    <AdminLayout title="Featured Colleges">
      <div className="mb-4">
        <CSVTools table="featured_colleges" filename="featured_colleges.csv" columns="*" upsertKey="id" />
      </div>

      <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-950">
        <p className="font-semibold">Production rule</p>
        <p className="mt-1 text-blue-900/80">
          Search and select a real college from the live database. Saving the same college again updates its featured slot instead of creating a duplicate.
          Priority 1 appears first. Category and state are optional targeting filters.
        </p>
      </div>

      <div className="flex justify-end mb-4">
        <Button onClick={() => { setForm(emptyForm); setShowForm(true); }} className="rounded-xl gradient-primary text-primary-foreground gap-2">
          <Plus className="w-4 h-4" /> Add Featured
        </Button>
      </div>

      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Add Featured College</h3>
            <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">College *</Label>
              <div className="mt-1">
                <AdEntitySearchSelect page="colleges" value={form.college_slug} onChange={(college_slug) => setForm({ ...form, college_slug })} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Category (optional)</Label>
              <Select value={form.category || "__any__"} onValueChange={(v) => setForm({ ...form, category: v === "__any__" ? "" : v })}>
                <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Any category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Any</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">State (optional)</Label>
              <Select value={form.state || "__any__"} onValueChange={(v) => setForm({ ...form, state: v === "__any__" ? "" : v })}>
                <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Any state" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Any</SelectItem>
                  {states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Featured Priority (1 = first)</Label>
              <Input
                type="number"
                min={1}
                max={999}
                step={1}
                value={form.display_order}
                onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value, 10) || 1 })}
                className="rounded-xl mt-1"
              />
            </div>

            <div className="flex items-center gap-3 pt-5">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label className="text-xs">Active</Label>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleSave} disabled={saving} className="rounded-xl gradient-primary text-primary-foreground">
              {saving ? "Saving..." : "Add Featured"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground w-8"></th>
                  <th className="text-left p-3 font-medium text-muted-foreground">College</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Category</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">State</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Priority</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {featured?.map((f) => (
                  <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="p-3 text-muted-foreground"><GripVertical className="w-4 h-4" /></td>
                    <td className="p-3">
                      <div className="flex min-w-[260px] items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background">
                          {getCollegeLogo(f.college_slug) ? (
                            <img src={getCollegeLogo(f.college_slug)} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
                          ) : (
                            <GraduationCap className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{getCollegeName(f.college_slug)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {getCollegeLocation(f.college_slug) || f.college_slug}
                            {collegeMeta[f.college_slug]?.status && ` · ${collegeMeta[f.college_slug]?.status}`}
                            {collegeMeta[f.college_slug]?.is_active === false && " · inactive"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{f.category ? <Badge variant="outline" className="text-xs">{f.category}</Badge> : <span className="text-xs text-muted-foreground">Any</span>}</td>
                    <td className="p-3">{f.state ? <Badge variant="outline" className="text-xs">{f.state}</Badge> : <span className="text-xs text-muted-foreground">Any</span>}</td>
                    <td className="p-3">
                      <div className="flex min-w-[130px] items-center gap-1.5">
                        <Input
                          type="number"
                          min={1}
                          max={999}
                          step={1}
                          value={priorityDraft[f.id] ?? f.display_order}
                          onChange={(event) => setPriorityDraft((current) => ({ ...current, [f.id]: Number(event.target.value) }))}
                          className="h-8 w-20 rounded-lg font-mono text-xs"
                          aria-label={`Priority for ${getCollegeName(f.college_slug)}`}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={priorityDraft[f.id] === undefined || priorityDraft[f.id] === f.display_order}
                          onClick={() => handlePrioritySave(f.id, f.display_order)}
                          aria-label={`Save priority for ${getCollegeName(f.college_slug)}`}
                        >
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="p-3">
                      <Switch checked={f.is_active} onCheckedChange={(v) => handleToggle(f.id, v)} className="scale-75" />
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                          <a href={`/colleges/${f.college_slug}`} target="_blank" rel="noreferrer" aria-label={`Preview ${getCollegeName(f.college_slug)}`}>
                            <Eye className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)} className="w-8 h-8 text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(!featured || featured.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">No featured colleges. Add some to prioritize them in filters.</div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
