import { useState, forwardRef } from "react";
import { X, FileText, Download, Phone, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadCaptureForm } from "@/components/LeadCaptureForm";
import { LeadGateDialog } from "@/components/LeadGateDialog";
import { downloadCourseFeePDF } from "@/lib/courseFeePdf";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface MobileBottomBarProps {
  type: "college" | "course" | "exam";
  slug?: string;
  collegeName?: string;
  brochureUrl?: string;
  sections?: { id: string; label: string }[];
}

export const MobileBottomBar = forwardRef<HTMLDivElement, MobileBottomBarProps>(function MobileBottomBar({ type, slug, collegeName, brochureUrl, sections }, ref) {
  const [showAd, setShowAd] = useState(true);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showTOC, setShowTOC] = useState(false);
  const [collegeLeadAction, setCollegeLeadAction] = useState<"brochure" | "fees" | null>(null);

  const scrollToSection = (id: string) => {
    setShowTOC(false);
    const el = document.getElementById(id);
    if (el) {
      const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - 150);
      window.scrollTo({ top: y, behavior: "smooth" });
      window.history.replaceState(null, "", `#${id}`);
    }
  };

  return (
    <div ref={ref}>
      {/* Fixed bottom bar - mobile only */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
        {/* Dismissible ad banner */}
        {showAd && (
          <div className="relative bg-primary text-primary-foreground px-3 py-2 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {type === "college" && `${collegeName} - Apply Now for ${new Date().getFullYear()} Admissions`}
                {type === "course" && "Find the Best Colleges for This Course"}
                {type === "exam" && "Get Expert Preparation Strategy - Free!"}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="ml-2 text-xs h-7 px-3 rounded-full shrink-0"
              onClick={() => setShowLeadForm(true)}
            >
              Apply Now
            </Button>
            <button
              onClick={() => setShowAd(false)}
              className="ml-2 p-1 hover:bg-primary-foreground/10 rounded-full shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="bg-background border-t border-border px-3 py-2 flex items-center gap-2">
          {type === "college" && (
            <>
              <Button
                variant="outline"
                className="flex-1 h-10 rounded-xl text-sm"
                onClick={() => setCollegeLeadAction("brochure")}
              >
                <FileText className="w-4 h-4 mr-2" /> Brochure
              </Button>
              <Button
                className="flex-1 h-10 rounded-xl text-sm bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => setCollegeLeadAction("fees")}
              >
                <Download className="w-4 h-4 mr-2" /> Course & Fee
              </Button>
            </>
          )}
          {type === "course" && (
            <>
              <Button
                variant="outline"
                className="flex-1 h-10 rounded-xl text-sm gap-1.5"
                onClick={() => setShowLeadForm(true)}
              >
                <List className="w-4 h-4" /> View Colleges
              </Button>
              <Button
                className="flex-1 h-10 rounded-xl text-sm gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => setShowLeadForm(true)}
              >
                <Download className="w-4 h-4" /> Download Guide
              </Button>
            </>
          )}
          {type === "exam" && (
            <>
              <Button
                variant="outline"
                className="flex-1 h-10 rounded-xl text-sm gap-1.5"
                onClick={() => setShowLeadForm(true)}
              >
                <Phone className="w-4 h-4" /> Counselling Info
              </Button>
              <Button
                className="flex-1 h-10 rounded-xl text-sm gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => setShowLeadForm(true)}
              >
                <Download className="w-4 h-4" /> Guide
              </Button>
            </>
          )}
        </div>

        {/* Table of contents toggle */}
        {sections && sections.length > 0 && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2">
            <button
              onClick={() => setShowTOC(true)}
              className="flex items-center gap-1.5 bg-card border border-border shadow-lg rounded-full px-3 py-1.5 text-xs font-medium text-foreground"
            >
              <List className="w-3.5 h-3.5 text-primary" />
              Table of content
            </button>
          </div>
        )}
      </div>

      {/* Table of Contents popup */}
      <Dialog open={showTOC} onOpenChange={setShowTOC}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Table of Contents</DialogTitle>
          </DialogHeader>
          <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
            {sections?.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lead form dialog */}
      <Dialog open={showLeadForm} onOpenChange={setShowLeadForm}>
        <DialogContent className="max-w-md mx-auto p-0 overflow-hidden">
          <div className="p-1">
            <LeadCaptureForm
              variant="card"
              title={
                type === "college"
                  ? `Get details for ${collegeName}`
                  : type === "course"
                  ? "Get Course Details"
                  : "Get Exam Preparation Help"
              }
              source={`mobile_bottom_${type}_${slug}`}
              interestedCollegeSlug={type === "college" ? slug : undefined}
              interestedCourseSlug={type === "course" ? slug : undefined}
              interestedExamSlug={type === "exam" ? slug : undefined}
            />
          </div>
        </DialogContent>
      </Dialog>

      <LeadGateDialog
        open={collegeLeadAction !== null}
        onOpenChange={(open) => { if (!open) setCollegeLeadAction(null); }}
        title={collegeLeadAction === "brochure" ? `Download Brochure - ${collegeName}` : `Course & Fees - ${collegeName}`}
        subtitle="Share your contact details first, then add your course and location preferences."
        source={`mobile_college_${collegeLeadAction || "details"}_${slug || ""}`}
        interestedCollegeSlug={slug}
        simple
        onSuccess={() => {
          const action = collegeLeadAction;
          setCollegeLeadAction(null);
          if (action === "brochure" && brochureUrl) {
            const url = /^(https?:|\/)/i.test(brochureUrl) ? brochureUrl : `https://${brochureUrl}`;
            window.location.assign(url);
          } else if (action === "fees") {
            void downloadCourseFeePDF({ collegeSlug: slug || "", collegeName: collegeName || "College" });
          }
        }}
      />

      {/* Spacer to prevent content being hidden behind fixed bar */}
      <div className="h-24 lg:hidden" />
    </div>
  );
});
