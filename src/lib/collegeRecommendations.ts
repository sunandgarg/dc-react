export type CollegeRecommendation = {
  slug?: string | null;
  city?: string | null;
  state?: string | null;
  location?: string | null;
  category?: string | null;
  type?: string | null;
  affiliation_kind?: string | null;
  is_partner?: boolean | null;
  priority?: number | null;
  featured_rank?: number | null;
  rating?: number | null;
};

export type RecommendationLocation = {
  city?: string | null;
  state?: string | null;
};

export const DELHI_NCR_CITIES = [
  "Delhi",
  "New Delhi",
  "Noida",
  "Greater Noida",
  "Ghaziabad",
  "Gurgaon",
  "Gurugram",
  "Faridabad",
];

const normalizedNcrCities = new Set(DELHI_NCR_CITIES.map(normalize));

function normalize(value?: string | null) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function placeText(location: RecommendationLocation & { location?: string | null }) {
  return normalize([location.city, location.state, location.location].filter(Boolean).join(" "));
}

export function isDelhiNcrLocation(location?: (RecommendationLocation & { location?: string | null }) | null) {
  if (!location) return false;
  const city = normalize(location.city);
  const place = placeText(location);
  return normalizedNcrCities.has(city)
    || place.includes("delhi ncr")
    || place.includes("national capital region");
}

function institutionClass(college: CollegeRecommendation) {
  const kind = normalize(college.affiliation_kind);
  const type = normalize(college.type);
  return kind === "university" || type.includes("university") ? "university" : "college";
}

function qualityScore(college: CollegeRecommendation) {
  const priority = Number(college.priority ?? 999);
  const featuredRank = Number(college.featured_rank ?? 999);
  return (college.is_partner ? 8 : 0)
    + Math.max(0, 8 - Math.min(priority, 8))
    + Math.max(0, 5 - Math.min(featuredRank, 5))
    + Math.min(10, Number(college.rating || 0));
}

function locationScore(candidate: CollegeRecommendation, target?: RecommendationLocation | null) {
  if (!target) return 0;
  const city = normalize(candidate.city);
  const state = normalize(candidate.state);
  const targetCity = normalize(target.city);
  const targetState = normalize(target.state);
  if (city && targetCity && city === targetCity) return 80;
  if (isDelhiNcrLocation(candidate) && isDelhiNcrLocation(target)) return 65;
  if (state && targetState && state === targetState) return 50;
  return 0;
}

export function rankSimilarColleges<T extends CollegeRecommendation>(
  candidates: T[],
  current: CollegeRecommendation,
  visitor?: RecommendationLocation | null,
  limit = 8,
) {
  const currentClass = institutionClass(current);
  const category = normalize(current.category);
  const type = normalize(current.type);
  const unique = new Map<string, T>();
  candidates.forEach((candidate) => {
    if (candidate.slug && candidate.slug !== current.slug) unique.set(candidate.slug, candidate);
  });

  return [...unique.values()]
    .map((candidate) => ({
      candidate,
      sameClass: institutionClass(candidate) === currentClass,
      score: locationScore(candidate, current)
        + (category && normalize(candidate.category) === category ? 30 : 0)
        + (type && normalize(candidate.type) === type ? 15 : 0)
        + Math.round(locationScore(candidate, visitor) * 0.12)
        + qualityScore(candidate),
    }))
    .sort((a, b) => Number(b.sameClass) - Number(a.sameClass) || b.score - a.score || String(a.candidate.slug).localeCompare(String(b.candidate.slug)))
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

export function rankPartnerColleges<T extends CollegeRecommendation>(
  candidates: T[],
  preferred?: RecommendationLocation | null,
  limit = 8,
) {
  const unique = new Map<string, T>();
  candidates.forEach((candidate) => {
    if (candidate.slug) unique.set(candidate.slug, candidate);
  });
  return [...unique.values()]
    .sort((a, b) => locationScore(b, preferred) - locationScore(a, preferred)
      || qualityScore(b) - qualityScore(a)
      || String(a.slug).localeCompare(String(b.slug)))
    .slice(0, limit);
}
