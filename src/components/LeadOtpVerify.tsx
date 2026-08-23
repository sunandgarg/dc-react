import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { functionUrl } from "@/lib/backendMode";

const SEND_OTP_URL = functionUrl("send-otp");
const RESEND_COOLDOWN = 45; // seconds
const OTP_LENGTH = 6;

interface LeadOtpVerifyProps {
  phone: string; // 10-digit Indian mobile
  onVerified: () => void;
  onCancel: () => void;
  /** Optional form key - when provided, admin per-form channel override is honored. */
  formKey?: string;
}

export function LeadOtpVerify({ phone, onVerified, onCancel, formKey }: LeadOtpVerifyProps) {
  void formKey;

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const sendOtp = async (resend = false) => {
    setSending(true);
    try {
      const res = await fetch(SEND_OTP_URL, {
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
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) throw new Error(body.error || "Failed to send OTP");
      toast.success(`OTP sent to +91 ${phone.slice(0, 5)}*****`);
      setCooldown(RESEND_COOLDOWN);
    } catch (e: any) {
      toast.error(e?.message || "Could not send OTP. Try again.");
    } finally {
      setSending(false);
    }
  };

  // initial send on mount
  useEffect(() => {
    sendOtp();
    inputsRef.current[0]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  const code = digits.join("");

  const onChangeDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = clean;
      return next;
    });
    if (clean && i < OTP_LENGTH - 1) inputsRef.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const v = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!v) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill("");
    for (let i = 0; i < v.length; i++) next[i] = v[i];
    setDigits(next);
    inputsRef.current[Math.min(v.length, OTP_LENGTH - 1)]?.focus();
  };

  const verify = async () => {
    if (code.length !== OTP_LENGTH) {
      toast.error(`Please enter the ${OTP_LENGTH}-digit code`);
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch(SEND_OTP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: `+91${phone}`,
          otp: code,
          channel: "sms",
          action: "verify",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.verified) {
        toast.error("Incorrect OTP. Please try again.");
        return;
      }
      onVerified();
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-foreground/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-card rounded-2xl shadow-elevated w-full max-w-sm p-6 relative"
      >
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="Cancel"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Verify your mobile</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {sending ? "Sending" : "We sent"} a 6-digit code to <span className="font-semibold text-foreground">+91 {phone}</span>
        </p>

        <div className="flex justify-between gap-2 mt-5" onPaste={onPaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputsRef.current[i] = el)}
              value={d}
              onChange={(e) => onChangeDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              inputMode="numeric"
              maxLength={1}
              autoComplete="one-time-code"
              className="w-11 h-12 text-center text-lg font-bold rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          ))}
        </div>

        <Button
          type="button"
          onClick={verify}
          disabled={sending || verifying || code.length !== OTP_LENGTH}
          className="w-full mt-5 rounded-xl h-11"
        >
          {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Verify & Continue
        </Button>

        <div className="flex items-center justify-between mt-3 text-xs">
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
          >
            Change number
          </button>
          <button
            type="button"
            onClick={() => sendOtp(true)}
            disabled={sending || cooldown > 0}
            className="inline-flex items-center gap-1 text-primary font-medium disabled:text-muted-foreground"
          >
            <RefreshCw className={`w-3 h-3 ${sending ? "animate-spin" : ""}`} />
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
