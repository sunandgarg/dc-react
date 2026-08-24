export const COOKIE_CONSENT_KEY = "dc_cookie_consent_v1";
export const COOKIE_RESOLVED_EVENT = "dc:cookie-consent-resolved";
export const LOCK_PROMO_RESOLVED_KEY = "dc:lock-target-promo:resolved";
export const LOCK_PROMO_RESOLVED_EVENT = "dc:lock-target-promo-resolved";
export const PROMPT_DELAY_MS = 30_000;

export function hasCookieDecision() {
  try { return Boolean(localStorage.getItem(COOKIE_CONSENT_KEY)); } catch { return false; }
}

export function hasLockPromoResolved() {
  try { return sessionStorage.getItem(LOCK_PROMO_RESOLVED_KEY) === "1"; } catch { return false; }
}

export function signalCookieResolved() {
  window.dispatchEvent(new Event(COOKIE_RESOLVED_EVENT));
}

export function signalLockPromoResolved() {
  try { sessionStorage.setItem(LOCK_PROMO_RESOLVED_KEY, "1"); } catch { /* noop */ }
  window.dispatchEvent(new Event(LOCK_PROMO_RESOLVED_EVENT));
}

export function scheduleAfterGate(options: {
  ready: () => boolean;
  event: string;
  callback: () => void;
  delay?: number;
}) {
  let timer: number | undefined;
  const start = () => {
    if (timer !== undefined) return;
    timer = window.setTimeout(options.callback, options.delay ?? PROMPT_DELAY_MS);
  };
  if (options.ready()) start();
  else window.addEventListener(options.event, start, { once: true });
  return () => {
    if (timer !== undefined) window.clearTimeout(timer);
    window.removeEventListener(options.event, start);
  };
}
