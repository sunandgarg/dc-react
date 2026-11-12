import { beforeEach, expect, it, vi } from "vitest";
import { useInfiniteData } from "./useInfiniteData";
import { useCollegeDirectory } from "./useCollegeDirectory";

const state = vi.hoisted(() => ({ options: null as any, next: vi.fn(), chain: {} as any }));
vi.mock("@tanstack/react-query", () => ({ useInfiniteQuery: (options: any) => {
  state.options = options;
  return { fetchNextPage: state.next, data: undefined };
} }));
vi.mock("@/integrations/backend/client", () => ({ backendClient: { from: () => state.chain } }));
beforeEach(() => {
  state.next.mockReset();
  state.chain = {};
  for (const name of ["select", "eq", "order", "range", "or", "in", "overlaps"]) state.chain[name] = vi.fn(() => state.chain);
  state.chain.abortSignal = vi.fn(async () => ({ data: Array.from({length:10}, (_,id)=>({id})), error:null }));
});

it.each(["courses", "exams"] as const)("loads %s in tens only when requested", async table => {
  const list = useInfiniteData({table, columns:"id,name",queryKey:[table]});
  const options = state.options;
  expect(state.next).not.toHaveBeenCalled();
  const signal = new AbortController().signal;
  const first = await options.queryFn({pageParam:0, signal});
  expect(state.chain.range).toHaveBeenLastCalledWith(0,9);
  expect(state.chain.abortSignal).toHaveBeenCalledWith(signal);
  expect(options.getNextPageParam(first,[first])).toBe(10);
  await list.loadMore();
  expect(state.next).toHaveBeenCalledTimes(1);
  await options.queryFn({pageParam:10, signal});
  expect(state.chain.range).toHaveBeenLastCalledWith(10,19);
  expect(options.getNextPageParam({...first,items:[]},[first])).toBeUndefined();
  expect(options.refetchOnWindowFocus).toBe(false);
  expect(options.refetchOnReconnect).toBe(false);
});

it("uses a cancellable ten-college chunk and stable indexed ordering", async () => {
  useCollegeDirectory();
  const options = state.options;
  const signal = new AbortController().signal;
  const first = await options.queryFn({pageParam:0,signal});
  expect(state.chain.range).toHaveBeenLastCalledWith(0,9);
  expect(state.chain.abortSignal).toHaveBeenCalledWith(signal);
  expect(state.chain.order.mock.calls.map(([name]:string[])=>name)).toEqual(["priority","featured_rank","rating","id"]);
  expect(options.getNextPageParam(first,[first])).toBe(1);
  await options.queryFn({pageParam:1,signal});
  expect(state.chain.range).toHaveBeenLastCalledWith(10,19);
  expect(options.getNextPageParam([], [first,[]])).toBeUndefined();
});
