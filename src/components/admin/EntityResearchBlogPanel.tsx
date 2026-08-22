import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, CalendarClock, CheckCircle2, Loader2, Pause, Play, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

type EntityType = "college" | "course" | "exam";
type EntityRow = { slug: string; name: string };
type Selection = EntityRow & {
  entity_type: EntityType;
  articles_per_day: number;
  interval_minutes: number;
  publish_status: "Draft" | "Published";
  human_review_required: boolean;
};
type Schedule = Selection & {
  id: string;
  enabled: boolean;
  topic_focus: string[];
  next_run_at: string;
  last_run_at?: string | null;
  last_status: string;
  last_message: string;
};
type Publication = {
  id: string;
  schedule_id: string;
  article_id: string;
  topic_kind: string;
  generated_for_date: string;
  created_at: string;
  articles?: { title?: string; slug?: string; status?: string } | null;
};

const TABLES: Record<EntityType, string> = { college: "colleges", course: "courses", exam: "exams" };
const LABELS: Record<EntityType, string> = { college: "Colleges", course: "Courses", exam: "Exams" };
const FREQUENCIES = [
  { value: 60, label: "Hourly" },
  { value: 180, label: "Every 3 hours" },
  { value: 360, label: "Every 6 hours" },
  { value: 720, label: "Every 12 hours" },
  { value: 1440, label: "Daily" },
];

const defaultSelection = (row: EntityRow, entityType: EntityType): Selection => ({
  ...row,
  entity_type: entityType,
  articles_per_day: 1,
  interval_minutes: 1440,
  publish_status: "Draft",
  human_review_required: true,
});

const formatDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "Not run yet";

export function EntityResearchBlogPanel({ onArticlesCreated }: { onArticlesCreated?: () => void }) {
  const queryClient = useQueryClient();
  const [entityType, setEntityType] = useState<EntityType>("college");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<Selection[]>([]);
  const [busyId, setBusyId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["entity-article-options", entityType, debouncedSearch],
    queryFn: async () => {
      let query = (supabase as any).from(TABLES[entityType]).select("slug,name").eq("is_active", true).order("name").limit(40);
      if (debouncedSearch) query = query.ilike("name", `%${debouncedSearch.replace(/[%_,]/g, " ")}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as EntityRow[];
    },
    staleTime: 60_000,
  });

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ["entity-article-schedules"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("entity_article_schedules").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Schedule[];
    },
    refetchInterval: 15_000,
  });

  const { data: publications = [] } = useQuery({
    queryKey: ["entity-article-publications"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("entity_article_publications")
        .select("id,schedule_id,article_id,topic_kind,generated_for_date,created_at,articles(title,slug,status)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as Publication[];
    },
    refetchInterval: 15_000,
  });

  const scheduleKeys = useMemo(() => new Set(schedules.map((item) => `${item.entity_type}:${item.entity_slug}`)), [schedules]);
  const selectedKeys = useMemo(() => new Set(selected.map((item) => `${item.entity_type}:${item.slug}`)), [selected]);
  const todayIndia = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const countsToday = useMemo(() => publications.reduce<Record<string, number>>((counts, item) => {
    if (item.generated_for_date === todayIndia) counts[item.schedule_id] = (counts[item.schedule_id] || 0) + 1;
    return counts;
  }, {}), [publications, todayIndia]);

  const addSelection = (row: EntityRow) => {
    const key = `${entityType}:${row.slug}`;
    if (scheduleKeys.has(key)) return toast.info("This entity already has a schedule");
    if (selectedKeys.has(key)) return;
    if (selected.length >= 20) return toast.error("Save these 20 selections before adding more");
    setSelected((current) => [...current, defaultSelection(row, entityType)]);
  };

  const updateSelection = (index: number, values: Partial<Selection>) => {
    setSelected((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item));
  };

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["entity-article-schedules"] }),
      queryClient.invalidateQueries({ queryKey: ["entity-article-publications"] }),
    ]);
  };

  const saveSchedules = async () => {
    if (!selected.length) return toast.error("Select at least one college, course or exam");
    setSaving(true);
    try {
      const rows = selected.map((item) => ({
        entity_type: item.entity_type,
        entity_slug: item.slug,
        entity_name: item.name,
        enabled: true,
        articles_per_day: item.articles_per_day,
        interval_minutes: item.interval_minutes,
        publish_status: item.publish_status,
        human_review_required: item.human_review_required,
        next_run_at: new Date().toISOString(),
      }));
      const { error } = await (supabase as any).from("entity_article_schedules").upsert(rows, { onConflict: "entity_type,entity_slug" });
      if (error) throw error;
      toast.success(`${rows.length} entity schedule(s) activated`);
      setSelected([]);
      await refresh();
    } catch (error: any) {
      toast.error(error.message || "Could not save entity schedules");
    } finally {
      setSaving(false);
    }
  };

  const updateSchedule = async (schedule: Schedule, values: Partial<Schedule>) => {
    setBusyId(schedule.id);
    const { error } = await (supabase as any).from("entity_article_schedules").update(values).eq("id", schedule.id);
    setBusyId("");
    if (error) return toast.error(error.message);
    await refresh();
  };

  const deleteSchedule = async (schedule: Schedule) => {
    if (!window.confirm(`Remove the article schedule for ${schedule.entity_name}? Existing articles will remain.`)) return;
    setBusyId(schedule.id);
    const { error } = await (supabase as any).from("entity_article_schedules").delete().eq("id", schedule.id);
    setBusyId("");
    if (error) return toast.error(error.message);
    toast.success("Schedule removed; existing articles were kept");
    await refresh();
  };

  const runSchedule = async (schedule: Schedule, remainingToday = false) => {
    setBusyId(schedule.id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-blog-agent", {
        body: { trigger_type: "manual", mode: "entity_schedule", schedule_id: schedule.id, generate_remaining_today: remainingToday },
      });
      if (error || data?.error) throw error || new Error(data.error);
      if (data?.skipped) toast.info(data.message || "Nothing new to generate");
      else toast.success(`Created ${data?.created_article_ids?.length || 0} article(s) for ${schedule.entity_name}`);
      await refresh();
      onArticlesCreated?.();
    } catch (error: any) {
      let message = error?.message || "Entity article run failed";
      try {
        const payload = await error?.context?.clone?.().json?.();
        if (payload?.error) message = payload.error;
      } catch { /* keep the original error */ }
      toast.error(message, { duration: 14000 });
      await refresh();
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-orange-500/5 shadow-sm">
      <div className="border-b p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2"><BookOpenCheck className="h-5 w-5 text-primary" /><h3 className="font-semibold">Entity Article Agent</h3><Badge variant="outline">Independent add-on</Badge></div>
            <p className="mt-1 max-w-4xl text-xs text-muted-foreground">Schedule focused articles for selected colleges, courses and exams. The agent checks official and public signals first, falls back to useful evergreen guidance when there is no genuine news, prevents duplicate topics, links every article to its entity and keeps the existing Auto Blog Agent unchanged.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border bg-background/80 px-3 py-2 text-xs"><CalendarClock className="h-4 w-4 text-primary" /><span>{schedules.filter((item) => item.enabled).length} active schedule(s)</span></div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(TABLES) as EntityType[]).map((type) => <Button key={type} size="sm" type="button" variant={entityType === type ? "default" : "outline"} onClick={() => { setEntityType(type); setSearch(""); }}>{LABELS[type]}</Button>)}
        </div>
        <div className="relative mt-3"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search and add ${LABELS[entityType].toLowerCase()}...`} className="pl-9" /></div>
        <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {isFetching ? <div className="col-span-full py-6 text-center text-sm text-muted-foreground">Searching...</div> : results.map((row) => {
            const key = `${entityType}:${row.slug}`;
            const exists = scheduleKeys.has(key) || selectedKeys.has(key);
            return <button key={row.slug} type="button" disabled={exists} onClick={() => addSelection(row)} className={`flex items-start gap-2 rounded-xl border p-3 text-left transition ${exists ? "cursor-default border-primary/30 bg-primary/5 opacity-70" : "hover:border-primary/50 hover:bg-background"}`}>
              {exists ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Plus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className="min-w-0"><span className="block line-clamp-2 text-sm font-medium">{row.name}</span><span className="block truncate text-[10px] text-muted-foreground">{row.slug}</span></span>
            </button>;
          })}
        </div>
      </div>

      {!!selected.length && <div className="border-b bg-background/60 p-4">
        <div className="mb-3 flex items-center justify-between"><div><h4 className="text-sm font-semibold">New schedules</h4><p className="text-[11px] text-muted-foreground">Choose the exact daily article target and cadence for each entity.</p></div><Button size="sm" onClick={saveSchedules} disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Activate {selected.length}</Button></div>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/60 text-left text-xs"><tr><th className="p-3">Entity</th><th className="p-3">Articles/day</th><th className="p-3">Cadence</th><th className="p-3">Output</th><th className="p-3">Review gate</th><th className="w-12 p-3" /></tr></thead>
            <tbody>{selected.map((item, index) => <tr key={`${item.entity_type}:${item.slug}`} className="border-t">
              <td className="p-3"><div className="font-medium">{item.name}</div><div className="text-[10px] text-muted-foreground">{LABELS[item.entity_type]} - {item.slug}</div></td>
              <td className="p-3"><Input type="number" min={1} max={10} value={item.articles_per_day} onChange={(event) => updateSelection(index, { articles_per_day: Math.min(10, Math.max(1, Number(event.target.value || 1))) })} className="h-9 w-20" /></td>
              <td className="p-3"><select value={item.interval_minutes} onChange={(event) => updateSelection(index, { interval_minutes: Number(event.target.value) })} className="h-9 rounded-lg border bg-background px-2">{FREQUENCIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td>
              <td className="p-3"><select value={item.publish_status} onChange={(event) => updateSelection(index, { publish_status: event.target.value as "Draft" | "Published" })} className="h-9 rounded-lg border bg-background px-2"><option>Draft</option><option>Published</option></select></td>
              <td className="p-3"><label className="flex items-center gap-2"><Switch checked={item.human_review_required} onCheckedChange={(value) => updateSelection(index, { human_review_required: value })} /><span className="text-xs">{item.human_review_required ? "Approval first" : "Auto publish"}</span></label></td>
              <td className="p-3"><Button size="icon" variant="ghost" onClick={() => setSelected((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X className="h-4 w-4" /></Button></td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>}

      <div className="p-4">
        <div className="mb-3"><h4 className="text-sm font-semibold">Active entity plan</h4><p className="text-[11px] text-muted-foreground">Automated runs happen every 15 minutes when a schedule is due. Manual controls are available below.</p></div>
        {schedulesLoading ? <div className="py-8 text-center text-sm text-muted-foreground">Loading entity schedules...</div> : !schedules.length ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No entity schedules yet. Search above and add your first college, course or exam.</div> : <div className="space-y-3">
          {schedules.map((schedule) => {
            const isBusy = busyId === schedule.id || schedule.last_status === "running";
            const todayCount = countsToday[schedule.id] || 0;
            return <article key={schedule.id} className="rounded-xl border bg-background/80 p-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h5 className="truncate font-medium">{schedule.entity_name}</h5><Badge variant="secondary">{schedule.entity_type}</Badge><Badge variant={schedule.enabled ? "default" : "outline"}>{schedule.enabled ? "Active" : "Paused"}</Badge><Badge variant="outline">{todayCount}/{schedule.articles_per_day} today</Badge></div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Next: {formatDate(schedule.next_run_at)} - Last: {formatDate(schedule.last_run_at)} - {schedule.last_message || "Ready"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select value={schedule.articles_per_day} disabled={isBusy} onChange={(event) => updateSchedule(schedule, { articles_per_day: Number(event.target.value) })} className="h-8 rounded-lg border bg-background px-2 text-xs">{Array.from({ length: 10 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}/day</option>)}</select>
                  <select value={schedule.interval_minutes} disabled={isBusy} onChange={(event) => updateSchedule(schedule, { interval_minutes: Number(event.target.value), next_run_at: new Date().toISOString() })} className="h-8 rounded-lg border bg-background px-2 text-xs">{FREQUENCIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                  <Button size="sm" variant="outline" disabled={isBusy || todayCount >= schedule.articles_per_day} onClick={() => runSchedule(schedule)} className="gap-1">{isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Write one</Button>
                  <Button size="sm" disabled={isBusy || todayCount >= schedule.articles_per_day} onClick={() => runSchedule(schedule, true)} className="gap-1"><Sparkles className="h-3.5 w-3.5" /> Complete today</Button>
                  <Button size="sm" variant="outline" disabled={busyId === schedule.id} onClick={() => updateSchedule(schedule, { enabled: !schedule.enabled, last_status: schedule.enabled ? "paused" : "ready", next_run_at: schedule.enabled ? schedule.next_run_at : new Date().toISOString() })} className="gap-1">{schedule.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{schedule.enabled ? "Pause" : "Resume"}</Button>
                  <Button size="icon" variant="ghost" disabled={busyId === schedule.id} onClick={() => deleteSchedule(schedule)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </article>;
          })}
        </div>}

        {!!publications.length && <div className="mt-4 rounded-xl border bg-background/60 p-3"><h4 className="text-sm font-semibold">Recent entity articles</h4><div className="mt-2 grid gap-2 md:grid-cols-2">{publications.slice(0, 8).map((item) => <a key={item.id} href={`/admin/articles?article=${item.article_id}`} className="rounded-lg border p-2 text-xs transition hover:border-primary"><span className="block line-clamp-1 font-medium">{item.articles?.title || `Article ${item.article_id.slice(0, 8)}`}</span><span className="text-muted-foreground">{item.topic_kind.replace(/_/g, " ")} - {item.articles?.status || "Saved"}</span></a>)}</div></div>}
      </div>
    </section>
  );
}
