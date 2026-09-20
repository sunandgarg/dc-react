import { useState } from "react";
import { ChevronDown, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/detail/RichText";

interface PageSummaryProps {
  /** HTML or plain text written by admin (200-800 words). */
  html?: string | null;
  /** Optional context (e.g. "Amity Noida") used inside the heading. */
  entityName?: string;
  /** Optional kind label for the eyebrow/heading variation. */
  kind?: "college" | "course" | "exam" | "career" | "scholarship";
  className?: string;
  /** Default open state (defaults to false - collapsed). */
  defaultOpen?: boolean;
}

const HEADINGS: Record<NonNullable<PageSummaryProps["kind"]>, string[]> = {
  college: ["College at a Glance"],
  course: ["Course at a Glance"],
  exam: ["Exam at a Glance"],
  career: ["Career at a Glance"],
  scholarship: ["Scholarship at a Glance"],
};

function pickHeading(kind: PageSummaryProps["kind"], seedKey: string): string {
  const list = HEADINGS[kind || "college"] || HEADINGS.college;
  // Stable pick based on seedKey so each page keeps the same heading across renders.
  let h = 0;
  for (let i = 0; i < seedKey.length; i++) h = (h * 31 + seedKey.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

export function PageSummary({ html, entityName, kind = "college", className, defaultOpen = false }: PageSummaryProps) {
  const [open, setOpen] = useState(defaultOpen);

  const trimmed = (html || "").trim();
  if (!trimmed) return null;

  const heading = pickHeading(kind, entityName || kind);

  return (
    <section
      id="quick-summary"
      className={cn(
        "relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.06] via-background to-background scroll-mt-32",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 text-left p-4 md:p-5 group"
      >
        <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
          <CircleDot className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-primary">Quick Summary</p>
          <h2 className="text-base md:text-lg font-extrabold text-foreground leading-snug tracking-tight mt-0.5 break-words">
            {heading}
          </h2>
        </div>
        <span
          className={cn(
            "shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full border border-primary/30 bg-background text-primary transition-transform",
            open && "rotate-180 bg-primary text-primary-foreground border-primary",
            "group-hover:border-primary",
          )}
          aria-hidden
        >
          <ChevronDown className="w-4 h-4" />
        </span>
      </button>
      <div
        className={cn(
          "overflow-hidden transition-[max-height,opacity] duration-300",
          open ? "max-h-none opacity-100 px-4 md:px-5 pb-5" : "max-h-0 opacity-0",
        )}
        aria-hidden={!open}
      >
        <div className="rounded-xl border border-border bg-card p-4 md:p-5">
          <RichText html={trimmed} />
        </div>
      </div>
    </section>
  );
}
