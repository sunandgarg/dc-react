import type { ReactNode } from "react";
import { Link2, Mail, Send, Share2 } from "lucide-react";
import { toast } from "sonner";
import { GoogleAd } from "@/components/ads/GoogleAd";

interface EntityDetailSidebarProps {
  pageKey: "college-detail" | "course-detail" | "exam-detail";
  title: string;
  leadForm: ReactNode;
  children: ReactNode;
}

export function EntityDetailSidebar({ pageKey, title, leadForm, children }: EntityDetailSidebarProps) {
  const shareUrl = typeof window === "undefined" ? "" : window.location.href;
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  return (
    <aside className="hidden min-w-0 self-stretch lg:flex lg:flex-col" aria-label="Page actions and free guidance">
      <section className="overflow-hidden rounded-2xl border border-border bg-card p-2" aria-label="Advertisement">
        <p className="pb-1 text-center text-[10px] font-medium uppercase text-muted-foreground">Advertisement</p>
        <GoogleAd
          placement="article"
          position="sidebar"
          pageKey={pageKey}
          format="rectangle"
          fullWidthResponsive={false}
          reservedHeight={250}
          className="mx-auto h-[250px] w-full max-w-[336px]"
        />
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm" aria-label="Share this page">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Keep this page handy</p>
            <h2 className="mt-1 text-sm font-bold text-foreground">Share this guide</h2>
          </div>
          <Share2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
          <button type="button" onClick={copyLink} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-2 transition-colors hover:border-primary/40 hover:text-primary">
            <Link2 className="h-4 w-4" /> Copy link
          </button>
          <a href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-2 transition-colors hover:border-primary/40 hover:text-primary">
            <Send className="h-4 w-4" /> WhatsApp
          </a>
          <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-2 transition-colors hover:border-primary/40 hover:text-primary">
            <Share2 className="h-4 w-4" /> LinkedIn
          </a>
          <a href={`mailto:?subject=${encodedTitle}&body=${encodedUrl}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-2 transition-colors hover:border-primary/40 hover:text-primary">
            <Mail className="h-4 w-4" /> Email
          </a>
        </div>
      </section>

      <div className="relative mt-4 min-h-[26rem] flex-1">
        <div className="sticky top-[6.5rem] max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain rounded-2xl">
          {leadForm}
        </div>
      </div>

      <div className="space-y-4 pt-4">{children}</div>
    </aside>
  );
}
