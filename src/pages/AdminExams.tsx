import { PermGate } from "@/components/PermGate";
import { AIGenerateDialog } from "@/components/admin/AIGenerateDialog";
import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { CSVTools } from "@/components/CSVTools";
import { RowDataIO } from "@/components/admin/RowDataIO";
import { useAllDbExams, useSaveExam, useDeleteExam, type DbExam, type ExamImportantDate } from "@/hooks/useExamsData";
import { AdminFormSection } from "@/components/AdminFormSection";
import { RichTextEditor } from "@/components/RichTextEditor";
import { compactDisplayText } from "@/lib/displayText";
import { PageSummaryField } from "@/components/admin/PageSummaryField";
import { ArrayFieldEditor } from "@/components/ArrayFieldEditor";
import { EntitySlugMultiSearch } from "@/components/admin/EntitySlugMultiSearch";
import { SchoolClassMultiSelect } from "@/components/admin/SchoolClassMultiSelect";
import { CollegeSubjectMultiSearch } from "@/components/admin/CollegeSubjectMultiSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, FileText, X, Info, Calendar, Settings, BookOpen, CheckCircle2, Layers, Eye, CircleDot, HelpCircle, ExternalLink } from "lucide-react";
import { FaqInlineEditor } from "@/components/admin/FaqInlineEditor";
import { MultiCategoryPicker } from "@/components/admin/MultiCategoryPicker";
import { toast } from "sonner";
import { ImageHint } from "@/components/ImageHint";
import { UploadOrUrlField, YouTubeField, MultiFileField } from "@/components/UploadOrUrlField";
import { AdminStatsBar, QuickFilterPills } from "@/components/AdminStats";
import { EXAM_CATEGORIES, EXAM_LEVELS, EXAM_STREAMS_BY_CATEGORY } from "@/lib/taxonomies";
import { AuthorPicker } from "@/components/admin/AuthorPicker";
import { BulkEditToggle } from "@/components/admin/BulkEditToggle";
import { useAuth } from "@/hooks/useAuth";
import { AdminPageSizePicker } from "@/components/admin/AdminPageSizePicker";
import { useDraftState } from "@/hooks/useDraftState";
import { OfficialDataFillButton } from "@/components/admin/OfficialDataFillButton";
import { syncAutoSlug } from "@/lib/slugify";
import { examCategories, examCourseGroups, examLevels, examStreams } from "@/data/indianLocations";

const CATEGORIES = EXAM_CATEGORIES;
const LEVELS = EXAM_LEVELS;
const EXAM_MODES = ["Online (CBT)", "Offline (OMR)", "Online/Offline", "Online + Studio", "Offline"];
const STATUSES = ["Upcoming", "Applications Open", "Applications Closed", "Exam Over"];
const FREQUENCIES = ["Once", "Twice", "Quarterly", "Multiple"];
const EXAM_TYPES = ["MCQ", "Subjective", "MCQ + Subjective", "Online", "Practical", "Interview"];
const APPLICATION_MODES = ["Online", "Offline", "Both"];

const emptyExam: Partial<DbExam> = {
  slug: "", name: "", full_name: "", conducting_authority: null, category: "Engineering", level: "National", exam_date: "",
  applicants: "", eligibility: "", mode: "Online (CBT)", description: "", important_dates: [],
  syllabus: [], top_colleges: [], image: "", registration_url: "", duration: "", exam_type: "",
  language: "English", frequency: "Once", application_mode: "Online", status: "Upcoming", is_active: true, ...({ priority: 50 } as any),
  short_name: "", logo: "", application_start_date: "", application_end_date: "", result_date: "",
  website: "", negative_marking: false, seats: "", age_limit: "", sample_paper_url: "",
  summary_content: "", application_process: "", exam_pattern: "", cutoff_content: "",
  preparation_tips: "", counselling_content: "", center_content: "", question_paper: "",
  gender_wise: "", result_content: "", cast_wise_fee: "", dates_content: "",
  meta_title: "", meta_description: "", meta_keywords: "",
  question_papers: [], brochure_url: "", youtube_video_url: "", how_to_apply_video_url: "",
  listing_category: "Entrance", exam_streams: ["General"], course_groups: ["Multiple Courses"],
  education_levels: ["UG", "PG"], exam_filter_version: 1,
};

function ListingFacetPicker({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (value: string[]) => void }) {
  const selected = new Set(value || []);
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="mt-1 flex flex-wrap gap-1.5 rounded-lg border border-border bg-muted/20 p-2">
        {options.map((option) => {
          const active = selected.has(option);
          return <button key={option} type="button" onClick={() => onChange(active ? value.filter((item) => item !== option) : [...value, option])}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/50"}`}>
            {option}
          </button>;
        })}
      </div>
    </div>
  );
}

function ImportantDatesEditor({ dates, onChange }: { dates: ExamImportantDate[]; onChange: (d: ExamImportantDate[]) => void }) {
  const [event, setEvent] = useState("");
  const [date, setDate] = useState("");

  const add = () => {
    if (event.trim() && date.trim()) {
      onChange([...dates, { event: event.trim(), date: date.trim() }]);
      setEvent(""); setDate("");
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">Important Dates</label>
      <div className="flex gap-2">
        <Input value={event} onChange={(e) => setEvent(e.target.value)} placeholder="Event name" className="rounded-lg h-9 text-sm flex-1" />
        <Input value={date} onChange={(e) => setDate(e.target.value)} placeholder="Date" className="rounded-lg h-9 text-sm flex-1" />
        <Button type="button" variant="outline" size="sm" onClick={add} className="h-9 px-3"><Plus className="w-3.5 h-3.5" /></Button>
      </div>
      {dates.map((d, i) => (
        <div key={i} className="flex items-center gap-2 bg-muted rounded-lg p-2">
          <span className="text-xs font-medium text-foreground flex-1">{d.event}: {d.date}</span>
          <button type="button" onClick={() => onChange(dates.filter((_, j) => j !== i))} className="text-destructive hover:bg-destructive/10 rounded p-1"><X className="w-3 h-3" /></button>
        </div>
      ))}
    </div>
  );
}

export default function AdminExams() {
  const { data: exams, isLoading } = useAllDbExams();
  const saveExam = useSaveExam();
  const deleteExam = useDeleteExam();
  const { can, isAdmin } = useAuth();
  const canPublish = isAdmin || can("exams", "publish");
  const canCreate = isAdmin || can("exams", "create");
  const canEdit = isAdmin || can("exams", "edit");
  const [editing, setEditing] = useDraftState<Partial<DbExam> | null>('admin.exams.editing.v1', null);
  const [editingBaseline, setEditingBaseline] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem("admin_page_size_exams") || "", 10);
    return saved > 0 ? saved : 50;
  });
  const setPageSize = (n: number) => {
    setVisibleCount(n);
    try { localStorage.setItem("admin_page_size_exams", String(n)); } catch {}
  };

  const stats = useMemo(() => {
    const all = exams ?? [];
    const open = all.filter((e) => e.status === "Applications Open").length;
    const upcoming = all.filter((e) => e.status === "Upcoming").length;
    const closed = all.filter((e) => e.status === "Applications Closed" || e.status === "Exam Over").length;
    const missingFilters = all.filter((e) => !e.listing_category || !e.exam_streams?.length || !e.course_groups?.length || !e.education_levels?.length).length;
    const cats = all.reduce<Record<string, number>>((m, e) => { m[e.category] = (m[e.category] || 0) + 1; return m; }, {});
    const topCat = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";
    return { total: all.length, open, upcoming, closed, topCat, missingFilters };
  }, [exams]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (exams ?? []).filter((e) => {
      if (statusFilter === "__missing_filters" && e.listing_category && e.exam_streams?.length && e.course_groups?.length && e.education_levels?.length) return false;
      if (statusFilter !== "all" && statusFilter !== "__missing_filters" && e.status !== statusFilter) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q)
        || e.slug.toLowerCase().includes(q)
        || (e.full_name || "").toLowerCase().includes(q);
    });
  }, [exams, search, statusFilter]);

  const visible = filtered.slice(0, visibleCount);

  const handleSave = () => {
    if (!editing?.slug || !editing?.name) { toast.error("Slug and Name required"); return; }
    if (!editing.listing_category || !editing.exam_streams?.length || !editing.course_groups?.length || !editing.education_levels?.length) {
      toast.error("Complete every public listing filter before saving"); return;
    }
    saveExam.mutate({ ...editing, exam_filter_version: 1 } as any, { onSuccess: () => setEditing(null) });
  };

  const update = (field: string, value: any) => setEditing((prev) => {
    if (!prev) return prev;
    const next = { ...prev, [field]: value };
    if (field === "name" && !(prev as any).id) next.slug = syncAutoSlug(prev.slug, prev.name, value);
    return next;
  });
  const openEditor = (value: Partial<DbExam>) => {
    const next = { ...value };
    setEditingBaseline(JSON.stringify(next));
    setEditing(next);
  };
  const hasEditingChanges = Boolean(editing && JSON.stringify(editing) !== editingBaseline);

  return (
    <AdminLayout title="Exams Manager">
      {isAdmin && <div className="mb-3"><AIGenerateDialog entityType="exams" table="exams" /></div>}
      <AdminStatsBar
        stats={[
          { label: "Total", value: stats.total, icon: FileText, tone: "primary" },
          { label: "Apps Open", value: stats.open, icon: CheckCircle2, tone: "success" },
          { label: "Upcoming", value: stats.upcoming, icon: Layers, tone: "warning" },
          { label: "Closed/Over", value: stats.closed, icon: Eye, tone: "muted" },
          { label: "Top Category", value: stats.topCat, icon: CircleDot, tone: "primary" },
        ]}
      />

      {isAdmin && <div className="mb-3">
        <CSVTools
          table="exams"
          filename="exams.csv"
          columns="*"
          typeHints={{ priority: "number", is_active: "boolean", show_in_explore_by_category: "boolean", is_top_exam: "boolean", negative_marking: "boolean", top_colleges: "array", syllabus: "array", exam_streams: "array", course_groups: "array", education_levels: "array" }}
        />
      </div>}

      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setVisibleCount(50); }} placeholder="Search exams by name, slug or full name..." className="pl-10 rounded-xl h-10" />
        </div>
        {canCreate && <Button onClick={() => openEditor(emptyExam)} className="rounded-xl gap-2">
          <Plus className="w-4 h-4" /> Add Exam
        </Button>}
        {isAdmin && <BulkEditToggle
          table="exams"
          searchKeys={["name","slug","full_name","category"]}
          columns={[
            { key: "name", label: "Name", width: 220 },
            { key: "slug", label: "Slug", width: 180 },
            { key: "category", label: "Category", width: 120 },
            { key: "level", label: "Level", width: 120 },
            { key: "listing_category", label: "Public Filter", width: 130 },
            { key: "exam_date", label: "Exam Date", width: 140 },
            { key: "priority", label: "Priority", type: "number", width: 90 },
            { key: "status", label: "Status", width: 140 },
            { key: "show_in_explore_by_category", label: "Homepage Explore", type: "boolean", width: 120 },
            { key: "is_active", label: "Active", type: "boolean", width: 80 },
          ]}
        />}
      </div>

      <QuickFilterPills
        value={statusFilter as any}
        onChange={(v) => { setStatusFilter(v); setVisibleCount(50); }}
        options={[
          { label: "All", value: "all", count: stats.total },
          { label: "Apps Open", value: "Applications Open", count: stats.open },
          { label: "Upcoming", value: "Upcoming", count: stats.upcoming },
          { label: "Apps Closed", value: "Applications Closed" },
          { label: "Exam Over", value: "Exam Over" },
          { label: "Missing Filters", value: "__missing_filters", count: stats.missingFilters },
        ]}
      />

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-end">
            <AdminPageSizePicker
              value={visibleCount}
              onChange={setPageSize}
              totalLabel={`Showing ${Math.min(visible.length, filtered.length)} of ${filtered.length}`}
            />
          </div>
          {visible.map((e) => (
            <div key={e.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground text-sm">{e.name}</span>
                  <Badge variant="outline" className="text-[10px]">{compactDisplayText(e.category, "General", 28)}</Badge>
                  <Badge variant="outline" className="text-[10px]">{compactDisplayText(e.level, "Exam", 28)}</Badge>
                  <Badge variant="outline" className="text-[10px]">{compactDisplayText(e.listing_category, "Unclassified", 28)}</Badge>
                  <Badge variant={e.status === "Applications Open" ? "default" : "secondary"} className="text-[10px]">{e.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{e.full_name} • {e.exam_date}</p>
              </div>
              <div className="flex gap-1">
                <a href={`/exams/${e.slug}`} target="_blank" rel="noreferrer"><Button variant="ghost" size="icon" className="w-8 h-8" title="Open public page"><ExternalLink className="w-3.5 h-3.5" /></Button></a>
                {isAdmin && <RowDataIO row={e} base="exam" columns="*" />}
                {canEdit && <Button variant="ghost" size="icon" onClick={() => openEditor(e)} className="w-8 h-8"><Pencil className="w-3.5 h-3.5" /></Button>}
                <PermGate module="exams" action="delete"><Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete?")) deleteExam.mutate(e.id); }} className="w-8 h-8 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></PermGate>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">No exams found</div>}
          {visible.length < filtered.length && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => setVisibleCount((n) => n + visibleCount)} className="rounded-xl">
                Load {visibleCount} more ({filtered.length - visible.length} left)
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> {editing?.id ? "Edit" : "Add"} Exam</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              {isAdmin && <OfficialDataFillButton
                entityType="exams"
                record={editing as Record<string, unknown>}
                onApply={(updates) => setEditing((current) => current ? {
                  ...current,
                  ...updates,
                  website: (updates.official_website as string) || current.website,
                } : current)}
              />}
              {/* ── Basic Info ── */}
              <AdminFormSection title="Basic Information" icon={<Info className="w-4 h-4 text-primary" />}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                    <select value={editing.status || "Upcoming"} onChange={(e) => update("status", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm h-9">
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {!canPublish && <p className="text-[10px] text-muted-foreground mt-1">Your selection is submitted to admin review before it becomes live.</p>}
                  </div>
                  <div><label className="text-xs font-medium text-muted-foreground">Name *</label><Input value={editing.name || ""} onChange={(e) => update("name", e.target.value)} className="rounded-lg h-9 text-sm" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Slug *</label><Input value={editing.slug || ""} onChange={(e) => update("slug", e.target.value)} placeholder="jee-main-2026" className="rounded-lg h-9 text-sm" /></div>
                  <div className="sm:col-span-2 lg:col-span-3"><label className="text-xs font-medium text-muted-foreground">Official Website</label><Input value={(editing as any).official_website || editing.website || ""} onChange={(e) => { update("official_website" as any, e.target.value); update("website", e.target.value); }} placeholder="https://official-exam-domain.example/" className="rounded-lg h-9 text-sm" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Short Name</label><Input value={editing.short_name || ""} onChange={(e) => update("short_name", e.target.value)} className="rounded-lg h-9 text-sm" /></div>
                  <div className="sm:col-span-2"><label className="text-xs font-medium text-muted-foreground">Full Name</label><Input value={editing.full_name || ""} onChange={(e) => update("full_name", e.target.value)} className="rounded-lg h-9 text-sm" /></div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="text-xs font-medium text-muted-foreground">Conducting Authority</label>
                    <Input
                      value={editing.conducting_authority || ""}
                      onChange={(e) => update("conducting_authority", e.target.value.trimStart() || null)}
                      placeholder="For example: National Testing Agency"
                      className="rounded-lg h-9 text-sm"
                    />
                    <p className="mt-1 text-[10.5px] text-muted-foreground">Leave blank when the authority has not been verified. The public exam page will omit this field.</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Category</label>
                    <select value={editing.category || ""} onChange={(e) => update("category", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm h-9">
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Level</label>
                    <select value={editing.level || ""} onChange={(e) => update("level", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm h-9">
                      {LEVELS.map((l) => <option key={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Exam Type</label>
                    <select value={editing.exam_type || ""} onChange={(e) => update("exam_type", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm h-9">
                      <option value="">Select</option>
                      {EXAM_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Exam Mode</label>
                    <select value={editing.mode || ""} onChange={(e) => update("mode", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm h-9">
                      {EXAM_MODES.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Application Mode</label>
                    <select value={editing.application_mode || ""} onChange={(e) => update("application_mode", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm h-9">
                      {APPLICATION_MODES.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Frequency</label>
                    <select value={editing.frequency || ""} onChange={(e) => update("frequency", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm h-9">
                      {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <UploadOrUrlField label="Official Exam Logo (shown inside the themed ring)" value={editing.logo || ""} onChange={(v) => update("logo", v)} kind="image" preset="logo" folder="exam-logos" />
                    <p className="mt-1 text-[10.5px] text-muted-foreground">Use the official authority or exam logo with a transparent or plain background. Public exam pages no longer display a separate featured background image.</p>
                  </div>
                  <div><label className="text-xs font-medium text-muted-foreground">Website</label><Input value={editing.website || ""} onChange={(e) => update("website", e.target.value)} placeholder="https://..." className="rounded-lg h-9 text-sm" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Registration URL</label><Input value={editing.registration_url || ""} onChange={(e) => update("registration_url", e.target.value)} className="rounded-lg h-9 text-sm" /></div>
                </div>
                <div><label className="text-xs font-medium text-muted-foreground">Description</label>
                  <textarea value={editing.description || ""} onChange={(e) => update("description", e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm resize-none" />
                </div>
                <MultiCategoryPicker value={(editing as any).categories || []} onChange={(v) => update("categories" as any, v)} primary={editing.category} />
                <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-3 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Public exam listing filters</p>
                    <p className="text-[10.5px] text-muted-foreground">These dedicated fields power the Category, Stream, Course Group and Level filters on the public Exams page. They do not replace the legacy editorial category fields above.</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Category of Exams</label>
                    <select value={editing.listing_category || "Entrance"} onChange={(e) => update("listing_category", e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-card text-sm h-9">
                      {examCategories.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                  <ListingFacetPicker label="Streams of Exams" options={examStreams} value={editing.exam_streams || []} onChange={(value) => update("exam_streams", value)} />
                  <ListingFacetPicker label="Course Groups" options={examCourseGroups} value={editing.course_groups || []} onChange={(value) => update("course_groups", value)} />
                  <ListingFacetPicker label="Level of Exams" options={examLevels} value={editing.education_levels || []} onChange={(value) => update("education_levels", value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Listing Priority (1-100)</label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={(editing as any).priority ?? 50}
                      onChange={(e) => update("priority" as any, Math.max(1, Math.min(100, parseInt(e.target.value) || 50)))}
                      className="rounded-lg h-9 text-sm"
                    />
                    <p className="text-[10.5px] text-muted-foreground mt-1">Higher = appears first in listings & filters. Default 50.</p>
                  </div>
                  <div className="mt-5 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={editing.is_active !== false} onChange={(e) => update("is_active", e.target.checked)} className="rounded" />
                      <label className="text-sm text-foreground">Active</label>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="exam-show-in-explore"
                          checked={!!editing.show_in_explore_by_category}
                          onChange={(e) => update("show_in_explore_by_category", e.target.checked)}
                          className="rounded"
                        />
                        <label htmlFor="exam-show-in-explore" className="text-sm font-medium text-foreground">
                          Show in homepage Explore by Category
                        </label>
                      </div>
                      <p className="ml-5 mt-1 text-[10.5px] text-muted-foreground">
                        Checked exams replace the automatic category list; the latest checks appear first.
                        {editing.explore_by_category_checked_at && ` Last checked ${new Date(editing.explore_by_category_checked_at).toLocaleString()}.`}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 max-w-md"><AuthorPicker value={(editing as any).author_id} onChange={(v) => update("author_id" as any, v)} label="Author profile (byline)" /></div>
              </AdminFormSection>

              {/* ── Dates & Details ── */}
              <AdminFormSection title="Dates & Exam Details" icon={<Calendar className="w-4 h-4 text-primary" />}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div><label className="text-xs font-medium text-muted-foreground">Application Start Date</label><Input value={editing.application_start_date || ""} onChange={(e) => update("application_start_date", e.target.value)} placeholder="Jan 15, 2026" className="rounded-lg h-9 text-sm" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Application End Date</label><Input value={editing.application_end_date || ""} onChange={(e) => update("application_end_date", e.target.value)} placeholder="Mar 15, 2026" className="rounded-lg h-9 text-sm" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Exam Date</label><Input value={editing.exam_date || ""} onChange={(e) => update("exam_date", e.target.value)} placeholder="April 2026" className="rounded-lg h-9 text-sm" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Result Date</label><Input value={editing.result_date || ""} onChange={(e) => update("result_date", e.target.value)} placeholder="May 2026" className="rounded-lg h-9 text-sm" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Duration</label><Input value={editing.duration || ""} onChange={(e) => update("duration", e.target.value)} placeholder="3 hours" className="rounded-lg h-9 text-sm" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Language</label><Input value={editing.language || ""} onChange={(e) => update("language", e.target.value)} className="rounded-lg h-9 text-sm" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Applicants</label><Input value={editing.applicants || ""} onChange={(e) => update("applicants", e.target.value)} placeholder="15L+" className="rounded-lg h-9 text-sm" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Seats</label><Input value={editing.seats || ""} onChange={(e) => update("seats", e.target.value)} placeholder="50,000" className="rounded-lg h-9 text-sm" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Age Limit</label><Input value={editing.age_limit || ""} onChange={(e) => update("age_limit", e.target.value)} placeholder="No limit" className="rounded-lg h-9 text-sm" /></div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={editing.negative_marking ?? false} onChange={(e) => update("negative_marking", e.target.checked)} className="rounded" />
                  <label className="text-sm text-foreground">Negative Marking</label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <UploadOrUrlField label="Sample Paper" value={editing.sample_paper_url || ""} onChange={(v) => update("sample_paper_url", v)} kind="file" folder="exam-sample-papers" accept="application/pdf" maxSizeMb={15} />
                  <UploadOrUrlField label="Information Brochure (PDF)" value={editing.brochure_url || ""} onChange={(v) => update("brochure_url", v)} kind="file" folder="exam-brochures" accept="application/pdf" maxSizeMb={15} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <YouTubeField label="YouTube Video URL (overview)" value={editing.youtube_video_url || ""} onChange={(v) => update("youtube_video_url", v)} />
                  <YouTubeField label={`How to Apply ${editing.name || "Exam"} Video`} value={(editing as any).how_to_apply_video_url || ""} onChange={(v) => update("how_to_apply_video_url", v)} />
                </div>
                <MultiFileField
                  label="Previous Year Question Papers"
                  values={editing.question_papers || []}
                  onChange={(v) => update("question_papers", v)}
                  folder="exam-question-papers"
                  accept="application/pdf"
                  maxSizeMb={15}
                  itemLabelPlaceholder="Year e.g. 2024"
                />
                <div><label className="text-xs font-medium text-muted-foreground">Eligibility</label>
                  <textarea value={editing.eligibility || ""} onChange={(e) => update("eligibility", e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm resize-none" />
                </div>
                <ImportantDatesEditor dates={editing.important_dates || []} onChange={(d) => update("important_dates", d)} />
              </AdminFormSection>

              {/* ── Detailed Content ── */}
              <AdminFormSection title="Detailed Content" icon={<BookOpen className="w-4 h-4 text-primary" />} defaultOpen={false}>
                <PageSummaryField value={(editing as any).page_summary || ""} onChange={(v) => update("page_summary" as any, v)} />
                <RichTextEditor label="Summary" value={editing.summary_content || ""} onChange={(v) => update("summary_content", v)} />
                <RichTextEditor label="Application Process" value={editing.application_process || ""} onChange={(v) => update("application_process", v)} />
                <RichTextEditor label="Exam Pattern" value={editing.exam_pattern || ""} onChange={(v) => update("exam_pattern", v)} />
                <RichTextEditor label="Cut Off" value={editing.cutoff_content || ""} onChange={(v) => update("cutoff_content", v)} />
                <RichTextEditor label="Preparation Tips" value={editing.preparation_tips || ""} onChange={(v) => update("preparation_tips", v)} />
                <RichTextEditor label="Counselling" value={editing.counselling_content || ""} onChange={(v) => update("counselling_content", v)} />
                <RichTextEditor label="Exam Centers" value={editing.center_content || ""} onChange={(v) => update("center_content", v)} />
                <RichTextEditor label="Question Paper" value={editing.question_paper || ""} onChange={(v) => update("question_paper", v)} />
                <RichTextEditor label="Gender Wise Stats" value={editing.gender_wise || ""} onChange={(v) => update("gender_wise", v)} />
                <RichTextEditor label="Result" value={editing.result_content || ""} onChange={(v) => update("result_content", v)} />
                <RichTextEditor label="Cast Wise Fee" value={editing.cast_wise_fee || ""} onChange={(v) => update("cast_wise_fee", v)} />
                <RichTextEditor label="Important Dates Content" value={editing.dates_content || ""} onChange={(v) => update("dates_content", v)} />
              </AdminFormSection>

              {/* ── Tags & Arrays ── */}
              <AdminFormSection title="Syllabus & Linked Colleges" icon={<Settings className="w-4 h-4 text-primary" />} defaultOpen={false}>
                <ArrayFieldEditor label="Syllabus Topics" values={editing.syllabus || []} onChange={(v) => update("syllabus", v)} />
                <EntitySlugMultiSearch
                  kind="college"
                  label="Top Colleges Accepting (search & link from your colleges DB - saves slugs so links work)"
                  value={editing.top_colleges || []}
                  onChange={(v) => update("top_colleges", v)}
                />
                <SchoolClassMultiSelect
                  label="Linked School Classes (e.g. JEE → Class 11, 12)"
                  value={(editing as any).linked_school_classes || []}
                  onChange={(v) => update("linked_school_classes" as any, v)}
                />
                <CollegeSubjectMultiSearch
                  label="Linked College Subjects (semester-wise)"
                  value={(editing as any).linked_college_subjects || []}
                  onChange={(v) => update("linked_college_subjects" as any, v)}
                />
              </AdminFormSection>

              {/* ── SEO ── */}
              <AdminFormSection title="SEO" icon={<Search className="w-4 h-4 text-primary" />} defaultOpen={false}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium text-muted-foreground">Meta Title</label><Input value={editing.meta_title || ""} onChange={(e) => update("meta_title", e.target.value)} className="rounded-lg h-9 text-sm" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Meta Keywords</label><Input value={editing.meta_keywords || ""} onChange={(e) => update("meta_keywords", e.target.value)} placeholder="Comma separated" className="rounded-lg h-9 text-sm" /></div>
                </div>
                <div><label className="text-xs font-medium text-muted-foreground">Meta Description</label>
                  <textarea value={editing.meta_description || ""} onChange={(e) => update("meta_description", e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm resize-none" />
                </div>
              </AdminFormSection>

              <AdminFormSection title="FAQs (shown on this exam page)" icon={<HelpCircle className="w-4 h-4 text-primary" />} defaultOpen={false}>
                <FaqInlineEditor page="exams" itemSlug={editing.slug || ""} itemName={editing.name || ""} />
              </AdminFormSection>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)} className="rounded-xl">Cancel</Button>
                {(canPublish || hasEditingChanges) && <Button onClick={handleSave} disabled={saveExam.isPending || !hasEditingChanges} className="rounded-xl">
                  {saveExam.isPending ? "Saving..." : canPublish ? "Save Exam" : "Save as draft"}
                </Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
