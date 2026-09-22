import type { HTMLAttributes } from "react";

const INDIA_TIME_ZONE = "Asia/Kolkata";
const dayFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: INDIA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Returns true when an article was published on the current India calendar day. */
export function isArticlePublishedToday(createdAt: string | Date | null | undefined, now: Date = new Date()) {
  if (!createdAt) return false;
  const published = new Date(createdAt);
  if (Number.isNaN(published.getTime())) return false;
  return dayFormatter.format(published) === dayFormatter.format(now);
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
      aria-label="Live news published today"
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
