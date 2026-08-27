import { useQuery } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";
import { ensureBootstrap } from "@/lib/bootstrap";
import { getPrefillCookie } from "@/components/CookieConsent";
import { citiesByState } from "@/data/indianLocations";

export interface Ad {
  id: string;
  title: string;
  subtitle: string | null;
  cta_text: string;
  link_url: string;
  image_url: string | null;
  variant: string;
  bg_gradient: string;
  target_type: string;
  target_page: string | null;
  target_item_slug: string | null;
  target_city: string | null;
  target_state: string | null;
  position: string;
  priority: number;
  is_active: boolean;
  start_date?: string | null;
  end_date?: string | null;
}

interface AdSelectionOptions {
  page?: string;
  itemSlug?: string;
  state?: string;
  city?: string;
  variant?: string;
  position?: string;
}

export interface AdLocationTarget {
  state: string;
  cities: string[];
}

/** Supports legacy single-state values and the new multi-city audience payload. */
export function decodeAdLocation(value?: string | null): AdLocationTarget {
  const clean = value?.trim() || "";
  if (!clean) return { state: "", cities: [] };
  if (clean.startsWith("{")) {
    try {
      const parsed = JSON.parse(clean) as { state?: unknown; cities?: unknown };
      return {
        state: typeof parsed.state === "string" ? parsed.state : "",
        cities: Array.isArray(parsed.cities) ? parsed.cities.filter((city): city is string => typeof city === "string") : [],
      };
    } catch {
      // A malformed legacy value remains usable as a state/city string.
    }
  }
  return { state: clean, cities: [] };
}

export function encodeAdLocation(state: string, cities: string[]): string | null {
  const normalizedCities = Array.from(new Set(cities.map((city) => city.trim()).filter(Boolean)));
  const normalizedState = state.trim();
  if (!normalizedCities.length) return normalizedState || null;
  return JSON.stringify({ state: normalizedState, cities: normalizedCities });
}

function normalizeState(value?: string | null) {
  const clean = value?.trim() || "";
  if (clean === "Delhi") return "Delhi NCR";
  for (const [state, cities] of Object.entries(citiesByState)) {
    if (cities.some((city) => city.toLowerCase() === clean.toLowerCase())) return state;
  }
  return clean;
}

/** Deterministic selection used by every ad slot and covered by unit tests. */
export function selectBestAd(allAds: Ad[], options: AdSelectionOptions = {}): Ad | null {
  if (!allAds.length) return null;
  const now = Date.now();
  const { page, itemSlug, variant, position } = options;
  const state = normalizeState(options.state);
  const city = options.city?.trim().toLowerCase() || "";
  const available = allAds
    .filter((ad) => ad.is_active !== false)
    .filter((ad) => !ad.start_date || new Date(ad.start_date).getTime() <= now)
    .filter((ad) => !ad.end_date || new Date(ad.end_date).getTime() >= now)
    .filter((ad) => !position || ad.position === position)
    .sort((left, right) => (right.priority || 0) - (left.priority || 0));

  const pick = (matches: Ad[]) => {
    if (variant) return matches.find((ad) => ad.variant === variant) || null;
    return matches[0] || null;
  };
  const adLocation = (ad: Ad) => decodeAdLocation(ad.target_state || ad.target_city);
  const adState = (ad: Ad) => normalizeState(adLocation(ad).state);
  const adHasCity = (ad: Ad) => city && adLocation(ad).cities.some((candidate) => candidate.trim().toLowerCase() === city);
  const noGeo = (ad: Ad) => !adState(ad) && adLocation(ad).cities.length === 0;

  if (itemSlug) {
    const match = pick(available.filter((ad) => ad.target_type === "item" && ad.target_item_slug === itemSlug && (!page || !ad.target_page || ad.target_page === page)));
    if (match) return match;
  }
  if (page && state) {
    const cityMatch = pick(available.filter((ad) => ad.target_type === "page" && ad.target_page === page && adHasCity(ad)));
    if (cityMatch) return cityMatch;
    const match = pick(available.filter((ad) => ad.target_type === "page" && ad.target_page === page && adState(ad) === state));
    if (match) return match;
  }
  if (page) {
    const cityMatch = pick(available.filter((ad) => ad.target_type === "page" && ad.target_page === page && adHasCity(ad)));
    if (cityMatch) return cityMatch;
    const match = pick(available.filter((ad) => ad.target_type === "page" && ad.target_page === page && noGeo(ad)));
    if (match) return match;
  }
  if (city) {
    const match = pick(available.filter((ad) => ["state", "city"].includes(ad.target_type) && adHasCity(ad)));
    if (match) return match;
  }
  if (state) {
    const match = pick(available.filter((ad) => ["state", "city"].includes(ad.target_type) && adState(ad) === state));
    if (match) return match;
  }
  return pick(available.filter((ad) => ad.target_type === "universal"));
}

/**
 * Fetches ads with fallback priority:
 * 1. Item-specific ad (specific college/course/exam/article)
 * 2. Page + state specific
 * 3. Page-specific (e.g., "colleges" page)
 * 4. State-specific universal
 * 5. Universal fallback
 */
export function useAds(options?: {
  page?: string;
  itemSlug?: string;
  state?: string;
  city?: string;
  variant?: string;
  position?: string;
}) {
  return useQuery({
    // Single shared cache key so every <DynamicAdBanner> reuses the same fetch.
    // Filtering happens in `select` (client-side) - no extra network calls per slot.
    queryKey: ["ads", "all-active"],
    queryFn: async () => {
      const boot = await ensureBootstrap();
      if (boot?.ads) return boot.ads as Ad[];
      const { data, error } = await backendClient
        .from("ads")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Ad[];
    },
    select: (allAds) => {
      if (!allAds.length) return null;

      const prefill = getPrefillCookie();
      const rememberedState = options?.state || prefill.state || "";
      const rememberedCity = options?.city || prefill.city || "";
      return selectBestAd(allAds, { ...options, state: rememberedState, city: rememberedCity });
    },
    staleTime: 5 * 60_000, // 5 min - ads change rarely
    gcTime: 30 * 60_000,
  });
}

/** Fetch all ads for admin management */
export function useAllAds() {
  return useQuery({
    queryKey: ["admin-ads"],
    queryFn: async () => {
      const { data, error } = await backendClient
        .from("ads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ad[];
    },
  });
}
