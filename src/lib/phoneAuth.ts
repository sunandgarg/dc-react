import { backendClient } from "@/integrations/backend/client";
import { functionUrl } from "@/lib/backendMode";

const SEND_OTP_URL = functionUrl("send-otp");

export async function requestPhoneOtp(phoneDigits: string, action: "send" | "resend" = "send") {
  // Send directly through the OTP router. Going through phone-auth first added
  // a second Edge Function cold start before the SMS request even began.
  const response = await fetch(SEND_OTP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone: `+91${phoneDigits}`,
      channel: "sms",
      action,
    }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.error || !data?.success) {
    throw new Error(data?.error || "Could not send OTP.");
  }
  return data;
}

export async function exchangePhoneOtpForSession(phoneDigits: string, verifiedOtp: string) {
  const { data, error } = await backendClient.functions.invoke("phone-auth", {
    body: { phone: `+91${phoneDigits}`, otp: verifiedOtp },
  });

  if (error || data?.error) {
    throw new Error(error?.message || data?.error || "Could not start secure phone login.");
  }

  if (data?.session?.access_token && data?.session?.refresh_token) {
    const { error: sessionError } = await backendClient.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (sessionError) throw sessionError;
    return;
  }

  if (!data?.token_hash) {
    throw new Error("Could not start secure phone login.");
  }

  const { error: verifyError } = await backendClient.auth.verifyOtp({
    token_hash: data.token_hash,
    type: (data.type || "magiclink") as any,
  });
  if (verifyError) throw verifyError;
}

export async function tryExchangePhoneOtpForSession(phoneDigits: string, verifiedOtp: string) {
  try {
    await exchangePhoneOtpForSession(phoneDigits, verifiedOtp);
    return true;
  } catch (error) {
    console.warn("Phone OTP session exchange skipped:", error instanceof Error ? error.message : error);
    return false;
  }
}
