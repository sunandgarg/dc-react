import directory from "./applyUniversities.json";

export type ApplyUniversity = { name: string; city: string; url: string };

// Editorial starting points, not a ranking or a complete register. Keep links on
// each university's own domain; students should confirm the admission notice there.
export const UNIVERSITIES_BY_STATE: Record<string, ApplyUniversity[]> = directory;

export const FEATURED_UNIVERSITIES = [
  directory.Karnataka[0], directory.Delhi[0], directory["Uttar Pradesh"][0],
  directory.Maharashtra[0], directory["Tamil Nadu"][0], directory["West Bengal"][0],
  directory.Telangana[0], directory.Punjab[0], directory.Assam[0], directory.Kerala[0],
];
