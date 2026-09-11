export const SITE_SCOPES = ["dekhocampus", "sarkari"] as const;

export type SiteScope = (typeof SITE_SCOPES)[number];

export const DEFAULT_SITE_SCOPE: SiteScope = "dekhocampus";

export function siteScopeLabel(scope: SiteScope) {
  return scope === "sarkari" ? "Sarkari DekhoCampus" : "DekhoCampus";
}
