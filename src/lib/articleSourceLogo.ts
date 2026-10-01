import { resolveExamLogo } from "@/lib/examBranding";

export function resolveArticleSourceLogo(value: unknown): string {
  const source = String(value || "").trim();
  const legacyExamLogo = source.match(/\/exam-logos-v[123]\/([^/?#]+)\.(?:png|jpe?g|webp)(?:[?#]|$)/i);
  if (!legacyExamLogo) return source;
  return resolveExamLogo({ slug: legacyExamLogo[1], logo: source });
}
