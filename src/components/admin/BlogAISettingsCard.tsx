import { useEffect, useState } from "react";
import { Image, Loader2, Newspaper, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type State = { text_model: string; image_model: string; image_quality: "low" | "medium" | "high"; gemini_key_set: boolean; openai_key_set: boolean };
const defaults: State = { text_model: "gemini-3.5-flash-lite", image_model: "gpt-image-1", image_quality: "medium", gemini_key_set: false, openai_key_set: false };

const TEXT_MODELS = [
  { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite - lowest cost" },
  { value: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
  { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
] as const;


export function BlogAISettingsCard() {
  const [settings, setSettings] = useState(defaults);
  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.functions.invoke("admin-blog-ai-settings", { method: "GET" });
    if (!error && data && !data.error) setSettings({ ...defaults, ...data, text_model: String(data.text_model || "").startsWith("gemini-") ? data.text_model : defaults.text_model, image_model: "gpt-image-1" });
  };
  useEffect(() => { void load(); }, []);

  const save = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-blog-ai-settings", { body: { gemini_api_key: geminiKey, openai_api_key: openaiKey, text_model: settings.text_model, image_model: settings.image_model, image_quality: settings.image_quality } });
      if (error || data?.error) throw error || new Error(data.error);
      setGeminiKey(""); setOpenaiKey(""); await load(); toast.success("Blog AI providers saved securely");
    } catch (error: any) { toast.error(error.message || "Could not save blog AI settings"); }
    finally { setBusy(false); }
  };

  return <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50/40 p-5 dark:border-orange-900 dark:bg-orange-950/10">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold"><Newspaper className="h-5 w-5 text-orange-500" /> Blog AI providers</h2><p className="mt-1 text-sm text-muted-foreground">Gemini Flash Lite is the lowest-cost text option for blog writing, research and structured data generation. OpenAI GPT Image is used only for optional blog imagery. Keys are write-only and are never returned to the browser.</p></div><div className="flex gap-2"><Badge variant={settings.gemini_key_set ? "default" : "destructive"}>Gemini {settings.gemini_key_set ? "ready" : "missing"}</Badge><Badge variant={settings.openai_key_set ? "default" : "destructive"}>OpenAI {settings.openai_key_set ? "ready" : "missing"}</Badge></div></div>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <Label className="flex items-center gap-2"><Newspaper className="h-4 w-4" /> Google Gemini API key</Label>
        <Input type="password" autoComplete="new-password" value={geminiKey} onChange={event => setGeminiKey(event.target.value)} placeholder={settings.gemini_key_set ? "Leave blank to keep current key" : "Paste the Gemini API key"} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2"><Label>Text provider</Label><Select value="gemini" disabled><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gemini">Google Gemini</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Default text model</Label><Select value={settings.text_model} onValueChange={(value) => setSettings({ ...settings, text_model: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TEXT_MODELS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <p className="text-xs text-muted-foreground">The same Gemini key powers Blog Studio, Auto Blog Agent, AI generation and Clean Data after their runtime controls select Gemini.</p>
      </div>
      <div className="space-y-3"><Label className="flex items-center gap-2"><Image className="h-4 w-4" /> OpenAI API key</Label><Input type="password" autoComplete="new-password" value={openaiKey} onChange={event => setOpenaiKey(event.target.value)} placeholder={settings.openai_key_set ? "Leave blank to keep current key" : "Paste a new OpenAI key"} /><div className="grid grid-cols-[1fr_auto] gap-2"><div><Label>Image model</Label><Input value={settings.image_model} onChange={event => setSettings({ ...settings, image_model: event.target.value })} /></div><div><Label>Quality</Label><select value={settings.image_quality} onChange={event => setSettings({ ...settings, image_quality: event.target.value as State["image_quality"] })} className="mt-0 h-10 rounded-md border bg-background px-3"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div></div></div>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Existing keys are never returned to the browser.</span><Button onClick={save} disabled={busy} className="gap-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save blog AI settings</Button></div>
  </div>;
}
