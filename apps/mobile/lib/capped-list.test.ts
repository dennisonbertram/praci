import { describe, expect, it } from "vitest";
import { capItems, filterTodosByDue, searchItems } from "./capped-list";

describe("capItems", () => {
  it("keeps three rows and reports the total", () => {
    expect(capItems([1, 2, 3, 4, 5])).toEqual({ shown: [1, 2, 3], total: 5, capped: true });
  });
  it("does not cap a list of exactly three", () => {
    expect(capItems([1, 2, 3]).capped).toBe(false);
  });
});

describe("searchItems", () => {
  const rows = [
    { n: "Alpha", s: "one" },
    { n: "Beta", s: "two" },
  ];
  it("matches any field, ignoring case", () => {
    expect(searchItems(rows, " TWO ", (r) => [r.n, r.s])).toEqual([rows[1]]);
  });
  it("returns everything for a blank query", () => {
    expect(searchItems(rows, "  ", (r) => [r.n])).toHaveLength(2);
  });
});

describe("filterTodosByDue", () => {
  const now = new Date(2030, 5, 15, 12);
  const todos = [
    { id: "late", dueOn: "2030-06-10" },
    { id: "none", dueOn: null },
    { id: "soon", dueOn: "2030-06-20" },
    { id: "today", dueOn: "2030-06-15" },
  ];
  const ids = (f: Parameters<typeof filterTodosByDue>[1]) =>
    filterTodosByDue(todos, f, now).map((t) => t.id);
  it("sorts by due date with undated last", () => {
    expect(ids("all")).toEqual(["late", "today", "soon", "none"]);
  });
  it("filters overdue, upcoming (today counts) and undated", () => {
    expect(ids("overdue")).toEqual(["late"]);
    expect(ids("upcoming")).toEqual(["today", "soon"]);
    expect(ids("none")).toEqual(["none"]);
  });
});
