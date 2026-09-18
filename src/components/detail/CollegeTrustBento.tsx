import { Building2, GraduationCap, Star, TrendingUp } from "lucide-react";
import { displayRating } from "@/lib/ratings";

interface Props {
  college: any;
}

function displayInstitutionType(college: any): string {
  const type = String(college?.type || "").trim();
  if (!type) return "Not published";
  if (/\b(university|college|institute|school)\b/i.test(type)) return type;

  const institutionContext = `${college?.name || ""} ${college?.category || ""}`;
  return /\buniversity\b/i.test(institutionContext) ? `${type} University` : type;
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
      iconClassName: "text-amber-500",
    },
    {
      icon: GraduationCap,
      label: "Courses",
      value: courseCount > 0 ? `${courseCount}+` : "Not published",
      iconClassName: "text-blue-600",
    },
    {
      icon: TrendingUp,
      label: "Avg Package",
      value: college.placement || "Not published",
      iconClassName: "text-emerald-500",
    },
    {
      icon: Building2,
      label: "Type",
      value: displayInstitutionType(college),
      iconClassName: "text-orange-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex min-h-[132px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-4 text-center transition-colors hover:border-slate-300 md:min-h-[172px] md:p-6"
        >
          <it.icon className={`mb-2.5 h-7 w-7 ${it.iconClassName}`} aria-hidden="true" />
          <p className="text-lg font-bold leading-snug text-slate-950 md:text-2xl">
            {it.value}
          </p>
          <p className="mt-1 text-sm text-slate-500 md:text-lg">{it.label}</p>
        </div>
      ))}
    </div>
  );
}
