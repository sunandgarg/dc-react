import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENGINEERING_COLLEGE_SLUGS, fetchHomepageExplore, rankHomepageExplore } from "./homepageExplore";

const { requests, responses } = vi.hoisted(() => ({ requests: [] as any[], responses: [] as any[] }));
vi.mock("@/integrations/backend/client", () => ({ backendClient: {
  from: (table: string) => {
    const request: any = { table, filters: [] };
    requests.push(request);
    const chain: any = {
      select: (fields: string) => { request.select = fields; return chain; },
      eq: (...args: any[]) => { request.filters.push(args); return chain; },
      neq: (...args: any[]) => { request.filters.push(["neq", ...args]); return chain; },
      or: (filter: string) => { request.or = filter; return chain; },
      order: () => chain,
      limit: () => chain,
      in: (field: string, slugs: string[]) => { request.in = [field, slugs]; return chain; },
      then: (resolve: any, reject: any) => Promise.resolve(responses.shift() || { data: [], error: null }).then(resolve, reject),
    };
    return chain;
  },
} }));

beforeEach(() => { requests.length = 0; responses.length = 0; });
const row = (name: string, extra = {}) => ({ id: name, slug: name, name, priority: 50, ...extra });

describe("homepage category recommendations", () => {
  it("keeps the five requested Engineering colleges first, with stable real slugs", () => {
    const rows = [row("Other", { show_in_explore_by_category: true }), ...ENGINEERING_COLLEGE_SLUGS.map((slug) => row(slug))].reverse();
    expect(rankHomepageExplore(rows, "Engineering", "colleges").slice(0, 5).map((item) => item.slug)).toEqual(ENGINEERING_COLLEGE_SLUGS);
  });

  it("orders JEE Main, JEE Advanced, VITEEE and SRMJEEE before other Engineering exams", () => {
    const rows = [row("WBJEE"), row("JEE Advanced 2026"), row("SRMJEEE"), row("BITSAT"), row("VITEEE"), row("Joint Entrance Examination", { short_name: "JEE-Mains" })];
    expect(rankHomepageExplore(rows, "Engineering", "exams").map((item) => item.name)).toEqual(["Joint Entrance Examination", "JEE Advanced 2026", "VITEEE", "SRMJEEE", "BITSAT", "WBJEE"]);
  });

  it.each(["Management", "Medical", "Science", "Law", "Pharmacy", "Design", "Education"])("keeps editorially selected %s colleges before unselected fallback rows", (category) => {
    expect(rankHomepageExplore([row("Fallback", { priority: 1 }), row("Selected", { show_in_explore_by_category: true })], category, "colleges")[0].name).toBe("Selected");
  });

  it("queries exam streams and category aliases and never fills empty categories with unrelated exams", async () => {
    expect(await fetchHomepageExplore("exams", "Information Technology", "id,slug,name,category,categories")).toEqual([]);
    expect(requests).toHaveLength(1);
    expect(requests[0].or).toContain('exam_streams.cs.["IT and Software"]');
    expect(requests[0].or).toContain('categories.cs.["Computer Applications"]');
    expect(requests[0].filters).toContainEqual(["is_active", true]);
    expect(requests[0].filters).toContainEqual(["neq", "listing_category", "Sarkari"]);
  });

  it("fetches requested Engineering colleges even with incomplete legacy category tags", async () => {
    responses.push({ data: [], error: null }, { data: ENGINEERING_COLLEGE_SLUGS.map((slug) => row(slug)), error: null });
    expect((await fetchHomepageExplore("colleges", "Engineering", "id,slug,name,category,categories")).map((item) => item.slug)).toEqual(ENGINEERING_COLLEGE_SLUGS);
    expect(requests[1].in).toEqual(["slug", ENGINEERING_COLLEGE_SLUGS]);
  });

  it("reports API errors instead of silently showing unrelated results", async () => {
    responses.push({ data: null, error: new Error("Network unavailable") });
    await expect(fetchHomepageExplore("courses", "Law", "id,slug,name")).rejects.toThrow("Network unavailable");
  });

  it("deduplicates legacy exam names while keeping UG and PG exams separate", () => {
    const rows = [row("IIT JAM", { short_name: "JAM" }), row("IIT JAM 2026", { short_name: "IIT JAM" }), row("NEET UG"), row("NEET PG")];
    expect(rankHomepageExplore(rows, "Science", "exams")).toHaveLength(3);
  });

  it.each(["Commerce and Banking", "Hotel Management", "Information Technology", "Pharmacy"])("finds relevant %s courses despite broad legacy tags", async (category) => {
    await fetchHomepageExplore("courses", category, "id,slug,name");
    expect(requests[0].or).toContain("name.ilike.");
  });

  it("supports older schemas missing the homepage selection columns", async () => {
    responses.push({ data: null, error: { message: "Unknown column show_in_explore_by_category" } }, { data: [row("Law Course")], error: null });
    expect(await fetchHomepageExplore("courses", "Law", "id,slug,name,show_in_explore_by_category,explore_by_category_checked_at")).toHaveLength(1);
    expect(requests[1].select).toBe("id,slug,name");
  });
});
