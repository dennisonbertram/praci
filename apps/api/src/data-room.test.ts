import { expect, it, vi } from "vitest";
import { anyWordQuery, searchWithFallback } from "./data-room.js";

it("turns a question into any-word search terms, leaving a single word alone", () => {
  expect(anyWordQuery("when does our office lease end")).toBe(
    "when or does or our or office or lease or end",
  );
  expect(anyWordQuery("lease")).toBeNull();
  expect(anyWordQuery("  lease  ")).toBeNull();
});

it("does not broaden a query that already uses operators, so exclusions survive", () => {
  expect(anyWordQuery("lease -draft")).toBeNull();
  expect(anyWordQuery('"office lease" end')).toBeNull();
  expect(anyWordQuery("lease or end")).toBeNull();
});

it("keeps matching any word on every page of a broadened search", async () => {
  const pages: Record<string, { results: number[]; nextCursor: string | null }> = {
    "a or b|": { results: [1, 2], nextCursor: "c1" },
    "a or b|c1": { results: [3], nextCursor: null },
  };
  const searchPage = vi.fn(async (query: string, cursor: string | undefined) =>
    query === "a b" ? { results: [], nextCursor: null } : pages[`${query}|${cursor ?? ""}`]!,
  );
  const first = await searchWithFallback(searchPage, { query: "a b" });
  expect(first).toEqual({ results: [1, 2], nextCursor: "any:c1" });
  const second = await searchWithFallback(searchPage, { query: "a b", cursor: first.nextCursor! });
  expect(second).toEqual({ results: [3], nextCursor: null });
});
