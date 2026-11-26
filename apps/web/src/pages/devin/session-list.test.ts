import { expect, it } from "vitest";
import { sessions } from "./fixtures";
import { filterSessions, sortSessions } from "./session-list";

const ids = (list: typeof sessions) => list.map((s) => s.id);

it("searches title and pull request, filters status and source", () => {
  expect(ids(filterSessions(sessions, { q: "retry limit" }))).toEqual(["devin-1001"]);
  expect(ids(filterSessions(sessions, { q: "acme/web#88" }))).toEqual(["devin-1002"]);
  expect(ids(filterSessions(sessions, { q: "callers" }))).toEqual(["devin-1001"]);
  expect(ids(filterSessions(sessions, { status: "error" }))).toEqual(["devin-1002"]);
  expect(ids(filterSessions(sessions, { source: "slack" }))).toEqual(["devin-1001"]);
});

it("sorts by updated time, title and status", () => {
  const status = (s: (typeof sessions)[number]) => s.kind;
  expect(sortSessions(sessions, { field: "updated", dir: "desc" }, status)[0]?.id).toBe(
    "devin-1003",
  );
  // Untitled sessions go last in both directions.
  for (const dir of ["asc", "desc"] as const) {
    expect(sortSessions(sessions, { field: "title", dir }, status).at(-1)?.id).toBe("devin-1005");
  }
  const titled = sortSessions(sessions, { field: "title", dir: "asc" }, status)
    .map((s) => s.title)
    .filter(Boolean);
  expect(titled).toEqual([...titled].sort((a, b) => a.localeCompare(b)));
});
