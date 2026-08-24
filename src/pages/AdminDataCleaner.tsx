import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bot, Check, CheckCheck, CirclePause, CirclePlay, Clock3, DatabaseZap, ExternalLink, Eye, Loader2, Search, ShieldCheck, Trash2, X } from "lucide-react";

const ENTITY_OPTIONS = [
  { id: "colleges", label: "Colleges", table: "colleges", name: "name" },
  { id: "courses", label: "Courses", table: "courses", name: "name" },
  { id: "exams", label: "Exams", table: "exams", name: "name" },
  { id: "careers", label: "Careers", table: "career_profiles", name: "name" },
  { id: "scholarships", label: "Scholarships", table: "scholarships", name: "title" },
  { id: "articles", label: "Articles", table: "articles", name: "title" },
  { id: "study_material", label: "Study Material", table: "study_subjects", name: "name" },
  { id: "college_study", label: "College Study", table: "college_universities", name: "name" },
  { id: "cat_universe", label: "CAT Universe", table: "cat_universe_modules", name: "title" },
] as const;

const terminalStatuses = new Set(["completed", "cancelled", "failed"]);

const CLEANER_MODELS: Record<string, Array<{ value: string; label: string }>> = {
  anthropic: [
    { value: "auto-haiku", label: "Claude Haiku - cheaper review pass" },
    { value: "auto-sonnet", label: "Claude Sonnet - deeper official research" },
    { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  ],
  gemini: [
    { value: "gemini-3.6-flash", label: "Gemini 3.6 Flash - production default" },
    { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite - lowest cost" },
    { value: "gemini-3.7-flash", label: "Gemini 3.7 Flash - latest Flash" },
  ],
  openai: [
    { value: "gpt-4o-mini", label: "OpenAI GPT-4o mini - low cost" },
  ],
};

async function invokeCleaner(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-data-cleaner", { body });
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

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "Calculating...";
  if (seconds < 60) return `${Math.ceil(seconds)} sec`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} hr`;
}

function lifecycleLabel(item: any) {
  if (item.status === "updated") return { label: "Cleaned and applied", className: "bg-emerald-100 text-emerald-800" };
  if (item.status === "review") return { label: "Checked - awaiting review", className: "bg-blue-100 text-blue-800" };
  if (item.status === "failed") return { label: "Pass failed", className: "bg-red-100 text-red-800" };
  if (item.status === "skipped" && item.error_message === "Rejected by administrator") {
    return { label: "Checked - change rejected", className: "bg-slate-100 text-slate-700" };
  }
  if (item.status === "skipped") return { label: "Checked - no safe change", className: "bg-amber-100 text-amber-800" };
  if (item.status === "processing") return { label: "Researching", className: "bg-violet-100 text-violet-800" };
  return { label: "Not checked yet", className: "bg-slate-100 text-slate-700" };
}

function resultNote(item: any) {
  if (item.changed_fields?.length) return `${item.changed_fields.length} proposed changes: ${item.changed_fields.join(", ")}`;
  const raw = String(item.error_message || "");
  if (/No usable cited source|No verified official source|existing values preserved|left unchanged|Not enough official evidence/i.test(raw)) {
    return "Research pass completed. No safe field-level update was applied yet, so the current values were preserved for the next stronger source pass.";
  }
  return raw || "Researching cited sources...";
}

function showConfidence(item: any) {
  return ["review", "updated"].includes(item.status)
    && item.confidence != null
    && item.source_urls?.length > 0
    && item.changed_fields?.length > 0;
}

export default function AdminDataCleaner() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const requestedTypes = (searchParams.get("types") || "").split(",").filter((id) => ENTITY_OPTIONS.some((option) => option.id === id));
  const [selectedTypes, setSelectedTypes] = useState<string[]>(requestedTypes.length ? requestedTypes : ["colleges"]);
  const [batchSize, setBatchSize] = useState(50);
  const [maxRecords, setMaxRecords] = useState(50);
  const [autoApply, setAutoApply] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string>("");
  const [excludeType, setExcludeType] = useState("colleges");
  const [excludeSearch, setExcludeSearch] = useState("");

  const cleanerRuntime = useQuery({
    queryKey: ["ai-runtime-control", "data-cleaner"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ai_runtime_controls")
        .select("*")
        .eq("feature", "data-cleaner")
        .maybeSingle();
      if (error) throw error;
      return data || {
        feature: "data-cleaner",
        display_name: "Clean Data",
        is_enabled: true,
        provider: "gemini",
        model: "gemini-3.6-flash",
      };
    },
  });

  const counts = useQuery({
    queryKey: ["data-cleaner-counts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_data_cleaning_coverage");
      if (error) throw error;
      return Object.fromEntries((data || []).map((row: any) => [row.entity_type, {
        total: Number(row.total_records || 0),
        never: Number(row.never_checked || 0),
        checked: Number(row.checked_records || 0),
        cleaned: Number(row.cleaned_records || 0),
        pending: Number(row.pending_reviews || 0),
        failed: Number(row.failed_checks || 0),
        currentPass: Number(row.current_pass || 1),
      }])) as Record<string, { total: number; never: number; checked: number; cleaned: number; pending: number; failed: number; currentPass: number }>;
    },
    staleTime: 5 * 60_000,
  });

  const jobs = useQuery({
    queryKey: ["data-cleaning-jobs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("data_cleaning_jobs").select("*").order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: (query) => (query.state.data || []).some((job: any) => !terminalStatuses.has(job.status) && job.status !== "paused") ? 3000 : false,
  });

  const activeJob = useMemo(() => {
    const rows = jobs.data || [];
    return rows.find((job: any) => job.id === selectedJob) || rows[0] || null;
  }, [jobs.data, selectedJob]);

  const items = useQuery({
    queryKey: ["data-cleaning-items", activeJob?.id],
    enabled: !!activeJob?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("data_cleaning_items").select("*").eq("job_id", activeJob.id).order("updated_at", { ascending: false }).limit(150);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: activeJob && !terminalStatuses.has(activeJob.status) && activeJob.status !== "paused" ? 3000 : false,
  });

  const exclusions = useQuery({
    queryKey: ["data-cleaning-exclusions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("data_cleaning_exclusions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const exclusionResults = useQuery({
    queryKey: ["data-cleaner-exclusion-search", excludeType, excludeSearch],
    enabled: excludeSearch.trim().length >= 2,
    queryFn: async () => {
      const entity = ENTITY_OPTIONS.find((option) => option.id === excludeType)!;
      const { data, error } = await (supabase as any).from(entity.table).select(`id,slug,${entity.name}`).ilike(entity.name, `%${excludeSearch.trim()}%`).limit(20);
      if (error) throw error;
      return (data || []).map((row: any) => ({ ...row, entity_name: row[entity.name] }));
    },
  });

  const action = useMutation({
    mutationFn: invokeCleaner,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["data-cleaning-jobs"] }),
        qc.invalidateQueries({ queryKey: ["data-cleaning-items"] }),
        qc.invalidateQueries({ queryKey: ["data-cleaner-counts"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateRuntime = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const payload = {
        ...values,
        updated_at: new Date().toISOString(),
      };
      // ai_runtime_controls grants authenticated admins SELECT + UPDATE.
      // Using UPSERT also requires INSERT permission, so an existing row could
      // be displayed correctly while every provider change was rejected.
      const { data, error } = await (supabase as any)
        .from("ai_runtime_controls")
        .update(payload)
        .eq("feature", "data-cleaner")
        .select("feature,provider,model")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Data cleaner runtime setting was not found");
    },
    onMutate: async (values) => {
      await qc.cancelQueries({ queryKey: ["ai-runtime-control", "data-cleaner"] });
      const previous = qc.getQueryData(["ai-runtime-control", "data-cleaner"]);
      qc.setQueryData(["ai-runtime-control", "data-cleaner"], (current: any) => ({
        ...(current || {}),
        ...values,
      }));
      return { previous };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["ai-runtime-control", "data-cleaner"] });
      toast.success("Clean Data AI model saved");
    },
    onError: (error: Error, _values, context) => {
      if (context?.previous) qc.setQueryData(["ai-runtime-control", "data-cleaner"], context.previous);
      toast.error(error.message);
    },
  });

  const start = async () => {
    if (!selectedTypes.length) return toast.error("Select at least one content type");
    try {
      const data = await action.mutateAsync({
        action: "start", entity_types: selectedTypes, batch_size: batchSize,
        max_records: maxRecords > 0 ? maxRecords : null, apply_mode: autoApply ? "auto_apply" : "review",
      });
      setSelectedJob(data.job_id);
      toast.success("Cited multi-source cleaning job started");
    } catch { /* mutation already reports */ }
  };

  const addExclusion = async (row: any) => {
    const { error } = await (supabase as any).from("data_cleaning_exclusions").upsert({
      entity_type: excludeType, entity_id: String(row.id), entity_slug: row.slug,
      entity_name: row.entity_name, reason: "Excluded in Clean Data admin",
    }, { onConflict: "entity_type,entity_id" });
    if (error) return toast.error(error.message);
    setExcludeSearch("");
    await qc.invalidateQueries({ queryKey: ["data-cleaning-exclusions"] });
    toast.success(`${row.entity_name} excluded`);
  };

  const removeExclusion = async (id: string) => {
    const { error } = await (supabase as any).from("data_cleaning_exclusions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["data-cleaning-exclusions"] });
  };

  const progress = activeJob?.total_items ? Math.round((activeJob.processed_items / activeJob.total_items) * 100) : 0;
  const elapsedSeconds = activeJob?.started_at ? Math.max(1, (Date.now() - new Date(activeJob.started_at).getTime()) / 1000) : 0;
  const rate = activeJob?.processed_items ? elapsedSeconds / activeJob.processed_items : 45;
  const remainingSeconds = Math.max(0, (activeJob?.total_items - activeJob?.processed_items) * rate);
  const currentBatch = activeJob ? Math.min(Math.ceil(Math.max(1, activeJob.processed_items + 1) / activeJob.batch_size), Math.max(1, Math.ceil(activeJob.total_items / activeJob.batch_size))) : 1;
  const totalBatches = activeJob ? Math.max(1, Math.ceil(activeJob.total_items / activeJob.batch_size)) : 1;
  const cleanerProvider = cleanerRuntime.data?.provider || "openai";
  const cleanerModels = CLEANER_MODELS[cleanerProvider] || CLEANER_MODELS.anthropic;
  const cleanerModel = cleanerRuntime.data?.model || cleanerModels[0]?.value;

  return (
    <AdminLayout title="Clean Data - Cited Multi-Source AI">
      <div className="space-y-5">
        <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-primary p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold"><ShieldCheck className="h-4 w-4" /> Cited source hierarchy</div>
              <h1 className="text-2xl font-black md:text-3xl">Clean, verify and modernise your content database</h1>
              <p className="mt-2 text-sm leading-6 text-blue-100/80">Research official, government, regulator and corroborated secondary sources. Every proposed fact keeps field-level citations, while media remains first-party only.</p>
            </div>
            <Button onClick={start} disabled={action.isPending || !selectedTypes.length} size="lg" className="h-12 rounded-2xl bg-white text-slate-950 hover:bg-blue-50">
              {action.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseZap className="mr-2 h-4 w-4" />} Start cleaning
            </Button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
          <Card className="rounded-3xl">
            <CardHeader><CardTitle>1. Choose content</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-bold">AI model for this cleaner</p>
                    <p className="text-xs text-muted-foreground">All providers use cited research. Gemini and GPT-4o mini use a low-cost grounded discovery pass before mapping values to database columns.</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select
                      value={cleanerProvider}
                      disabled={updateRuntime.isPending}
                      onValueChange={(provider) => updateRuntime.mutate({ provider, model: CLEANER_MODELS[provider]?.[0]?.value || null })}
                    >
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="anthropic">Claude</SelectItem>
                        <SelectItem value="gemini">Google Gemini</SelectItem>
                        <SelectItem value="openai">OpenAI / ChatGPT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select
                      value={cleanerModel}
                      disabled={updateRuntime.isPending}
                      onValueChange={(model) => updateRuntime.mutate({ model })}
                    >
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {cleanerModels.map((model) => <SelectItem key={model.value} value={model.value}>{model.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {ENTITY_OPTIONS.map((entity) => {
                  const checked = selectedTypes.includes(entity.id);
                  const coverage = counts.data?.[entity.id];
                  return (
                    <button key={entity.id} type="button" onClick={() => setSelectedTypes((current) => checked ? current.filter((id) => id !== entity.id) : [...current, entity.id])}
                      className={`rounded-2xl border p-4 text-left transition ${checked ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "border-border hover:border-primary/30"}`}>
                      <div className="flex items-center justify-between"><span className="font-bold">{entity.label}</span><span className={`flex h-5 w-5 items-center justify-center rounded-md border ${checked ? "border-primary bg-primary text-white" : "border-border"}`}>{checked && <Check className="h-3 w-3" />}</span></div>
                      <p className="mt-1 text-xs text-muted-foreground">{(coverage?.total || 0).toLocaleString("en-IN")} records</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{(coverage?.never || 0).toLocaleString("en-IN")} never checked</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">{(coverage?.cleaned || 0).toLocaleString("en-IN")} cleaned</span>
                        {!!coverage?.pending && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{coverage.pending.toLocaleString("en-IN")} awaiting review</span>}
                        {!!coverage?.failed && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800">{coverage.failed.toLocaleString("en-IN")} failed</span>}
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">{coverage?.pending ? "Pass blocked by review" : `Next: pass ${coverage?.currentPass || 1}`}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div><Label>Queue batch size</Label><Input type="number" min={1} max={500} value={batchSize} onChange={(e) => setBatchSize(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} /><p className="mt-1 text-[11px] text-muted-foreground">Recommended: 50 for exams/courses, smaller for manual review-heavy runs</p></div>
                <div><Label>Maximum records this run</Label><Input type="number" min={0} value={maxRecords} onChange={(e) => setMaxRecords(Math.max(0, Number(e.target.value) || 0))} /><p className="mt-1 text-[11px] text-muted-foreground">0 means all selected records</p></div>
                <div className="rounded-2xl border p-3"><div className="flex items-center justify-between gap-3"><div><Label>Auto-apply verified changes</Label><p className="text-[11px] text-muted-foreground">Off keeps changes for review</p></div><Switch checked={autoApply} onCheckedChange={setAutoApply} /></div></div>
              </div>
              {autoApply && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">Sensitive facts require an official/regulator citation or two independent sources. Descriptive fields require at least one cited source. Unsupported values stay unchanged; identity, slugs, ratings, reviews and commercial priority fields remain protected.</div>}
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-950">
                <strong>Pass control:</strong> each run selects records with the fewest completed research passes. Pass 2 cannot begin for a content type until every eligible record has completed pass 1. “Checked” and “cleaned” are tracked separately.
              </div>
              <p className="text-xs text-muted-foreground">The cleaner fills missing data and improves thin content using people-first SEO, answer extraction, generative-search clarity and more natural humanized copy. Begin with 50 records in review mode before a large auto-apply run.</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader><CardTitle>2. Exclude records</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <select value={excludeType} onChange={(e) => setExcludeType(e.target.value)} className="h-10 rounded-xl border bg-background px-3 text-sm">
                  {ENTITY_OPTIONS.map((entity) => <option key={entity.id} value={entity.id}>{entity.label}</option>)}
                </select>
                <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={excludeSearch} onChange={(e) => setExcludeSearch(e.target.value)} placeholder="Search to exclude..." className="pl-9" /></div>
              </div>
              {!!exclusionResults.data?.length && <div className="max-h-48 overflow-y-auto rounded-xl border bg-background p-1">{exclusionResults.data.map((row: any) => <button key={row.id} type="button" onClick={() => addExclusion(row)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"><span className="font-medium">{row.entity_name}</span><span className="ml-2 text-xs text-muted-foreground">{row.slug}</span></button>)}</div>}
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {(exclusions.data || []).map((row: any) => <div key={row.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-medium">{row.entity_name}</p><p className="text-[10px] uppercase text-muted-foreground">{row.entity_type}</p></div><Button size="icon" variant="ghost" onClick={() => removeExclusion(row.id)}><Trash2 className="h-4 w-4" /></Button></div>)}
                {!exclusions.data?.length && <p className="py-6 text-center text-xs text-muted-foreground">No exclusions - all selected records are eligible.</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        {activeJob && <Card className="rounded-3xl overflow-hidden">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div><div className="flex flex-wrap items-center gap-2"><CardTitle>Live cleaning progress</CardTitle><Badge variant={activeJob.status === "completed" ? "default" : "secondary"}>{activeJob.status}</Badge><Badge variant="outline">Pass {activeJob.cleaning_pass || 1}</Badge><Badge variant="outline">Batch {currentBatch} of {totalBatches}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{activeJob.message}{activeJob.current_name ? ` - ${activeJob.current_name}` : ""}</p></div>
              <div className="flex flex-wrap gap-2">
                {activeJob.status === "paused" ? <Button variant="outline" onClick={() => action.mutate({ action: "resume", job_id: activeJob.id })}><CirclePlay className="mr-2 h-4 w-4" />Resume</Button> : !terminalStatuses.has(activeJob.status) && <Button variant="outline" onClick={() => action.mutate({ action: "pause", job_id: activeJob.id })}><CirclePause className="mr-2 h-4 w-4" />Pause</Button>}
                {!terminalStatuses.has(activeJob.status) && <Button variant="outline" className="text-destructive" onClick={() => action.mutate({ action: "cancel", job_id: activeJob.id })}><X className="mr-2 h-4 w-4" />Cancel</Button>}
                <select value={activeJob.id} onChange={(e) => setSelectedJob(e.target.value)} className="h-10 rounded-xl border bg-background px-3 text-sm">{(jobs.data || []).map((job: any) => <option key={job.id} value={job.id}>{new Date(job.created_at).toLocaleString()} - {job.status}</option>)}</select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <div><div className="mb-2 flex justify-between text-sm"><span>{activeJob.processed_items.toLocaleString()} of {activeJob.total_items.toLocaleString()}</span><span className="font-bold">{progress}%</span></div><Progress value={progress} className="h-3" /></div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              {[['Updated',activeJob.updated_items,'text-emerald-600'],['Review',activeJob.review_items,'text-blue-600'],['Skipped',activeJob.skipped_items,'text-amber-600'],['Failed',activeJob.failed_items,'text-red-600'],['Remaining',Math.max(0,activeJob.total_items-activeJob.processed_items),'text-slate-700'],['ETA',formatDuration(remainingSeconds),'text-primary']].map(([label,value,color]) => <div key={String(label)} className="rounded-2xl border p-3"><p className="text-[11px] font-bold uppercase text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-black ${color}`}>{typeof value === 'number' ? value.toLocaleString() : value}</p></div>)}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold">Latest record results</h3><span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3 w-3" />Updates every 3 seconds</span></div>{activeJob.review_items > 0 && <Button onClick={() => action.mutate({ action: "approve_all", job_id: activeJob.id })} disabled={action.isPending}><CheckCheck className="mr-2 h-4 w-4" />Approve all verified ({activeJob.review_items})</Button>}</div>
              {(items.data || []).map((item: any) => {
                const lifecycle = lifecycleLabel(item);
                const hasComparison = !!item.before_data && !!item.proposed_data && (item.changed_fields || []).length > 0;
                return <div key={item.id} className="rounded-2xl border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold">{item.entity_name}</p>
                        <Badge variant="outline">{item.entity_type}</Badge>
                        <Badge variant="outline">Pass {item.cleaning_pass || 1}</Badge>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${lifecycle.className}`}>{lifecycle.label}</span>
                        {showConfidence(item) && <span className={`text-xs font-semibold ${Number(item.confidence) < .6 ? 'text-red-600' : Number(item.confidence) < .8 ? 'text-amber-600' : 'text-emerald-600'}`}>{Math.round(Number(item.confidence)*100)}% evidence confidence</span>}
                      </div>
                      <p className={`mt-1 text-xs ${item.status === "failed" ? 'text-red-600' : 'text-muted-foreground'}`}>{resultNote(item)}</p>
                      {item.official_url && <a href={item.official_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Primary source <ExternalLink className="h-3 w-3" /></a>}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {hasComparison && <Button size="sm" variant="outline" asChild><a href={`/admin/clean-data/preview/${item.id}`} target="_blank" rel="noopener noreferrer"><Eye className="mr-1 h-3 w-3" />Open full comparison</a></Button>}
                      {item.status === "review" && <Button size="sm" onClick={() => action.mutate({ action: "approve", item_id: item.id })}><Check className="mr-1 h-3 w-3" />Approve</Button>}
                      {item.status === "review" && <Button size="sm" variant="outline" onClick={() => action.mutate({ action: "reject", item_id: item.id })}>Reject</Button>}
                    </div>
                  </div>
                </div>;
              })}
              {!items.data?.length && <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">Waiting for the first record...</div>}
            </div>
          </CardContent>
        </Card>}
      </div>
    </AdminLayout>
  );
}
