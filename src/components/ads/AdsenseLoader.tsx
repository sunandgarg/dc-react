import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAdsenseSettings, useAdScripts } from "@/hooks/useAdsense";

/**
 * Globally injects Google AdSense Auto Ads script + admin-managed custom
 * head/body/footer scripts and custom CSS/JS. Mounted once in App.tsx.
 * Admin routes are excluded.
 */
export function AdsenseLoader() {
  const { pathname } = useLocation();
  const { data: settings } = useAdsenseSettings();
  const { data: scripts } = useAdScripts();

  const isAdmin = pathname.startsWith("/admin");
  const isHomepage = pathname === "/";
  const allowAutoAds = settings?.auto_ads_enabled && !pathname.startsWith("/news/");

  useEffect(() => {
    if (!isHomepage) return;
    const removeHomepageAds = () => {
      document.querySelectorAll("#global-internal-ad-top-anchor .google-ad-slot, .google-auto-placed, .adsbygoogle-noablate, ins.adsbygoogle, iframe[src*='googleads.g.doubleclick.net'], iframe[id^='aswift_']")
        .forEach((element) => element.remove());
      document.getElementById("adsbygoogle-lib")?.remove();
      document.getElementById("adsbygoogle-autoads")?.remove();
    };
    removeHomepageAds();
    const observer = new MutationObserver(removeHomepageAds);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isHomepage]);

  useEffect(() => {
    if (isAdmin || isHomepage || !settings || !settings.ads_globally_enabled) return;

    // Load during the first idle window, with a short fallback so reserved
    // ad slots fill promptly without competing with the LCP image.
    let cancelled = false;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const handle = idleWindow.requestIdleCallback
      ? idleWindow.requestIdleCallback(() => {
          if (!cancelled) runInject();
        }, { timeout: 1800 })
      : window.setTimeout(() => {
          if (!cancelled) runInject();
        }, 1200);

    const created: HTMLElement[] = [];

    function runInject() {
      const addScript = (id: string, attrs: Record<string, string>, code?: string) => {
        if (document.getElementById(id)) return;
        const s = document.createElement("script");
        s.id = id;
        Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
        if (code) s.text = code;
        document.head.appendChild(s);
        created.push(s);
      };

      const addRawHtml = (id: string, html: string, target: "head" | "body") => {
        if (!html?.trim() || document.getElementById(id)) return;
        const wrap = document.createElement("div");
        wrap.id = id;
        wrap.innerHTML = html;
        const dest = target === "head" ? document.head : document.body;
        Array.from(wrap.childNodes).forEach((n) => dest.appendChild(n));
        created.push(wrap);
      };

      // AdSense library
      if (settings.client_id || settings.publisher_id) {
        const cid = settings.client_id || settings.publisher_id;
        addScript("adsbygoogle-lib", {
          async: "",
          src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${cid}`,
          crossorigin: "anonymous",
        });
      }

      // Auto Ads
      if (allowAutoAds && (settings.client_id || settings.publisher_id)) {
        const cid = settings.client_id || settings.publisher_id;
        addScript(
          "adsbygoogle-autoads",
          {},
          `(adsbygoogle = window.adsbygoogle || []).push({ google_ad_client: "${cid}", enable_page_level_ads: true });`,
        );
      }

      // Verification meta
      if (settings.verification_meta && !document.getElementById("adsense-verify-meta")) {
        const meta = document.createElement("meta");
        meta.id = "adsense-verify-meta";
        meta.name = "google-adsense-account";
        meta.content = settings.verification_meta;
        document.head.appendChild(meta);
        created.push(meta);
      }

      // Custom CSS
      if (settings.custom_css?.trim() && !document.getElementById("adsense-custom-css")) {
        const style = document.createElement("style");
        style.id = "adsense-custom-css";
        style.textContent = settings.custom_css;
        document.head.appendChild(style);
        created.push(style);
      }

      // Custom JS
      if (settings.custom_js?.trim()) {
        addScript("adsense-custom-js", {}, settings.custom_js);
      }

      // Raw head/body/footer scripts from settings
      addRawHtml("adsense-head-scripts", settings.head_scripts || "", "head");
      addRawHtml("adsense-body-scripts", settings.body_scripts || "", "body");
      addRawHtml("adsense-footer-scripts", settings.footer_scripts || "", "body");

      // Admin-defined ad_scripts table entries
      const now = Date.now();
      (scripts ?? []).forEach((sc) => {
        if (sc.start_date && new Date(sc.start_date).getTime() > now) return;
        if (sc.end_date && new Date(sc.end_date).getTime() < now) return;
        addRawHtml(`ad-script-${sc.id}`, sc.code, sc.location === "footer" ? "body" : sc.location);
      });
    }

    return () => {
      cancelled = true;
      if (idleWindow.cancelIdleCallback && idleWindow.requestIdleCallback) idleWindow.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      created.forEach((el) => el.parentNode?.removeChild(el));
    };
  }, [allowAutoAds, isAdmin, isHomepage, settings, scripts]);

  return null;
}
