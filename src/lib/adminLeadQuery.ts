import type { SiteScope } from "./siteScope";

export const MAX_ADMIN_LEAD_PAGE_SIZE = 200;
export const MAX_ADMIN_LEAD_BULK_ROWS = 50_000;
export const ADMIN_LEAD_BATCH_SIZE = 1_000;

export type AdminLeadFilters = {
  search: string;
  source: string;
  city: string;
  state: string;
  college: string;
  course: string;
  mode: string;
  category: string;
  device: string;
  status: string;
  range: string;
  customFrom: string;
  customTo: string;
};

type LeadFilterQuery = {
  eq(column: string, value: unknown): LeadFilterQuery;
  gte(column: string, value: unknown): LeadFilterQuery;
  lte(column: string, value: unknown): LeadFilterQuery;
  or(expression: string): LeadFilterQuery;
};

const SERVER_SORT_COLUMNS = new Set([
  "name", "phone", "email", "state", "city", "current_situation", "source",
  "source_category", "device_type", "program_mode", "otp_verified",
  "consent_terms_accepted", "status", "interested_college_slug",
  "interested_exam_slug", "cta", "page_url", "initial_query", "created_at",
]);

/**
 * Boolean REST filters are a small expression language. Remove its structural
 * punctuation from user-entered text before embedding it into an `or` clause;
 * values are still parameterized by the API server after parsing.
 */
export function safeLeadFilterText(value: unknown): string {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f(),"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function normalizeAdminLeadPageSize(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(1, Math.min(MAX_ADMIN_LEAD_PAGE_SIZE, Math.trunc(value)));
}

export function normalizeAdminLeadSort(value: string): string {
  return SERVER_SORT_COLUMNS.has(value) ? value : "created_at";
}

function wildcard(value: unknown) {
  const safe = safeLeadFilterText(value).replace(/[*%]/g, "");
  return safe ? `*${safe}*` : "";
}

export function leadCreatedAtRange(filters: Pick<AdminLeadFilters, "range" | "customFrom" | "customTo">, now = new Date()) {
  if (filters.range === "all") return {};
  if (filters.range === "custom") {
    const from = filters.customFrom ? new Date(`${filters.customFrom}T00:00:00`) : null;
    const to = filters.customTo ? new Date(`${filters.customTo}T23:59:59.999`) : null;
    return {
      from: from && !Number.isNaN(from.getTime()) ? from.toISOString() : undefined,
      to: to && !Number.isNaN(to.getTime()) ? to.toISOString() : undefined,
    };
  }
  const days = ({ "1d": 1, "2d": 2, "7d": 7, "15d": 15, "30d": 30 } as Record<string, number>)[filters.range];
  return days ? { from: new Date(now.getTime() - days * 86_400_000).toISOString() } : {};
}

/** Applies mandatory tenant scope first, then all filters supported by SQL. */
export function applyAdminLeadFilters<T extends LeadFilterQuery>(
  query: T,
  siteScope: SiteScope,
  filters: AdminLeadFilters,
  now = new Date(),
): T {
  let next: LeadFilterQuery = query.eq("site_scope", siteScope);
  const search = wildcard(filters.search);
  if (search) {
    next = next.or([
      `name.ilike.${search}`,
      `phone.ilike.${search}`,
      `email.ilike.${search}`,
      `city.ilike.${search}`,
      `source.ilike.${search}`,
    ].join(","));
  }

  const exactFilters: Array<[string, string]> = [
    ["source", filters.source],
    ["city", filters.city],
    ["state", filters.state],
    ["interested_college_slug", filters.college],
    ["source_category", filters.category],
    ["device_type", filters.device],
  ];
  exactFilters.forEach(([column, value]) => {
    if (value && value !== "all") next = next.eq(column, value);
  });

  const course = wildcard(filters.course);
  if (filters.course !== "all" && course) {
    next = next.or([
      `interested_course_slug.ilike.${course}`,
      `current_situation.ilike.${course}`,
      `initial_query.ilike.${course}`,
    ].join(","));
  }

  if (filters.mode !== "all") {
    next = filters.mode === "regular"
      ? next.or("program_mode.eq.regular,program_mode.is.null")
      : next.eq("program_mode", filters.mode);
  }
  if (filters.status !== "all") {
    next = filters.status === "new"
      ? next.or("status.eq.new,status.is.null")
      : next.eq("status", filters.status);
  }

  const createdAt = leadCreatedAtRange(filters, now);
  if (createdAt.from) next = next.gte("created_at", createdAt.from);
  if (createdAt.to) next = next.lte("created_at", createdAt.to);
  return next as T;
}
