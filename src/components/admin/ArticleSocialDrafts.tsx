import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { articleSocialDrafts } from "@/lib/articleSocialDrafts";
import type { SiteScope } from "@/lib/siteScope";

export function ArticleSocialDrafts({ article, siteScope }: { article: { title: string; slug: string; description: string }; siteScope: SiteScope }) {
  const drafts = articleSocialDrafts(article, siteScope);
  const copy = async (caption: string) => {
    try {
      await navigator.clipboard.writeText(caption);
      toast.success("Caption copied. Review it and confirm the article is public before posting.");
    } catch {
      toast.error("Clipboard access failed. Select and copy the caption below.");
    }
  };
  return <details className="rounded-xl border p-3">
    <summary className="cursor-pointer text-sm font-medium">Social caption previews</summary>
    <p className="mt-3 text-xs text-muted-foreground">Nothing is posted automatically. Review each caption and wait until the article is published. These previews follow the current title, summary and URL slug.</p>
    {!drafts.length && <p className="mt-3 text-sm">Add a valid article slug first.</p>}
    {drafts.map(({ platform, caption }) => <div key={platform} className="mt-4 space-y-2">
      <div className="flex items-center justify-between gap-2"><label htmlFor={`social-caption-${platform}`} className="text-sm font-medium">{platform}</label><Button type="button" size="sm" variant="outline" onClick={() => copy(caption)} aria-label={`Copy ${platform} caption`}>Copy caption</Button></div>
      <Textarea id={`social-caption-${platform}`} value={caption} readOnly rows={6} className="text-xs" />
      {platform === "Instagram" && <p className="text-xs text-muted-foreground">Instagram caption links are not clickable. Use the article cover with an approved bio link or Story link instead.</p>}
    </div>)}
  </details>;
}
