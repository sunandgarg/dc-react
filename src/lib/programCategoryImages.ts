const CATEGORY_ARTWORK: Record<string, string> = {
  "agentic-ai": "/program-categories/agentic-ai.webp",
  "artificial-intelligence": "/program-categories/artificial-intelligence.webp",
  doctorate: "/program-categories/doctorate.webp",
  "machine-learning": "/program-categories/machine-learning.webp",
  "data-science": "/program-categories/data-science.webp",
  mba: "/program-categories/mba.webp",
  marketing: "/program-categories/marketing.webp",
  management: "/program-categories/management.webp",
  education: "/program-categories/education.webp",
  "project-management": "/program-categories/project-management.webp",
};

const CATEGORY_ICONS: Record<string, string> = {
  ...Object.fromEntries(
    Object.keys(CATEGORY_ARTWORK).map((slug) => [slug, `/category-icons/cat-${slug}.png`]),
  ),
  research: "/category-icons/cat-research.png",
};

export function getProgramCategoryArtwork(slug?: string | null) {
  return slug ? CATEGORY_ARTWORK[slug] : undefined;
}

export function getProgramCategoryIcon(slug?: string | null) {
  return slug ? CATEGORY_ICONS[slug] : undefined;
}

export function resolveProgramCategoryEmoji(iconEmoji?: string | null) {
  const value = String(iconEmoji || "").trim();
  return !value || /[✨⭐🌟★☆✦✧❇]/u.test(value) ? "🎓" : value;
}

export function resolveProgramCategoryArtwork(slug?: string | null, adminImageUrl?: string | null) {
  const uploaded = String(adminImageUrl || "").trim();
  const isLegacyBundledIcon = uploaded.startsWith("/category-icons/");
  return uploaded && !isLegacyBundledIcon
    ? uploaded
    : getProgramCategoryArtwork(slug);
}
