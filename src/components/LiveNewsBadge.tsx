import type { HTMLAttributes } from "react";

/** Keep recent-news badges visible across midnight, but never on stale stories. */
export function isArticlePublishedToday(createdAt: string | Date | null | undefined, now: Date = new Date()) {
  if (!createdAt) return false;
  const published = new Date(createdAt);
  if (Number.isNaN(published.getTime())) return false;
  const age = now.getTime() - published.getTime();
  return age >= 0 && age < 24 * 60 * 60 * 1000;
}

interface LiveNewsBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  intensity?: "low" | "high";
}

/** A small, accessible live indicator. Use high only for a primary hero or ticker. */
export function LiveNewsBadge({ intensity = "low", className = "", ...props }: LiveNewsBadgeProps) {
  return (
    <span
      {...props}
      role="status"
      aria-label="Recent news published within the last 24 hours"
      className={`inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white shadow-sm ${className}`}
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
        <span className={`absolute inset-0 rounded-full bg-white/80 ${intensity === "high" ? "animate-dc-live-pulse-high" : "animate-dc-live-pulse-low"}`} />
        <span className="relative m-0.5 h-1.5 w-1.5 rounded-full bg-white" />
      </span>
      Live
    </span>
  );
}
