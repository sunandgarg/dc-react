import directory from "./applyUniversities.json";
import delhiNcrDirectory from "./delhiNcrUniversities.json";

export type ApplyUniversity = { name: string; city: string; url: string };

// Editorial starting points, not a ranking or a complete register. Keep links on
// each university's own domain; students should confirm the admission notice there.
export const UNIVERSITIES_BY_STATE: Record<string, ApplyUniversity[]> = directory;

export const DELHI_NCR_UNIVERSITIES: ApplyUniversity[] = delhiNcrDirectory;

// One handpicked university for each orange state on the map. Their marks are
// stored locally from the institutions' own websites, with a text fallback.
export const SPOTLIGHT_UNIVERSITIES = [
  { state: "Delhi", university: directory.Delhi[0], logo: "/university-logos/delhi.webp" },
  { state: "Haryana", university: directory.Haryana[1], logo: "/university-logos/haryana.webp" },
  { state: "Gujarat", university: directory.Gujarat[0], logo: "/university-logos/gujarat.webp" },
  { state: "Punjab", university: directory.Punjab[0], logo: "/university-logos/punjab.webp" },
  { state: "Chandigarh", university: directory.Chandigarh[0], logo: "/university-logos/chandigarh.webp" },
  { state: "Uttarakhand", university: directory.Uttarakhand[2], logo: "/university-logos/uttarakhand.webp" },
  { state: "Uttar Pradesh", university: directory["Uttar Pradesh"][0], logo: "/university-logos/uttar-pradesh.webp" },
  { state: "Tamil Nadu", university: directory["Tamil Nadu"][0], logo: "/university-logos/tamil-nadu.webp" },
  { state: "Karnataka", university: directory.Karnataka[0], logo: "/university-logos/karnataka.webp" },
  { state: "Maharashtra", university: directory.Maharashtra[0], logo: "/university-logos/maharashtra.webp" },
];
