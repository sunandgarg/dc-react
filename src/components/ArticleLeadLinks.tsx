import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LeadConsentCheckbox, LEAD_CONSENT_TEXT } from "@/components/LeadConsentCheckbox";
import { isStrictIndianMobile, normalizeIndianMobile } from "@/lib/phone";
import { saveLeadPhase } from "@/lib/twoStepLead";

const SOCIAL_HOSTS = [
  "x.com", "twitter.com", "facebook.com", "instagram.com", "youtube.com", "youtu.be",
  "linkedin.com", "tiktok.com", "pinterest.com", "snapchat.com", "threads.net",
  "reddit.com", "whatsapp.com", "wa.me", "telegram.me", "t.me", "discord.com",
  "discord.gg", "bsky.app", "mastodon.social",
];

export function ArticleLeadLinks({ children, articleSlug, siteWide = false, onContinue = (url) => window.location.assign(url) }: {
  children?: ReactNode; articleSlug: string; siteWide?: boolean; onContinue?: (url: string) => void;
}) {
  const [destination, setDestination] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  const capture = (event: ReactMouseEvent<HTMLDivElement> | globalThis.MouseEvent) => {
    if (event.button !== 0 && event.button !== 1) return;
    if (siteWide && /^\/(?:admin|auth|dashboard|onboarding)(?:\/|$)/.test(window.location.pathname)) return;
    const anchor = (event.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!anchor || (!siteWide && anchor.dataset.leadCapture !== "true")) return;
    if (!siteWide && !(event.currentTarget as HTMLDivElement).contains(anchor)) return;
    try {
      const url = new URL(anchor.getAttribute("href") || "", window.location.href);
      if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol) || url.username || url.password) return;
      if (["http:", "https:"].includes(url.protocol) && SOCIAL_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return;
      if (siteWide && !["http:", "https:"].includes(url.protocol) && anchor.dataset.leadCapture !== "true") return;
      if (siteWide && anchor.dataset.leadCapture !== "true" && (
        url.origin === window.location.origin || url.hostname === "dekhocampus.com" || url.hostname.endsWith(".dekhocampus.com")
      )) return;
      event.preventDefault();
      event.stopPropagation();
      setDestination(url.href);
      setError("");
    } catch { /* Invalid authored URLs never become navigation targets. */ }
  };

  useEffect(() => {
    if (!siteWide) return;
    document.addEventListener("click", capture, true);
    document.addEventListener("auxclick", capture, true);
    return () => {
      document.removeEventListener("click", capture, true);
      document.removeEventListener("auxclick", capture, true);
    };
  });

  return <>
    {siteWide ? children : <div className="space-y-5" onClickCapture={capture} onAuxClickCapture={capture}>{children}</div>}
    <Dialog open={Boolean(destination)} onOpenChange={(open) => { if (!open && !submitting.current) setDestination(null); }}>
      <DialogContent className="max-w-sm p-5">
        <DialogTitle className="text-lg">Continue to the link</DialogTitle>
        <DialogDescription className="text-xs">Share your details with DekhoCampus to continue to {destination ? new URL(destination).hostname || "this link" : "this link"}.</DialogDescription>
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
              source: siteWide ? "site_link" : `article_link_${articleSlug}`,
              source_category: siteWide ? "website" : "article", cta: siteWide ? "site_link" : "article_link",
              page_url: window.location.pathname, initial_query: `Requested link site: ${new URL(destination).hostname || new URL(destination).protocol}`,
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
