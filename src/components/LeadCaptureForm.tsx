import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, User, Mail, Phone, MapPin, Loader2, CheckCircle, BookOpen, GraduationCap } from "lucide-react";
import { IITAlumniBadge } from "@/components/IITAlumniBadge";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useStatesAndCities } from "@/hooks/useLocations";
import { educationStatus } from "@/data/indianLocations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import dcLogo from "@/assets/dc-lead-logo.png";
import { useUserProfile } from "@/hooks/useUserProfile";
import { getPrefillCookie, savePrefillCookie } from "@/components/CookieConsent";
import { markLeadSubmitted } from "@/lib/leadCapture";
import { useInlineOtp, isValidIndianMobile, PHONE_HINT, sanitizeIndianMobile } from "@/components/LeadInlineOtp";
import { ProgramModeToggle, type ProgramMode } from "@/components/ProgramModeToggle";
import { detectDeviceType, inferSourceCategory } from "@/lib/leadTracking";
import { trackEvent, trackLeadConversion } from "@/lib/analytics";
import { LeadConsentCheckbox, LEAD_CONSENT_TEXT } from "@/components/LeadConsentCheckbox";
import { setLeadConsentPreference } from "@/lib/leadConsent";
import { saveLeadPhase } from "@/lib/twoStepLead";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LeadCaptureFormProps {
  variant?: "inline" | "card" | "banner" | "sidebar";
  title?: string;
  subtitle?: string;
  source?: string;
  interestedCollegeSlug?: string;
  interestedCourseSlug?: string;
  interestedExamSlug?: string;
  onSuccess?: () => void;
  /** Optional context-specific replacement for the default course interest. */
  interestLabel?: string;
  interestOptions?: string[];
  /** Strip urgency hooks (slots/counselling pitch) and tagline. Used for high-intent Apply/Brochure CTAs. */
  simple?: boolean;
}

const courseOptions = [
  "B.Tech / B.E.", "MBBS / BDS", "B.Com / BBA / MBA", "B.Sc / M.Sc",
  "B.A / M.A", "Law (LLB)", "Design / Architecture",
  "Other UG Program", "Other PG Program", "Other UG Medical", "Other PG Medical",
  "Other",
];

const stateOptions = [
  "Andhra Pradesh", "Bihar", "Delhi NCR", "Gujarat", "Haryana", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Punjab", "Rajasthan",
  "Tamil Nadu", "Telangana", "Uttar Pradesh", "West Bengal", "Other",
];

export function LeadCaptureForm({ 
  variant = "card", 
  title = "Get Free Counseling",
  subtitle = "Talk to our expert counselors for personalized college recommendations",
  source = "website_form",
  interestedCollegeSlug,
  interestedCourseSlug,
  interestedExamSlug,
  onSuccess,
  interestLabel = "Course",
  interestOptions = courseOptions,
  simple = false,
}: LeadCaptureFormProps) {
  const interestPrompt = interestLabel === "Course" ? "Interested Course" : interestLabel;
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", course: "", state: "", city: "",
  });
  const [errors, setErrors] = useState<{ name?: string; email?: string; course?: string; state?: string; city?: string }>({});
  const [filledTracked, setFilledTracked] = useState<{ name?: boolean; email?: boolean; phone?: boolean }>({});
  const [programMode, setProgramMode] = useState<ProgramMode>("regular");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(true);
  const { data: locations } = useStatesAndCities();
  const { data: profile } = useUserProfile();

  // Derive form key from source so admin per-form OTP channel override applies.
  const formKey = (() => {
    const s = (source || "").toLowerCase();
    if (s.includes("popup")) return "popup";
    if (s.includes("loan")) return "loan";
    if (s.includes("landing")) return "landing";
    if (s.includes("trending")) return "trending_program";
    if (variant === "sidebar" || s.includes("sidebar")) return "sidebar";
    return "sidebar";
  })();
  const otp = useInlineOtp(formData.phone, formKey);

  // Prefill from cookie first (instant), then from logged-in profile when ready.
  useEffect(() => {
    const c = getPrefillCookie();
    setFormData((prev) => ({
      name: prev.name || c.name || "",
      email: prev.email || c.email || "",
      phone: prev.phone || sanitizeIndianMobile(c.phone || ""),
      course: prev.course,
      state: prev.state || c.state || "",
      city: prev.city || c.city || "",
    }));
  }, []);

  useEffect(() => {
    if (!profile) return;
    setFormData((prev) => ({
      name: prev.name || profile.name,
      email: prev.email || profile.email,
      phone: prev.phone || sanitizeIndianMobile(profile.phone || ""),
      course: prev.course,
      state: prev.state || profile.state,
      city: prev.city || profile.city,
    }));
  }, [profile]);

  const update = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === "name" || field === "email") {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    // Track first meaningful fill per field
    if ((field === "name" || field === "email" || field === "phone") && value.trim() && !filledTracked[field as "name" | "email" | "phone"]) {
      setFilledTracked(prev => ({ ...prev, [field]: true }));
      trackEvent("lead_form_field_filled", { field, source, variant });
    }
  };

  const identityPayload = () => ({
    phase: "identity",
    name: formData.name.trim(),
    email: formData.email.trim().toLowerCase(),
    phone: sanitizeIndianMobile(formData.phone),
    source,
    cta: source,
    page_url: typeof window !== "undefined" ? window.location.pathname + window.location.search : null,
    otp_verified: otp.verified,
    device_type: detectDeviceType(),
    source_category: inferSourceCategory(source),
    consent_terms_accepted: authorized,
    consent_text: LEAD_CONSENT_TEXT,
    consent_at: new Date().toISOString(),
  });

  const submitLead = async () => {
    setIsLoading(true);
    try {
      await saveLeadPhase({
          ...identityPayload(),
          phase: "complete",
          lead_id: leadId,
          city: formData.city || null, state: formData.state || null,
          current_situation: formData.course || null, source,
          cta: source,
          page_url: typeof window !== "undefined" ? window.location.pathname + window.location.search : null,
          interested_college_slug: interestedCollegeSlug || null,
          interested_course_slug: interestedCourseSlug || null,
          interested_exam_slug: interestedExamSlug || null,
          otp_verified: otp.verified,
          program_mode: programMode,
          device_type: detectDeviceType(),
          source_category: inferSourceCategory(source),
          consent_terms_accepted: authorized,
          consent_text: LEAD_CONSENT_TEXT,
          consent_at: new Date().toISOString(),
      });
        setIsSubmitted(true);
        toast.success("Thank you! Our counselor will contact you soon.");
        setLeadConsentPreference(authorized);
        savePrefillCookie({ name: formData.name, email: formData.email, phone: formData.phone, state: formData.state, city: formData.city });
        markLeadSubmitted();
        try { (window as any).fireGoogleAdsConversion?.({ value: 1, currency: "INR", source }); } catch {}
        trackLeadConversion({ source, variant, has_email: !!formData.email, has_phone: !!formData.phone });
        trackEvent("lead_form_submit_success", { source, variant });
        onSuccess?.();
    } catch (error) {
      console.error("Lead submission error:", error);
      trackEvent("lead_form_submit_error", { source, variant });
      toast.error("Failed to submit. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    trackEvent("lead_form_submit_attempt", { source, variant });

    const newErrors: { name?: string; email?: string; course?: string; state?: string; city?: string } = {};
    if (step === 1 && !formData.name.trim()) {
      newErrors.name = "Please enter your name";
    } else if (step === 1 && formData.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    }
    if (step === 1 && !formData.email.trim()) {
      newErrors.email = "Please enter your email";
    } else if (step === 1 && formData.email.trim() && !EMAIL_REGEX.test(formData.email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }
    if (step === 2 && !formData.course?.trim()) {
      newErrors.course = `Please select your ${interestLabel.toLowerCase()}`;
    }
    if (step === 2 && !formData.state?.trim()) {
      newErrors.state = "Please select your state";
    }
    if (step === 2 && !formData.city?.trim()) {
      newErrors.city = "Please select your city";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      trackEvent("lead_form_validation_error", { source, variant, fields: Object.keys(newErrors).join(",") });
      toast.error(newErrors.name || newErrors.email || newErrors.course || newErrors.state || newErrors.city || "Please fix the errors");
      return;
    }
    if (step === 1 && !isValidIndianMobile(formData.phone)) {
      trackEvent("lead_form_validation_error", { source, variant, fields: "phone" });
      toast.error(PHONE_HINT);
      return;
    }
    setErrors({});
    // OTP rule: if user pressed Get OTP they MUST verify before save.
    // If they never pressed Get OTP, save anyway with otp_verified=false.
    if (step === 1 && otp.requested && !otp.verified) {
      otp.markMissing();
      trackEvent("lead_form_validation_error", { source, variant, fields: "otp" });
      return;
    }
    if (step === 1) {
      setIsLoading(true);
      try {
        const saved = await saveLeadPhase(identityPayload());
        setLeadId(saved.lead_id);
        setLeadConsentPreference(authorized);
        savePrefillCookie({ name: formData.name, email: formData.email, phone: formData.phone });
        setStep(2);
        trackEvent("lead_form_identity_saved", { source, variant, returning: Boolean(saved.existing_count) });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save your details");
      } finally {
        setIsLoading(false);
      }
      return;
    }
    await submitLead();
  };

  const otpPortal: React.ReactNode = null;



  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`
          ${variant === "card" ? "bg-card rounded-2xl border border-border p-5 shadow-soft" : ""}
          ${variant === "banner" ? "bg-primary rounded-2xl p-5 text-primary-foreground" : ""}
          ${variant === "sidebar" ? "bg-card rounded-2xl border border-border p-4" : ""}
          ${variant === "inline" ? "bg-muted/50 rounded-xl p-4" : ""}
        `}
      >
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-7 h-7 text-success" />
          </div>
          <h3 className={`text-lg font-bold mb-2 ${variant === "banner" ? "text-primary-foreground" : "text-foreground"}`}>
            Thank You! 🎉
          </h3>
          <p className={`text-sm ${variant === "banner" ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
            Our expert counselor will call you within 24 hours
          </p>
        </div>
        {otpPortal}
      </motion.div>
    );
  }

  const selectCls = "w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none";

  const LogoBadge = () => (
    <img src={dcLogo} alt="DekhoCampus" className="h-8 w-8 object-contain" />
  );

  const TwoStepFields = ({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) => (
    <>
      {step === 1 ? (
        <>
          <div className="space-y-1">
            <Input value={formData.name} onChange={e => update("name", e.target.value)} placeholder="Your name *" aria-invalid={!!errors.name} className={`${compact ? "h-9" : "h-10"} rounded-xl ${dark ? "border-white/15 bg-white/10 text-white placeholder:text-white/60" : ""} ${errors.name ? "border-destructive" : ""}`} required />
            {errors.name && <p className={`text-xs ${dark ? "text-white" : "text-destructive"}`}>{errors.name}</p>}
          </div>
          <div className="space-y-1">
            <Input value={formData.email} onChange={e => update("email", e.target.value)} placeholder="Email address *" type="email" aria-invalid={!!errors.email} className={`${compact ? "h-9" : "h-10"} rounded-xl ${dark ? "border-white/15 bg-white/10 text-white placeholder:text-white/60" : ""} ${errors.email ? "border-destructive" : ""}`} required />
            {errors.email && <p className={`text-xs ${dark ? "text-white" : "text-destructive"}`}>{errors.email}</p>}
          </div>
          <div className="space-y-1">
            <div className="flex items-stretch gap-2">
              <Input value={formData.phone} onChange={e => update("phone", sanitizeIndianMobile(e.target.value))} placeholder="Mobile number *" type="tel" maxLength={10} className={`${compact ? "h-9" : "h-10"} min-w-0 flex-1 rounded-xl ${dark ? "border-white/15 bg-white/10 text-white placeholder:text-white/60" : ""}`} required />
              <div className={dark ? "[&_button]:!bg-white [&_button]:!text-slate-900" : ""}>{otp.getOtpButton}</div>
            </div>
            {formData.phone.length > 0 && !isValidIndianMobile(formData.phone) && <p className={`text-xs ${dark ? "text-white" : "text-destructive"}`}>{PHONE_HINT}</p>}
            {otp.verifyBlock && <div className={dark ? "rounded-xl bg-white p-2 text-slate-900" : ""}>{otp.verifyBlock}</div>}
          </div>
          <LeadConsentCheckbox checked={authorized} onCheckedChange={setAuthorized} compact={compact} dark={dark} />
        </>
      ) : (
        <>
          <select value={formData.course} onChange={e => update("course", e.target.value)} className={`${selectCls} ${compact ? "h-9 py-1" : "h-10"} ${dark ? "border-white/15 bg-white/10 text-white [&>option]:text-slate-900" : ""} ${errors.course ? "border-destructive" : ""}`} required>
            <option value="">{interestPrompt} *</option>
            {interestOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {errors.course && <p className={`text-xs ${dark ? "text-white" : "text-destructive"}`}>{errors.course}</p>}
          <div className="grid grid-cols-2 gap-2">
            <SearchableSelect options={locations?.states || []} value={formData.state} onChange={(v) => { update("state", v); update("city", ""); }} placeholder="State *" />
            <SearchableSelect options={formData.state ? (locations?.citiesByState[formData.state] || []) : []} value={formData.city} onChange={(v) => update("city", v)} placeholder={formData.state ? "City *" : "Select state"} />
          </div>
          {(errors.state || errors.city) && <p className={`text-xs ${dark ? "text-white" : "text-destructive"}`}>{errors.state || errors.city}</p>}
          <ProgramModeToggle value={programMode} onChange={setProgramMode} compact={compact} />
        </>
      )}
      <Button type="submit" className={`w-full rounded-xl ${compact ? "h-9" : "h-10"} ${dark ? "bg-white text-primary hover:bg-slate-100" : "bg-primary text-primary-foreground hover:bg-primary/90"}`} disabled={isLoading}>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : step === 1 ? "Save & continue" : "Complete request"}
      </Button>
    </>
  );

  // Card variant
  if (variant === "card") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="bg-card rounded-2xl border border-border p-4 shadow-soft"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img src={dcLogo} alt="DekhoCampus" className="w-10 h-10 object-contain" />
            <div>
              <h3 className="text-sm font-bold text-foreground">{title}</h3>
              {simple ? (
                <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
              ) : (
                <IITAlumniBadge className="mt-1" />
              )}
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <TwoStepFields />
        </form>
        {otpPortal}
      </motion.div>
    );
  }

  // Banner variant
  if (variant === "banner") {
    if (simple) {
      return (
        <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-900 via-blue-950 to-primary p-5 text-white shadow-2xl md:p-7">
          <div className="mx-auto grid max-w-5xl items-center gap-6 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <span className="inline-flex rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-extrabold text-emerald-200 ring-1 ring-emerald-300/20">Personalised guidance with a fast shortlist</span>
              <h3 className="mt-3 text-2xl font-extrabold leading-tight md:text-3xl">Let an expert simplify your decision</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-white/70">Share only the essentials. We will help you shortlist the right options and next steps.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-2.5">
              <TwoStepFields dark />
            </form>
          </div>
        </motion.div>
      );
    }
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="bg-primary rounded-2xl p-4 md:p-6"
      >
        <div className="flex flex-col items-center gap-5 md:gap-6">
          <div className="text-center max-w-2xl flex flex-col items-center">
            <h3 className="text-xl md:text-3xl font-bold text-primary-foreground mb-2 leading-tight">{title}</h3>
            <IITAlumniBadge />
            <p className="text-primary-foreground/90 text-sm md:text-base mt-2">{subtitle}</p>
          </div>
          <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto space-y-2.5">
            <TwoStepFields dark />
          </form>
        </div>
        {otpPortal}
      </motion.div>
    );
  }

  // Sidebar variant
  if (variant === "sidebar") {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="bg-card rounded-2xl border border-border p-4"
      >
        <div className="text-center mb-3">
          <img src={dcLogo} alt="DekhoCampus" className="w-10 h-10 object-contain mx-auto mb-2" />
          <h4 className="font-bold text-foreground text-sm">{title}</h4>
          <IITAlumniBadge className="mt-1.5" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          <TwoStepFields compact />
        </form>
        {otpPortal}
      </motion.div>
    );
  }

  // Inline variant
  return (
    <div className="bg-muted/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <IITAlumniBadge className="mt-1" />
        </div>
        <img src={dcLogo} alt="DekhoCampus" className="h-7 w-7 object-contain" />
      </div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <TwoStepFields compact />
      </form>
      {otpPortal}
    </div>
  );
}
