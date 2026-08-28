import { useEffect, useState } from "react";
import { backendClient } from "@/integrations/backend/client";
import { useAuth } from "./useAuth";

/**
 * Returns helpers to mask lead PII (phone/email) for teammates flagged with
 * `mask_leads = true` in their profile. Admins always see unmasked data.
 */
export function useLeadMask() {
  const { user, isAdmin } = useAuth();
  const [mask, setMask] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || isAdmin) { setMask(false); return; }
      const { data } = await (backendClient as any)
        .from("profiles")
        .select("mask_leads")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setMask(!!(data as any)?.mask_leads);
    })();
    return () => { cancelled = true; };
  }, [isAdmin, user]);

  const maskPhone = (p?: string | null) => {
    if (!mask || !p) return p || "";
    const digits = String(p).replace(/\D/g, "");
    if (digits.length < 4) return "••••";
    return digits.slice(0, 2) + "••••••" + digits.slice(-2);
  };
  const maskEmail = (e?: string | null) => {
    if (!mask || !e) return e || "";
    const [u, d] = String(e).split("@");
    if (!d) return "•••";
    return (u?.slice(0, 1) || "") + "•••@" + d;
  };
  const maskName = (n?: string | null) => {
    if (!mask || !n) return n || "";
    const parts = String(n).trim().split(/\s+/);
    return parts.map((p, i) => (i === 0 ? p : (p[0] || "") + ".")).join(" ");
  };

  return { mask, maskPhone, maskEmail, maskName };
}
