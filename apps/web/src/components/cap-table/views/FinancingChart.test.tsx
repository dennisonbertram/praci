// @vitest-environment jsdom

import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));

import { FinancingChart } from "./FinancingChart";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it("draws one cumulative point per bar and names the running total", () => {
  act(() =>
    root.render(
      <FinancingChart
        bars={[
          { id: "r1", label: "Pre-seed", cents: "50000000" },
          { id: "r2", label: "Seed", cents: "200000000" },
          { id: "r3", label: "Series A", cents: "800000000" },
        ]}
      />,
    ),
  );
  const points = host.querySelector("polyline")?.getAttribute("points")?.split(" ") ?? [];
  expect(points).toHaveLength(3);
  expect(points.at(-1)?.split(",")[1]).toBe("0");
  expect(host.querySelector("svg")?.getAttribute("aria-label")).toContain("$10,500,000");
  expect(host.querySelectorAll("ol li")).toHaveLength(3);
});

it("draws nothing without bars", () => {
  act(() => root.render(<FinancingChart bars={[]} />));
  expect(host.querySelector("polyline")).toBeNull();
});
