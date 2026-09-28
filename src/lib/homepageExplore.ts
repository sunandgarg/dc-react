import { backendClient } from "@/integrations/backend/client";
import { HOMEPAGE_COURSE_PICKS } from "./homepageCoursePicks";

export function isMissingExploreSelectionColumn(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("show_in_explore_by_category")
    || message.includes("explore_by_category_checked_at");
}

export const ENGINEERING_COLLEGE_SLUGS = [
  "lovely-professional-university", "chandigarh-university", "amity-university-noida",
  "jecrc-university-jaipur", "kr-mangalam-university-gurgaon",
];

export const FEATURED_COLLEGE_NAMES: Record<string, string> = {
  "lovely-professional-university": "LPU",
  "chandigarh-university": "Chandigarh University",
  "amity-university-noida": "Amity University, Noida",
  "jecrc-university-jaipur": "JECRC University",
  "kr-mangalam-university-gurgaon": "KRMU",
};

const EXAM_PREFERENCES: Record<string, string[]> = {
  Engineering: ["JEE Main", "JEE Advanced", "VITEEE", "SRMJEEE", "BITSAT", "GATE", "MHT CET", "WBJEE"],
  Management: ["CAT", "XAT", "CMAT", "MAT", "NMAT", "SNAP"],
  "Commerce and Banking": ["CUET UG", "CUET PG", "CA Foundation", "CSEET", "CMA Foundation"],
  Medical: ["NEET UG", "NEET PG", "INI CET", "NEET MDS", "NEET SS"],
  Science: ["CUET UG", "IIT JAM", "CUET PG", "IISER IAT", "NEST", "CSIR UGC NET"],
  "Hotel Management": ["NCHM JEE", "NCHMCT JEE", "MAH B HMCT CET", "MAH M HMCT CET"],
  "Information Technology": ["NIMCET", "CUET UG", "CUET PG", "MAH MCA CET", "TG ICET"],
  "Arts & Humanities": ["CUET UG", "CUET PG", "UGC NET"],
  Agriculture: ["ICAR AIEEA PG", "CUET UG", "Rajasthan JET", "GBPUAT Entrance", "PAU CET"],
  Law: ["CLAT", "AILET", "SLAT", "MAH LL B 5 Year CET", "MAH LL B 3 Year CET"],
  Pharmacy: ["GPAT", "NIPER JEE", "MHT CET", "WBJEE"],
  Education: ["CUET PG", "UP B Ed JEE", "Bihar B Ed CET", "Rajasthan PTET", "AP EDCET"],
  Design: ["UCEED", "NID DAT", "NIFT", "CEED", "FDDI AIST"],
};

const CATEGORY_ALIASES: Record<string, string[]> = {
  "Commerce and Banking": ["Commerce & Banking", "Commerce", "Banking"],
  "Arts & Humanities": ["Arts and Humanities", "Arts", "Humanities"],
  "Information Technology": ["IT and Software", "Computer Applications"],
};

// Legacy course imports use broader Medical/Management/Engineering tags.
const COURSE_NAME_TERMS: Record<string, string[]> = {
  "Commerce and Banking": ["commerce", "b.com", "m.com", "banking", "accountancy"],
  "Hotel Management": ["hotel", "hospitality", "tourism"],
  "Information Technology": ["computer applications", "computer science", "information technology", "bca", "mca"],
  Pharmacy: ["pharm"],
};

type ExploreRow = {
  id: string; slug: string; name: string; short_name?: string;
  priority?: number | null; rating?: number; updated_at?: string;
  show_in_explore_by_category?: boolean | number;
  explore_by_category_checked_at?: string | null;
};

const normalizeExam = (name: string) => name.toLowerCase().replace(/\b20\d{2}\b/g, "").replace(/[^a-z0-9]/g, "").replace(/^jeemains$/, "jeemain").replace(/^jam$/, "iitjam").replace(/^nchmctjee$/, "nchmjee");

/** Editorial feature order, not an official institutional ranking. */
export function rankHomepageExplore<T extends ExploreRow>(rows: T[], category: string, table: string): T[] {
  const byId = new Map<string, T>();
  rows.forEach((row) => byId.set(row.id, { ...byId.get(row.id), ...row }));
  const unique = [...byId.values()].filter((row) => table !== "courses" || !row.slug.startsWith("dekho-sample-"));
  const preferences = table === "exams" ? EXAM_PREFERENCES[category] || [] : [];
  const courseSlugs = (HOMEPAGE_COURSE_PICKS[category] || []).map(({ slug }) => slug);
  const rank = (row: T) => {
    const index = table === "colleges" && category === "Engineering"
      ? ENGINEERING_COLLEGE_SLUGS.indexOf(row.slug)
      : table === "courses" ? courseSlugs.indexOf(row.slug)
      : preferences.findIndex((name) => [row.short_name, row.name].some((value) => value && normalizeExam(value) === normalizeExam(name)));
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  const sorted = unique.sort((a, b) => rank(a) - rank(b)
    || Number(Boolean(b.show_in_explore_by_category)) - Number(Boolean(a.show_in_explore_by_category))
    || (a.priority ?? 101) - (b.priority ?? 101)
    || (b.rating ?? 0) - (a.rating ?? 0)
    || (Date.parse(b.updated_at || "") || 0) - (Date.parse(a.updated_at || "") || 0)
    || a.name.localeCompare(b.name));
  const seenNames = new Set<string>();
  return sorted.filter((row) => {
    const key = table === "exams" ? normalizeExam(row.short_name || row.name)
      : table === "courses" ? row.name.toLowerCase().replace(/\s+courses?$/, "").trim() : row.slug;
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });
}

export async function fetchHomepageExplore<T extends ExploreRow>(table: "colleges" | "courses" | "exams", category: string, select: string): Promise<T[]> {
  const aliases = [category, ...(CATEGORY_ALIASES[category] || [])];
  const filters = aliases.flatMap((alias) => [
    `category.ilike.%${alias}%`,
    `categories.cs.${JSON.stringify([alias])}`,
    ...(table === "exams" ? [`exam_streams.cs.${JSON.stringify([alias])}`] : []),
  ]);
  // Named editorial picks also cover legacy exams still tagged only as General.
  if (table === "exams" && EXAM_PREFERENCES[category]?.length) {
    filters.push(`short_name.in.(${EXAM_PREFERENCES[category].map((name) => JSON.stringify(name)).join(",")})`);
  }
  if (table === "courses") {
    filters.push(...(COURSE_NAME_TERMS[category] || []).map((term) => `name.ilike.%${term}%`));
  }
  const query = (fields: string) => {
    let request = backendClient.from(table).select(fields).eq("is_active", true);
    if (table === "exams") request = request.neq("listing_category", "Sarkari");
    return request.or(filters.join(",")).order("priority", { ascending: true, nullsFirst: false }).order("name").limit(200);
  };
  let result = await query(select);
  if (isMissingExploreSelectionColumn(result.error)) {
    result = await query(select.split(",").filter((field) => !["show_in_explore_by_category", "explore_by_category_checked_at"].includes(field)).join(","));
  }
  if (result.error) throw result.error;
  const rows = (result.data || []) as T[];
  // Exact picks must survive broad legacy tags and the category query's 200-row cap.
  const featuredSlugs = table === "courses"
    ? (HOMEPAGE_COURSE_PICKS[category] || []).map(({ slug }) => slug)
    : table === "colleges" && category === "Engineering" ? ENGINEERING_COLLEGE_SLUGS : [];
  if (featuredSlugs.length) {
    const fields = select.split(",").filter((field) => !["show_in_explore_by_category", "explore_by_category_checked_at"].includes(field)).join(",");
    const featured = await backendClient.from(table).select(fields).eq("is_active", true).in("slug", featuredSlugs);
    if (featured.error) throw featured.error;
    rows.push(...(featured.data || []) as T[]);
  }
  return rankHomepageExplore(rows, category, table).slice(0, 5);
}
