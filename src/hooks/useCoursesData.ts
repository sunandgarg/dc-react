import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";
import { toast } from "sonner";
import { isMissingExploreSelectionColumn } from "@/lib/homepageExplore";

function isPendingReview(response: { status?: number | null }) {
  return response.status === 202;
}

export type DbCourse = {
  id: string;
  slug: string;
  name: string;
  full_name: string;
  category: string;
  duration: string;
  level: string;
  colleges_count: number;
  avg_fees: string;
  avg_salary: string;
  growth: string;
  description: string;
  eligibility: string;
  top_exams: string[];
  careers: string[];
  subjects: string[];
  image: string;
  mode: string;
  specializations: string[];
  is_active: boolean;
  show_in_explore_by_category: boolean;
  explore_by_category_checked_at: string | null;
  created_at: string;
  updated_at: string;
  // New fields
  status: string;
  short_description: string;
  domain: string;
  duration_type: string;
  study_type: string;
  rating: number;
  fee_type: string;
  fee: number;
  low_fee: number;
  high_fee: number;
  syllabus_pdf_url: string;
  about_content: string;
  scope_content: string;
  subjects_content: string;
  placements_content: string;
  admission_process: string;
  fees_content: string;
  cutoff_content: string;
  specialization_content: string;
  recruiters_content: string;
  syllabus_content: string;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  youtube_video_url: string;
  short_id?: number | null;
};

const HOMEPAGE_EXPLORE_COURSE_SELECT = "id,slug,name,category,categories,colleges_count,growth,avg_salary,priority,updated_at,show_in_explore_by_category,explore_by_category_checked_at";
const HOMEPAGE_FALLBACK_COURSE_SELECT = "id,slug,name,category,categories,colleges_count,growth,avg_salary,priority,updated_at";
type HomepageExploreCourse = Pick<DbCourse, "id" | "slug" | "name" | "category" | "colleges_count" | "growth" | "avg_salary" | "show_in_explore_by_category" | "explore_by_category_checked_at" | "updated_at"> & {
  categories: string[];
  priority: number | null;
};

export function useDbCourses() {
  return useQuery({
    queryKey: ["db-courses"],
    queryFn: async () => {
      const { data, error } = await backendClient
        .from("courses")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("name");
      if (error) throw error;
      return data as DbCourse[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useHomepageCategoryCourses(category: string) {
  return useQuery({
    queryKey: ["homepage-category-courses", category],
    queryFn: async () => {
      const categoryPattern = `%${category}%`;
      const selectedBase = () => backendClient
        .from("courses")
        .select(HOMEPAGE_EXPLORE_COURSE_SELECT)
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

      const selected = new Map<string, HomepageExploreCourse>();
      if (!selectionUnavailable) {
        [...(selectedPrimaryResult.data || []), ...(selectedAdditionalResult.error ? [] : selectedAdditionalResult.data || [])]
          .forEach((row) => selected.set(row.id, row as HomepageExploreCourse));
      }
      if (selected.size > 0) {
        return [...selected.values()]
          .sort((a, b) => Date.parse(b.explore_by_category_checked_at || "0") - Date.parse(a.explore_by_category_checked_at || "0"))
          .slice(0, 5);
      }

      const fallbackBase = () => backendClient
        .from("courses")
        .select(HOMEPAGE_FALLBACK_COURSE_SELECT)
        .eq("is_active", true)
        .order("priority", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("name")
        .limit(5);
      const [fallbackPrimary, fallbackAdditional] = await Promise.allSettled([
        fallbackBase().ilike("category", categoryPattern),
        fallbackBase().contains("categories", [category]),
      ]);
      const fallbackPrimaryResult = fallbackPrimary.status === "fulfilled" ? fallbackPrimary.value : { data: [], error: fallbackPrimary.reason };
      const fallbackAdditionalResult = fallbackAdditional.status === "fulfilled" ? fallbackAdditional.value : { data: [], error: fallbackAdditional.reason };
      if (fallbackPrimaryResult.error) throw fallbackPrimaryResult.error;

      const fallback = new Map<string, HomepageExploreCourse>();
      [...(fallbackPrimaryResult.data || []), ...(fallbackAdditionalResult.error ? [] : fallbackAdditionalResult.data || [])]
        .forEach((row) => fallback.set(row.id, row as HomepageExploreCourse));
      const categoryRows = [...fallback.values()]
        .sort((a, b) => (a.priority ?? 101) - (b.priority ?? 101) || Date.parse(b.updated_at || "0") - Date.parse(a.updated_at || "0"))
        .slice(0, 5);
      if (categoryRows.length > 0) return categoryRows;

      const { data, error } = await backendClient
        .from("courses")
        .select(HOMEPAGE_FALLBACK_COURSE_SELECT)
        .eq("is_active", true)
        .order("priority", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("name")
        .limit(5);
      if (error) throw error;
      return (data || []) as HomepageExploreCourse[];
    },
    staleTime: 10 * 60_000,
  });
}

export function useAllDbCourses() {
  return useQuery({
    queryKey: ["db-courses-all"],
    queryFn: async () => {
      const { data, error } = await backendClient
        .from("courses")
        .select("*")
        .order("priority", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("name");
      if (error) throw error;
      return data as DbCourse[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useDbCourse(slugOrSlugId: string | undefined) {
  return useQuery({
    queryKey: ["db-course", slugOrSlugId],
    queryFn: async () => {
      if (!slugOrSlugId) return null;
      const m = slugOrSlugId.match(/^(.*?)-(\d+)$/);
      const id = m ? Number(m[2]) : null;
      const slug = m ? m[1] : slugOrSlugId;
      if (id) {
        const { data } = await backendClient.from("courses").select("*").eq("short_id", id).maybeSingle();
        if (data) return data as DbCourse;
      }
      const { data, error } = await backendClient
        .from("courses")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as DbCourse | null;
    },
    enabled: !!slugOrSlugId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (course: Partial<DbCourse> & { slug: string; name: string }) => {
      let pendingReview = false;
      if (course.id) {
        const { id, created_at, updated_at, ...rest } = course;
        delete rest.short_id;
        const response = await backendClient.from("courses").update(rest).eq("id", id);
        const { error } = response;
        if (error) throw error;
        pendingReview = isPendingReview(response);
      } else {
        const { id, created_at, updated_at, ...rest } = course;
        delete rest.short_id;
        const response = await backendClient.from("courses").insert(rest);
        const { error } = response;
        if (error) throw error;
        pendingReview = isPendingReview(response);
      }
      return { pendingReview };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["db-courses"] });
      qc.invalidateQueries({ queryKey: ["homepage-category-courses"] });
      toast.success(result.pendingReview ? "Course draft submitted for admin review." : "Course saved!");
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await backendClient.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["db-courses"] });
      toast.success("Course deleted!");
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
}
