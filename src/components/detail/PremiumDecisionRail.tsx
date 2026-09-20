import { StudentAvatars } from "@/components/StudentAvatars";
import { useEffect, useState } from "react";
import { Download, Star, ShieldCheck, Calendar, Clock, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IITAlumniBadge } from "@/components/IITAlumniBadge";
import { YouTubeVideoButton } from "@/components/YouTubeVideoButton";

interface Props {
  program: any;
  discountedPrice: number;
  emi: number;
  formatPrice: (n: number) => string;
  onApply: () => void;
  onBrochure: () => void;
  onCounsel: () => void;
}

/**
 * 2026 redesign - sticky decision rail for premium programs.
 * One confident next step: Apply (primary), followed by brochure and counsellor support.
 * Live countdown + social-proof interest count keep urgency contextual, not noisy.
 */
export function PremiumDecisionRail({ program, discountedPrice, emi, formatPrice, onApply, onBrochure, onCounsel }: Props) {
  const [countdown, setCountdown] = useState("");
  const instituteIdentity = [program?.college_name, program?.title, program?.slug, program?.tag]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  const isIitProgram = /(?:^|[^a-z0-9])iit(?=$|[^a-z0-9])/i.test(instituteIdentity);
  const originalPrice = Number(program?.original_price) || 0;
  const hasPrice = discountedPrice > 0 || originalPrice > 0;

  useEffect(() => {
    // Use cohort_close_at if present, else default to 3 days out.
    const deadline = (program as any).cohort_close_at
      ? new Date((program as any).cohort_close_at).getTime()
      : Date.now() + 3 * 24 * 60 * 60 * 1000;
    const tick = () => {
      const diff = Math.max(0, deadline - Date.now());
      const d = Math.floor(diff / (24 * 60 * 60 * 1000));
      const h = Math.floor((diff / (60 * 60 * 1000)) % 24);
      const m = Math.floor((diff / (60 * 1000)) % 60);
      const s = Math.floor((diff / 1000) % 60);
      if (d > 0) setCountdown(`${d}d ${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m`);
      else setCountdown(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [program]);

  const seedSrc = (program.slug || program.title || "x") as string;
  let seed = 0;
  for (let i = 0; i < seedSrc.length; i++) seed = (seed * 31 + seedSrc.charCodeAt(i)) >>> 0;
  const interestedToday = 150 + (seed % 650);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xl shadow-slate-200/60 md:p-6">
        <div className="mb-3 text-center">
          <p className="mb-1.5 text-xs text-slate-500">Cohort status</p>
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-[11px] font-bold text-[#e85d3a]">
            <span className="w-2 h-2 bg-[#e85d3a] rounded-full animate-pulse" />
            Closing in {countdown || "soon"}
          </div>
        </div>

        <div className="mb-4 text-center">
          <p className="text-slate-500 text-xs">Program Fee</p>
          <div className="flex items-baseline justify-center gap-2 flex-wrap mt-1">
            <span className="text-2xl font-extrabold text-slate-900">{hasPrice ? formatPrice(discountedPrice || originalPrice) : "Fee on request"}</span>
            {discountedPrice > 0 && originalPrice > discountedPrice && (
              <span className="text-sm line-through text-slate-400">{formatPrice(originalPrice)}</span>
            )}
          </div>
          {emi > 0 && <p className="text-xs text-blue-600 font-bold mt-1">EMI from {formatPrice(emi)}/mo · 0% interest</p>}
        </div>

        {isIitProgram && <div className="flex justify-center mb-4"><IITAlumniBadge showTagline={false} /></div>}

        <div className="space-y-2" data-testid="premium-decision-ctas">
          <div className="flex gap-2">
            <Button
              onClick={onApply}
              className="h-10 min-w-0 flex-1 rounded-xl border-0 bg-primary font-extrabold text-primary-foreground shadow-md shadow-primary/25 transition hover:-translate-y-0.5 hover:bg-primary/90"
            >
              Apply Now
            </Button>
            <YouTubeVideoButton
              url={program.youtube_url || program.hero_video_url}
              category="course"
              title={`${program.title} - Programme Video`}
              label="Watch programme video"
              iconOnly
              className="h-10 w-10 shrink-0 rounded-xl p-0"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={onBrochure}
              variant="outline"
              className="h-10 min-w-0 rounded-xl border-slate-300 px-1 text-[11px] font-bold text-slate-800 hover:bg-slate-50 sm:px-2 sm:text-sm"
            >
              <Download className="mr-1.5 h-4 w-4 shrink-0" /> Brochure
            </Button>
            <Button
              onClick={onCounsel}
              variant="outline"
              className="h-10 min-w-0 rounded-xl border-slate-300 px-1 text-[11px] font-bold text-slate-800 hover:bg-slate-50 sm:px-2 sm:text-sm"
            >
              Talk to Counsellor
            </Button>
          </div>
        </div>

        {/* Social proof */}
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-3">
            <StudentAvatars extraCount={Math.max(1, Math.floor(interestedToday / 100))} />
            <p className="text-xs text-slate-500 font-medium leading-tight">
              <span className="text-slate-900 font-bold">{interestedToday.toLocaleString()}</span> learners exploring today
            </p>
          </div>

          {Number(program.rating) > 0 && (
            <div className="flex items-center gap-2 text-blue-600 text-xs font-bold">
              <Star className="w-4 h-4 fill-current" />
              Verified Rating: {Number(program.rating).toFixed(1)} / 5.0
            </div>
          )}
        </div>

        {/* Practicalities */}
        <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
          {program.batch_start_date && (
            <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Starts {program.batch_start_date}</p>
          )}
          {program.schedule && (
            <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {program.schedule}</p>
          )}
          {program.duration && (
            <p className="flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> {program.duration}</p>
          )}
          <p className="flex items-center gap-1.5 text-emerald-600 font-semibold"><ShieldCheck className="w-3.5 h-3.5" /> 7-day money-back guarantee</p>
        </div>
      </div>
    </div>
  );
}
