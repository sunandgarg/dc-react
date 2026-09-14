import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Image as ImageIcon, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/AdminLayout";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { backendClient } from "@/integrations/backend/client";

interface MediaItem {
  name: string;
  url: string;
  size: number;
  updatedAt: string | null;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "Size unavailable";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AdminMedia() {
  const [selectedUrl, setSelectedUrl] = useState("");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState("");

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await backendClient.storage.from("admin-uploads").list("media-library", {
        limit: 500,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) throw error;
      setItems((data || [])
        .filter((file) => !file.name.startsWith(".") && !file.name.includes("/"))
        .map((file) => {
          const path = `media-library/${file.name}`;
          const { data: publicData } = backendClient.storage.from("admin-uploads").getPublicUrl(path);
          return {
            name: file.name,
            url: publicData.publicUrl,
            size: Number(file.metadata?.size || 0),
            updatedAt: file.updated_at || file.created_at || null,
          };
        }));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not load the media library");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadMedia(); }, [loadMedia]);

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? items.filter((item) => item.name.toLowerCase().includes(normalized)) : items;
  }, [items, query]);

  const copyLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success("Public image link copied");
    window.setTimeout(() => setCopiedUrl((current) => current === url ? "" : current), 1600);
  };

  return (
    <AdminLayout title="Media Library">
      <div className="space-y-5">
        <section className="border-b border-border pb-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Upload or import an image</h2>
              <p className="mt-1 text-sm text-muted-foreground">The generated AWS media URL can be reused in any content field.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadMedia()} disabled={loading} title="Refresh media">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="max-w-3xl">
            <ImageUploadField
              label="Image and public URL"
              value={selectedUrl}
              onChange={setSelectedUrl}
              folder="media-library"
              maxSizeMb={8}
              placeholder="Paste an existing image URL"
              onUploaded={() => void loadMedia()}
            />
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Uploaded images</h2>
              <p className="text-xs text-muted-foreground">{visibleItems.length} of {items.length} images</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search file names" className="pl-9" />
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading media</div>
          ) : visibleItems.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center border border-dashed border-border text-center text-muted-foreground">
              <ImageIcon className="mb-2 h-8 w-8" />
              <p className="text-sm font-medium">No matching images</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {visibleItems.map((item) => (
                <article key={item.url} className="overflow-hidden rounded-lg border border-border bg-card">
                  <button type="button" onClick={() => setSelectedUrl(item.url)} className="block aspect-square w-full bg-muted/30" title="Use this image link">
                    <img src={item.url} alt={item.name} loading="lazy" className="h-full w-full object-contain" />
                  </button>
                  <div className="p-2">
                    <p className="truncate text-xs font-semibold text-foreground" title={item.name}>{item.name}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{formatBytes(item.size)}</p>
                    <div className="mt-2 flex items-center justify-end gap-1">
                      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => void copyLink(item.url)} title="Copy public link">
                        {copiedUrl === item.url ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" asChild title="Open image">
                        <a href={item.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
