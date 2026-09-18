import { Building2, GraduationCap, Star, TrendingUp } from "lucide-react";
import { displayRating } from "@/lib/ratings";

interface Props {
  college: any;
}

/**
 * The single at-a-glance stats row used near the top of every college page.
 */
export function CollegeTrustBento({ college }: Props) {
  const courseCount = Number(college.courses_count || 0);
  const items = [
    {
      icon: Star,
      label: "Rating",
      value: `${displayRating(college.rating)}/5`,
    },
    {
      icon: GraduationCap,
      label: "Courses",
      value: courseCount > 0 ? `${courseCount}+` : "Not published",
    },
    {
      icon: TrendingUp,
      label: "Avg Package",
      value: college.placement || "Not published",
    },
    {
      icon: Building2,
      label: "Type",
      value: college.type || "Not published",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-border bg-card p-4 text-center transition-colors hover:border-primary/30 hover:bg-primary/[0.02] md:min-h-36 md:p-5"
        >
          <it.icon className="mb-2 h-6 w-6 text-primary" aria-hidden="true" />
          <p className="text-base font-bold leading-snug text-foreground md:text-xl">
            {it.value}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{it.label}</p>
        </div>
      ))}
    </div>
  );
}
