import { useEffect, useState } from "react";
import { Sparkles, Loader2, Image as ImageIcon, BookOpenCheck } from "lucide-react";
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

type Suggestion = { entity_type: string; entity_slug: string; label: string };
type DraftFaq = { question: string; answer: string };
type Draft = { title: string; slug: string; description: string; content_html: string; meta_title: string; meta_description: string; meta_keywords: string; tags: string[]; featured_image: string; faqs?: DraftFaq[]; entity_suggestions?: Suggestion[] };
const LENGTHS = [800, 1200, 1800] as const;

export function BlogStudioDialog({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [wordLimit, setWordLimit] = useState<number>(1200);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [imageMode, setImageMode] = useState<"generated" | "template" | "none">("template");
  const [templateUrl, setTemplateUrl] = useState("");
  const [includeLogo, setIncludeLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data } = await (backendClient as any).from("blog_auto_agent_settings")
        .select("image_mode,image_template_url,include_logo,logo_url")
        .eq("id", "default")
        .maybeSingle();
      if (!data) return;
      setImageMode(data.image_mode || "template");
      setTemplateUrl(data.image_template_url || "");
      setIncludeLogo(Boolean(data.include_logo));
      setLogoUrl(data.logo_url || "");
    })();
  }, [open]);

  const generate = async () => {
    if (!topic.trim()) return toast.error("Enter a blog topic");
    setBusy(true);
    try {
      const { data, error } = await backendClient.functions.invoke("admin-blog-studio", {
        body: {
          topic,
          word_limit: wordLimit,
          content_goals: ["SEO", "AEO", "GEO", "AIO", "LLMO", "LLM"],
          image: { mode: imageMode, template_url: templateUrl, reference_image_url: templateUrl, include_logo: includeLogo, logo_url: logoUrl, resolution: "web" },
        },
      });
      if (error || data?.error) throw error || new Error(data.error);
      const next = data.draft as Draft;
      next.slug = next.slug || slugify(next.title || topic);
      setDraft(next);
      setSelected(new Set((next.entity_suggestions || []).map(item => `${item.entity_type}:${item.entity_slug}`)));
    } catch (error: any) {
      const message = error?.context?.error || error?.message || "Blog generation failed";
      toast.error(message);
    } finally { setBusy(false); }
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const { data: article, error } = await (backendClient as any).from("articles").upsert({
        title: draft.title, slug: slugify(draft.slug), description: draft.description, content: draft.content_html,
        meta_title: draft.meta_title, meta_description: draft.meta_description, meta_keywords: draft.meta_keywords,
        tags: draft.tags || [], featured_image: draft.featured_image, status: "Draft", is_active: true,
      }, { onConflict: "slug" }).select("id").single();
      if (error) throw error;
      const articleSlug = slugify(draft.slug);
      const { error: faqDeleteError } = await (backendClient as any).from("faqs").delete().eq("page", "articles").eq("item_slug", articleSlug);
      if (faqDeleteError) throw faqDeleteError;
      if (draft.faqs?.length) {
        const { error: faqInsertError } = await (backendClient as any).from("faqs").insert(draft.faqs.map((faq, index) => ({
          page: "articles",
          item_slug: articleSlug,
          question: faq.question,
          answer: faq.answer,
          display_order: (index + 1) * 10,
          is_active: true,
        })));
        if (faqInsertError) throw faqInsertError;
      }
      for (const suggestion of draft.entity_suggestions || []) {
        if (selected.has(`${suggestion.entity_type}:${suggestion.entity_slug}`)) {
          await (backendClient as any).from("article_links").upsert({ article_id: article.id, entity_type: suggestion.entity_type, entity_slug: suggestion.entity_slug }, { onConflict: "article_id,entity_type,entity_slug" });
        }
      }
      toast.success("Editorial draft, cover choice and selected links saved");
      setOpen(false); setDraft(null); onSaved?.();
    } catch (error: any) {
      toast.error(error.message || "Could not save blog draft");
    } finally { setBusy(false); }
  };

  return <>
    <Button className="gap-2 rounded-xl" onClick={() => setOpen(true)}><Sparkles className="w-4 h-4" /> AI Blog Studio</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><BookOpenCheck className="w-5 h-5 text-primary" /> Editorial Blog Studio</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div><Label>Topic</Label><Input value={topic} onChange={event => setTopic(event.target.value)} placeholder="e.g. JEE Main counselling dates and choice filling guide" /></div>
        <div className="rounded-lg border bg-muted/40 p-3 text-sm"><b>Blog providers:</b> Gemini writes by default. You can choose Gemini, Claude or OpenAI under Admin - AI Providers. OpenAI is called only when you choose a newly generated image.</div>
        <div><Label>Optimised word limit</Label><div className="flex gap-2 mt-2">{LENGTHS.map(length => <Button key={length} variant={wordLimit === length ? "default" : "outline"} onClick={() => setWordLimit(length)}>{length} words</Button>)}</div></div>
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
        <p className="text-xs text-muted-foreground">Competitor research is used for trend awareness only. Every result is checked for duplicate coverage, includes dedicated FAQs, and is saved as Draft for editor review.</p>
        <Button onClick={generate} disabled={busy} className="gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Research, write and generate branded cover</Button>
        {draft && <div className="grid lg:grid-cols-[1.2fr_.8fr] gap-4 border-t pt-4">
          <div className="space-y-3"><Input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /><Input value={draft.slug} onChange={event => setDraft({ ...draft, slug: event.target.value })} /><Textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} rows={3} /><Textarea value={draft.content_html} onChange={event => setDraft({ ...draft, content_html: event.target.value })} rows={16} /><Textarea value={draft.meta_description} onChange={event => setDraft({ ...draft, meta_description: event.target.value })} rows={2} />{draft.faqs?.length ? <div className="rounded-lg border p-3"><Label>Generated FAQs ({draft.faqs.length})</Label><div className="mt-2 space-y-2">{draft.faqs.map((faq, index) => <div key={`${faq.question}-${index}`} className="text-sm"><p className="font-medium">{faq.question}</p><p className="text-muted-foreground">{faq.answer}</p></div>)}</div></div> : null}</div>
          <div className="space-y-3">{draft.featured_image ? <div className="rounded-xl overflow-hidden border bg-muted"><img alt="Editorial cover" src={draft.featured_image} className="w-full aspect-video object-cover" loading="lazy" /><div className="p-3 text-xs text-muted-foreground flex gap-2"><ImageIcon className="w-4 h-4" /> Web-optimised editorial cover</div></div> : <div className="rounded-xl border bg-muted p-8 text-center text-sm text-muted-foreground">No cover selected</div>}<Label>Suggested entity links</Label><div className="flex flex-wrap gap-2">{(draft.entity_suggestions || []).map(suggestion => { const key = `${suggestion.entity_type}:${suggestion.entity_slug}`; return <Badge key={key} variant={selected.has(key) ? "default" : "outline"} className="cursor-pointer" onClick={() => setSelected(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; })}>{suggestion.label || suggestion.entity_slug}</Badge>; })}</div><Button onClick={save} disabled={busy} className="w-full">Save as Draft with image and links</Button></div>
        </div>}
      </div>
    </DialogContent></Dialog>
  </>;
}
