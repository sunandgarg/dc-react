import { useCallback, useEffect, useMemo, useState } from "react";
import { backendClient } from "@/integrations/backend/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Save, Search, X, Pencil, CircleHelp } from "lucide-react";
import { toast } from "sonner";
import { CSVTools } from "@/components/CSVTools";
import { useQueryClient } from "@tanstack/react-query";
import { COURSE_GROUP_OPTIONS, inferCourseGroup, inferCourseSpecialization, normalizeCourseDisplayName } from "@/lib/courseFeeGroups";
import { syncAutoSlug } from "@/lib/slugify";
import { ComboboxAdd } from "@/components/admin/ComboboxAdd";

interface Props {
  collegeSlug: string;
}

interface CourseLite { slug: string; name: string; full_name: string; category: string; }
interface FeeRow {
  id?: string;
  college_slug: string;
  course_slug: string;
  course_name: string;
  course_group: string;
  specialization: string;
  fee_amount: number;
  fee_type: string;
  year: string;
}

const FEE_TYPES = ["Annual", "Semester", "Total Course", "Monthly"];

function FieldLabel({ children, help }: { children: React.ReactNode; help: string }) {
  return (
    <label className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
      {children}
      <span title={help} aria-label={help} className="cursor-help"><CircleHelp className="h-3 w-3" /></span>
    </label>
  );
}

function isPendingReview(response: { status?: number | null }) {
  return response.status === 202;
}

export function CourseFeePicker({ collegeSlug }: Props) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [courses, setCourses] = useState<CourseLite[]>([]);
  const [search, setSearch] = useState("");
  const [courseSearchOpen, setCourseSearchOpen] = useState(false);
  const [draft, setDraft] = useState<FeeRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedCourseGroups, setSavedCourseGroups] = useState<string[]>([]);

  const reload = useCallback(async () => {
    if (!collegeSlug) return;
    setLoading(true);
    const { data } = await (backendClient as any).from("course_fees").select("*").eq("college_slug", collegeSlug).order("course_name");
    setRows(data || []);
    setLoading(false);
    qc.invalidateQueries({ queryKey: ["college_fees", collegeSlug] });
  }, [collegeSlug, qc]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    (backendClient as any).from("courses").select("slug,name,full_name,category").eq("is_active", true).order("name").limit(500).then(({ data }: any) => setCourses(data || []));
  }, []);

  const loadSavedCourseGroups = useCallback(async () => {
    const { data } = await (backendClient as any).from("course_fees").select("course_group").limit(5000);
    const groups = Array.from(new Set((data || [])
      .map((row: any) => String(row.course_group || "").trim())
      .filter(Boolean))) as string[];
    const normalized = groups.map((group) => inferCourseGroup({ course_group: group }));
    setSavedCourseGroups(Array.from(new Set(normalized)).sort((a, b) => a.localeCompare(b)));
  }, []);

  useEffect(() => { void loadSavedCourseGroups(); }, [loadSavedCourseGroups]);

  const courseGroupOptions = useMemo(() => Array.from(new Set([
    ...COURSE_GROUP_OPTIONS,
    ...savedCourseGroups,
  ])), [savedCourseGroups]);

  const matches = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return courses.slice(0, 8);
    return courses
      .filter(c => c.name.toLowerCase().includes(q) || c.full_name.toLowerCase().includes(q) || c.slug.includes(q))
      .slice(0, 8);
  }, [search, courses]);

  const addFromCourse = (c: CourseLite) => {
    setSearch("");
    setCourseSearchOpen(false);
    const selected = { course_slug: c.slug, course_name: c.name };
    setDraft({
      college_slug: collegeSlug,
      course_slug: c.slug,
      course_name: c.name,
      course_group: inferCourseGroup(selected),
      specialization: inferCourseSpecialization(selected),
      fee_amount: 0,
      fee_type: "Annual",
      year: String(new Date().getFullYear()),
    });
  };

  const addManual = () => {
    setSearch("");
    setDraft({ college_slug: collegeSlug, course_slug: "", course_name: "", course_group: "", specialization: "", fee_amount: 0, fee_type: "Annual", year: String(new Date().getFullYear()) });
  };

  const validate = (d: FeeRow): string | null => {
    if (!d.course_name?.trim()) return "Course name is required";
    if (!d.course_group?.trim()) return "Broad course or degree is required";
    if (!d.fee_type) return "Fee type is required";
    if (d.fee_amount === null || d.fee_amount === undefined || isNaN(Number(d.fee_amount))) return "Fee amount must be a number";
    if (Number(d.fee_amount) < 0) return "Fee amount cannot be negative";
    if (Number(d.fee_amount) > 100000000) return "Fee amount looks too large (max ₹10 Cr)";
    if (d.year && !/^\d{4}$/.test(d.year)) return "Year must be a 4-digit value";
    const slug = d.course_slug || d.course_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const specialization = d.specialization?.trim().toLowerCase() || "";
    const dup = rows.find(r => r.id !== d.id
      && r.course_slug === slug
      && (r.specialization?.trim().toLowerCase() || "") === specialization
      && (r.year || "") === (d.year || "")
      && (r.fee_type || "") === (d.fee_type || ""));
    if (dup) return `Duplicate: a ${d.fee_type} fee for "${d.course_name}" (${d.year || "any year"}) already exists`;
    return null;
  };

  const save = async () => {
    if (!draft) return;
    const err = validate(draft);
    if (err) { toast.error(err); return; }
    const normalizedName = normalizeCourseDisplayName(draft.course_name);
    const normalizedGroup = inferCourseGroup({ course_group: draft.course_group });
    const normalizedSpecialization = draft.specialization ? normalizeCourseDisplayName(draft.specialization) : "";
    if (!draft.course_slug) draft.course_slug = syncAutoSlug("", "", normalizedName);
    const payload: any = {
      ...draft,
      course_name: normalizedName,
      course_group: normalizedGroup,
      specialization: normalizedSpecialization || null,
      fee_amount: Number(draft.fee_amount),
    };
    const response = draft.id
      ? await (backendClient as any).from("course_fees").update(payload).eq("id", draft.id)
      : await (backendClient as any).from("course_fees").insert(payload);
    const { error } = response;
    if (error) { toast.error(error.message); return; }
    toast.success(isPendingReview(response) ? "Course fee draft submitted for admin review." : "Saved");
    setDraft(null);
    await Promise.all([reload(), loadSavedCourseGroups()]);
  };

  const remove = async (id?: string) => {
    if (!id || !confirm("Delete this fee row?")) return;
    const { error } = await (backendClient as any).from("course_fees").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); reload(); }
  };

  if (!collegeSlug) return <p className="text-xs text-muted-foreground italic">Save the college slug first to add course fees.</p>;

  return (
    <div className="space-y-3">
      <div className="relative">
        {courseSearchOpen && <div className="fixed inset-0 z-20" onClick={() => setCourseSearchOpen(false)} />}
        <Search className="pointer-events-none absolute left-3 top-1/2 z-40 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onFocus={() => setCourseSearchOpen(true)}
          onClick={() => setCourseSearchOpen(true)}
          onChange={e => { setSearch(e.target.value); setCourseSearchOpen(true); }}
          placeholder="Search course directory (e.g. B.Tech, MBA)…"
          className="relative z-30 rounded-lg pl-10 h-9 text-sm"
        />
        {courseSearchOpen && (
          <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            <div className="px-3 py-1.5 text-[10px] font-medium uppercase text-muted-foreground">
              {search.trim() ? `${matches.length} matching courses` : "Course directory"}
            </div>
            {matches.map(c => (
              <button
                type="button"
                key={c.slug}
                onClick={() => addFromCourse(c)}
                className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between items-center"
              >
                <span><span className="font-medium">{c.name}</span> <span className="text-xs text-muted-foreground">{c.full_name || c.slug}</span></span>
                <span className="text-[10px] text-muted-foreground">{c.category}</span>
              </button>
            ))}
            {matches.length === 0 && <div className="px-3 py-3 text-xs text-muted-foreground">No directory course found. Use Add manual below.</div>}
          </div>
        )}
      </div>
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">{loading ? "Loading…" : `${rows.length} fee${rows.length === 1 ? "" : "s"} added`}</span>
        <Button type="button" size="sm" variant="outline" onClick={addManual} className="rounded-lg gap-1 h-8 text-xs">
          <Plus className="w-3.5 h-3.5" /> Add manual
        </Button>
      </div>

      <CSVTools
        table="course_fees"
        filename={`course-fees-${collegeSlug}.csv`}
        columns={["college_slug","course_slug","course_name","course_group","specialization","fee_amount","fee_type","year"]}
        typeHints={{ fee_amount: "number" }}
        upsertKey="id"
        onImported={reload}
      />

      {draft && (
        <div className="bg-muted/40 rounded-xl border border-border p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <FieldLabel help="The parent qualification used to group specializations on the college page, such as B.E. / B.Tech.">Broad Course / Degree *</FieldLabel>
              <ComboboxAdd
                value={draft.course_group}
                onChange={(value) => setDraft({ ...draft, course_group: inferCourseGroup({ course_group: value }) })}
                options={courseGroupOptions}
                placeholder="Select or add a degree"
              />
            </div>
            <div>
              <FieldLabel help="The branch or major within the broad degree, such as Computer Science and Engineering.">Specialization</FieldLabel>
              <Input value={draft.specialization} onChange={e => setDraft({ ...draft, specialization: e.target.value })} onBlur={() => setDraft({ ...draft, specialization: normalizeCourseDisplayName(draft.specialization) })} placeholder="Computer Science and Engineering" className="rounded-lg h-9 text-sm" />
            </div>
            <div>
              <FieldLabel help="The exact public course name shown to students and used to match the course directory.">Directory Course Name *</FieldLabel>
              <Input value={draft.course_name} onChange={e => setDraft({ ...draft, course_name: e.target.value, course_slug: syncAutoSlug(draft.course_slug, draft.course_name, e.target.value) })} onBlur={() => setDraft({ ...draft, course_name: normalizeCourseDisplayName(draft.course_name) })} className="rounded-lg h-9 text-sm" />
            </div>
            <div>
              <FieldLabel help="The URL-safe course identifier. It follows the course name automatically until you edit it manually.">Course Slug</FieldLabel>
              <Input value={draft.course_slug} onChange={e => setDraft({ ...draft, course_slug: e.target.value })} placeholder="auto-generated" className="rounded-lg h-9 text-sm" />
            </div>
            <div>
              <FieldLabel help="Enter only the numeric rupee amount for the selected fee type; do not include currency symbols.">Fee Amount (₹) *</FieldLabel>
              <Input type="number" min={0} step="1" value={draft.fee_amount} onChange={e => setDraft({ ...draft, fee_amount: parseFloat(e.target.value) || 0 })} className="rounded-lg h-9 text-sm" />
            </div>
            <div>
              <FieldLabel help="Defines whether the amount applies annually, per semester, monthly, or to the entire course.">Fee Type *</FieldLabel>
              <select value={draft.fee_type} onChange={e => setDraft({ ...draft, fee_type: e.target.value })} className="w-full h-9 rounded-lg border border-border bg-card px-2 text-sm">
                {FEE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel help="The four-digit admission or fee session year for which this amount is valid.">Year (YYYY)</FieldLabel>
              <Input value={draft.year} onChange={e => setDraft({ ...draft, year: e.target.value })} placeholder={String(new Date().getFullYear())} maxLength={4} className="rounded-lg h-9 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)} className="h-8 text-xs gap-1"><X className="w-3 h-3" /> Cancel</Button>
            <Button type="button" size="sm" onClick={save} className="h-8 text-xs gap-1"><Save className="w-3 h-3" /> Save</Button>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-1.5">
          {rows.map(r => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 bg-card rounded-lg border border-border px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground truncate">{r.course_name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {r.course_group || inferCourseGroup(r)}{(r.specialization || inferCourseSpecialization(r)) ? ` · ${r.specialization || inferCourseSpecialization(r)}` : ""}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  ₹{Number(r.fee_amount).toLocaleString("en-IN")} · {r.fee_type} · {r.year || "-"}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setDraft({ ...r, id: undefined, course_group: r.course_group || inferCourseGroup(r), specialization: "", fee_amount: 0 })}
                >
                  <Plus className="w-3 h-3" /> Specialization
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setDraft({ ...r, course_group: r.course_group || inferCourseGroup(r), specialization: r.specialization || inferCourseSpecialization(r) })}
                >
                  <Pencil className="w-3 h-3" /> Edit
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label={`Delete ${r.course_name}`} onClick={() => remove(r.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
