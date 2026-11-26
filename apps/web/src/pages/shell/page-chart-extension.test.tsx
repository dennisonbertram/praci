// @vitest-environment jsdom
import type { PageChart } from "@rakazo/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { usePageChartRows } from "./page-chart-extension";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const data = [{ at: "2026-09-06T13:17:00.000Z", value: 1 }];
const chart = (over?: "history"): PageChart => ({ name: "c", spec: {}, data, over });

function read(c: PageChart): unknown[][] {
  const seen: unknown[][] = [];
  const Probe = () => {
    seen.push(usePageChartRows(c));
    return null;
  };
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe />));
  act(() => root.render(<Probe />));
  act(() => root.unmount());
  return seen;
}

it("gives a history chart Date values with a stable identity across renders", () => {
  const [first, second] = read(chart("history"));
  expect((first as Record<string, unknown>[])[0]?.at).toBeInstanceOf(Date);
  expect(second).toBe(first);
});

it("leaves other charts on their raw strings", () => {
  const [first] = read(chart());
  expect(first).toBe(data);
});
