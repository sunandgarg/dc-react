import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";
import { toast } from "sonner";
import { isMissingExploreSelectionColumn } from "@/lib/homepageExplore";
import { getPrefillCookie } from "@/components/CookieConsent";
import {
  DELHI_NCR_CITIES,
  isDelhiNcrLocation,
  rankPartnerColleges,
  rankSimilarColleges,
  type RecommendationLocation,
} from "@/lib/collegeRecommendations";

function isPendingReview(response: { status?: number | null }) {
  return response.status === 202;
}

export type DbCollege = {
  id: string;
  short_id?: number | null;
  slug: string;
  name: string;
  short_name: string;
  location: string;
  city: string;
  state: string;
  type: string;
  category: string;
  rating: number;
  reviews: number;
  courses_count: number;
  fees: string;
  placement: string;
  ranking: string;
  image: string;
  tags: string[];
  established: number;
  description: string;
  highlights: string[];
  facilities: string[];
  approvals: string[];
  naac_grade: string;
  top_recruiters: string[];
  is_active: boolean;
  show_in_explore_by_category: boolean;
  explore_by_category_checked_at: string | null;
  created_at: string;
  updated_at: string;
  // New fields
  status: string;
  logo: string;
  carousel_images: string[];
  brochure_url: string;
  eligibility_criteria: string;
  admission_process: string;
  scholarship_details: string;
  hostel_life: string;
  gallery_images: string[];
  cutoff: string;
  course_fee_content: string;
  placement_content: string;
  rankings_content: string;
  facilities_content: string;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  banner_ad_image: string;
  square_ad_image: string;
  youtube_video_url: string;
  priority?: number | null;
  priority_updated_at?: string | null;
  featured_rank?: number | null;
  apply_cta_mode?: string | null;
  apply_url?: string | null;
  admission_deadline?: string | null;
  admission_criteria_points?: string[] | null;
  affiliation_kind?: "university" | "affiliated" | "standalone" | null;
  parent_university_slug?: string | null;
  is_partner?: boolean | null;
};

export type AdminCollegeListItem = Pick<DbCollege,
  | "id" | "slug" | "name" | "short_name" | "location" | "city" | "state"
  | "type" | "category" | "rating" | "reviews" | "courses_count" | "established"
  | "image" | "logo" | "status" | "is_active" | "updated_at" | "priority"
  | "featured_rank" | "affiliation_kind" | "is_partner" | "show_in_explore_by_category"
>;

export type AdminCollegeListFilters = {
  page: number;
  pageSize: number;
  search?: string;
  status?: "all" | "Published" | "Draft";
  category?: string;
  state?: string;
};

const ADMIN_COLLEGE_LIST_SELECT = "id,slug,name,short_name,location,city,state,type,category,rating,reviews,courses_count,established,image,logo,status,is_active,updated_at,priority,featured_rank,affiliation_kind,is_partner,show_in_explore_by_category";
const PUBLIC_COLLEGE_CARD_SELECT = "id,slug,name,short_name,location,city,state,type,category,rating,reviews,courses_count,fees,image,logo,tags,established,approvals,naac_grade,is_active,status,priority,priority_updated_at,featured_rank,affiliation_kind,parent_university_slug,is_partner";
const HOMEPAGE_EXPLORE_COLLEGE_SELECT = "id,slug,name,short_name,city,state,category,categories,rating,image,logo,priority,show_in_explore_by_category,explore_by_category_checked_at";
const HOMEPAGE_FALLBACK_COLLEGE_SELECT = "id,slug,name,short_name,city,state,category,categories,rating,image,logo,priority";
type HomepageExploreCollege = Pick<DbCollege, "id" | "slug" | "name" | "short_name" | "city" | "state" | "category" | "rating" | "image" | "logo" | "priority" | "show_in_explore_by_category" | "explore_by_category_checked_at"> & {
  categories: string[];
};

const COLLEGE_PAGE_SIZE = 1000;

async function fetchActiveColleges(): Promise<DbCollege[]> {
  const { data, error } = await backendClient
    .from("colleges")
    .select(PUBLIC_COLLEGE_CARD_SELECT)
    .eq("is_active", true)
    .order("priority", { ascending: true, nullsFirst: false })
    .order("featured_rank", { ascending: true, nullsFirst: false })
    .order("priority_updated_at", { ascending: false })
    .order("rating", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as unknown as DbCollege[];
}

async function fetchAllColleges(): Promise<DbCollege[]> {
  const colleges: DbCollege[] = [];

  for (let from = 0; ; from += COLLEGE_PAGE_SIZE) {
    const { data, error } = await backendClient
      .from("colleges")
      .select("*")
      .order("priority", { ascending: true, nullsFirst: false })
      .order("featured_rank", { ascending: true, nullsFirst: false })
      .order("priority_updated_at", { ascending: false })
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + COLLEGE_PAGE_SIZE - 1);

    if (error) throw error;
    const page = (data ?? []) as DbCollege[];
    colleges.push(...page);
    if (page.length < COLLEGE_PAGE_SIZE) break;
  }

  return colleges;
}

export function useDbColleges() {
  return useQuery({
    queryKey: ["db-colleges"],
    queryFn: async () => {
      // Sort rule (UI/UX 2026, leaderboard semantics):
      //   1. priority asc (1 = top, nulls last) - admin-pinned items always win
      //   2. featured_rank asc (1-4 slots) - secondary tiebreaker
      //   3. most-recently re-pinned wins ties
      //   4. rating desc
      return fetchActiveColleges();
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useFeaturedCollegeCards(slugs: string[]) {
  const orderedSlugs = [...new Set(slugs.filter(Boolean))];

  return useQuery({
    queryKey: ["featured-college-cards", orderedSlugs],
    queryFn: async () => {
      if (!orderedSlugs.length) return [] as DbCollege[];
      const { data, error } = await backendClient
        .from("colleges")
        .select(PUBLIC_COLLEGE_CARD_SELECT)
        .eq("is_active", true)
        .in("slug", orderedSlugs);

      if (error) throw error;

      const rows = new Map<string, DbCollege>();
      ((data ?? []) as unknown as DbCollege[]).forEach((row) => rows.set(row.slug, row));
      return orderedSlugs.map((slug) => rows.get(slug)).filter(Boolean) as DbCollege[];
    },
    enabled: orderedSlugs.length > 0,
    staleTime: 10 * 60_000,
  });
}

/** Small, independent homepage query so category cards never depend on the
 * directory's first top-100 batch. */
export function useHomepageCategoryColleges(category: string) {
  return useQuery({
    queryKey: ["homepage-category-colleges", category],
    queryFn: async () => {
      const categoryPattern = `%${category}%`;
      const selectedBase = () => backendClient
        .from("colleges")
        .select(HOMEPAGE_EXPLORE_COLLEGE_SELECT)
        .eq("is_active", true)
        .eq("show_in_explore_by_category", true)
        .order("explore_by_category_checked_at", { ascending: false, nullsFirst: false })
        .limit(5);

      const [selectedPrimary, selectedAdditional] = await Promise.allSettled([
        selectedBase().ilike("category", categoryPattern),
        selectedBase().contains("categories", [category]),
      ]);
      const selectedPrimaryResult = selectedPrimary.status === "fulfilled" ? selectedPrimary.value : { data: [], error: selectedPrimary.reason };
      const selectedAdditionalResult = selectedAdditional.status === "fulfilled" ? selectedAdditional.value : { data: [], error: selectedAdditional.reason };
      const selectionUnavailable = isMissingExploreSelectionColumn(selectedPrimaryResult.error)
        || isMissingExploreSelectionColumn(selectedAdditionalResult.error);
      if (selectedPrimaryResult.error && !selectionUnavailable) throw selectedPrimaryResult.error;

      const selected = new Map<string, HomepageExploreCollege>();
      if (!selectionUnavailable) {
        [...(selectedPrimaryResult.data || []), ...(selectedAdditionalResult.error ? [] : selectedAdditionalResult.data || [])]
          .forEach((row) => selected.set(row.id, row as HomepageExploreCollege));
      }

      if (selected.size > 0) {
        return [...selected.values()]
          .sort((a, b) => Date.parse(b.explore_by_category_checked_at || "0") - Date.parse(a.explore_by_category_checked_at || "0"))
          .slice(0, 5);
      }

      const fallbackBase = () => backendClient
        .from("colleges")
        .select(HOMEPAGE_FALLBACK_COLLEGE_SELECT)
        .eq("is_active", true)
        .order("priority", { ascending: true, nullsFirst: false })
        .order("rating", { ascending: false, nullsFirst: false })
        .limit(5);
      const [fallbackPrimary, fallbackAdditional] = await Promise.allSettled([
        fallbackBase().ilike("category", categoryPattern),
        fallbackBase().contains("categories", [category]),
      ]);
      const fallbackPrimaryResult = fallbackPrimary.status === "fulfilled" ? fallbackPrimary.value : { data: [], error: fallbackPrimary.reason };
      const fallbackAdditionalResult = fallbackAdditional.status === "fulfilled" ? fallbackAdditional.value : { data: [], error: fallbackAdditional.reason };
      if (fallbackPrimaryResult.error) throw fallbackPrimaryResult.error;

      const fallback = new Map<string, HomepageExploreCollege>();
      [...(fallbackPrimaryResult.data || []), ...(fallbackAdditionalResult.error ? [] : fallbackAdditionalResult.data || [])]
        .forEach((row) => fallback.set(row.id, row as HomepageExploreCollege));
      const categoryRows = [...fallback.values()]
        .sort((a, b) => (a.priority ?? 101) - (b.priority ?? 101) || (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 5);
      if (categoryRows.length > 0) return categoryRows;

      const { data, error } = await backendClient
        .from("colleges")
        .select(HOMEPAGE_FALLBACK_COLLEGE_SELECT)
        .eq("is_active", true)
        .order("is_partner", { ascending: false, nullsFirst: false })
        .order("priority", { ascending: true, nullsFirst: false })
        .order("rating", { ascending: false, nullsFirst: false })
        .limit(5);
      if (error) throw error;
      return (data || []) as HomepageExploreCollege[];
    },
    staleTime: 10 * 60_000,
  });
}

export function useAllDbColleges() {
  return useQuery({
    queryKey: ["db-colleges-all"],
    queryFn: fetchAllColleges,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAdminCollegeList(filters: AdminCollegeListFilters) {
  const page = Math.max(1, filters.page);
  const pageSize = Math.max(10, Math.min(100, filters.pageSize));
  const search = (filters.search ?? "").trim().replace(/[,%()]/g, " ").replace(/\s+/g, " ");

  return useQuery({
    queryKey: ["admin-colleges-list-v2", page, pageSize, search, filters.status ?? "all", filters.category ?? "", filters.state ?? ""],
    queryFn: async () => {
      let query = backendClient
        .from("colleges")
        .select(ADMIN_COLLEGE_LIST_SELECT, { count: "exact" });

      if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
      if (filters.category) query = query.eq("category", filters.category);
      if (filters.state) query = query.eq("state", filters.state);
      if (search) {
        query = query.or(`name.ilike.%${search}%,short_name.ilike.%${search}%,slug.ilike.%${search}%,city.ilike.%${search}%,state.ilike.%${search}%`);
      }

      const from = (page - 1) * pageSize;
      const { data, error, count } = await query
        .order("priority", { ascending: true, nullsFirst: false })
        .order("featured_rank", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      return { rows: (data ?? []) as AdminCollegeListItem[], total: count ?? 0 };
    },
    placeholderData: (previous) => previous,
    staleTime: 30 * 1000,
  });
}

export function useAdminCollegeStats() {
  return useQuery({
    queryKey: ["admin-colleges-stats-v2"],
    queryFn: async () => {
      const [total, published, draft, active, inactive] = await Promise.all([
        backendClient.from("colleges").select("id", { count: "exact", head: true }),
        backendClient.from("colleges").select("id", { count: "exact", head: true }).eq("status", "Published"),
        backendClient.from("colleges").select("id", { count: "exact", head: true }).eq("status", "Draft"),
        backendClient.from("colleges").select("id", { count: "exact", head: true }).eq("is_active", true),
        backendClient.from("colleges").select("id", { count: "exact", head: true }).eq("is_active", false),
      ]);
      const failed = [total, published, draft, active, inactive].find((result) => result.error);
      if (failed?.error) throw failed.error;
      return {
        total: total.count ?? 0,
        published: published.count ?? 0,
        draft: draft.count ?? 0,
        active: active.count ?? 0,
        inactive: inactive.count ?? 0,
      };
    },
    staleTime: 30 * 1000,
    refetchOnMount: "always",
  });
}

/**
 * Sensible defaults so a freshly-created college (just slug + name) still
 * renders a complete-looking detail page. Admin-entered values always win.
 */
function applyCollegeFallbacks(c: DbCollege | null): DbCollege | null {
  if (!c) return c;
  const shortName = c.short_name || c.name;
  const yr = new Date().getFullYear();
  return {
    ...c,
    short_name: shortName,
    location: c.location || [c.city, c.state].filter(Boolean).join(", ") || "India",
    city: c.city || "-",
    state: c.state || "India",
    type: c.type || "Private",
    category: c.category || "General",
    rating: c.rating ?? 4.2,
    reviews: c.reviews ?? 0,
    courses_count: c.courses_count ?? 25,
    fees: c.fees || "₹50,000 - ₹2,50,000 / year (approx.)",
    placement: c.placement || "₹4 - 8 LPA (avg.)",
    ranking: c.ranking || "Emerging",
    image: c.image || "/placeholder.svg",
    tags: c.tags?.length ? c.tags : ["Admissions Open", `Session ${yr}`],
    established: c.established || 2000,
    description:
      c.description ||
      `<p>${shortName} is a recognised ${c.type || "private"} institution offering a wide range of programs across UG and PG streams. Admissions for the ${yr} academic session are now open. Read on for fees, placements, courses, ranking, scholarships and admission process.</p>`,
    highlights: c.highlights?.length
      ? c.highlights
      : [
          `Recognised ${c.type || "Private"} institution`,
          `Multiple UG & PG programs`,
          `Modern campus & infrastructure`,
          `Active placement cell`,
          `Scholarships available for eligible students`,
        ],
    facilities: c.facilities?.length ? c.facilities : ["Library", "Hostel", "Wi-Fi Campus", "Cafeteria", "Sports Complex", "Labs"],
    approvals: c.approvals?.length ? c.approvals : ["UGC", "AICTE"],
    naac_grade: c.naac_grade || "-",
    top_recruiters: c.top_recruiters?.length
      ? c.top_recruiters
      : ["TCS", "Infosys", "Wipro", "Accenture", "Cognizant", "HCL"],
  };
}

export function useDbCollege(slugOrSlugId: string | undefined) {
  return useQuery({
    queryKey: ["db-college", slugOrSlugId],
    queryFn: async () => {
      if (!slugOrSlugId) return null;
      // Parse trailing -<id>
      const m = slugOrSlugId.match(/^(.*?)-(\d+)$/);
      const id = m ? Number(m[2]) : null;
      const slug = m ? m[1] : slugOrSlugId;

      // Try id first (canonical), then slug fallback.
      if (id) {
        const { data } = await backendClient.from("colleges").select("*").eq("short_id", id).maybeSingle();
        if (data) return applyCollegeFallbacks(data as DbCollege);
      }
      const { data, error } = await backendClient
        .from("colleges")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return applyCollegeFallbacks(data as DbCollege | null);
    },
    enabled: !!slugOrSlugId,
    staleTime: 5 * 60 * 1000,
  });
}


export function useCollegesByState(state: string | undefined, excludeSlug?: string) {
  return useQuery({
    queryKey: ["db-colleges-state", state, excludeSlug],
    queryFn: async () => {
      let q = backendClient.from("colleges").select("*").eq("state", state!).eq("is_active", true).limit(6);
      if (excludeSlug) q = q.neq("slug", excludeSlug);
      const { data, error } = await q;
      if (error) throw error;
      return data as DbCollege[];
    },
    enabled: !!state,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCollegesByCategory(category: string | undefined, excludeSlug?: string) {
  return useQuery({
    queryKey: ["db-colleges-category", category, excludeSlug],
    queryFn: async () => {
      let q = backendClient.from("colleges").select("*").eq("category", category!).eq("is_active", true).limit(6);
      if (excludeSlug) q = q.neq("slug", excludeSlug);
      const { data, error } = await q;
      if (error) throw error;
      return data as DbCollege[];
    },
    enabled: !!category,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSimilarColleges(college: DbCollege | null | undefined, limit = 8) {
  const visitor = typeof window === "undefined" ? {} : getPrefillCookie();
  const current = college ? {
    slug: college.slug,
    city: college.city,
    state: college.state,
    location: college.location,
    category: college.category,
    type: college.type,
    affiliation_kind: college.affiliation_kind,
  } : null;

  return useQuery({
    queryKey: ["similar-colleges-v2", current, visitor.city || "", visitor.state || "", limit],
    queryFn: async () => {
      if (!college || !current) return [] as DbCollege[];
      const candidateLimit = Math.max(24, limit * 4);
      const base = () => {
        let query = backendClient
          .from("colleges")
          .select(PUBLIC_COLLEGE_CARD_SELECT)
          .eq("is_active", true)
          .limit(candidateLimit);
        query = query.neq("slug", college.slug);
        return query;
      };
      const queries: any[] = [];
      if (college.state) queries.push(base().eq("state", college.state));
      if (college.category) queries.push(base().eq("category", college.category));
      if (isDelhiNcrLocation(college)) queries.push(base().in("city", DELHI_NCR_CITIES));
      if (!queries.length) queries.push(base().order("rating", { ascending: false, nullsFirst: false }));
      const results = await Promise.all(queries);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      const candidates = results.flatMap((result) => result.data || []) as unknown as DbCollege[];
      return rankSimilarColleges(candidates, current, visitor, limit);
    },
    enabled: Boolean(college?.slug),
    staleTime: 10 * 60 * 1000,
  });
}

export function usePartnerColleges(limit = 8, excludeSlug?: string, preferredLocation?: RecommendationLocation) {
  const cached = typeof window === "undefined" ? {} : getPrefillCookie();
  const preferred = {
    city: preferredLocation?.city || cached.city,
    state: preferredLocation?.state || cached.state,
  };
  return useQuery({
    queryKey: ["partner-colleges-v2", limit, excludeSlug, preferred.city || "", preferred.state || ""],
    queryFn: async () => {
      const candidateLimit = Math.max(24, limit * 4);
      const base = () => {
        let query = backendClient
          .from("colleges")
          .select(PUBLIC_COLLEGE_CARD_SELECT)
          .eq("is_active", true)
          .eq("is_partner", true)
          .limit(candidateLimit);
        if (excludeSlug) query = query.neq("slug", excludeSlug);
        return query;
      };
      const queries: any[] = [base()
        .order("priority", { ascending: true, nullsFirst: false })
        .order("featured_rank", { ascending: true, nullsFirst: false })
        .order("rating", { ascending: false, nullsFirst: false })];
      if (preferred.state) queries.push(base().eq("state", preferred.state));
      if (isDelhiNcrLocation(preferred)) queries.push(base().in("city", DELHI_NCR_CITIES));
      const results = await Promise.all(queries);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      const candidates = results.flatMap((result) => result.data || []) as unknown as DbCollege[];
      return rankPartnerColleges(candidates, preferred, limit);
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useSaveCollege() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (college: Partial<DbCollege> & { slug: string; name: string }) => {
      let pendingReview = false;
      if (college.id) {
        const { id, created_at, updated_at, ...rest } = college;
        const response = await backendClient.from("colleges").update(rest).eq("id", id);
        const { error } = response;
        if (error) throw error;
        pendingReview = isPendingReview(response);
      } else {
        const { id, created_at, updated_at, ...rest } = college;
        const response = await backendClient.from("colleges").insert(rest);
        const { error } = response;
        if (error) throw error;
        pendingReview = isPendingReview(response);
      }
      return { pendingReview };
    },
    onSuccess: (result) => {
      // Invalidate every cached colleges query so changes (priority, featured rank,
      // status, etc.) reflect everywhere without a hard refresh.
      qc.invalidateQueries({ predicate: (q) => {
        const k = q.queryKey?.[0];
        return typeof k === "string" && (k.startsWith("db-college") || k.startsWith("admin-colleges") || k.startsWith("infinite-college") || k === "featured-colleges" || k.startsWith("homepage-category-colleges"));
      }});
      toast.success(result.pendingReview ? "College draft submitted for admin review." : "College saved!");
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
}

export function useDeleteCollege() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await backendClient.from("colleges").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => {
        const k = q.queryKey?.[0];
        return typeof k === "string" && (k.startsWith("db-college") || k.startsWith("admin-colleges") || k.startsWith("infinite-college") || k === "featured-colleges");
      }});
      toast.success("College deleted!");
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
}
