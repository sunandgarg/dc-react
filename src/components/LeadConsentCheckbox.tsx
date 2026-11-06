import { Checkbox } from "@/components/ui/checkbox";
export { LEAD_CONSENT_TEXT } from "@/lib/leadConsent";

interface LeadConsentCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  textClassName?: string;
  compact?: boolean;
  dark?: boolean;
  unbranded?: boolean;
}

export function LeadConsentCheckbox({
  checked,
  onCheckedChange,
  className = "",
  textClassName = "",
  compact = false,
  dark = false,
  unbranded = false,
}: LeadConsentCheckboxProps) {
  const linkClass = dark ? "underline text-white" : "underline text-primary";

  return (
    <label className={`flex cursor-pointer items-start gap-2 ${className}`}>
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5 h-4 w-4 shrink-0"
        aria-label="Privacy and terms consent"
      />
      <span className={`${compact ? "text-[10px] leading-4" : "text-[11px] leading-tight"} ${dark ? "text-white/75" : "text-muted-foreground"} ${textClassName}`}>
        I agree to{unbranded ? " the" : " DekhoCampus"}{" "}
        <a href="/legal/privacy-policy" className={linkClass} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          Privacy Policy
        </a>{" "}
        and{" "}
        <a href="/legal/terms-of-service" className={linkClass} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          Terms & Conditions
        </a>
        . I may receive admission guidance by call, SMS, WhatsApp or email, and I can opt out anytime.
      </span>
    </label>
  );
}
