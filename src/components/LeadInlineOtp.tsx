import { useEffect, useRef, useState } from "react";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { isStrictIndianMobile, normalizeIndianMobile } from "@/lib/phone";
import { functionUrl } from "@/lib/backendMode";

const SEND_OTP_URL = functionUrl("send-otp");
const OTP_LENGTH = 6;
const RESEND = 45;

/** Indian mobile: 10 digits, must start with 6, 7, 8, or 9. */
export const isValidIndianMobile = (phone: string) =>
  isStrictIndianMobile(phone);

export const PHONE_HINT = "Number must start with 9, 8, 7, or 6";

/**
 * Sanitize raw phone input:
 *  - strip non-digits
 *  - strip "+91" / "91" country prefix when 12+ digits
 *  - strip any leading 0(s) automatically (default 0 prefix is removed)
 *  - cap length at 10 - never drop any other digit the user typed
 */
export const sanitizeIndianMobile = (raw: string): string => {
  return normalizeIndianMobile(raw);
};

/**
 * Inline OTP block used inside lead forms.
 *  - Verification is OPTIONAL - the lead is always saved.
 *  - Exposes `getOtpButton` (place inline next to the phone input)
 *    and `verifyBlock` (render below the phone row when requested).
 */
export function useInlineOtp(phone: string, formKey: string) {
  void formKey;

  const [requested, setRequested] = useState(false);
  const [requestedPhone, setRequestedPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [missing, setMissing] = useState(false);
  const cooldownRef = useRef<number | null>(null);
  const latestPhoneRef = useRef("");
  const normalizedPhone = sanitizeIndianMobile(phone);
  latestPhoneRef.current = normalizedPhone;

  const markMissing = () => setMissing(true);
  const clearMissing = () => setMissing(false);

  const phoneOk = isValidIndianMobile(normalizedPhone);

  const clearCooldown = () => {
    if (cooldownRef.current !== null) {
      window.clearInterval(cooldownRef.current);
      cooldownRef.current = null;
    }
    setCooldown(0);
  };

  const resetVerification = () => {
    clearCooldown();
    setRequested(false);
    setRequestedPhone("");
    setCode("");
    setVerified(false);
    setMissing(false);
  };

  // An OTP belongs to one exact phone number. If the user corrects the number,
  // invalidate the old challenge immediately and restore the Get OTP action.
  useEffect(() => {
    if (requestedPhone && normalizedPhone !== requestedPhone) resetVerification();
    // resetVerification intentionally operates on the current OTP state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedPhone, requestedPhone]);

  useEffect(() => () => {
    if (cooldownRef.current !== null) window.clearInterval(cooldownRef.current);
  }, []);

  const tickCooldown = () => {
    clearCooldown();
    setCooldown(RESEND);
    cooldownRef.current = window.setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (cooldownRef.current !== null) window.clearInterval(cooldownRef.current);
          cooldownRef.current = null;
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const sendOtp = async () => {
    if (!phoneOk) {
      toast.error(PHONE_HINT);
      return;
    }
    const phoneAtSend = normalizedPhone;
    const wasRequested = requested;

    // Reveal the verification UI immediately; SMS delivery continues in the
    // background. Roll back only when the first request actually fails.
    setRequested(true);
    setRequestedPhone(phoneAtSend);
    setCode("");
    setVerified(false);
    tickCooldown();
    setSending(true);
    try {
      const res = await fetch(SEND_OTP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: `+91${phoneAtSend}`,
          channel: "sms",
          action: wasRequested ? "resend" : "send",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success || body.skipped) throw new Error(body.error || "Failed to send OTP");
      if (latestPhoneRef.current !== phoneAtSend) return;
      toast.success(`OTP sent via SMS to +91 ${phoneAtSend.slice(0, 5)}*****`);
    } catch (e: unknown) {
      if (!wasRequested && latestPhoneRef.current === phoneAtSend) {
        resetVerification();
      }
      toast.error(e instanceof Error ? e.message : "Could not send OTP. Try again.");
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (!requestedPhone || normalizedPhone !== requestedPhone) {
      resetVerification();
      toast.error("Phone number changed. Please request a new OTP.");
      return;
    }
    if (code.length !== OTP_LENGTH) {
      toast.error(`Enter the ${OTP_LENGTH}-digit code`);
      return;
    }
    try {
      const res = await fetch(SEND_OTP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: `+91${normalizedPhone}`,
          otp: code,
          channel: "sms",
          action: "verify",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.verified) {
        setVerified(true);
        clearMissing();
        toast.success("Mobile verified ✓");
        return;
      }
      toast.error(body.error || "Incorrect OTP");
    } catch {
      toast.error("Incorrect OTP");
    }
  };

  const getOtpButton = (
    <Button
      type="button"
      onClick={() => sendOtp()}
      disabled={sending || !phoneOk || verified || cooldown > 0}
      className="h-10 shrink-0 whitespace-nowrap rounded-xl bg-primary px-2.5 text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground min-[390px]:px-4"
    >
      {sending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : verified ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <Send className="w-4 h-4" />
      )}
      <span className="whitespace-nowrap text-[13px] font-medium min-[390px]:text-sm">
        {verified ? "Verified" : sending ? "Sending" : cooldown > 0 ? `${cooldown}s` : requested ? "Resend OTP" : "Get OTP"}
      </span>
    </Button>
  );

  const verifyBlock = requested && !verified ? (
    <div
      className={`rounded-xl p-2.5 space-y-2 border-2 transition-colors ${
        missing ? "border-destructive bg-destructive/10 ring-2 ring-destructive/40" : "border-primary bg-primary/5"
      }`}
    >
      <div className="flex items-center gap-2">
        <Input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH));
            if (missing) clearMissing();
          }}
          placeholder={`Enter ${OTP_LENGTH}-digit OTP sent via SMS`}
          inputMode="numeric"
          className={`h-9 rounded-lg text-sm tracking-widest bg-card ${
            missing ? "border-destructive focus-visible:ring-destructive/30" : "border-primary/40 focus-visible:ring-primary/30"
          }`}
        />
        <Button
          type="button"
          size="sm"
          onClick={verify}
          disabled={sending || code.length !== OTP_LENGTH}
          className="h-9 shrink-0 whitespace-nowrap rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Verify
        </Button>
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className={`text-[11px] leading-tight ${missing ? "text-destructive font-medium" : "text-muted-foreground"}`}>
          {missing
            ? "Please verify your OTP before submitting"
            : sending
              ? `Sending OTP to +91 ${requestedPhone.slice(0, 5)}*****…`
              : `Sent to +91 ${requestedPhone.slice(0, 5)}*****. Wrong number? Edit the mobile number above, then tap Get OTP again.`}
        </p>
        {cooldown > 0 ? (
          <span className="text-[11px] text-muted-foreground">Resend options in {cooldown}s</span>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => sendOtp()}
              disabled={sending}
              className="h-7 whitespace-nowrap rounded-md border-primary/40 px-2.5 text-[11px] text-primary hover:bg-primary/10"
            >
              Resend SMS
            </Button>
          </div>
        )}
      </div>
    </div>
  ) : null;


  // Back-compat: some forms still render {otp.block}. Keep it null so layouts
  // don't break, but new code should use getOtpButton + verifyBlock.
  const block = verifyBlock;

  return { block, getOtpButton, verifyBlock, verified, requested, markMissing, clearMissing, missing };
}
