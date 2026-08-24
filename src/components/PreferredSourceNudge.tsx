import { useEffect, useState } from "react";
import { CheckCircle2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "react-router-dom";
import { GoogleGLogo } from "@/components/GoogleGLogo";
import { hasLockPromoResolved, LOCK_PROMO_RESOLVED_EVENT, scheduleAfterGate, signalGooglePromoResolved } from "@/lib/promptSequence";

const STORAGE_KEY = "dc:preferred-source-nudge:v1";
const GOOGLE_PREFERRED_SOURCE_URL = "https://google.com/preferences/source?q=dekhocampus.com";

type StoredState = {
  dismissedAt?: number;
  clickedAt?: number;
};

function readStoredState(): StoredState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeStoredState(next: StoredState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function PreferredSourceNudge() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/target-dashboard") ||
      pathname.startsWith("/lp") ||
      pathname.startsWith("/landing/")
    ) {
      setVisible(false);
      return;
    }

    const stored = readStoredState();
    if (stored.clickedAt) {
      signalGooglePromoResolved();
      return;
    }
    if (stored.dismissedAt && Date.now() - stored.dismissedAt < 1000 * 60 * 60 * 24 * 14) {
      signalGooglePromoResolved();
      return;
    }

    return scheduleAfterGate({
      ready: hasLockPromoResolved,
      event: LOCK_PROMO_RESOLVED_EVENT,
      callback: () => setVisible(true),
    });
  }, [pathname]);

  if (!visible) return null;

  const dismiss = () => {
    writeStoredState({ ...readStoredState(), dismissedAt: Date.now() });
    signalGooglePromoResolved();
    setVisible(false);
  };

  const markClicked = () => {
    writeStoredState({ ...readStoredState(), clickedAt: Date.now() });
    signalGooglePromoResolved();
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-[5.75rem] z-40 flex justify-center sm:bottom-5 sm:inset-x-auto sm:right-5">
      <div className="relative w-full max-w-[420px] overflow-hidden rounded-3xl border border-blue-200/80 bg-white/95 p-3.5 shadow-2xl shadow-blue-950/10 backdrop-blur-xl dark:border-blue-900/50 dark:bg-slate-950/92">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide preferred source suggestion"
          className="absolute right-2.5 top-2.5 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex gap-3 pr-7">
          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg shadow-blue-600/15 ring-1 ring-slate-200">
            <GoogleGLogo className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                <CheckCircle2 className="h-3 w-3" /> 1 click
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-200">
                <Sparkles className="h-3 w-3" /> Latest education updates
              </span>
            </div>
            <p className="mt-2 text-sm font-extrabold leading-snug text-slate-950 dark:text-white">
              Prefer DekhoCampus on Google
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
              If Google shows the option, add DekhoCampus as a preferred source so admission, exam and college updates surface faster for you.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button asChild size="sm" className="h-9 rounded-full bg-blue-600 px-4 text-xs font-bold hover:bg-blue-700" onClick={markClicked}>
                <a href={GOOGLE_PREFERRED_SOURCE_URL} target="_blank" rel="noopener noreferrer">
                  Add on Google
                </a>
              </Button>
              <button type="button" onClick={dismiss} className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                Maybe later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
