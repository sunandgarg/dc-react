/**
 * Lightweight analytics helper that fans events out to GA4 (gtag),
 * GTM (dataLayer) and Meta Pixel (fbq) when those are loaded by
 * <SiteIntegrations /> or <LpComplianceHeader />. All calls are no-ops
 * when the corresponding tracker isn't present, so it's safe to call
 * from anywhere.
 *
 * Standard events used by the LP funnel:
 *   - lp_view              (auto on LP mount)
 *   - lp_otp_sent          { lp_type, lp_slug, source, ...utm }
 *   - lp_otp_verified      { lp_type, lp_slug, source, ...utm }
 *   - lp_unlock_success    { lp_type, lp_slug, source, gate, ...utm }
 *   - lp_lead_submit       { lp_type, lp_slug, source, ...utm }
 */

export type LpEventName =
  | "lp_view"
  | "lp_otp_sent"
  | "lp_otp_verified"
  | "lp_unlock_success"
  | "lp_lead_submit"
  | "chunk_load_error"
  | "chunk_load_recovered";

export type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;
let googleAdsDestination = "";
let ga4LandingDestination = "";
const pendingGa4LandingEvents: Array<[string, AnalyticsParams]> = [];
const pendingGoogleAdsLeads = new Map<string, AnalyticsParams>();
const recordedLeadIds = new Set<string>();

function sendGa4LandingEvent(name: string, params: AnalyticsParams) {
  if (!ga4LandingDestination || typeof window === "undefined") return;
  const analyticsWindow = window as Window & {
    dcGa4EventsLayer?: unknown[];
    dcGa4EventsTag?: (...args: unknown[]) => void;
  };
  if (!analyticsWindow.dcGa4EventsLayer) {
    analyticsWindow.dcGa4EventsLayer = [];
    analyticsWindow.dcGa4EventsTag = function () {
      // eslint-disable-next-line prefer-rest-params -- Google requires Arguments objects.
      analyticsWindow.dcGa4EventsLayer!.push(arguments);
    };
    analyticsWindow.dcGa4EventsTag("js", new Date());
    analyticsWindow.dcGa4EventsTag("config", ga4LandingDestination, { send_page_view: false });
    const script = document.createElement("script");
    script.id = "dc-ga4-landing-events";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${ga4LandingDestination}&l=dcGa4EventsLayer`;
    document.head.appendChild(script);
  }
  analyticsWindow.dcGa4EventsTag!("event", name, params);
}

export function configureGa4LandingEvents(id?: string) {
  if (!/^G-[A-Z0-9]+$/.test(id || "")) return;
  ga4LandingDestination = id!;
  for (const [name, params] of pendingGa4LandingEvents.splice(0)) sendGa4LandingEvent(name, params);
}

function trackGa4LandingEvent(name: string, params: AnalyticsParams) {
  if (!/^\/ad\/jee-main-2027(?:$|-)/.test(window.location.pathname)) return;
  if (ga4LandingDestination) sendGa4LandingEvent(name, params);
  else if (pendingGa4LandingEvents.length < 50) pendingGa4LandingEvents.push([name, params]);
}

export function configureGoogleAdsConversion(id?: string, label?: string) {
  if (!/^AW-\d+$/.test(id || "") || !/^[A-Za-z0-9_-]+$/.test(label || "")) return;
  const destination = `${id}/${label}`;
  if (destination !== googleAdsDestination) ensureGtag()("config", id);
  googleAdsDestination = destination;
  for (const params of pendingGoogleAdsLeads.values()) {
    ensureGtag()("event", "conversion", { ...params, send_to: destination });
  }
  pendingGoogleAdsLeads.clear();
}

export function ensureGtag() {
  const analyticsWindow = window as Window & {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  };
  analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
  if (!analyticsWindow.gtag) {
    analyticsWindow.gtag = function () {
      // eslint-disable-next-line prefer-rest-params -- Google requires Arguments objects, not arrays.
      analyticsWindow.dataLayer!.push(arguments);
    };
  }
  return analyticsWindow.gtag;
}

export function getUtmParams(): AnalyticsParams {
  if (typeof window === "undefined") return {};
  const sp = new URLSearchParams(window.location.search);
  const out: AnalyticsParams = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"].forEach((k) => {
    const v = sp.get(k);
    if (v) out[k] = v;
  });
  return out;
}

export function trackEvent(name: LpEventName | string, params: AnalyticsParams = {}) {
  if (typeof window === "undefined") return;
  const payload = { ...getUtmParams(), ...params, event_time: Date.now() };
  try {
    ensureGtag()("event", name, payload);
  } catch {/* noop */}
  try {
    (window as any).fbq?.("trackCustom", name, payload);
  } catch {/* noop */}
  try {
    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).dataLayer.push({ event: name, ...payload });
  } catch {/* noop */}
  trackGa4LandingEvent(name, payload);
  // Bridge CTA clicks into the intent-based scoring engine (zero-touch coverage).
  try {
    if (name === "cta_click") {
      import("@/lib/intentTracking").then(({ maybeTrackCtaAsIntent }) => maybeTrackCtaAsIntent(params as any)).catch(() => {});
    }
  } catch {/* noop */}
  if (import.meta.env.DEV) {
    console.debug("[analytics]", name, payload);
  }

  // Persist lead-popup funnel events through the Node/MySQL compatibility client.
  try {
    if (typeof name === "string" && name.startsWith("lp_popup_")) {
      // Lazy import keeps the compatibility client out of the initial bundle path.
      import("@/integrations/backend/client").then(({ backendClient }) => {
        let sid = "anon";
        try { sid = localStorage.getItem("dc_session_id") || "anon"; } catch {}
        (backendClient as any).from("user_events").insert({
          session_id: sid,
          event_type: name,
          path: typeof location !== "undefined" ? location.pathname : null,
          metadata: payload,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        }).then(() => {}, () => {});
      }).catch(() => {});
    }
    // Persist CTA click events (Apply/Talk/Brochure/etc) for the admin conversion dashboard.
    if (name === "cta_click") {
      import("@/integrations/backend/client").then(({ backendClient }) => {
        let sid = "anon";
        try {
          sid = localStorage.getItem("dc_session_id") || "";
          if (!sid) {
            sid = (crypto as any)?.randomUUID?.() || `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            localStorage.setItem("dc_session_id", sid);
          }
        } catch {}
        const p = params as any;
        (backendClient as any).from("cta_events").insert({
          page: String(p.page || "unknown"),
          cta: String(p.cta || "unknown"),
          entity_slug: p.college_slug || p.course_slug || p.exam_slug || p.program_slug || p.slug || null,
          entity_name: p.entity_name || null,
          session_id: sid,
          path: typeof location !== "undefined" ? location.pathname : null,
          referrer: typeof document !== "undefined" ? document.referrer || null : null,
          utm_source: (payload as any).utm_source || null,
          utm_medium: (payload as any).utm_medium || null,
          utm_campaign: (payload as any).utm_campaign || null,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          meta: payload,
        }).then(() => {}, () => {});
      }).catch(() => {});
    }
  } catch {/* noop */}
}

/** Lead/Conversion shortcut - also fires the standard generate_lead/Lead events. */
export function trackLeadConversion(params: AnalyticsParams = {}) {
  if (typeof window === "undefined") return;
  const leadId = typeof params.transaction_id === "string" ? params.transaction_id : "";
  if (!leadId || params.silent || recordedLeadIds.has(leadId)) return;
  recordedLeadIds.add(leadId);
  const event = { transaction_id: leadId, source: params.source || "website_form", value: 1, currency: "INR" };
  try { ensureGtag()("event", "generate_lead", event); } catch {/* noop */}
  trackGa4LandingEvent("generate_lead", event);
  try { (window as any).fbq?.("track", "Lead", event); } catch {/* noop */}
  if (googleAdsDestination) {
    try { ensureGtag()("event", "conversion", { ...event, send_to: googleAdsDestination }); } catch {/* noop */}
  } else pendingGoogleAdsLeads.set(leadId, event);
  trackEvent("lp_lead_submit", event);
}
