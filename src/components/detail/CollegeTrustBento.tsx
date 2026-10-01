import { useRef, useState } from "react";
import { Building2, Star, TrendingUp } from "lucide-react";
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
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeCard, setActiveCard] = useState(0);
  const items = [
    {
      icon: Star,
      label: "DekhoCampus Rating",
      value: `${displayRating(college.rating)}/5`,
      iconClassName: "text-amber-500",
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

  const goToCard = (index: number) => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    carousel.scrollLeft = index * carousel.clientWidth;
    setActiveCard(index);
  };

  return (
    <div>
      <div
        ref={carouselRef}
        aria-label="College at a glance"
        onScroll={(event) => {
          const carousel = event.currentTarget;
          if (carousel.clientWidth) setActiveCard(Math.round(carousel.scrollLeft / carousel.clientWidth));
        }}
        className="flex snap-x snap-mandatory gap-0 overflow-x-auto overscroll-x-contain scrollbar-hide sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible md:gap-5"
      >
        {items.map((it) => (
          <div
            key={it.label}
            className="flex min-h-[116px] w-full shrink-0 snap-start flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-3 text-center transition-colors hover:border-slate-300 sm:w-auto sm:shrink md:min-h-[136px] md:p-4"
          >
            <it.icon className={`mb-1.5 h-6 w-6 md:mb-2 ${it.iconClassName}`} aria-hidden="true" />
            <p className="text-lg font-bold leading-snug text-slate-950 md:text-xl">
              {it.value}
            </p>
            <p className="mt-0.5 text-sm text-slate-500 md:text-base">{it.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-center gap-2 sm:hidden" aria-label="College facts carousel controls">
        {items.map((it, index) => (
          <button
            key={it.label}
            type="button"
            aria-label={`Show ${it.label}`}
            aria-current={activeCard === index ? "true" : undefined}
            onClick={() => goToCard(index)}
            className="flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className={`h-2 rounded-full transition-all ${activeCard === index ? "w-6 bg-primary" : "w-2 bg-slate-300"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
