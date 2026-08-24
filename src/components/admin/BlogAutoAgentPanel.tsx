import { useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, CirclePause, Clock, ExternalLink, ImageIcon, Loader2, OctagonX, Play, Plus, RotateCcw, Save, Sparkles, Square, Timer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/admin/ImageUploadField";

type Settings = {
  enabled: boolean;
  interval_minutes: number;
  posts_per_run: number;
  daily_post_cap: number;
  publish_status: "Draft" | "Published";
  model_provider: string;
  text_model: string;
  word_limit: number;
  author_mode: "none" | "single" | "round_robin";
  author_ids: string[];
  language: string;
  audience: string;
  tone: string;
  content_goals: string[];
  required_sections: string[];
  minimum_sources: number;
  editorial_quality_target: number;
  human_review_required: boolean;
  image_mode: "generated" | "template" | "none";
  image_provider: "openai" | "gemini" | "xai";
  image_model: string;
  image_template_url: string;
  image_prompt_style: string;
  include_logo: boolean;
  logo_url: string;
  logo_position: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-right";
  image_aspect_ratio: "16:9" | "1:1" | "4:5";
  output_resolution: "web" | "2k" | "4k";
  google_trends_daily_enabled: boolean;
  google_trends_daily_posts: number;
  last_run_at?: string | null;
  next_run_at?: string | null;
};

type Source = { id?: string; name: string; url: string; source_type: "official" | "public_signal" | "own" | "competitor"; is_active: boolean };
type Run = {
  id: string;
  status: "running" | "paused" | "cancelling" | "cancelled" | "aborted" | "completed" | "skipped" | "failed";
  trigger_type: string;
  started_at: string;
  finished_at?: string | null;
  message: string;
  created_article_ids?: string[];
  progress?: number;
  current_step?: string;
  estimated_seconds?: number;
  selected_topics?: Array<{ title?: string }>;
};
type GeneratedArticle = { id: string; title: string; slug: string; featured_image?: string; status?: string; description?: string };
type Author = { id: string; name: string; designation?: string; photo?: string };

const DRAFT_KEY = "dc:admin:blog-agent:draft:v1";
const DEFAULT_SETTINGS: Settings = {
  enabled: false,
  interval_minutes: 60,
  posts_per_run: 2,
  daily_post_cap: 12,
  publish_status: "Published",
  model_provider: "gemini",
  text_model: "gemini-3.6-flash",
  word_limit: 1200,
  author_mode: "none",
  author_ids: [],
  language: "English",
  audience: "Indian students and parents",
  tone: "Clear, practical, trustworthy",
  content_goals: ["SEO", "AEO", "GEO", "AIO", "LLMO", "LLM"],
  required_sections: ["Quick answer", "Key facts", "Step-by-step guidance", "FAQs"],
  minimum_sources: 1,
  editorial_quality_target: 80,
  human_review_required: true,
  image_mode: "generated",
  image_provider: "openai",
  image_model: "gpt-image-1",
  image_template_url: "",
  image_prompt_style: "Premium editorial, clean, credible, student-focused",
  include_logo: true,
  logo_url: "https://dekhocampus.com/brand/dekhocampus-blog-logo.png",
  logo_position: "top-center",
  image_aspect_ratio: "16:9",
  output_resolution: "4k",
  google_trends_daily_enabled: true,
  google_trends_daily_posts: 3,
};

const DEFAULT_SOURCES: Source[] = [
  { name: "Google News Education", url: "https://news.google.com/rss/search?q=education%20admission%20India", source_type: "own", is_active: true },
  { name: "Google News Exams", url: "https://news.google.com/rss/search?q=exam%20counselling%20admission%20India", source_type: "own", is_active: true },
  { name: "Google Trends India", url: "https://trends.google.com/trending/rss?geo=IN", source_type: "public_signal", is_active: true },
  { name: "DekhoCampus", url: "https://dekhocampus.com/news", source_type: "own", is_active: true },
];

const COMPETITOR_SOURCE_PATTERN = /(collegedekho|college\s*dekho|collegedunia|college\s*dunia|shiksha|careers\s*360|careers360|kollege\s*apply|kollegeapply|getmyuni|pagalguy)/i;

const IMAGE_URL_SETTING_KEYS = new Set<keyof Settings>(["image_template_url", "logo_url"]);

function normalizeImageSettingUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (/^(dekhocampus\.com|www\.dekhocampus\.com|[a-z0-9-]+\.supabase\.co)\//i.test(raw)) return `https://${raw}`;
  return raw;
}

export function BlogAutoAgentPanel({ onArticlesCreated }: { onArticlesCreated?: () => void }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [sources, setSources] = useState<Source[]>(DEFAULT_SOURCES);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [generatedArticles, setGeneratedArticles] = useState<GeneratedArticle[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [now, setNow] = useState(Date.now());
  const [supportsAdvancedSettings, setSupportsAdvancedSettings] = useState(false);
  const [supportsGoogleTrendsSettings, setSupportsGoogleTrendsSettings] = useState(false);
  const [sourceDraft, setSourceDraft] = useState<Pick<Source, "name" | "url" | "source_type">>({ name: "", url: "", source_type: "official" });
  const [removedSourceIds, setRemovedSourceIds] = useState<string[]>([]);

  const load = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const [{ data: settingsData }, { data: sourceData }, { data: runData }, { data: authorData }] = await Promise.all([
        (supabase as any).from("blog_auto_agent_settings")
          .select("*")
          .eq("id", "default").maybeSingle(),
        (supabase as any).from("blog_research_sources").select("*").order("display_order"),
        (supabase as any).from("blog_auto_agent_runs").select("*").order("started_at", { ascending: false }).limit(5),
        (supabase as any).from("authors").select("id,name,designation,photo").eq("is_active", true).order("display_order"),
      ]);
      if (settingsData) {
        setSupportsAdvancedSettings(Object.prototype.hasOwnProperty.call(settingsData, "image_mode"));
        setSupportsGoogleTrendsSettings(Object.prototype.hasOwnProperty.call(settingsData, "google_trends_daily_enabled"));
        setSettings({
          ...DEFAULT_SETTINGS,
          ...settingsData,
          model_provider: "gemini",
          text_model: String(settingsData.text_model || "").startsWith("gemini-") ? settingsData.text_model : DEFAULT_SETTINGS.text_model,
          image_provider: "openai",
          image_model: "gpt-image-1",
        });
      }
      if (sourceData?.length) setSources(sourceData);
      setAuthors(authorData || []);
      if (runData) {
        setRuns(runData);
        const ids = Array.from(new Set(runData.flatMap((run: Run) => run.created_article_ids || [])));
        if (ids.length) {
          const { data } = await (supabase as any).from("articles")
            .select("id,title,slug,featured_image,status,description")
            .in("id", ids);
          setGeneratedArticles(data || []);
        }
      }
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    void load(true).then(() => {
      try {
        const draft = sessionStorage.getItem(DRAFT_KEY);
        if (draft) {
          const parsed = JSON.parse(draft);
          if (parsed.settings) setSettings((current) => ({ ...current, ...parsed.settings }));
          if (parsed.sources) setSources(parsed.sources);
        }
      } catch { /* ignore invalid session draft */ }
    });
  }, []);

  const activeRun = runs.find((run) => run.status === "running");
  const pausedRun = runs.find((run) => run.status === "paused");
  const currentRun = activeRun || pausedRun;

  useEffect(() => {
    if (!activeRun) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void load(false);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeRun?.id]);

  useEffect(() => {
    if (loading) return;
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ settings, sources }));
  }, [settings, sources, loading]);

  const activeSourceCount = useMemo(() => sources.filter(s => s.is_active).length, [sources]);
  const updateSetting = (key: keyof Settings, value: any) => setSettings(prev => ({
    ...prev,
    [key]: IMAGE_URL_SETTING_KEYS.has(key) ? normalizeImageSettingUrl(value) : value,
  }));

  const edgeErrorMessage = async (error: any) => {
    try {
      const response = error?.context as Response | undefined;
      if (response) {
        const payload = await response.clone().json().catch(async () => ({ error: await response.clone().text() }));
        if (payload?.error) return String(payload.error);
        if (payload?.message) return String(payload.message);
      }
    } catch { /* fall through */ }
    return error?.message || "Blog agent run failed";
  };

  const save = async () => {
    setBusy(true);
    try {
      const nextRun = settings.enabled && !settings.next_run_at ? new Date().toISOString() : settings.next_run_at;
      const normalizedSettings = { ...settings, model_provider: "gemini", image_provider: "openai" as const, image_model: "gpt-image-1" };
      const legacySettings = {
        enabled: settings.enabled,
        interval_minutes: settings.interval_minutes,
        posts_per_run: Math.min(3, settings.posts_per_run),
        daily_post_cap: settings.daily_post_cap,
        publish_status: settings.publish_status,
        model_provider: "gemini",
        word_limit: settings.word_limit,
        author_mode: settings.author_mode,
        author_ids: settings.author_ids,
        next_run_at: nextRun,
      };
      const settingsPayload = supportsAdvancedSettings
        ? {
            ...normalizedSettings,
            ...(supportsGoogleTrendsSettings ? {} : {
              google_trends_daily_enabled: undefined,
              google_trends_daily_posts: undefined,
            }),
            image_template_url: normalizeImageSettingUrl(settings.image_template_url),
            logo_url: normalizeImageSettingUrl(settings.logo_url),
            next_run_at: nextRun,
          }
        : legacySettings;
      const { error } = await (supabase as any).from("blog_auto_agent_settings").upsert({ id: "default", ...settingsPayload });
      if (error) throw error;
      for (const [index, source] of sources.entries()) {
        await (supabase as any).from("blog_research_sources").upsert({ ...source, display_order: (index + 1) * 10 }, { onConflict: "url" });
      }
      if (removedSourceIds.length) {
        const { error: deleteError } = await (supabase as any).from("blog_research_sources").delete().in("id", removedSourceIds);
        if (deleteError) throw deleteError;
        setRemovedSourceIds([]);
      }
      toast.success("Auto blog agent settings saved");
      sessionStorage.removeItem(DRAFT_KEY);
      await load(false);
    } catch (error: any) {
      toast.error(error.message || "Could not save blog agent settings");
    } finally {
      setBusy(false);
    }
  };

  const addSource = () => {
    const name = sourceDraft.name.trim();
    const url = sourceDraft.url.trim();
    try {
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error("Use an http or https URL");
      if (COMPETITOR_SOURCE_PATTERN.test(`${name} ${url}`)) {
        toast.error("Competitor sources are blocked. Add an official, regulator, government, or public-news source instead.");
        return;
      }
      if (!name) throw new Error("Enter a source name");
      if (sources.some((source) => source.url.toLowerCase() === parsed.toString().toLowerCase())) throw new Error("This source is already listed");
      setSources((current) => [...current, { name, url: parsed.toString(), source_type: sourceDraft.source_type, is_active: true }]);
      setSourceDraft({ name: "", url: "", source_type: "official" });
    } catch (error: any) {
      toast.error(error.message || "Enter a valid source URL");
    }
  };

  const removeSource = (source: Source, index: number) => {
    if (source.id) setRemovedSourceIds((current) => [...current, source.id!]);
    setSources((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const runNow = async () => {
    setBusy(true);
    try {
      const invocation = supabase.functions.invoke("admin-blog-agent", { body: { trigger_type: "manual" } });
      // The run row is created immediately. Start polling it while the long AI
      // request continues, and keep that state recoverable after navigation.
      window.setTimeout(() => { void load(false); }, 800);
      const { data, error } = await invocation;
      if (error || data?.error) throw error || new Error(data.error);
      toast.success(`Created ${data.created_article_ids?.length || 0} blog article(s)`);
      await load(false);
      onArticlesCreated?.();
    } catch (error: any) {
      const message = await edgeErrorMessage(error);
      toast.error(message, { duration: 12000 });
      await load(false);
    } finally {
      setBusy(false);
    }
  };

  const controlRun = async (action: "pause" | "resume" | "cancel" | "abort") => {
    if (!currentRun) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-blog-agent", {
        body: { action, run_id: currentRun.id },
      });
      if (error || data?.error) throw error || new Error(data.error);
      toast.success(
        action === "pause" ? "Pause requested" :
        action === "resume" ? "Agent resumed" :
        action === "cancel" ? "Cancellation requested" : "Run aborted",
      );
      await load(false);
    } catch (error: any) {
      toast.error(await edgeErrorMessage(error), { duration: 12000 });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="rounded-2xl border p-4 text-sm text-muted-foreground">Loading blog automation...</div>;

  return (
    <div className="mb-4 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold">Auto Blog Agent</h3>
            <Badge variant={settings.enabled ? "default" : "secondary"}>{settings.enabled ? "Running" : "Paused"}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Uses low-cost Gemini for source-aware editorial drafts and OpenAI only for optional blog cover images. Review gates, schedules and templates remain under your control.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={save} disabled={busy} className="gap-2 rounded-xl">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </Button>
          <Button onClick={runNow} disabled={busy || !!currentRun || activeSourceCount < 2} className="gap-2 rounded-xl">
            {busy || activeRun ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {activeRun ? "Agent running" : pausedRun ? "Resume paused run" : "Run now"}
          </Button>
        </div>
      </div>

      {currentRun && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-background to-orange-500/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                {pausedRun ? <CirclePause className="h-4 w-4 text-amber-600" /> : <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {pausedRun ? "Blog agent is paused" : "Blog agent is working"}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{currentRun.current_step || "Preparing your articles"}</p>
            </div>
            <Badge variant="outline" className="gap-1 bg-background/80"><Timer className="h-3.5 w-3.5" /> {(() => {
              if (pausedRun) return "Waiting to resume";
              const elapsed = Math.max(0, Math.round((now - new Date(currentRun.started_at).getTime()) / 1000));
              const remaining = Math.max(0, Number(currentRun.estimated_seconds || 180) - elapsed);
              return remaining > 0 ? `About ${Math.max(1, Math.ceil(remaining / 60))} min left` : "Finishing now";
            })()}</Badge>
          </div>
          <Progress value={Math.max(2, currentRun.progress || 2)} className="mt-4 h-3" />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{currentRun.progress || 2}% complete</span><span>Controls are durable across tabs and reloads</span></div>
          {supportsAdvancedSettings ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {pausedRun ? (
                <Button size="sm" onClick={() => controlRun("resume")} disabled={busy} className="gap-2"><RotateCcw className="h-4 w-4" /> Resume</Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => controlRun("pause")} disabled={busy} className="gap-2"><CirclePause className="h-4 w-4" /> Pause</Button>
              )}
              <Button size="sm" variant="outline" onClick={() => controlRun("cancel")} disabled={busy} className="gap-2 text-destructive"><Square className="h-4 w-4" /> Cancel safely</Button>
              <Button size="sm" variant="destructive" onClick={() => controlRun("abort")} disabled={busy} className="gap-2"><OctagonX className="h-4 w-4" /> Abort now</Button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-amber-700">Lifecycle controls become active after the pending Node function deployment.</p>
          )}
          {!!currentRun.selected_topics?.length && <div className="mt-3 flex flex-wrap gap-2">{currentRun.selected_topics.map((topic, index) => <Badge key={`${topic.title}-${index}`} variant="secondary">{topic.title}</Badge>)}</div>}
        </div>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <div className="rounded-xl border p-3">
          <Label className="text-xs">Enable auto push</Label>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm">{settings.enabled ? "Auto publishing on" : "Manual only"}</span>
            <Switch checked={settings.enabled} onCheckedChange={(value) => updateSetting("enabled", value)} />
          </div>
        </div>
        <div className="rounded-xl border p-3">
          <Label className="text-xs">Frequency</Label>
          <div className="mt-3 flex gap-2">
            {[30, 60].map(minutes => <Button key={minutes} size="sm" variant={settings.interval_minutes === minutes ? "default" : "outline"} onClick={() => updateSetting("interval_minutes", minutes)}>{minutes === 30 ? "30 min" : "1 hour"}</Button>)}
          </div>
        </div>
        <div className="rounded-xl border p-3">
          <Label className="text-xs">Articles per run</Label>
          <div className="mt-3 flex flex-wrap gap-2">
            {[1, 2, 3].map(count => <Button key={count} size="sm" variant={settings.posts_per_run === count ? "default" : "outline"} onClick={() => updateSetting("posts_per_run", count)}>{count}</Button>)}
            <Input aria-label="Custom articles per run" type="number" min={1} max={20} value={settings.posts_per_run} onChange={(event) => updateSetting("posts_per_run", Math.min(20, Math.max(1, Number(event.target.value || 1))))} className="h-9 w-20" />
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">Custom: 1-20. Higher counts take longer and use more AI credits.</p>
        </div>
        <div className="rounded-xl border p-3">
          <Label className="text-xs">Publish mode</Label>
          <div className="mt-3 flex gap-2">
            {(["Published", "Draft"] as const).map(status => <Button key={status} size="sm" variant={settings.publish_status === status ? "default" : "outline"} onClick={() => updateSetting("publish_status", status)}>{status}</Button>)}
          </div>
        </div>
      </div>

      {!supportsAdvancedSettings && (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
          Advanced editorial, lifecycle, template, and logo controls are ready in this release but will remain locked until the production MySQL migration and Node functions are deployed.
        </div>
      )}

      <div className="mt-4 rounded-2xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><Label>Author assignment</Label><p className="text-xs text-muted-foreground">Choose one byline or rotate articles across selected author profiles.</p></div>
          <div className="flex flex-wrap gap-2">
            {([['none', 'Editorial default'], ['single', 'Single author'], ['round_robin', 'Round robin']] as const).map(([mode, label]) => (
              <Button key={mode} type="button" size="sm" variant={settings.author_mode === mode ? "default" : "outline"} onClick={() => updateSetting("author_mode", mode)}>{label}</Button>
            ))}
          </div>
        </div>
        {settings.author_mode !== "none" && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {authors.map((author) => {
              const selected = settings.author_ids.includes(author.id);
              return <label key={author.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${selected ? 'border-primary bg-primary/5' : ''}`}>
                <input
                  type={settings.author_mode === "single" ? "radio" : "checkbox"}
                  name="blog-agent-author"
                  checked={selected}
                  onChange={() => updateSetting("author_ids", settings.author_mode === "single" ? [author.id] : selected ? settings.author_ids.filter((id) => id !== author.id) : [...settings.author_ids, author.id])}
                />
                {author.photo ? <img src={author.photo} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-primary/10" />}
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{author.name}</span><span className="block truncate text-xs text-muted-foreground">{author.designation || "Author"}</span></span>
              </label>;
            })}
            {!authors.length && <p className="text-sm text-muted-foreground">Add active profiles in Authors / Team first.</p>}
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div>
          <Label className="text-xs">Daily cap</Label>
          <Input type="number" min={1} max={48} value={settings.daily_post_cap} onChange={e => updateSetting("daily_post_cap", Number(e.target.value || 12))} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Blog AI provider</Label>
          <div className="mt-1"><Button type="button" size="sm" variant="default" disabled>Google Gemini</Button></div>
          <p className="mt-1 text-[10px] text-muted-foreground">Gemini is fixed for text, research, data cleaning and admin AI generation.</p>
          {supportsAdvancedSettings && (
            <select
              aria-label="Blog text model"
              value={settings.text_model}
              onChange={(event) => updateSetting("text_model", event.target.value)}
              className="mt-2 h-9 w-full rounded-md border bg-background px-2 text-xs"
            >
              <option value="gemini-3.6-flash">Gemini 3.6 Flash - production default</option>
              <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite - lowest cost</option>
              <option value="gemini-3.7-flash">Gemini 3.7 Flash - latest Flash</option>
            </select>
          )}
        </div>
        <div>
          <Label className="text-xs">Word limit</Label>
          <div className="mt-1 flex gap-2">
            {[800, 1200, 1800].map(limit => <Button key={limit} size="sm" variant={settings.word_limit === limit ? "default" : "outline"} onClick={() => updateSetting("word_limit", limit)}>{limit}</Button>)}
          </div>
        </div>
        {supportsGoogleTrendsSettings && <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Label className="text-sm font-semibold">Daily Google Trends articles</Label>
              <p className="mt-1 text-xs text-muted-foreground">At the first scheduled run each day, the agent selects the top Indian education trends by Google Trends' published traffic estimate and writes distinct articles before normal research runs continue.</p>
            </div>
            <Switch checked={settings.google_trends_daily_enabled} onCheckedChange={(value) => updateSetting("google_trends_daily_enabled", value)} />
          </div>
          {settings.google_trends_daily_enabled && <div className="mt-3 flex items-center gap-3"><Label className="whitespace-nowrap text-xs">Daily trend posts</Label><Input type="number" min={1} max={3} value={settings.google_trends_daily_posts} onChange={(event) => updateSetting("google_trends_daily_posts", Math.min(3, Math.max(1, Number(event.target.value || 3))))} className="h-9 w-20" /><span className="text-xs text-muted-foreground">Maximum 3 per day, subject to the daily article cap and available valid trends.</span></div>}
        </div>}
      </div>

      {supportsAdvancedSettings && <div className="mt-4 rounded-2xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Label className="text-sm font-semibold">Answer and AI discovery quality</Label>
            <p className="mt-1 text-xs text-muted-foreground">Configure reader intent, answer structure, factual sourcing, and the editorial review threshold.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["SEO", "AEO", "GEO", "AIO", "LLMO", "LLM"].map((goal) => {
              const selected = settings.content_goals.includes(goal);
              return (
                <Button
                  key={goal}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  onClick={() => updateSetting("content_goals", selected
                    ? settings.content_goals.filter((item) => item !== goal)
                    : [...settings.content_goals, goal])}
                >
                  {goal}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div><Label>Language</Label><Input value={settings.language} onChange={(event) => updateSetting("language", event.target.value)} className="mt-1" /></div>
          <div><Label>Audience</Label><Input value={settings.audience} onChange={(event) => updateSetting("audience", event.target.value)} className="mt-1" /></div>
          <div><Label>Minimum independent sources</Label><Input type="number" min={1} max={10} value={settings.minimum_sources} onChange={(event) => updateSetting("minimum_sources", Math.min(10, Math.max(1, Number(event.target.value || 2))))} className="mt-1" /></div>
          <div className="md:col-span-2 lg:col-span-3"><Label>Tone and editorial voice</Label><Input value={settings.tone} onChange={(event) => updateSetting("tone", event.target.value)} className="mt-1" /></div>
          <div className="md:col-span-2">
            <Label>Required sections (one per line)</Label>
            <Textarea
              rows={5}
              value={settings.required_sections.join("\n")}
              onChange={(event) => updateSetting("required_sections", event.target.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean))}
              className="mt-1"
            />
          </div>
          <div className="space-y-3 rounded-xl border p-3">
            <div>
              <Label>Editorial quality target</Label>
              <Input type="number" min={0} max={100} value={settings.editorial_quality_target} onChange={(event) => updateSetting("editorial_quality_target", Math.min(100, Math.max(0, Number(event.target.value || 80))))} className="mt-1" />
              <p className="mt-1 text-[10px] text-muted-foreground">A completeness target, not an AI-detector score.</p>
            </div>
            <label className="flex items-center justify-between gap-3">
              <span><span className="block text-sm font-medium">Require human review</span><span className="block text-[10px] text-muted-foreground">Keeps generated work in Draft until an editor reviews it.</span></span>
              <Switch checked={settings.human_review_required} onCheckedChange={(value) => updateSetting("human_review_required", value)} />
            </label>
          </div>
        </div>
      </div>}

      {supportsAdvancedSettings && <div className="mt-4 rounded-2xl border p-4">
        <div>
          <Label className="text-sm font-semibold">Cover image workflow</Label>
          <p className="mt-1 text-xs text-muted-foreground">Generate a new background, use your template, or skip the cover. Uploaded logos are placed without changing the source file.</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {([["generated", "Generate new"], ["template", "Use saved template"], ["none", "No image"]] as const).map(([mode, label]) => (
            <Button key={mode} type="button" size="sm" variant={settings.image_mode === mode ? "default" : "outline"} onClick={() => updateSetting("image_mode", mode)}>{label}</Button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {settings.image_mode === "template" && (
              <ImageUploadField label="Cover template" value={settings.image_template_url} onChange={(value) => updateSetting("image_template_url", value)} folder="blog-templates" />
            )}
            {settings.image_mode === "generated" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Image provider</Label><select value="openai" disabled className="mt-1 h-10 w-full rounded-md border bg-background px-3"><option value="openai">OpenAI</option></select></div>
                  <div><Label>Image model</Label><select value="gpt-image-1" disabled className="mt-1 h-10 w-full rounded-md border bg-background px-3"><option value="gpt-image-1">GPT Image 1</option></select></div>
                </div>
                <div><Label>Image art direction</Label><Textarea rows={4} value={settings.image_prompt_style} onChange={(event) => updateSetting("image_prompt_style", event.target.value)} className="mt-1" /></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Aspect ratio</Label><select value={settings.image_aspect_ratio} onChange={(event) => updateSetting("image_aspect_ratio", event.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3"><option value="16:9">16:9</option><option value="1:1">1:1</option><option value="4:5">4:5</option></select></div>
              <div><Label>Output</Label><select value={settings.output_resolution} onChange={(event) => updateSetting("output_resolution", event.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3"><option value="web">Web</option><option value="2k">2K</option><option value="4k">4K</option></select></div>
            </div>
          </div>
          <div className="space-y-3">
            <label className="flex items-center justify-between rounded-xl border p-3">
              <span><span className="block text-sm font-medium">Place logo on cover</span><span className="block text-xs text-muted-foreground">Works with generated images and templates.</span></span>
              <Switch checked={settings.include_logo} onCheckedChange={(value) => updateSetting("include_logo", value)} />
            </label>
            {settings.include_logo && (
              <>
                <ImageUploadField label="High-resolution logo (PNG, WebP or SVG)" value={settings.logo_url} onChange={(value) => updateSetting("logo_url", value)} folder="blog-brand" />
                <div><Label>Logo position</Label><select value="top-center" disabled className="mt-1 h-10 w-full rounded-md border bg-muted px-3"><option value="top-center">Top center (locked)</option></select></div>
              </>
            )}
          </div>
        </div>
      </div>}

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Sparkles className="h-3.5 w-3.5" /> Research sources visible to the agent</div>
        <div className="mb-3 rounded-xl border bg-muted/30 p-3">
          <p className="mb-3 text-xs text-muted-foreground">Add official institution pages, government/regulator notices, or public signals. Research is internal only - no visible source section is published with an article.</p>
          <div className="grid gap-2 md:grid-cols-[1fr_2fr_150px_auto]">
            <Input aria-label="Research source name" value={sourceDraft.name} onChange={(event) => setSourceDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Source name" />
            <Input aria-label="Research source URL" value={sourceDraft.url} onChange={(event) => setSourceDraft((current) => ({ ...current, url: event.target.value }))} placeholder="https://example.gov.in/updates" />
            <select aria-label="Research source type" value={sourceDraft.source_type} onChange={(event) => setSourceDraft((current) => ({ ...current, source_type: event.target.value as Source["source_type"] }))} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="official">Official / regulator</option><option value="public_signal">Public signal</option><option value="own">DekhoCampus</option></select>
            <Button type="button" variant="outline" onClick={addSource} className="gap-2"><Plus className="h-4 w-4" /> Add</Button>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {sources.map((source, index) => (
            <div key={source.url} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
              <Switch checked={source.is_active} onCheckedChange={(value) => setSources(prev => prev.map((item, i) => i === index ? { ...item, is_active: value } : item))} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{source.name} <Badge variant="outline" className="ml-1 text-[10px]">{source.source_type}</Badge></span>
                <span className="block truncate text-xs text-muted-foreground">{source.url}</span>
              </span>
              <Button type="button" size="icon" variant="ghost" onClick={() => removeSource(source, index)} className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Remove ${source.name}`}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Last: {settings.last_run_at ? new Date(settings.last_run_at).toLocaleString() : "Not run yet"}</span>
          <span>Next: {settings.next_run_at ? new Date(settings.next_run_at).toLocaleString() : "After saving enabled schedule"}</span>
        </div>
        {runs.length > 0 && <div className="mt-2 space-y-1">{runs.map(run => <div key={run.id}>• {new Date(run.started_at).toLocaleString()} - {run.status} - {run.message || `${run.created_article_ids?.length || 0} articles`}</div>)}</div>}
      </div>

      {generatedArticles.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Recently generated articles</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {generatedArticles.map((article) => (
              <a key={article.id} href={`/news/${article.slug}`} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border bg-card transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="aspect-[16/9] bg-muted">
                  {article.featured_image ? <img src={article.featured_image} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImageIcon className="h-8 w-8 text-muted-foreground" /></div>}
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2"><h4 className="line-clamp-2 text-sm font-semibold">{article.title}</h4><ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" /></div>
                  <div className="mt-2"><Badge variant={article.status === "Published" ? "default" : "secondary"}>{article.status || "Draft"}</Badge></div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
