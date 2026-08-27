import { useEffect, useState } from "react";
import { Download, Lock, Phone, FileText, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { backendClient } from "@/integrations/backend/client";
import { toast } from "sonner";
import { trackEvent, trackLeadConversion } from "@/lib/analytics";
import { normalizeIndianMobile } from "@/lib/phone";
import { functionUrl } from "@/lib/backendMode";
import { LeadConsentCheckbox } from "@/components/LeadConsentCheckbox";
import { setLeadConsentPreference } from "@/lib/leadConsent";

const SEND_OTP_URL = functionUrl("send-otp");

export interface ResourceItem {
  title: string;
  subtitle?: string;
  url?: string;        // for free resources
  preview?: string;    // small visible teaser for locked
}

export type GateMethod = "otp" | "form";

export interface ExamAd {
  free_downloads: ResourceItem[];
  locked_premium: ResourceItem[];
  lead_only: ResourceItem[];
  locked_gate: GateMethod;
  lead_only_gate: GateMethod;
}

export function ExamAdBlocks({ data, slug }: { data: ExamAd; slug: string }) {
  return (
    <div className="space-y-12 px-5 md:px-12 py-10 md:py-14">
      <FreeBlock items={data.free_downloads || []} />
      <LockedBlock items={data.locked_premium || []} gate={data.locked_gate || "form"} slug={slug} kind="locked_premium" />
      <LeadOnlyBlock items={data.lead_only || []} gate={data.lead_only_gate || "form"} slug={slug} />
    </div>
  );
}

function FreeBlock({ items }: { items: ResourceItem[] }) {
  if (!items.length) return null;
  return (
    <section>
      <SectionHeader
        eyebrow="Free for everyone"
        title="Last 10 years' question papers & sample papers"
        subtitle="No login. No spam. Tap to download."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((it, i) => (
          <a
            key={i}
            href={it.url || "#"}
            target={it.url?.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            download={it.url ? true : undefined}
            className="lp-card p-4 flex items-center gap-3 hover:-translate-y-0.5 transition"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{it.title}</div>
              {it.subtitle && <div className="text-xs opacity-70 truncate">{it.subtitle}</div>}
            </div>
            <Download className="w-4 h-4 opacity-60" />
          </a>
        ))}
      </div>
    </section>
  );
}

function LockedBlock({ items, gate, slug, kind }: { items: ResourceItem[]; gate: GateMethod; slug: string; kind: string }) {
  const [unlockedFor, setUnlockedFor] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<number | null>(null);
  if (!items.length) return null;

  const onUnlock = (i: number) => {
    setUnlockedFor((prev) => new Set(prev).add(i));
    setOpen(null);
  };

  return (
    <section>
      <SectionHeader
        eyebrow="Premium · unlock free"
        title="Most-important questions & topper notes"
        subtitle="Unlock instantly - we just need to know you're a real student."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((it, i) => {
          const unlocked = unlockedFor.has(i);
          return (
            <div key={i} className="lp-card p-4 relative overflow-hidden">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${unlocked ? "bg-[var(--lp-accent)] text-[var(--lp-primary)]" : "bg-amber-50 text-amber-600"}`}>
                  {unlocked ? <CheckCircle2 className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{it.title}</div>
                  {it.preview && <div className="text-xs opacity-70 mt-1 line-clamp-2">{it.preview}</div>}
                </div>
              </div>

              {!unlocked ? (
                <Button
                  type="button"
                  className="lp-btn-primary w-full mt-3 rounded-md"
                  onClick={() => setOpen(i)}
                >
                  Unlock now
                </Button>
              ) : (
                <a
                  href={it.url || "#"}
                  target={it.url?.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center justify-center w-full gap-2 rounded-md py-2 text-sm font-semibold text-[var(--lp-primary)] border"
                >
                  <Download className="w-4 h-4" /> Download
                </a>
              )}

              {open === i && (
                <UnlockOverlay
                  gate={gate}
                  slug={slug}
                  source={`${kind}:${it.title}`}
                  onSuccess={() => onUnlock(i)}
                  onClose={() => setOpen(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LeadOnlyBlock({ items, gate, slug }: { items: ResourceItem[]; gate: GateMethod; slug: string }) {
  const [opened, setOpened] = useState(false);
  const [done, setDone] = useState(false);
  if (!items.length) return null;
  return (
    <section>
      <SectionHeader
        eyebrow="Counsellor-only"
        title="1-on-1 mentor call & personalised plan"
        subtitle="Talk to a real counsellor. We respond within 24 hours."
      />
      <div className="lp-card p-5 md:p-6 max-w-3xl">
        <ul className="grid sm:grid-cols-2 gap-2 mb-4">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-[var(--lp-primary)] mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">{it.title}</div>
                {it.subtitle && <div className="text-xs opacity-70">{it.subtitle}</div>}
              </div>
            </li>
          ))}
        </ul>
        {done ? (
          <div className="rounded-md border bg-emerald-50 text-emerald-800 px-4 py-3 text-sm">
            ✓ Thanks! Our advisor will call you within 24 hours.
          </div>
        ) : (
          <Button type="button" className="lp-btn-primary rounded-md px-6 py-5" onClick={() => setOpened(true)}>
            <Phone className="w-4 h-4 mr-2" /> Get a call back
          </Button>
        )}
        {opened && (
          <UnlockOverlay
            gate={gate}
            slug={slug}
            source="lead_only:callback"
            onSuccess={() => { setDone(true); setOpened(false); }}
            onClose={() => setOpened(false)}
          />
        )}
      </div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      {eyebrow && <span className="lp-tag inline-block px-3 py-1 rounded-full text-[11px] font-semibold mb-2">{eyebrow}</span>}
      <h2 className="text-2xl md:text-3xl font-extrabold">{title}</h2>
      {subtitle && <p className="opacity-70 mt-1">{subtitle}</p>}
    </div>
  );
}

function UnlockOverlay({ gate, slug, source, onSuccess, onClose }: { gate: GateMethod; slug: string; source: string; onSuccess: () => void; onClose: () => void }) {
  const [step, setStep] = useState<"form" | "otp">(gate === "otp" ? "otp" : "form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(true);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  const submitLead = async () => {
    if (!/^[6-9]\d{9}$/.test(phone)) return toast.error("Enter a valid 10-digit Indian mobile number");
    if (gate === "form" && !name.trim()) return toast.error("Name is required");
    setBusy(true);
    const { error } = await (backendClient as any).from("landing_page_leads").insert({
      landing_slug: slug, name: name || phone, phone,
      page_url: window.location.href, referrer: document.referrer, consent: consentAccepted,
      utm_content: source,
    });
    setBusy(false);
    if (error) return toast.error("Could not submit - please try again");
    setLeadConsentPreference(consentAccepted);
    trackLeadConversion({ lp_type: "exam_ad", lp_slug: slug, source, gate });
    trackEvent("lp_unlock_success", { lp_type: "exam_ad", lp_slug: slug, source, gate: "form" });
    onSuccess();
  };

  const sendOtp = async (resend = false) => {
    if (!/^[6-9]\d{9}$/.test(phone)) return toast.error("Enter a valid 10-digit Indian mobile number");
    setOtpSent(true);
    setOtp("");
    setResendCooldown(45);
    setBusy(true);
    try {
      const response = await fetch(SEND_OTP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: `+91${phone}`,
          channel: "sms",
          action: resend ? "resend" : "send",
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || "Could not send OTP");
      trackEvent("lp_otp_sent", { lp_type: "exam_ad", lp_slug: slug, source });
      toast.success(resend ? "A new OTP was sent" : "OTP sent to your phone");
    } catch (error) {
      if (!resend) {
        setOtpSent(false);
        setResendCooldown(0);
      }
      toast.error(error instanceof Error ? error.message : "Could not send OTP");
    } finally {
      setBusy(false);
    }
  };

  const changeNumber = () => {
    setOtpSent(false);
    setOtp("");
    setResendCooldown(0);
  };
  const verifyOtp = async () => {
    if (otp.length < 4) return toast.error("Enter the OTP");
    setBusy(true);
    const response = await fetch(SEND_OTP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone: `+91${phone}`,
        otp,
        channel: "sms",
        action: "verify",
      }),
    });
    const result = await response.json().catch(() => ({}));
    const verified = response.ok && result.verified;
    if (verified) {
      await (backendClient as any).from("landing_page_leads").insert({
        landing_slug: slug, name: name || phone, phone,
        page_url: window.location.href, referrer: document.referrer, consent: consentAccepted,
        utm_content: source,
      });
      setLeadConsentPreference(consentAccepted);
      trackEvent("lp_otp_verified", { lp_type: "exam_ad", lp_slug: slug, source });
      trackLeadConversion({ lp_type: "exam_ad", lp_slug: slug, source, gate: "otp" });
      trackEvent("lp_unlock_success", { lp_type: "exam_ad", lp_slug: slug, source, gate: "otp" });
    }
    setBusy(false);
    if (!verified) return toast.error(result.error || "Invalid OTP");
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 relative">
        <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 text-xl opacity-60 hover:opacity-100">×</button>
        <h3 className="font-bold text-lg">{step === "otp" ? "Verify your phone" : "Just a quick detail"}</h3>
        <p className="text-xs opacity-70 mt-1 mb-4">
          {step === "otp"
            ? "We'll send a 6-digit OTP to confirm you're a real student."
            : "Helps us send the right material. We never spam - promise."}
        </p>

        {step === "form" && (
          <div className="space-y-3">
            <div><Label className="text-xs">Full name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></div>
            <div><Label className="text-xs">Mobile *</Label><Input inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(normalizeIndianMobile(e.target.value))} placeholder="10-digit mobile" /></div>
            <LeadConsentCheckbox checked={consentAccepted} onCheckedChange={setConsentAccepted} compact />
            <Button className="lp-btn-primary w-full rounded-md" disabled={busy} onClick={submitLead}>{busy ? "Submitting…" : "Unlock"}</Button>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-3">
            <div><Label className="text-xs">Mobile *</Label><Input inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(normalizeIndianMobile(e.target.value))} placeholder="10-digit mobile" disabled={otpSent} /></div>
            {otpSent && (
              <>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <span>OTP sent to +91 {phone}</span>
                  <button type="button" onClick={changeNumber} className="font-semibold text-primary hover:underline">Change number</button>
                </div>
                <div><Label className="text-xs">OTP *</Label><Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="Enter OTP" /></div>
              </>
            )}
            {!otpSent ? (
              <>
                <LeadConsentCheckbox checked={consentAccepted} onCheckedChange={setConsentAccepted} compact />
                <Button className="lp-btn-primary w-full rounded-md" disabled={busy} onClick={() => sendOtp()}>{busy ? "Sending…" : "Send OTP"}</Button>
              </>
            ) : (
              <>
                <Button className="lp-btn-primary w-full rounded-md" disabled={busy || otp.length !== 6} onClick={verifyOtp}>{busy ? "Verifying…" : "Verify & Unlock"}</Button>
                <button
                  type="button"
                  onClick={() => sendOtp(true)}
                  disabled={busy || resendCooldown > 0}
                  className="mx-auto inline-flex items-center gap-1 text-xs font-semibold text-primary disabled:text-slate-400"
                >
                  <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                </button>
              </>
            )}
          </div>
        )}

        <p className="text-[10px] opacity-60 mt-4 leading-relaxed">
          By continuing you agree to our <a href="/legal/privacy" className="underline">Privacy Policy</a> and to receive communications about education programs. This is not an offer of admission, scholarship, or guaranteed outcome.
        </p>
      </div>
    </div>
  );
}
