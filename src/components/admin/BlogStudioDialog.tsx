import { useEffect, useState } from "react";
import { Sparkles, Loader2, Image as ImageIcon, BookOpenCheck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { backendClient } from "@/integrations/backend/client";
import { slugify } from "@/lib/slugify";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { DEFAULT_SITE_SCOPE, siteScopeLabel, type SiteScope } from "@/lib/siteScope";

type Suggestion = { entity_type: string; entity_slug: string; label: string };
type DraftFaq = { question: string; answer: string };
type Draft = { title: string; slug: string; description: string; content_html: string; meta_title: string; meta_description: string; meta_keywords: string; tags: string[]; category: string; vertical: string; featured_image: string; faqs?: DraftFaq[]; entity_suggestions?: Suggestion[] };
type EditorialSettings = {
  text_model: string;
  word_limit: number;
  content_goals: string[];
  required_sections: string[];
  minimum_sources: number;
  editorial_quality_target: number;
  language: string;
  audience: string;
  tone: string;
};
type Quality = { score?: number; issues?: string[]; model_review?: { score?: number; summary?: string } };
const LENGTHS = [0, 900, 1200, 1500, 1800] as const;
const DEFAULT_EDITORIAL_SETTINGS: EditorialSettings = {
  text_model: "gpt-5.4-mini",
  word_limit: 0,
  content_goals: ["SEO", "AEO", "GEO", "LLMO"],
  required_sections: ["Answer first", "Key facts", "Decision guidance", "FAQs"],
  minimum_sources: 2,
  editorial_quality_target: 90,
  language: "English",
  audience: "Indian students and parents",
  tone: "Clear, practical, trustworthy",
};
const SARKARI_CATEGORIES = ["Latest Jobs", "Results", "Admit Card", "Answer Key", "Admissions", "Syllabus", "Scholarships"];

interface BlogStudioDialogProps {
  onSaved?: () => void;
  siteScope?: SiteScope;
  initiallyOpen?: boolean;
}

export function BlogStudioDialog({ onSaved, siteScope = DEFAULT_SITE_SCOPE, initiallyOpen = false }: BlogStudioDialogProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const [topic, setTopic] = useState("");
  const [wordLimit, setWordLimit] = useState<number>(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [imageMode, setImageMode] = useState<"generated" | "template" | "none">("template");
  const [templateUrl, setTemplateUrl] = useState("");
  const [includeLogo, setIncludeLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [editorial, setEditorial] = useState<EditorialSettings>(DEFAULT_EDITORIAL_SETTINGS);
  const [researchSources, setResearchSources] = useState<string[]>([]);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [modelUsed, setModelUsed] = useState("");

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const settingsId = siteScope === "sarkari" ? "sarkari" : "default";
      const { data: scopedData } = await (backendClient as any).from("blog_auto_agent_settings")
        .select("image_mode,image_template_url,include_logo,logo_url,text_model,word_limit,content_goals,required_sections,minimum_sources,editorial_quality_target,language,audience,tone")
        .eq("id", settingsId)
        .maybeSingle();
      let data = scopedData;
      if (!data && settingsId !== "default") {
        const fallback = await (backendClient as any).from("blog_auto_agent_settings")
          .select("image_mode,image_template_url,include_logo,logo_url,text_model,word_limit,content_goals,required_sections,minimum_sources,editorial_quality_target,language,audience,tone")
          .eq("id", "default")
          .maybeSingle();
        data = fallback.data;
      }
      if (!data) return;
      setImageMode(data.image_mode || "template");
      setTemplateUrl(data.image_template_url || "");
      setIncludeLogo(Boolean(data.include_logo));
      setLogoUrl(data.logo_url || "");
      const nextEditorial = { ...DEFAULT_EDITORIAL_SETTINGS, ...data };
      setEditorial(nextEditorial);
      setWordLimit(Number(nextEditorial.word_limit) || 0);
    })();
  }, [open, siteScope]);

  const functionErrorMessage = async (error: any, fallback: string) => {
    try {
      const response = error?.context as Response | undefined;
      if (response) {
        const payload = await response.clone().json().catch(async () => ({ error: await response.clone().text() }));
        return String(payload?.error || payload?.message || fallback);
      }
    } catch { /* use the normal error below */ }
    return String(error?.message || fallback);
  };

  const generate = async () => {
    if (!topic.trim()) return toast.error("Enter a blog topic");
    setBusy(true);
    try {
      const { data, error } = await backendClient.functions.invoke("admin-blog-studio", {
        body: {
          topic,
          site_scope: siteScope,
          content_type: siteScope === "sarkari" ? "sarkari_job_update" : "editorial_article",
          word_limit: wordLimit,
          model: editorial.text_model,
          content_goals: editorial.content_goals,
          required_sections: editorial.required_sections,
          minimum_sources: editorial.minimum_sources,
          editorial_quality_target: editorial.editorial_quality_target,
          language: editorial.language,
          audience: editorial.audience,
          tone: editorial.tone,
          image: { mode: imageMode, template_url: templateUrl, reference_image_url: templateUrl, include_logo: includeLogo, logo_url: logoUrl, resolution: "web" },
        },
      });
      if (error || data?.error) throw error || new Error(data.error);
      const next = data.draft as Draft;
      next.slug = next.slug || slugify(next.title || topic);
      setDraft(next);
      setSelected(new Set((next.entity_suggestions || []).map(item => `${item.entity_type}:${item.entity_slug}`)));
      setResearchSources(Array.isArray(data.research_sources) ? data.research_sources : []);
      setQuality(data.quality || null);
      setModelUsed(String(data.model_used || editorial.text_model));
    } catch (error: any) {
      toast.error(await functionErrorMessage(error, "Blog generation failed"));
    } finally { setBusy(false); }
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const entityLinks = siteScope === "dekhocampus" ? (draft.entity_suggestions || []).filter((suggestion) => (
        selected.has(`${suggestion.entity_type}:${suggestion.entity_slug}`)
      )).map(({ entity_type, entity_slug }) => ({ entity_type, entity_slug })) : [];
      const publishDraft = {
        ...draft,
        slug: slugify(draft.slug),
        ...(siteScope === "sarkari" ? {
          category: SARKARI_CATEGORIES.includes(draft.category) ? draft.category : "Latest Jobs",
          vertical: draft.vertical || "Government Jobs",
        } : {}),
      };
      const { data, error } = await backendClient.functions.invoke("admin-blog-studio", {
        body: {
          action: "publish",
          status: "Published",
          site_scope: siteScope,
          draft: publishDraft,
          entity_links: entityLinks,
          research_sources: researchSources,
        },
      });
      if (error || data?.error) throw error || new Error(data.error);
      toast.success(`${siteScopeLabel(siteScope)} article published after quality and duplicate checks (${data?.quality?.score || quality?.score || 0}/100)`);
      setOpen(false); setDraft(null); onSaved?.();
    } catch (error: any) {
      toast.error(await functionErrorMessage(error, "Could not publish the article"));
    } finally { setBusy(false); }
  };

  return <>
    <Button className="gap-2 rounded-xl" onClick={() => setOpen(true)}><Sparkles className="w-4 h-4" /> {siteScope === "sarkari" ? "Sarkari Job AI Studio" : "AI Blog Studio"}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><BookOpenCheck className="w-5 h-5 text-primary" /> {siteScope === "sarkari" ? "Sarkari Job Editorial Studio" : "Editorial Blog Studio"}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div><Label>Topic</Label><Input value={topic} onChange={event => setTopic(event.target.value)} placeholder={siteScope === "sarkari" ? "e.g. SSC CGL notification, eligibility, dates and application process" : "e.g. JEE Main counselling dates and choice filling guide"} /></div>
        <div className="rounded-lg border bg-muted/40 p-3 text-sm"><b>Editorial model:</b> {editorial.text_model}. It checks novelty within the {siteScopeLabel(siteScope)} library, synthesises evidence, drafts the article and performs a second quality review. OpenAI image generation runs only when you choose a new image.</div>
        <div><Label>Optimised word limit</Label><div className="mt-2 flex flex-wrap gap-2">{LENGTHS.map(length => <Button key={length} variant={wordLimit === length ? "default" : "outline"} onClick={() => setWordLimit(length)}>{length === 0 ? "Adaptive" : `${length} words`}</Button>)}</div><p className="mt-2 text-xs text-muted-foreground">Adaptive is recommended: concise updates stay short, while detailed guides receive more depth.</p></div>
        <div className="rounded-xl border p-3">
          <Label>Cover workflow</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {([["generated", "New OpenAI image"], ["template", "Use template"], ["none", "No image"]] as const).map(([mode, label]) => <Button key={mode} size="sm" variant={imageMode === mode ? "default" : "outline"} onClick={() => setImageMode(mode)}>{label}</Button>)}
          </div>
          {imageMode === "template" && <div className="mt-3"><ImageUploadField label="Optional custom background" value={templateUrl} onChange={setTemplateUrl} folder="blog-templates" /></div>}
          {imageMode === "generated" && <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2"><ImageUploadField label="Optional OpenAI style reference" value={templateUrl} onChange={setTemplateUrl} folder="blog-templates" /></div>
            <label className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">Place uploaded logo</span><Switch checked={includeLogo} onCheckedChange={setIncludeLogo} /></label>
            {includeLogo && <ImageUploadField label="High-resolution logo" value={logoUrl} onChange={setLogoUrl} folder="blog-brand" />}
          </div>}
          {imageMode === "template" && <p className="mt-2 text-xs text-muted-foreground">One of 24 built-in editorial backgrounds is selected automatically. The locked logo, panel and typography use no OpenAI image credits.</p>}
          {imageMode === "generated" && <p className="mt-2 text-xs text-muted-foreground">OpenAI receives the supplied DekhoCampus cover as a style reference and changes only the illustrated background. Branding and typography are rendered locally and stay fixed.</p>}
        </div>
        <p className="text-xs text-muted-foreground">Research sources are private editorial inputs, never published citations. Every result is checked against all existing article intents, reviewed for factual usefulness, and rechecked when you publish.</p>
        <Button onClick={generate} disabled={busy} className="gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Research, write and generate branded cover</Button>
        {draft && <div className="grid gap-4 border-t pt-4 lg:grid-cols-[1.2fr_.8fr]">
          <div className="space-y-4">
            <div><Label>Article title</Label><Input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} className="mt-1" /></div>
            <div><Label>URL slug</Label><Input value={draft.slug} onChange={event => setDraft({ ...draft, slug: event.target.value })} className="mt-1" /></div>
            <div><Label>Listing summary</Label><Textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} rows={3} className="mt-1" /></div>
            <div><Label>Article HTML</Label><Textarea value={draft.content_html} onChange={event => setDraft({ ...draft, content_html: event.target.value })} rows={18} className="mt-1 font-mono text-xs" /></div>
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Meta title</Label><Input value={draft.meta_title || ""} onChange={event => setDraft({ ...draft, meta_title: event.target.value })} className="mt-1" /></div>
              <div><Label>Meta keywords</Label><Input value={draft.meta_keywords || ""} onChange={event => setDraft({ ...draft, meta_keywords: event.target.value })} className="mt-1" /></div>
              <div className="md:col-span-2"><Label>Meta description</Label><Textarea value={draft.meta_description || ""} onChange={event => setDraft({ ...draft, meta_description: event.target.value })} rows={2} className="mt-1" /></div>
              <div><Label>Category</Label>{siteScope === "sarkari" ? <select value={draft.category || "Latest Jobs"} onChange={event => setDraft({ ...draft, category: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{SARKARI_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}</select> : <Input value={draft.category || "Education"} onChange={event => setDraft({ ...draft, category: event.target.value })} className="mt-1" />}</div>
              <div><Label>Vertical</Label><Input value={draft.vertical || "General"} onChange={event => setDraft({ ...draft, vertical: event.target.value })} className="mt-1" /></div>
              <div className="md:col-span-2"><Label>Tags</Label><Input value={(draft.tags || []).join(", ")} onChange={event => setDraft({ ...draft, tags: event.target.value.split(",").map(value => value.trim()).filter(Boolean) })} className="mt-1" /></div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2"><Label>FAQs ({draft.faqs?.length || 0})</Label><Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setDraft({ ...draft, faqs: [...(draft.faqs || []), { question: "", answer: "" }] })}><Plus className="h-3.5 w-3.5" /> Add FAQ</Button></div>
              <div className="mt-3 space-y-3">{(draft.faqs || []).map((faq, index) => <div key={index} className="grid gap-2 rounded-md border p-3">
                <div className="flex gap-2"><Input aria-label={`FAQ ${index + 1} question`} value={faq.question} onChange={event => setDraft({ ...draft, faqs: (draft.faqs || []).map((item, itemIndex) => itemIndex === index ? { ...item, question: event.target.value } : item) })} placeholder="Question" /><Button type="button" size="icon" variant="ghost" aria-label={`Delete FAQ ${index + 1}`} onClick={() => setDraft({ ...draft, faqs: (draft.faqs || []).filter((_, itemIndex) => itemIndex !== index) })}><Trash2 className="h-4 w-4" /></Button></div>
                <Textarea aria-label={`FAQ ${index + 1} answer`} value={faq.answer} onChange={event => setDraft({ ...draft, faqs: (draft.faqs || []).map((item, itemIndex) => itemIndex === index ? { ...item, answer: event.target.value } : item) })} rows={3} placeholder="Answer" />
              </div>)}</div>
            </div>
          </div>
          <div className="space-y-4">
            {draft.featured_image ? <div className="overflow-hidden rounded-xl border bg-muted"><img alt="Editorial cover" src={draft.featured_image} className="aspect-video w-full object-cover" loading="lazy" /><div className="flex gap-2 p-3 text-xs text-muted-foreground"><ImageIcon className="h-4 w-4" /> Web-optimised editorial cover</div></div> : <div className="rounded-xl border bg-muted p-8 text-center text-sm text-muted-foreground">No cover selected</div>}
            <div className="rounded-xl border p-3 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="font-medium">Editorial quality</span><Badge variant={(quality?.score || 0) >= editorial.editorial_quality_target ? "default" : "secondary"}>{quality?.score || 0}/100</Badge></div>
              <p className="mt-2 text-xs text-muted-foreground">Model: {modelUsed || editorial.text_model}. Private sources checked: {researchSources.length}.</p>
              {!!quality?.issues?.length && <p className="mt-2 text-xs text-amber-700">{quality.issues.join("; ")}</p>}
            </div>
            {siteScope === "dekhocampus" && <div><Label>Suggested entity links</Label><div className="mt-2 flex flex-wrap gap-2">{(draft.entity_suggestions || []).map(suggestion => { const key = `${suggestion.entity_type}:${suggestion.entity_slug}`; return <Badge key={key} variant={selected.has(key) ? "default" : "outline"} className="cursor-pointer" onClick={() => setSelected(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; })}>{suggestion.label || suggestion.entity_slug}</Badge>; })}</div></div>}
            <Button onClick={save} disabled={busy} className="w-full">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{siteScope === "sarkari" ? "Publish Sarkari article after final checks" : "Publish after final checks"}</Button>
          </div>
        </div>}
      </div>
    </DialogContent></Dialog>
  </>;
}
