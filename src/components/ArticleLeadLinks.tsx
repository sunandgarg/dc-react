import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LeadConsentCheckbox, LEAD_CONSENT_TEXT } from "@/components/LeadConsentCheckbox";
import { isStrictIndianMobile, normalizeIndianMobile } from "@/lib/phone";
import { saveLeadPhase } from "@/lib/twoStepLead";

export function ArticleLeadLinks({ children, articleSlug, onContinue = (url) => window.location.assign(url) }: {
  children: ReactNode; articleSlug: string; onContinue?: (url: string) => void;
}) {
  const [destination, setDestination] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  const capture = (event: MouseEvent<HTMLDivElement>) => {
    if (event.type === "auxclick" && event.button !== 1) return;
    const anchor = (event.target as Element).closest?.('a[data-lead-capture="true"][href]');
    if (!anchor || !event.currentTarget.contains(anchor)) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      const url = new URL(anchor.getAttribute("href") || "", window.location.href);
      if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol) || url.username || url.password) return;
      setDestination(url.href);
      setError("");
    } catch { /* Invalid authored URLs never become navigation targets. */ }
  };

  return <>
    <div className="space-y-5" onClickCapture={capture} onAuxClickCapture={capture}>{children}</div>
    <Dialog open={Boolean(destination)} onOpenChange={(open) => { if (!open && !submitting.current) setDestination(null); }}>
      <DialogContent className="max-w-sm p-5">
        <DialogTitle className="text-lg">Continue to the link</DialogTitle>
        <DialogDescription className="text-xs">Share your details with DekhoCampus to continue.</DialogDescription>
        <form className="space-y-3" onSubmit={async (event) => {
          event.preventDefault();
          if (submitting.current || !destination) return;
          if (!name.trim() || !isStrictIndianMobile(phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !consent) {
            setError("Enter your name, valid mobile and email, and accept the consent checkbox."); return;
          }
          submitting.current = true; setBusy(true); setError("");
          try {
            const saved = await saveLeadPhase({
              phase: "complete", name: name.trim(), phone, email: email.trim(),
              source: `article_link_${articleSlug}`, source_category: "article", cta: "article_link",
              page_url: window.location.pathname, initial_query: `Requested link: ${destination}`,
              otp_verified: false, consent_terms_accepted: true, consent_text: LEAD_CONSENT_TEXT,
              consent_at: new Date().toISOString(),
            });
            if (!saved.success || !saved.lead_id) throw new Error("Could not save your details. Please try again.");
            onContinue(destination);
            setDestination(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save your details. Please try again.");
          } finally { submitting.current = false; setBusy(false); }
        }}>
          <Input aria-label="Full name" autoComplete="name" placeholder="Full name" maxLength={250} value={name} onChange={(e) => setName(e.target.value)} required disabled={busy} />
          <Input aria-label="Mobile number" autoComplete="tel" type="tel" placeholder="10-digit mobile number" maxLength={15} value={phone} onChange={(e) => setPhone(normalizeIndianMobile(e.target.value))} required disabled={busy} />
          <Input aria-label="Email address" autoComplete="email" type="email" placeholder="Email address" maxLength={320} value={email} onChange={(e) => setEmail(e.target.value)} required disabled={busy} />
          <LeadConsentCheckbox checked={consent} onCheckedChange={setConsent} compact />
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !consent}>{busy ? "Saving…" : "Save & continue"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
