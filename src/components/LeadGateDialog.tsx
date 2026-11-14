import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { LeadCaptureForm } from "@/components/LeadCaptureForm";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { trackEvent } from "@/lib/analytics";
import { X } from "lucide-react";
import { silentSaveLead } from "@/lib/leadCapture";
import { getPrefillCookie } from "@/components/CookieConsent";
import { clearSessionOtpProof, getLeadSession, getSessionOtpProof, hasSubmittedLead } from "@/lib/leadSession";
import { invokeNodeFunction } from "@/lib/backendMode";

const VisuallyHidden = ({ children }: { children: React.ReactNode }) => (
  <span style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>{children}</span>
);

interface LeadGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  source?: string;
  onSuccess?: (leadId?: string, downloadUrl?: string) => void;
  otpDownload?: "jee-main-171-papers";
  /** Require a form for profile-only visitors; a submitted session lead is reused. */
  forceShow?: boolean;
  contactOnly?: boolean;
  /** Strip counselling/slots urgency for clean Apply/Brochure forms. */
  simple?: boolean;
  interestLabel?: string;
  interestOptions?: string[];
  interestedCollegeSlug?: string;
  interestedCourseSlug?: string;
  interestedExamSlug?: string;
  theme?: "default" | "cat-kit";
  brandLogoUrl?: string;
  brandName?: string;
  unbrandedConsent?: boolean;
  className?: string;
}



export function LeadGateDialog({
  open,
  onOpenChange,
  title = "🎯 Apply Now - Get Free Counseling!",
  subtitle = "Share a few details and our team will guide you.",
  source = "lead_gate",
  onSuccess,
  otpDownload,
  forceShow = false,
  contactOnly = false,
  simple = false,
  interestLabel,
  interestOptions,
  interestedCollegeSlug,
  interestedCourseSlug,
  interestedExamSlug,
  theme = "default",
  brandLogoUrl,
  brandName,
  unbrandedConsent = false,
  className = "",
}: LeadGateDialogProps) {
  const { user } = useAuth();
  const { data: profile } = useUserProfile();
  const silentRef = useRef(false);
  const lastOpenRef = useRef(false);
  const successRef = useRef(false);
  const continuationRef = useRef(0);
  const [checkingDownload, setCheckingDownload] = useState(false);
  const knownBySession = hasSubmittedLead();
  const knownByAuth = !forceShow && !!(user && profile?.phone);
  useEffect(() => () => { continuationRef.current += 1; silentRef.current = false; }, []);

  // Fire open/dismiss analytics whenever this dialog is shown anywhere on the site.
  useEffect(() => {
    if (open && !lastOpenRef.current) {
      lastOpenRef.current = true;
      successRef.current = false;
      trackEvent("lp_popup_open", { source });
    } else if (!open && lastOpenRef.current) {
      lastOpenRef.current = false;
      if (!successRef.current) trackEvent("lp_popup_dismiss", { source });
    }
  }, [open, source]);

  const handleSuccess = (leadId?: string, downloadUrl?: string) => {
    successRef.current = true;
    trackEvent("lp_popup_submit", { source });
    onSuccess?.(leadId, downloadUrl);
  };

  useEffect(() => {
    if (!open) { silentRef.current = false; continuationRef.current += 1; setCheckingDownload(false); return; }
    if (silentRef.current) return;
    if (otpDownload) {
      const lead = getLeadSession();
      const proof = getSessionOtpProof(lead.phone || "");
      if (!knownBySession || !proof) return;
      silentRef.current = true;
      const continuation = ++continuationRef.current;
      setCheckingDownload(true);
      (async () => {
        try {
          const result = await invokeNodeFunction<{ download_url: string }>("jee-paper-bundle", { body: { phone: lead.phone, otp_verification_token: proof } });
          if (result.error || !result.data?.download_url) throw result.error || new Error("Download unavailable");
          if (!lastOpenRef.current || continuation !== continuationRef.current) return;
          successRef.current = true;
          onSuccess?.(lead.leadId, result.data.download_url);
          onOpenChange(false);
        } catch {
          if (continuation === continuationRef.current) clearSessionOtpProof();
        } finally { if (continuation === continuationRef.current) setCheckingDownload(false); }
      })();
      return;
    }
    if (!knownByAuth && !knownBySession) return;
    silentRef.current = true;
    const continuation = ++continuationRef.current;

    (async () => {
      try {
        const c = getPrefillCookie();
        await silentSaveLead({
          source: `${source}_silent`,
          cta: source,
          name: knownByAuth ? (profile?.name || user?.user_metadata?.display_name || c.name || "Returning user") : c.name,
          email: knownByAuth ? (profile?.email ?? null) : (c.email ?? null),
          phone: knownByAuth ? (profile?.phone || c.phone) : c.phone,
          city: knownByAuth ? (profile?.city ?? null) : (c.city ?? null),
          state: knownByAuth ? (profile?.state ?? null) : (c.state ?? null),
          interested_college_slug: interestedCollegeSlug || null,
          interested_course_slug: interestedCourseSlug || null,
          interested_exam_slug: interestedExamSlug || null,
        });
        trackEvent("lead_intent_click", { source: `${source}_silent` });
      } catch {/* ignore - UX must not block */}
      if (!lastOpenRef.current || continuation !== continuationRef.current) return;
      successRef.current = true;
      onSuccess?.(getLeadSession().leadId);
      onOpenChange(false);
    })();
  }, [open, user, profile, source, onOpenChange, onSuccess, knownByAuth, knownBySession, otpDownload, interestedCollegeSlug, interestedCourseSlug, interestedExamSlug]);

  if (!otpDownload && open && (knownByAuth || knownBySession)) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`${theme === "cat-kit" ? "max-w-lg" : "max-w-md"} w-[calc(100vw-2rem)] sm:w-full mx-auto p-0 gap-0 rounded-2xl border-0 bg-transparent shadow-none overflow-visible [&_h3]:pr-8 [&_h3+p]:pr-8 ${className}`}
        aria-describedby={undefined}
        onPointerDownOutside={(e) => { if ((e.target as HTMLElement)?.closest?.('#searchable-select-portal-active')) e.preventDefault(); }}
        onInteractOutside={(e) => { if ((e.target as HTMLElement)?.closest?.('#searchable-select-portal-active')) e.preventDefault(); }}
      >
        <VisuallyHidden><DialogTitle>Lead Form</DialogTitle></VisuallyHidden>
        <DialogClose className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/95 text-muted-foreground shadow-sm transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>
        {checkingDownload ? <p role="status" className="rounded-2xl bg-background p-8 text-center">Preparing your verified download…</p> : <LeadCaptureForm
          variant="card"
          title={title}
          subtitle={subtitle}
          source={source}
          onSuccess={handleSuccess}
          otpDownload={otpDownload}
          contactOnly={contactOnly}
          simple={simple}
          interestLabel={interestLabel}
          interestOptions={interestOptions}
          interestedCollegeSlug={interestedCollegeSlug}
          interestedCourseSlug={interestedCourseSlug}
          interestedExamSlug={interestedExamSlug}
          brandLogoUrl={brandLogoUrl}
          brandName={brandName}
          unbrandedConsent={unbrandedConsent}
          theme={theme}
        />}
      </DialogContent>
    </Dialog>
  );
}
