import { expect, it, vi } from "vitest";
import { listAllCursor, listAllPages } from "./list-all";

it("reads every page until the total is reached", async () => {
  const fetchPage = vi.fn(async (page: number) => ({
    items: page === 1 ? [1, 2] : [3],
    total: 3,
  }));
  expect(await listAllPages(fetchPage)).toEqual([1, 2, 3]);
  expect(fetchPage).toHaveBeenCalledTimes(2);
});

it("stops on an empty page even if the total is wrong", async () => {
  const fetchPage = vi.fn(async () => ({ items: [] as number[], total: 5 }));
  expect(await listAllPages(fetchPage)).toEqual([]);
  expect(fetchPage).toHaveBeenCalledTimes(1);
});

it("follows the cursor to the end", async () => {
  const fetchPage = vi.fn(async (cursor: string | undefined) =>
    cursor ? { items: ["b"], nextCursor: null } : { items: ["a"], nextCursor: "c1" },
  );
  expect(await listAllCursor(fetchPage)).toEqual(["a", "b"]);
  expect(fetchPage).toHaveBeenLastCalledWith("c1");
});
