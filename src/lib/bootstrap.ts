import { functionUrl } from "@/lib/backendMode";

const BOOTSTRAP_TTL = 30_000; // match the short edge cache for admin-managed homepage content
const BOOTSTRAP_CACHE_VERSION = "announcements-v4";

export interface BootstrapPayload {
  hero_banners?: unknown[];
  hero_settings?: unknown;
  featured_colleges?: unknown[];
  trusted_partners?: unknown[];
  lead_form_settings?: unknown;
  feature_toggles?: unknown[];
  ads?: unknown[];
  site_integrations?: Array<{ key: string; value: string | null; enabled: boolean }>;
}

const requests = new Map<keyof BootstrapPayload, { started: number; promise: Promise<BootstrapPayload | null> }>();
let requestRevision = 0;

export function ensureBootstrap(section: keyof BootstrapPayload): Promise<BootstrapPayload | null> {
  const previous = requests.get(section);
  if (previous && Date.now() - previous.started < BOOTSTRAP_TTL) return previous.promise;
  const endpoint = new URL(functionUrl("bootstrap"));
  endpoint.searchParams.set("section", section);
  endpoint.searchParams.set("v", BOOTSTRAP_CACHE_VERSION);
  endpoint.searchParams.set("revision", String(requestRevision));
  const promise = fetch(endpoint, { cache: requestRevision ? "no-cache" : "default" })
    .then(response => response.ok ? response.json() as Promise<BootstrapPayload> : null)
    .catch(() => null);
  requests.set(section, { started: Date.now(), promise });
  return promise;
}

export function resetBootstrap() {
  requests.clear();
  requestRevision += 1;
}
