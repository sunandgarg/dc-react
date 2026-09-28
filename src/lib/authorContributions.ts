import { backendClient } from "@/integrations/backend/client";
import { buildCollegeHref, buildCourseHref, buildExamHref } from "@/lib/entityUrls";

export type Contribution = {
  id: string; slug: string; short_id?: number; name?: string; title?: string;
  description?: string; image?: string; featured_image?: string; cover_image?: string;
  created_at: string; class_num?: number; board_slug?: string;
};

export const AUTHOR_SOURCES = [
  { table: "articles", label: "Articles", columns: "id,slug,title,description,featured_image,created_at", titleColumn: "title", hasStatus: true, href: (row: Contribution) => `/news/${row.slug}` },
  { table: "colleges", label: "Colleges", columns: "id,slug,short_id,name,description,image,created_at", titleColumn: "name", hasStatus: true, href: buildCollegeHref },
  { table: "courses", label: "Courses", columns: "id,slug,short_id,name,description,image,created_at", titleColumn: "name", hasStatus: true, href: buildCourseHref },
  { table: "exams", label: "Exams", columns: "id,slug,short_id,name,description,image,created_at", titleColumn: "name", hasStatus: true, href: buildExamHref },
  { table: "scholarships", label: "Scholarships", columns: "id,slug,title,description,image,created_at", titleColumn: "title", hasStatus: false, href: (row: Contribution) => `/scholarships/${row.slug}` },
  { table: "career_profiles", label: "Career Profiles", columns: "id,slug,name,description,image,created_at", titleColumn: "name", hasStatus: true, href: (row: Contribution) => `/careers/${row.slug}` },
  { table: "study_subjects", label: "Study Material", columns: "id,slug,name,description,cover_image,created_at,class_num,board_slug", titleColumn: "name", hasStatus: false, href: (row: Contribution) => `/study-material/class-${row.class_num}/${row.board_slug}/${row.slug}` },
] as const;

export type AuthorSource = typeof AUTHOR_SOURCES[number];
export const AUTHOR_PAGE_SIZE = 12;

export async function fetchAuthorContributions(
  source: AuthorSource,
  author: { id: string; name: string },
  offset = 0,
  search = "",
) {
  let query = backendClient.from(source.table).select(source.columns, { count: "exact" }).eq("is_active", true);
  if (source.table === "articles") {
    query = query.eq("site_scope", "dekhocampus").eq("status", "Published");
    const id = JSON.stringify(author.id);
    // Two OR groups express id = writer OR (id IS NULL AND byline = writer).
    // The REST API supports flat groups, not nested and(...). Explicit IDs win
    // over a stale text byline, so we never claim another author's articles.
    query = query.or(`author_id.eq.${id},author_id.is.null`)
      .or(`author_id.eq.${id},author.eq.${JSON.stringify(author.name)}`);
  } else {
    query = query.eq("author_id", author.id);
    // These legacy entities have non-publication statuses such as Upcoming;
    // active remains their visibility flag. Exclude drafts explicitly even
    // when the visitor is an authenticated administrator.
    if (source.hasStatus) query = query.neq("status", "Draft").neq("status", "draft");
  }
  if (search.trim()) query = query.ilike(source.titleColumn, `%${search.trim()}%`);
  const { data, error, count } = await query.order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(offset, offset + AUTHOR_PAGE_SIZE - 1);
  if (error) throw error;
  const rows = (data || []) as Contribution[];
  const nextOffset = count != null ? (offset + rows.length < count ? offset + rows.length : undefined)
    : (rows.length === AUTHOR_PAGE_SIZE ? offset + rows.length : undefined);
  return { rows, count, nextOffset };
}
