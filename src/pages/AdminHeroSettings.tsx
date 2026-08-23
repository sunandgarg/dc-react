import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHeroSettings, useUpdateHeroSettings, type HeroSettings } from "@/hooks/useHeroSettings";
import { Plus, Trash2, Save } from "lucide-react";
import { useDraftState } from "@/hooks/useDraftState";
import { UploadOrUrlField } from "@/components/UploadOrUrlField";
import { Switch } from "@/components/ui/switch";
import { useSiteIntegration, useSiteIntegrationEnabled } from "@/hooks/useSiteIntegration";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MODES: HeroSettings["overlay_mode"][] = ["none", "dark", "light", "tint", "gradient"];

export default function AdminHeroSettings() {
  const { data, isLoading } = useHeroSettings();
  const update = useUpdateHeroSettings();
  const queryClient = useQueryClient();
  const { data: textGradientEnabled = true } = useSiteIntegrationEnabled("hero_text_gradient", true);
  const { data: textGradientValue = "0.72" } = useSiteIntegration("hero_text_gradient_strength");
  const textGradientStrength = Number(textGradientValue) || 0.72;
  const [draft, setDraft] = useDraftState<HeroSettings | null>('admin.hero-settings.draft.v2', null);

  useEffect(() => { if (data && !draft) setDraft(data); }, [data, draft]);

  if (isLoading || !draft) {
    return <AdminLayout title="Hero / Search Background"><div className="p-8 text-muted-foreground">Loading…</div></AdminLayout>;
  }

  const setField = <K extends keyof HeroSettings,>(k: K, v: HeroSettings[K]) => setDraft({ ...draft, [k]: v });
  const setImage = (i: number, v: string) => {
    const next = [...draft.image_urls]; next[i] = v; setField("image_urls", next);
  };
  const addImage = () => setField("image_urls", [...draft.image_urls, ""]);
  const removeImage = (i: number) => setField("image_urls", draft.image_urls.filter((_, j) => j !== i));
  const saveTextGradient = async (key: string, label: string, value: string, enabled = true) => {
    const { error } = await (supabase as any).from("site_integrations").upsert({
      key,
      label,
      category: "website",
      value,
      enabled,
      notes: `Controls homepage ${label}`,
    }, { onConflict: "key" });
    if (error) {
      toast.error(`Failed to update ${label}`);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["site-integrations", "all"] });
  };

  const previewStyle: React.CSSProperties = {
    backgroundImage: draft.image_urls[0] ? `url(${draft.image_urls[0]})` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
    filter: `blur(${draft.blur_px}px) saturate(${draft.saturation}) brightness(${draft.brightness}) grayscale(${draft.grayscale})`,
    opacity: draft.overlay_mode === "none" ? 1 : 0.95,
  };

  return (
    <AdminLayout title="Hero / Search Background">
      <p className="text-sm text-muted-foreground mb-6">
        Control the rotating background images behind the homepage hero & search bar, plus the overlay style (dark, light, tint, blur, grayscale, opacity).
      </p>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Background Images (rotates)</label>
              <Button size="sm" variant="outline" className="rounded-lg gap-1" onClick={addImage}><Plus className="w-3 h-3"/>Add</Button>
            </div>
            <div className="space-y-2">
              {draft.image_urls.length === 0 && (
                <p className="text-xs text-muted-foreground">No images yet - add at least one URL. Leave empty to fall back to defaults.</p>
              )}
              {draft.image_urls.map((url, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <UploadOrUrlField
                      label={`Background Image ${i + 1}`}
                      value={url}
                      onChange={(value) => setImage(i, value)}
                      folder="hero-backgrounds"
                      preset="heroBanner"
                      maxSizeMb={5}
                      placeholder="Paste image address or upload"
                    />
                  </div>
                  <Button size="sm" variant="outline" className="mt-6 rounded-lg text-destructive" onClick={() => removeImage(i)}><Trash2 className="w-3 h-3"/></Button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Overlay Mode</label>
              <select value={draft.overlay_mode} onChange={(e) => setField("overlay_mode", e.target.value as any)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm">
                {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tint / Overlay Color</label>
              <Input type="color" value={draft.tint_color} onChange={(e) => setField("tint_color", e.target.value)} className="h-10 rounded-xl p-1" />
            </div>
            <Slider label={`Overlay opacity (${draft.overlay_opacity.toFixed(2)})`} value={draft.overlay_opacity} min={0} max={1} step={0.05} onChange={(v) => setField("overlay_opacity", v)} />
            <Slider label={`Blur (${draft.blur_px}px)`} value={draft.blur_px} min={0} max={20} step={1} onChange={(v) => setField("blur_px", v)} />
            <Slider label={`Grayscale (${draft.grayscale.toFixed(2)})`} value={draft.grayscale} min={0} max={1} step={0.05} onChange={(v) => setField("grayscale", v)} />
            <Slider label={`Brightness (${draft.brightness.toFixed(2)})`} value={draft.brightness} min={0.3} max={1.5} step={0.05} onChange={(v) => setField("brightness", v)} />
            <Slider label={`Saturation (${draft.saturation.toFixed(2)})`} value={draft.saturation} min={0} max={2} step={0.05} onChange={(v) => setField("saturation", v)} />
            <Slider label={`Rotation (${draft.rotation_seconds}s)`} value={draft.rotation_seconds} min={4} max={30} step={1} onChange={(v) => setField("rotation_seconds", v)} />
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Text readability gradient</p>
                <p className="text-xs text-muted-foreground">Automatically places a soft gradient behind hero text when a background image is present.</p>
              </div>
              <Switch
                checked={textGradientEnabled}
                onCheckedChange={(enabled) => void saveTextGradient("hero_text_gradient", "Hero text gradient", "enabled", enabled)}
              />
            </div>
            <Slider
              label={`Gradient strength (${textGradientStrength.toFixed(2)})`}
              value={textGradientStrength}
              min={0.1}
              max={1}
              step={0.05}
              onChange={(value) => void saveTextGradient("hero_text_gradient_strength", "Hero text gradient strength", String(value))}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.is_active} onChange={(e) => setField("is_active", e.target.checked)} className="rounded" />
            Active (uncheck to fall back to default images)
          </label>

          <Button onClick={() => update.mutate(draft)} disabled={update.isPending} className="gradient-primary text-primary-foreground rounded-xl gap-2">
            <Save className="w-4 h-4"/> {update.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>

        {/* Preview */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-3">Live Preview</h3>
          <div className="relative h-72 rounded-xl overflow-hidden border border-border bg-muted">
            <div className="absolute inset-0" style={previewStyle} />
            {draft.overlay_mode !== "none" && (
              <div className="absolute inset-0" style={{
                background: draft.overlay_mode === "gradient"
                  ? `linear-gradient(180deg, ${draft.tint_color}00 0%, ${draft.tint_color}${Math.round(draft.overlay_opacity * 255).toString(16).padStart(2,"0")} 100%)`
                  : draft.overlay_mode === "tint"
                    ? `${draft.tint_color}${Math.round(draft.overlay_opacity * 255).toString(16).padStart(2,"0")}`
                    : draft.overlay_mode === "light"
                      ? `rgba(255,255,255,${draft.overlay_opacity})`
                      : `rgba(0,0,0,${draft.overlay_opacity})`,
              }} />
            )}
            <div className="absolute inset-0 flex items-center justify-center text-white font-semibold text-lg drop-shadow">Search anything…</div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full" />
    </div>
  );
}
