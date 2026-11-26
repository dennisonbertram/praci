// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { expect, it } from "vitest";
import { compareValues, sortBy, useListParams } from "./list-params";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("compares numbers by size and text naturally", () => {
  expect(compareValues(9, 10)).toBeLessThan(0);
  expect(compareValues("Item 9", "item 10")).toBeLessThan(0);
});

it("sorts with empty values last in both directions, and keeps ties in order", () => {
  const items = [
    { n: "a", v: 5 },
    { n: "b", v: null },
    { n: "c", v: 1 },
    { n: "d", v: 5 },
  ];
  expect(sortBy(items, (i) => i.v, "asc").map((i) => i.n)).toEqual(["c", "a", "d", "b"]);
  expect(sortBy(items, (i) => i.v, "desc").map((i) => i.n)).toEqual(["a", "d", "c", "b"]);
});

it("sorts ISO dates as dates", () => {
  const dates = ["2026-11-02", "2026-01-30", "2026-10-15"];
  expect(sortBy(dates, (d) => d, "asc")).toEqual(["2026-01-30", "2026-10-15", "2026-11-02"]);
});

type Api = ReturnType<typeof useListParams<"name" | "value">>;
function mount(url: string) {
  const out: { api?: Api; search: string } = { search: "" };
  function Probe() {
    out.api = useListParams(["name", "value"], { field: "name", dir: "asc" });
    out.search = useLocation().search;
    return null;
  }
  const container = document.createElement("div");
  act(() =>
    createRoot(container).render(
      <MemoryRouter initialEntries={[url]}>
        <Probe />
      </MemoryRouter>,
    ),
  );
  return out;
}

it("reads the sort, falling back for unknown fields", () => {
  expect(mount("/?sort=value&dir=desc").api?.sort).toEqual({ field: "value", dir: "desc" });
  expect(mount("/?sort=bogus").api?.sort).toEqual({ field: "name", dir: "asc" });
});

it("writes filters and sort to the URL, keeping other params and a clean default", () => {
  const out = mount("/?view=deadlines");
  act(() => out.api?.setParam("q", "acme"));
  expect(out.search).toBe("?view=deadlines&q=acme");
  act(() => out.api?.toggleSort("value"));
  expect(out.search).toBe("?view=deadlines&q=acme&sort=value&dir=asc");
  act(() => out.api?.toggleSort("value"));
  expect(out.api?.sort).toEqual({ field: "value", dir: "desc" });
  act(() => out.api?.toggleSort("name"));
  act(() => out.api?.toggleSort("name"));
  act(() => out.api?.toggleSort("name"));
  expect(out.api?.sort).toEqual({ field: "name", dir: "asc" });
  expect(out.search).toBe("?view=deadlines&q=acme");
  act(() => out.api?.clear("q"));
  expect(out.search).toBe("?view=deadlines");
});
