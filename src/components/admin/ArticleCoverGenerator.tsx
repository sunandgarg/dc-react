import { useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { backendClient } from "@/integrations/backend/client";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  slug?: string;
  onGenerated: (url: string) => void;
};

export function ArticleCoverGenerator({ title, slug, onGenerated }: Props) {
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!title.trim()) {
      toast.error("Enter the article title first");
      return;
    }
    setBusy(true);
    const { data, error } = await backendClient.functions.invoke("admin-article-cover", {
      body: { title: title.trim(), slug: slug?.trim() },
    });
    setBusy(false);
    if (error || !data?.featured_image) {
      toast.error(error?.message || "Could not generate the article cover");
      return;
    }
    onGenerated(data.featured_image);
    toast.success("Branded cover generated");
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={generate} disabled={busy} className="mt-2 gap-2">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
      Generate branded cover
    </Button>
  );
}
