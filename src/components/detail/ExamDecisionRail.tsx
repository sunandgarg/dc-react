import { useState } from "react";
import { ArrowRight, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadGateDialog } from "@/components/LeadGateDialog";
import { IITAlumniBadge } from "@/components/IITAlumniBadge";
import { trackEvent } from "@/lib/analytics";
import { resolveExamLogo } from "@/lib/examBranding";

interface Props {
  exam: any;
  onDownloadSample?: () => void;
}

/**
 * 2026 redesign - sticky decision rail for an exam.
 * Primary (Apply) → Secondary (Mentor) → Tertiary (Sample Paper).
 */
export function ExamDecisionRail({ exam, onDownloadSample }: Props) {
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  const hasSamplePaper = Boolean(exam.sample_paper_url && exam.sample_paper_url !== "#");

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl p-6 md:p-7 shadow-xl shadow-slate-200/60 border border-slate-100">
        <p className="text-center text-slate-500 text-xs md:text-sm mb-6">Check the official notice for current application dates.</p>

        <div className="flex justify-center mb-4"><IITAlumniBadge showTagline={false} /></div>

        <div className="space-y-3">
          <Button
            onClick={() => {
              try { trackEvent("cta_click", { page: "exam", cta: "Apply Now", exam_slug: exam.slug, entity_name: exam.name }); } catch {}
              setDestination(exam.registration_url && exam.registration_url !== "#" ? exam.registration_url : null);
              setOpen(true);
            }}
            className="w-full h-auto bg-[#e85d3a] hover:bg-[#d14b2d] text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-200 hover:scale-[1.02] transition-transform text-sm md:text-base"
          >
            {exam.registration_url && exam.registration_url !== "#" ? <ExternalLink className="w-4 h-4 mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
            {exam.registration_url && exam.registration_url !== "#" ? "View application portal" : "Ask about applications"}
          </Button>

          <Button
            onClick={() => { try { trackEvent("cta_click", { page: "exam", cta: "Talk to Mentor", exam_slug: exam.slug, entity_name: exam.name }); } catch {}; setDestination(null); setOpen(true); }}
            variant="outline"
            className="w-full h-auto border-2 border-[#e85d3a] text-[#e85d3a] hover:bg-orange-50 font-bold py-4 rounded-2xl"
          >
            Talk to Mentor
          </Button>

          {hasSamplePaper && <Button
            onClick={() => { try { trackEvent("cta_click", { page: "exam", cta: "Download Sample Paper", exam_slug: exam.slug, entity_name: exam.name }); } catch {}; (onDownloadSample ?? (() => setOpen(true)))(); }}
            variant="ghost"
            className="w-full bg-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-semibold py-2 text-sm"
          >
            <Download className="w-4 h-4 mr-2" /> Download Sample Paper
          </Button>}
        </div>
      </div>

      <LeadGateDialog
        open={open}
        onOpenChange={setOpen}
        title={destination ? `${exam.name} application portal` : `Get prep guidance for ${exam.name}`}
        subtitle="Share your contact details, then choose your course and location."
        source={destination ? `exam_apply_${exam.slug}` : `exam_rail_${exam.slug}`}
        simple
        interestedExamSlug={exam.slug}
        brandLogoUrl={resolveExamLogo(exam)}
        brandName={exam.name}
        onSuccess={() => {
          setOpen(false);
          if (destination) window.location.assign(destination);
        }}
      />
    </div>
  );
}
