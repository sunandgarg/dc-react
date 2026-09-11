import { useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { backendClient } from "@/integrations/backend/client";
import { Button } from "@/components/ui/button";
import { DEFAULT_SITE_SCOPE, type SiteScope } from "@/lib/siteScope";

type Props = {
  title: string;
  slug?: string;
  onGenerated: (url: string) => void;
  siteScope?: SiteScope;
};

export function ArticleCoverGenerator({ title, slug, onGenerated, siteScope = DEFAULT_SITE_SCOPE }: Props) {
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!title.trim()) {
      toast.error("Enter the article title first");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await backendClient.functions.invoke("admin-article-cover", {
        body: { title: title.trim(), slug: slug?.trim(), site_scope: siteScope },
      });
      if (error || !data?.featured_image) {
        throw error || new Error("The cover service did not return an image");
      }
      onGenerated(data.featured_image);
      toast.success("Branded cover generated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not generate the article cover";
      toast.error(message || "Could not generate the article cover");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={generate} disabled={busy} className="mt-2 gap-2">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
      Generate branded cover
    </Button>
  );
}
