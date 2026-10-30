import { useSyncExternalStore } from "react";
import { COOKIE_CONSENT_KEY, COOKIE_RESOLVED_EVENT } from "@/lib/promptSequence";

export function measurementAllowed(kind: "analytics" | "marketing") {
  if (typeof window === "undefined") return false;
  if (!["dekhocampus.com", "www.dekhocampus.com", "lp.dekhocampus.com", "www.lp.dekhocampus.com", "sarkari.dekhocampus.com"].includes(window.location.hostname)) return false;
  if (window.location.pathname.startsWith("/admin")) return false;
  try {
    if (localStorage.getItem(COOKIE_CONSENT_KEY) !== "accepted") return false;
    const prefs = JSON.parse(localStorage.getItem("dc_cookie_prefs_v1") || "{}");
    return prefs[kind] === true;
  } catch { return false; }
}

function subscribe(callback: () => void) {
  window.addEventListener(COOKIE_RESOLVED_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(COOKIE_RESOLVED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useMeasurementConsent(kind: "analytics" | "marketing") {
  return useSyncExternalStore(subscribe, () => measurementAllowed(kind), () => false);
}

let consentInitialized = false;

export function googleConsentCommand(command: "default" | "update") {
  const w = window as typeof window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  w.dataLayer ||= [];
  // eslint-disable-next-line prefer-rest-params -- Google command queue protocol
  w.gtag ||= function () { w.dataLayer!.push(arguments); };
  w.gtag("consent", command === "default" && !consentInitialized ? "default" : "update", {
    analytics_storage: measurementAllowed("analytics") ? "granted" : "denied",
    ad_storage: measurementAllowed("marketing") ? "granted" : "denied",
    ad_user_data: measurementAllowed("marketing") ? "granted" : "denied",
    ad_personalization: measurementAllowed("marketing") ? "granted" : "denied",
  });
  consentInitialized = true;
}
