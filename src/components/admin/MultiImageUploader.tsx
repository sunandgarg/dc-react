import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { backendClient } from "@/integrations/backend/client";
import { Images, Loader2, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { optimizeImageFile } from "@/lib/imageOptimizer";
import { ImageQualityControls, useImageQuality } from "@/components/admin/ImageQualityControls";

interface Props {
  label?: string;
  value: string[];
  onChange: (urls: string[]) => void;
  folder?: string;
  bucket?: string;
  hint?: string;
  /** Optional parallel array of names (e.g. AICTE, UGC). When provided, a name input is shown for each logo. */
  names?: string[];
  onNamesChange?: (names: string[]) => void;
  namePlaceholder?: string;
}

export function MultiImageUploader({ label, value, onChange, folder = "images", bucket = "admin-uploads", hint, names, onNamesChange, namePlaceholder = "Name (e.g. AICTE)" }: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryItems, setLibraryItems] = useState<{ name: string; url: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { quality, setQuality } = useImageQuality();
  const list = value || [];
  const nameList = names || [];
  const supportsNames = !!onNamesChange;

  const setName = (i: number, v: string) => {
    if (!onNamesChange) return;
    const next = [...nameList];
    while (next.length <= i) next.push("");
    next[i] = v;
    onNamesChange(next);
  };

  const removeAt = (i: number) => {
    onChange(list.filter((_, idx) => idx !== i));
    if (onNamesChange) onNamesChange(nameList.filter((_, idx) => idx !== i));
  };

  const appendUrl = (nextUrl: string) => {
    const cleanUrl = nextUrl.trim();
    if (!cleanUrl || list.includes(cleanUrl)) return;
    onChange([...list, cleanUrl]);
    if (onNamesChange) onNamesChange([...nameList, ""]);
  };

  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const folders = [...new Set([folder, "media-library"])];
      const responses = await Promise.all(folders.map(async (sourceFolder) => {
        const { data, error } = await backendClient.storage.from(bucket).list(sourceFolder, {
          limit: 200,
          sortBy: { column: "created_at", order: "desc" },
        });
        if (error) throw error;
        return (data || [])
          .filter((file) => !file.name.startsWith(".") && !file.name.includes("/"))
          .map((file) => {
            const path = `${sourceFolder}/${file.name}`;
            const { data: publicData } = backendClient.storage.from(bucket).getPublicUrl(path);
            return { name: path, url: publicData.publicUrl };
          });
      }));
      setLibraryItems(responses.flat().filter((item, index, all) =>
        all.findIndex((candidate) => candidate.url === item.url) === index
      ));
    } catch (error: any) {
      toast.error(error.message || "Failed to load the image library");
    } finally {
      setLibraryLoading(false);
    }
  }, [bucket, folder]);

  useEffect(() => {
    if (libraryOpen) void loadLibrary();
  }, [libraryOpen, loadLibrary]);

  const handleFiles = async (files: FileList | File[]) => {
    setUploading(true);
    const next: string[] = [...list];
    const nextNames: string[] = [...nameList];
    try {
      for (const raw of Array.from(files)) {
        if (!raw.type.startsWith("image/")) { toast.error(`${raw.name} is not an image`); continue; }
        const file = quality.hd ? raw : await optimizeImageFile(raw, { maxDim: quality.maxDim });
        if (file.size > 8 * 1024 * 1024) { toast.error(`${file.name} > 8MB skipped`); continue; }
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await backendClient.storage.from(bucket).upload(path, file, { contentType: file.type });
        if (error) { toast.error(error.message); continue; }
        const { data: pub } = backendClient.storage.from(bucket).getPublicUrl(path);
        next.push(pub.publicUrl);
        nextNames.push("");
      }
      onChange(next);
      if (onNamesChange) onNamesChange(nextNames);
      toast.success(quality.hd ? "Uploaded (HD original)" : "Uploaded (WebP)");
    } finally { setUploading(false); }
  };

  return (
    <div>
      {label && <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>}
      <ImageQualityControls value={quality} onChange={setQuality} className="mb-1.5" />
      <div className={supportsNames ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-2" : "flex flex-wrap gap-2 mb-2"}>
        {list.map((u, i) => (
          <div key={i} className="relative group bg-muted/30 rounded-lg border border-border p-2">
            <img src={u} alt={nameList[i] || ""} className="h-14 w-full object-contain" />
            <button type="button" onClick={() => removeAt(i)} className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <X className="w-3 h-3" />
            </button>
            {supportsNames && (
              <Input
                value={nameList[i] || ""}
                onChange={(e) => setName(i, e.target.value)}
                placeholder={namePlaceholder}
                className="h-7 text-[11px] mt-1.5"
              />
            )}
          </div>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" multiple className="hidden" onChange={(e) => e.target.files && void handleFiles(e.target.files)} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
          if (files.length) void handleFiles(files);
          else toast.error("Drop PNG, JPG, WebP, GIF, or AVIF images");
        }}
        disabled={uploading}
        className={`mb-2 flex min-h-20 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-3 py-3 text-xs transition ${dragging ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:bg-muted/30"}`}
      >
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
        <span className="font-semibold text-foreground">{uploading ? "Uploading images..." : "Drop images here or browse"}</span>
        <span>Public AWS links are generated automatically</span>
      </button>
      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-1 items-center">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste an image URL" className="h-8 text-xs w-52" />
          <Button type="button" size="sm" variant="outline" onClick={() => { appendUrl(url); setUrl(""); }} disabled={!url.trim()} className="h-8 px-2" title="Add image URL"><Plus className="w-3.5 h-3.5" /></Button>
        </div>
        <Button type="button" size="sm" variant={libraryOpen ? "default" : "outline"} onClick={() => setLibraryOpen((open) => !open)} className="rounded-lg gap-1 h-8">
          <Images className="w-3.5 h-3.5" /> Media library
        </Button>
      </div>
      {libraryOpen && (
        <div className="mt-2 rounded-xl border border-border bg-muted/20 p-2">
          <Input value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="Search uploaded images..." className="mb-2 h-8 rounded-lg text-xs" />
          {libraryLoading ? (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading library...</div>
          ) : (
            <div className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-6">
              {libraryItems
                .filter((item) => !libraryQuery || item.name.toLowerCase().includes(libraryQuery.toLowerCase()))
                .map((item) => (
                  <button
                    key={item.url}
                    type="button"
                    onClick={() => { appendUrl(item.url); toast.success("Image added"); }}
                    className={`relative aspect-square overflow-hidden rounded-md border ${list.includes(item.url) ? "border-primary ring-2 ring-primary" : "border-border hover:border-primary/50"}`}
                    title={item.name}
                  >
                    <img src={item.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
