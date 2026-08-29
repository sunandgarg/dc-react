import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, ShieldCheck, Settings2, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COOKIE_CONSENT_KEY, signalCookieResolved } from "@/lib/promptSequence";

const COOKIE_KEY = COOKIE_CONSENT_KEY;             // "accepted" | "essential" | "rejected"
const PROFILE_KEY = "dc_user_prefill_v1";
const PREFS_KEY = "dc_cookie_prefs_v1";          // JSON {essential:true, prefill:bool, analytics:bool, marketing:bool}

interface Prefs {
  essential: true;
  prefill: boolean;
  analytics: boolean;
  marketing: boolean;
}
const DEFAULT_PREFS: Prefs = { essential: true, prefill: true, analytics: true, marketing: true };

export interface PrefillCookie {
  name?: string;
  email?: string;
  phone?: string;
  state?: string;
  city?: string;
  className?: string;
}

function getPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch { return DEFAULT_PREFS; }
}

export function getPrefillCookie(): PrefillCookie {
  try {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (consent !== "accepted" && consent !== "essential") return {};
    if (!getPrefs().prefill) return {};
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function savePrefillCookie(data: PrefillCookie) {
  try {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (consent !== "accepted" && consent !== "essential") return;
    if (!getPrefs().prefill) return;
    const existing = getPrefillCookie();
    const merged = { ...existing, ...data };
    Object.keys(merged).forEach(k => { if (!merged[k as keyof PrefillCookie]) delete merged[k as keyof PrefillCookie]; });
    localStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
  } catch {}
}

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    const saved = localStorage.getItem(COOKIE_KEY);
    setPrefs(getPrefs());
    if (!saved) {
      const t = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  const persist = (consent: "accepted" | "essential" | "rejected", finalPrefs: Prefs) => {
    localStorage.setItem(COOKIE_KEY, consent);
    localStorage.setItem(PREFS_KEY, JSON.stringify(finalPrefs));
    if (consent === "rejected") localStorage.removeItem(PROFILE_KEY);
    setOpen(false);
    signalCookieResolved();
    // Log opt-in choice (best-effort, anonymous)
    try {
      const sid = localStorage.getItem("dc_session_id") || `s_${Date.now()}`;
      import("@/integrations/backend/client").then(({ backendClient }) =>
        (backendClient as any).from("user_consent").insert({
          session_id: sid,
          essential: finalPrefs.essential,
          analytics: finalPrefs.analytics,
          marketing: finalPrefs.marketing,
          prefill: finalPrefs.prefill,
          user_agent: navigator.userAgent,
        })
      );
    } catch {}
  };

  const acceptAll = () => persist("accepted", { essential: true, prefill: true, analytics: true, marketing: true });
  const acceptEssential = () => persist("essential", { essential: true, prefill: true, analytics: false, marketing: false });
  const saveCustom = () => persist(prefs.analytics || prefs.marketing ? "accepted" : "essential", prefs);

  const Toggle = ({ k, label, desc, locked }: { k: keyof Prefs; label: string; desc: string; locked?: boolean }) => (
    <label className="flex items-start gap-3 py-2 cursor-pointer">
      <input
        type="checkbox"
        disabled={locked}
        checked={prefs[k] as boolean}
        onChange={e => setPrefs(p => ({ ...p, [k]: e.target.checked }))}
        className="mt-0.5 w-4 h-4 rounded accent-primary disabled:opacity-50"
      />
      <div className="flex-1">
        <div className="text-xs font-semibold flex items-center gap-1.5">{label}{locked && <span className="text-[10px] text-muted-foreground font-normal">(always on)</span>}</div>
        <div className="text-[11px] text-muted-foreground leading-snug">{desc}</div>
      </div>
    </label>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          data-testid="cookie-consent-bar"
          className="fixed inset-x-0 top-0 bottom-auto z-[120] pt-[env(safe-area-inset-top)] md:top-auto md:bottom-0 md:pt-0"
        >
          <div className="bg-card/95 backdrop-blur-xl border-b border-border shadow-2xl md:border-b-0 md:border-t">
            <div className="mx-auto max-w-7xl">
              <div className="p-3 sm:p-4 md:flex md:items-center md:gap-5">
                <div className="flex min-w-0 items-start gap-3 md:flex-1 md:items-center">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 sm:h-10 sm:w-10">
                    <Cookie className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold">We value your privacy</h3>
                      <button onClick={() => persist("rejected", { ...DEFAULT_PREFS, prefill: false, analytics: false, marketing: false })} aria-label="Close" className="text-muted-foreground hover:text-foreground md:hidden">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                      We use cookies to keep the site secure, remember your preferences and improve your experience. Choose what works for you.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 md:mt-0 md:flex-nowrap">
                  {!showCustom ? (
                    <>
                      <Button onClick={() => setShowCustom(true)} variant="ghost" size="sm" className="h-9 gap-1 rounded-md px-2 text-xs">
                        <Settings2 className="h-3.5 w-3.5" /> Customise <ChevronDown className="h-3 w-3" />
                      </Button>
                      <Button onClick={acceptEssential} variant="outline" size="sm" className="h-9 flex-1 rounded-md px-3 sm:flex-none">Essential only</Button>
                      <Button onClick={acceptAll} size="sm" className="h-9 flex-1 rounded-md bg-primary px-3 hover:bg-primary/90 sm:flex-none">
                        <ShieldCheck className="mr-1.5 h-4 w-4" /> Accept all
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={() => setShowCustom(false)} variant="ghost" size="sm" className="h-9 rounded-md text-xs">Back</Button>
                      <Button onClick={() => persist("rejected", { ...DEFAULT_PREFS, prefill: false, analytics: false, marketing: false })} variant="outline" size="sm" className="h-9 flex-1 rounded-md sm:flex-none">Decline all</Button>
                      <Button onClick={saveCustom} size="sm" className="h-9 flex-1 rounded-md bg-primary hover:bg-primary/90 sm:flex-none">Save preferences</Button>
                    </>
                  )}
                  <button onClick={() => persist("rejected", { ...DEFAULT_PREFS, prefill: false, analytics: false, marketing: false })} aria-label="Close" className="hidden text-muted-foreground hover:text-foreground md:block">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {showCustom && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="max-h-[55vh] overflow-y-auto border-t border-border px-4 pb-3 sm:grid sm:grid-cols-2 sm:gap-x-8 md:max-h-[40vh]"
                  >
                    <Toggle k="essential" label="Essential" desc="Login sessions, security, consent choices, form progress, lead delivery, duplicate prevention and saved preferences." locked />
                    <Toggle k="prefill" label="Personalisation (prefill)" desc="Remember your name, mobile, state and city so forms are auto-filled." />
                    <Toggle k="analytics" label="Analytics" desc="Help us understand which pages and tools work best." />
                    <Toggle k="marketing" label="Marketing" desc="Show counselling offers most relevant to your interests." />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
