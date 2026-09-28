import { expect, it, vi } from "vitest";
import { useAdminArticles } from "./useArticlesData";

const chain = vi.hoisted(() => ({ select: vi.fn(), eq: vi.fn(), order: vi.fn(), or: vi.fn(), gte: vi.fn(), range: vi.fn() }));
vi.mock("@/integrations/backend/client", () => ({ backendClient: { from: () => chain } }));
vi.mock("@tanstack/react-query", () => ({ useQuery: (options: unknown) => options, useMutation: vi.fn(), useQueryClient: vi.fn() }));

it("combines search and all filters on the server before counting and paginating", async () => {
  for (const method of [chain.select, chain.eq, chain.order, chain.or, chain.gte]) method.mockReturnValue(chain);
  chain.range.mockResolvedValue({ data: [{ id: "one" }], count: 45, error: null });
  const filters = { createdSince: "2026-09-25T12:00:00.000Z", author: { id: "neha-id", name: "Neha" }, status: "Draft", category: "Exams" };
  const result = useAdminArticles("admission", 2, 20, "dekhocampus", filters) as unknown as { queryFn: () => Promise<unknown>; queryKey: unknown[] };
  expect(await result.queryFn()).toEqual({ rows: [{ id: "one" }], total: 45 });
  expect(chain.select).toHaveBeenCalledWith("*", { count: "exact" });
  expect(chain.eq).toHaveBeenCalledWith("site_scope", "dekhocampus");
  expect(chain.eq).toHaveBeenCalledWith("status", "Draft");
  expect(chain.eq).toHaveBeenCalledWith("category", "Exams");
  expect(chain.gte).toHaveBeenCalledWith("created_at", filters.createdSince);
  expect(chain.or).toHaveBeenCalledTimes(2);
  expect(chain.or).toHaveBeenLastCalledWith('author_id.eq."neha-id",author.eq."Neha"');
  expect(chain.range).toHaveBeenCalledWith(20, 39);
  expect(result.queryKey).toContain(filters);
});
