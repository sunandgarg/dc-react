import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Target, X, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { COOKIE_RESOLVED_EVENT, hasCookieDecision, scheduleAfterGate, signalLockPromoResolved } from "@/lib/promptSequence";


const DISMISS_KEY = "lock_target_promo_dismissed_v1";

export function LockTargetFloatingPromo() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = sessionStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      signalLockPromoResolved();
      return;
    }
    return scheduleAfterGate({
      ready: hasCookieDecision,
      event: COOKIE_RESOLVED_EVENT,
      callback: () => setOpen(true),
    });
  }, []);

  // Hide on the lock-target page itself, dashboard, auth, and admin
  if (
    pathname === "/news" ||
    pathname.startsWith("/news/") ||
    pathname === "/articles" ||
    pathname.startsWith("/articles/") ||
    pathname.startsWith("/lock-target") ||
    pathname.startsWith("/target-dashboard") ||
    pathname.startsWith("/my-targets") ||
    pathname.startsWith("/target-with-ai") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth")
  ) {
    return null;
  }


  if (!open) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    signalLockPromoResolved();
    setOpen(false);
  }

  return (
    <div
      className="pointer-events-auto fixed z-[120] left-3 bottom-24 w-[min(238px,calc(100vw-7.5rem))] animate-in slide-in-from-bottom-2 fade-in md:left-5 md:bottom-40"
      role="dialog"
      aria-label="Lock your dream college"
    >
      <div className="relative isolate rounded-2xl border border-slate-200/90 bg-white text-slate-900 shadow-2xl p-2.5 pr-8">
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-1.5 right-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-200"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <Link to={user ? "/target-dashboard" : "/lock-target"} onClick={() => { sessionStorage.setItem(DISMISS_KEY, "1"); signalLockPromoResolved(); }} className="block">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-primary">
              <Target className="w-4.5 h-4.5" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
                Dream College
              </div>
              <div className="text-[13px] font-extrabold leading-tight">
                {user ? "Open my dashboard" : "Lock your dream college 🔒"}
              </div>
              <div className="mt-0.5 text-[10px] leading-tight text-slate-500">
                {user ? "Predicted fit, exams & roadmap →" : "Free roadmap + PDF. Tap to start →"}
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
