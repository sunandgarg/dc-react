/**
 * Generate fuzzy search variants for a query.
 * Handles dot/space variants (b.tech ↔ btech ↔ b tech),
 * common abbreviations and PG/UG prefixes.
 */
export function buildSearchVariants(s: string): string[] {
  const norm = s.replace(/\s+/g, " ").trim();
  const noDot = norm.replace(/\./g, "");
  const noPunct = noDot.replace(/[^a-z0-9\s]/gi, " ").replace(/\s+/g, " ").trim();
  const compact = noPunct.replace(/\s+/g, "");
  const spaced = noDot.replace(/([a-z])\.?(tech|com|sc|ed|ca|pharm|arch|des|ba|ma|phil|phd)\b/gi, "$1 $2");
  const dotted = compact.replace(/^(b|m)(tech|com|sc|ed|ca|pharm|arch|des|ba|ma|phil|phd)/i, "$1.$2");
  const synonyms: Record<string, string[]> = {
    btech: ["b.tech", "bachelor of technology", "be"],
    mtech: ["m.tech", "master of technology"],
    bsc: ["b.sc", "bachelor of science"],
    msc: ["m.sc", "master of science"],
    ba: ["b.a", "bachelor of arts"],
    ma: ["m.a", "master of arts"],
    mba: ["master of business"],
    bba: ["bachelor of business"],
    bcom: ["b.com", "bachelor of commerce"],
    mcom: ["m.com", "master of commerce"],
    bca: ["b.c.a", "bachelor of computer"],
    mca: ["m.c.a", "master of computer"],
  };
  const extras = synonyms[compact.toLowerCase()] || [];
  const locationAliases: Record<string, string[]> = {
    trivandrum: ["thiruvananthapuram"],
    thiruvananthapuram: ["trivandrum"],
    bangalore: ["bengaluru"],
    bengaluru: ["bangalore"],
    bombay: ["mumbai"],
    madras: ["chennai"],
    calcutta: ["kolkata"],
    gurgaon: ["gurugram"],
    gurugram: ["gurgaon"],
  };
  const aliasVariants = Object.entries(locationAliases).flatMap(([from, to]) => {
    const source = noPunct.toLowerCase();
    if (!source.includes(from)) return [];
    return to.map((alias) => source.replaceAll(from, alias));
  });
  const tokens = noPunct
    .split(" ")
    .filter((token) => token.length >= 3 && !["college", "colleges", "university", "institute", "school", "the", "and", "for"].includes(token));
  return Array.from(
    new Set([norm, noDot, noPunct, compact, spaced, dotted, ...extras, ...aliasVariants, ...tokens].filter((v) => v && v.length >= 2))
  );
}

/** Build a PostgREST `or=` clause across one column for all variants. */
export function buildIlikeOr(column: string, variants: string[]): string {
  return variants.map((v) => `${column}.ilike.%${v.replace(/[%,()]/g, "")}%`).join(",");
}

export function rankDirectoryResult(query: string, name: string, subtitle = ""): number {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const q = normalize(query);
  const haystack = normalize(`${name} ${subtitle}`);
  const acronym = normalize(name)
    .split(" ")
    .filter((word) => word && !["of", "the", "and", "in", "at", "for"].includes(word))
    .map((word) => word[0])
    .join("");
  if (!q || !haystack) return 0;

  const importantTokens = q
    .split(" ")
    .filter((token) => token.length >= 2 && !["of", "the", "and", "in", "at", "for"].includes(token));
  const matchedTokens = importantTokens.filter((token) => haystack.includes(token)).length;
  const coverage = importantTokens.length ? matchedTokens / importantTokens.length : 0;

  let score = coverage * 100;
  if (haystack === q) score += 80;
  if (haystack.startsWith(q)) score += 55;
  if (haystack.includes(q)) score += 45;
  if (normalize(name) === q) score += 40;
  if (normalize(name).startsWith(q)) score += 30;
  if (q.length >= 2 && acronym === q) score += 200;
  return score;
}
