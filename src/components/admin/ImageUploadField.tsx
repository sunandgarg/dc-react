import { useCallback, useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { backendClient } from "@/integrations/backend/client";
import { Check, Copy, ExternalLink, Upload, Link as LinkIcon, X, Images, Loader2, CircleDot, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { ImageHint, type ImagePresetKey } from "@/components/ImageHint";
import { fetchRemoteImageFile, optimizeImageFile, optimizeRemoteImage } from "@/lib/imageOptimizer";
import { ImageQualityControls, useImageQuality } from "@/components/admin/ImageQualityControls";

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  preset?: ImagePresetKey;
  bucket?: string;
  folder?: string;
  maxSizeMb?: number;
  placeholder?: string;
  onUploaded?: (url: string) => void;
}

/**
 * Combined upload-or-URL-or-library field. Admins can paste a URL,
 * upload a new file, or pick from previously uploaded images.
 */
export function ImageUploadField({
  value,
  onChange,
  label,
  preset,
  bucket = "admin-uploads",
  folder = "images",
  maxSizeMb = 8,
  placeholder = "https://...",
  onUploaded,
}: Props) {
  const [mode, setMode] = useState<"url" | "upload" | "library">("url");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const { quality, setQuality } = useImageQuality();
  const fileRef = useRef<HTMLInputElement>(null);
  const [libItems, setLibItems] = useState<{ name: string; url: string }[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [libQuery, setLibQuery] = useState("");

  const loadLibrary = useCallback(async () => {
    setLibLoading(true);
    try {
      const folders = [...new Set([folder, "media-library"])];
      const responses = await Promise.all(folders.map(async (sourceFolder) => {
        const { data, error } = await backendClient.storage.from(bucket).list(sourceFolder, {
          limit: 200, sortBy: { column: "created_at", order: "desc" },
        });
        if (error) throw error;
        return (data || [])
          .filter((file) => !file.name.startsWith(".") && !file.name.includes("/"))
          .map((file) => {
            const path = `${sourceFolder}/${file.name}`;
            const { data: publicData } = backendClient.storage.from(bucket).getPublicUrl(path);
            return { name: `${sourceFolder}/${file.name}`, url: publicData.publicUrl };
          });
      }));
      const items = responses.flat().filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index);
      setLibItems(items);
    } catch (e: any) {
      toast.error(e.message || "Failed to load library");
    } finally {
      setLibLoading(false);
    }
  }, [bucket, folder]);

  useEffect(() => { if (mode === "library") void loadLibrary(); }, [loadLibrary, mode]);

  const handleFile = async (rawFile: File) => {
    if (!rawFile) return;
    setUploading(true);
    try {
      const file = quality.hd ? rawFile : await optimizeImageFile(rawFile, { maxDim: quality.maxDim });
      if (file.size > maxSizeMb * 1024 * 1024) { toast.error(`File must be under ${maxSizeMb} MB`); return; }
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await backendClient.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data: pub } = backendClient.storage.from(bucket).getPublicUrl(path);
      onChange(pub.publicUrl);
      onUploaded?.(pub.publicUrl);
      toast.success(quality.hd ? "Uploaded (HD original)" : "Uploaded (WebP)");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const saveLinkedImage = async () => {
    if (!/^https?:\/\//i.test(value || "")) return;
    setUploading(true);
    try {
      const file = quality.hd
        ? await fetchRemoteImageFile(value)
        : await optimizeRemoteImage(value, { maxDim: quality.maxDim });
      if (!file) {
        toast.error("This website blocks image downloads. Upload the original file instead.");
        return;
      }
      if (file.size > maxSizeMb * 1024 * 1024) {
        toast.error(`Linked image is over ${maxSizeMb} MB`);
        return;
      }
      const ext = file.name.split(".").pop() || (quality.hd ? "jpg" : "webp");
      const path = `${folder}/${Date.now()}-linked-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await backendClient.storage.from(bucket).upload(path, file, {
        upsert: false,
        contentType: file.type,
        cacheControl: "31536000",
      });
      if (error) throw error;
      const { data: pub } = backendClient.storage.from(bucket).getPublicUrl(path);
      onChange(pub.publicUrl);
      onUploaded?.(pub.publicUrl);
      toast.success(quality.hd ? "HD original saved to your storage" : "Linked image optimized and saved");
    } catch (e: any) {
      toast.error(e.message || "Could not save linked image");
    } finally {
      setUploading(false);
    }
  };

  const filtered = libQuery
    ? libItems.filter((i) => i.name.toLowerCase().includes(libQuery.toLowerCase()))
    : libItems;

  const copyUrl = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success("Image link copied");
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div>
      {label && <label className="text-xs text-muted-foreground mb-1 block">{label}</label>}
      <div className="flex flex-wrap gap-1 mb-1.5">
        <Button type="button" size="sm" variant={mode === "url" ? "default" : "outline"} onClick={() => setMode("url")} className="rounded-lg h-7 text-xs gap-1">
          <LinkIcon className="w-3 h-3" /> Link
        </Button>
        <Button type="button" size="sm" variant={mode === "upload" ? "default" : "outline"} onClick={() => setMode("upload")} className="rounded-lg h-7 text-xs gap-1">
          <Upload className="w-3 h-3" /> Upload
        </Button>
        <Button type="button" size="sm" variant={mode === "library" ? "default" : "outline"} onClick={() => setMode("library")} className="rounded-lg h-7 text-xs gap-1">
          <Images className="w-3 h-3" /> Library
        </Button>
      </div>
      {mode === "url" && (
        <div className="space-y-1.5">
          <ImageQualityControls value={quality} onChange={setQuality} />
          <div className="flex gap-2">
            <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="rounded-xl min-w-0" />
            <Button
              type="button"
              variant="outline"
              onClick={saveLinkedImage}
              disabled={uploading || !/^https?:\/\//i.test(value || "") || value.includes("/storage/v1/object/public/")}
              className="rounded-xl gap-1.5 shrink-0"
              title={quality.hd ? "Copy the original linked image to your storage without reducing quality" : "Optimize the linked image and save it to your storage"}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : quality.hd ? <CircleDot className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{quality.hd ? "Save HD copy" : "Optimize & save"}</span>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {quality.hd ? "HD keeps the source image at its original resolution and format." : "Copies the external image to your storage and optimizes it for faster loading."}
          </p>
        </div>
      )}
      {mode === "upload" && (
        <div>
          <ImageQualityControls value={quality} onChange={setQuality} className="mb-1.5" />
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = Array.from(event.dataTransfer.files).find((candidate) => candidate.type.startsWith("image/"));
              if (file) void handleFile(file);
              else toast.error("Drop a PNG, JPG, WebP, GIF, or AVIF image");
            }}
            disabled={uploading}
            className={`flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-sm transition ${dragging ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:bg-muted/30"}`}
          >
            {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
            <span className="font-semibold text-foreground">{uploading ? "Uploading..." : "Drop an image here or browse"}</span>
            <span className="text-xs">A public AWS media link is generated after upload</span>
          </button>
        </div>
      )}
      {mode === "library" && (
        <div className="border border-border rounded-xl p-2 bg-muted/20">
          <Input value={libQuery} onChange={(e) => setLibQuery(e.target.value)} placeholder="Search library..." className="rounded-lg h-8 mb-2 text-xs" />
          {libLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-6">No images in library yet - upload one first.</div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-56 overflow-y-auto">
              {filtered.map((it) => (
                <button
                  key={it.name}
                  type="button"
                  onClick={() => { onChange(it.url); toast.success("Selected"); }}
                  className={`relative aspect-square rounded-md overflow-hidden border ${value === it.url ? "border-primary ring-2 ring-primary" : "border-border hover:border-primary/50"}`}
                  title={it.name}
                >
                  <img src={it.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {value && (
        <div className="mt-2 flex items-center gap-2 p-2 bg-muted/40 rounded-lg">
          <img src={value} alt="" className="w-10 h-10 rounded bg-white object-contain p-0.5" />
          <span className="text-xs text-muted-foreground truncate flex-1">{value}</span>
          <Button type="button" size="sm" variant="ghost" onClick={copyUrl} className="h-7 w-7 p-0" title="Copy public image link">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
          <Button type="button" size="sm" variant="ghost" asChild className="h-7 w-7 p-0" title="Open image">
            <a href={value} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5" /></a>
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")} className="h-6 w-6 p-0">
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
      {preset && <ImageHint preset={preset} />}
    </div>
  );
}
