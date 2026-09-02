import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadGateDialog } from "@/components/LeadGateDialog";
import { backendClient } from "@/integrations/backend/client";
import { getPrefillCookie } from "@/components/CookieConsent";
import { trackEvent } from "@/lib/analytics";

interface ApplyButtonProps {
  collegeSlug: string;
  collegeName: string;
  courseSlug?: string;
  className?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  label?: string;
  applyMode?: "lead" | "link" | "lead_then_link" | string | null;
  applyUrl?: string | null;
  onSuccessAction?: () => void | Promise<void>;
  icon?: React.ReactNode;
  formTitle?: string;
  formSubtitle?: string;
  submitLabel?: string;
}

function normalizedUrl(value?: string | null) {
  const url = String(value || "").trim();
  if (!url || url === "#") return null;
  if (/^(https?:|mailto:|tel:|\/)/i.test(url)) return url;
  return `https://${url}`;
}

function sourceFor(label: string) {
  return label.toLowerCase().includes("brochure") ? "brochure_download" : label.toLowerCase().includes("counsel") ? "counsellor_request" : "apply_button";
}

/**
 * One high-intent CTA contract for the whole site. Apply and brochure links
 * never bypass lead capture; known visitors are saved silently by the shared
 * gate, while new visitors receive the standard two-step form.
 */
export function ApplyButton({
  collegeSlug,
  collegeName,
  courseSlug = "",
  className = "",
  variant = "default",
  size = "default",
  label = "Apply Now",
  applyMode,
  applyUrl,
  onSuccessAction,
  icon,
  formTitle,
  formSubtitle,
}: ApplyButtonProps) {
  const [open, setOpen] = useState(false);
  const destination = normalizedUrl(applyUrl);
  const source = sourceFor(label);

  const handleSuccess = async () => {
    // Preserve the legacy applications workspace without making it the lead
    // source of truth. The native lead row has already been saved by the gate.
    try {
      const identity = getPrefillCookie();
      if (identity.phone) {
        await backendClient.from("college_applications").insert({
          name: identity.name || "Website lead",
          email: identity.email || null,
          phone: identity.phone,
          city: identity.city || "",
          state: identity.state || "",
          college_slug: collegeSlug,
          college_name: collegeName,
          course_slug: courseSlug,
          course_interest: courseSlug,
          message: label,
          status: "submitted",
        });
      }
    } catch {
      // The lead is already durable; legacy dashboard mirroring is non-blocking.
    }

    if (onSuccessAction) {
      try {
        await onSuccessAction();
      } catch (error) {
        console.error("Post-lead CTA action failed", error);
      }
    }
    setOpen(false);
    if (destination && (applyMode === "link" || applyMode === "lead_then_link" || label.toLowerCase().includes("brochure"))) {
      window.location.assign(destination);
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          trackEvent("cta_click", { page: courseSlug ? "course" : "college", cta: label, college_slug: collegeSlug, course_slug: courseSlug || null, apply_mode: applyMode || "lead" });
          setOpen(true);
        }}
        variant={variant}
        size={size}
        className={className}
      >
        {icon ?? <GraduationCap className="mr-2 h-4 w-4" />} {label}
      </Button>
      <LeadGateDialog
        open={open}
        onOpenChange={setOpen}
        title={formTitle || `${label} - ${collegeName}`}
        subtitle={formSubtitle || "Share your contact details, then choose your course and location."}
        source={`${source}_${collegeSlug}`}
        simple
        interestedCollegeSlug={collegeSlug}
        interestedCourseSlug={courseSlug || undefined}
        onSuccess={handleSuccess}
      />
    </>
  );
}
