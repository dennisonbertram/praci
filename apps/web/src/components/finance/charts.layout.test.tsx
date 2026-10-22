// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { BurnLines, LineChart, StackBar } from "./charts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(width: number, node: ReactNode) {
  const saved = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => width,
  });
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  await act(async () => root.render(node));
  return {
    el,
    done: () => {
      act(() => root.unmount());
      el.remove();
      if (saved) Object.defineProperty(HTMLElement.prototype, "clientWidth", saved);
    },
  };
}

const day = (d: number, financingCents = 0) => ({
  start: `2026-10-${String(d).padStart(2, "0")}`,
  end: `2026-10-${String(d).padStart(2, "0")}`,
  outCents: 300_000,
  revenueCents: 0,
  financingCents,
  partial: false,
});

// The label is about 6 px a character at 11 px, so "Financing, Oct 29 ↑ $250,000" is ~170 px.
it.each([375, 600, 1000])("keeps the Financing label inside the chart at %i px", async (width) => {
  // A raise on any of the last four days must stay inside the plot, wherever it falls.
  for (const raise of [26, 27, 28, 29]) {
    const days = Array.from({ length: 29 }, (_, i) => day(i + 1, i + 1 === raise ? 25_000_000 : 0));
    const { el, done } = await mount(
      width,
      <BurnLines label="Burn" height={200} granularity="day" series={days} onOpen={() => {}} />,
    );
    const text = el.querySelector("[data-testid=financing-clipped]") as SVGTextElement;
    const x = Number(text.getAttribute("x"));
    const len = (text.textContent ?? "").length * 6;
    const anchor = text.getAttribute("text-anchor");
    const [from, to] =
      anchor === "end"
        ? [x - len, x]
        : anchor === "start"
          ? [x, x + len]
          : [x - len / 2, x + len / 2];
    expect(from).toBeGreaterThanOrEqual(0);
    expect(to).toBeLessThanOrEqual(width);
    done();
  }
});

it("folds a long category list into five segments plus Other, each named", async () => {
  const segments = Array.from({ length: 10 }, (_, i) => ({
    key: `k${i}`,
    label: `Category ${i}`,
    cents: 1000 - i * 10,
  }));
  const { el, done } = await mount(
    400,
    <StackBar label="Burn" onOpen={() => {}} segments={segments} />,
  );
  const rects = [...el.querySelectorAll("rect")];
  expect(rects).toHaveLength(6);
  expect(rects.map((r) => r.querySelector("title")?.textContent).at(-1)).toBe("Other");
  expect(rects.every((r) => r.querySelector("title")?.textContent)).toBe(true);
  expect(rects.every((r) => r.getAttribute("tabindex") === "0")).toBe(true);
  done();
});

it("names the dashed part of the projection", async () => {
  const { el, done } = await mount(
    400,
    <LineChart
      label="Cash"
      height={200}
      values={[500, 400, 300, 200]}
      labels={["a", "b", "c", "d"]}
      solidUntil={1}
      projectedLabel="Projected"
    />,
  );
  expect(el.textContent).toContain("Projected");
  done();
});

it("keeps the projected label inside a chart with a short runway", async () => {
  const { el, done } = await mount(
    343,
    <LineChart
      label="Cash"
      height={200}
      values={Array.from({ length: 13 }, (_, i) => 500 - i)}
      labels={Array.from({ length: 13 }, (_, i) => String(i))}
      solidUntil={11}
      projectedLabel="Projected"
    />,
  );
  const text = [...el.querySelectorAll("text")].find((t) => t.textContent === "Projected");
  expect(text?.getAttribute("text-anchor")).toBe("end");
  done();
});

it("draws a flat balance line mid-chart, not on the x axis", async () => {
  const values = [115_000_000, 115_000_000, 115_000_000, 115_000_000];
  const { el, done } = await mount(
    600,
    <LineChart values={values} labels={["a", "b", "c", "d"]} height={200} label="Balance" />,
  );
  const ys = el
    .querySelector("polyline")
    ?.getAttribute("points")
    ?.split(" ")
    .map((p) => Number(p.split(",")[1]));
  done();
  // The plot runs from y=10 to y=170; mid-chart is 90.
  expect(ys?.every((y) => Math.abs(y - 90) < 1)).toBe(true);
});

const month = (m: number, outCents: number, revenueCents: number, partial = false) => ({
  start: `2026-${String(m).padStart(2, "0")}-01`,
  end: `2026-${String(m).padStart(2, "0")}-01`,
  outCents,
  revenueCents,
  financingCents: 0,
  partial,
});

it("starts the monthly chart at the first month with money and ends both lines on the last full month", async () => {
  const series = [
    month(1, 0, 0),
    month(2, 0, 0),
    month(3, 100_000, 50_000),
    month(4, 120_000, 60_000),
    month(5, 130_000, 70_000),
    month(6, 20_000, 10_000, true),
  ];
  const { el, done } = await mount(
    600,
    <BurnLines label="Burn" height={200} series={series} onOpen={() => {}} />,
  );
  const labels = [...el.querySelectorAll("text")].map((t) => t.textContent);
  expect(labels).not.toContain("Jan");
  expect(labels).not.toContain("Feb");
  const endX = (testId: string) =>
    Number(el.querySelector(`[data-testid=${testId}]`)?.getAttribute("cx"));
  // The revenue dot sits on the same month as the Out dot, and neither line reaches it.
  expect(endX("burn-revenue-end")).toBe(endX("burn-out-end"));
  const lastX = (d: string | null | undefined) =>
    Number(
      d
        ?.split(/[ ,CL]+/)
        .filter(Boolean)
        .at(-2),
    );
  const outEnd = lastX(el.querySelector("[data-testid=burn-out-line]")?.getAttribute("d"));
  expect(outEnd).toBeLessThan(endX("burn-out-end"));
  done();
});

it("labels a flat balance's gridlines evenly, with the balance on the middle one", async () => {
  const { el, done } = await mount(
    600,
    <LineChart
      values={[115_000_000, 115_000_000, 115_000_000, 115_000_000]}
      labels={["a", "b", "c", "d"]}
      height={200}
      label="Balance"
    />,
  );
  const labels = [...el.querySelectorAll("text")]
    .map((t) => t.textContent ?? "")
    .filter((t) => t.startsWith("$"));
  done();
  expect(labels).toEqual(["$950k", "$1.15M", "$1.35M"]);
});

it("shows revenue when trimming leaves one month, or one full month plus the current one", async () => {
  const one = await mount(
    600,
    <BurnLines
      label="Burn"
      height={200}
      series={[month(10, 20_000, 10_000, true)]}
      onOpen={() => {}}
    />,
  );
  expect(one.el.querySelector("[data-testid=burn-revenue-end]")).not.toBeNull();
  one.done();
  const two = await mount(
    600,
    <BurnLines
      label="Burn"
      height={200}
      series={[month(9, 100_000, 50_000), month(10, 20_000, 0, true)]}
      onOpen={() => {}}
    />,
  );
  expect(two.el.querySelector("[data-testid=burn-revenue-point]")).not.toBeNull();
  two.done();
});

const markers = (el: Element) =>
  [...el.querySelectorAll("circle")].map((c): [number, number] => [
    Number(c.getAttribute("cx")),
    Number(c.getAttribute("cy")),
  ]);

it("draws the partial month as one mark, with no two markers within 8 px", async () => {
  const series = [
    month(7, 100_000, 50_000),
    month(8, 120_000, 60_000),
    month(9, 130_000, 70_000),
    // Barely started: spend and revenue are both near zero, so their dots would touch.
    { ...month(10, 1_000, 500, true), financingCents: 1_500 },
  ];
  const { el, done } = await mount(
    600,
    <BurnLines label="Burn" height={200} series={series} onOpen={() => {}} />,
  );
  const pts = markers(el);
  for (const [i, a] of pts.entries())
    for (const b of pts.slice(i + 1))
      expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThanOrEqual(8);
  done();
});

it("keeps the partial month's financing marker 8 px from the revenue marker", async () => {
  const series = [
    month(8, 130_000, 70_000),
    { ...month(9, 100_000, 10_000, true), financingCents: 15_000 },
  ];
  const { el, done } = await mount(
    600,
    <BurnLines label="Burn" height={200} series={series} onOpen={() => {}} />,
  );
  const pts = markers(el);
  for (const [i, a] of pts.entries())
    for (const b of pts.slice(i + 1))
      expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThanOrEqual(8);
  done();
});

it("starts quarters at the first one with data and fills the plot width", async () => {
  const q = (start: string, outCents: number) => ({
    start,
    end: start,
    outCents,
    revenueCents: 0,
    financingCents: 0,
    partial: false,
  });
  const { el, done } = await mount(
    600,
    <BurnLines
      label="Burn"
      height={200}
      granularity="quarter"
      series={[
        q("2025-01-01", 0),
        q("2025-04-01", 0),
        q("2025-07-01", 90_000),
        q("2025-10-01", 120_000),
      ]}
      onOpen={() => {}}
    />,
  );
  const labels = [...el.querySelectorAll("text")].map((t) => t.textContent);
  expect(labels).not.toContain("Q1 '25");
  expect(el.querySelectorAll("g[role=link]").length).toBe(2);
  const rect = el.querySelector("g[role=link] rect") as SVGRectElement;
  expect(Number(rect.getAttribute("width"))).toBeGreaterThan(200);
  done();
});

const mk = (m: number, outCents: number, partial = false, financingCents = 0) => ({
  start: `2026-${String(m).padStart(2, "0")}-01`,
  end: `2026-${String(m).padStart(2, "0")}-01`,
  outCents,
  revenueCents: 0,
  financingCents,
  partial,
});

it("draws a single running period as a bar with no stray markers", async () => {
  const { el, done } = await mount(
    600,
    <BurnLines
      label="Burn"
      granularity="year"
      series={[{ ...mk(10, 900_000, true, 250_000), start: "2026-01-01" }]}
      onOpen={() => {}}
    />,
  );
  expect(el.querySelector("[data-testid=burn-bar-out]")).not.toBeNull();
  expect(el.querySelector("[data-testid=burn-out-end]")).toBeNull();
  done();
});

it("never puts two markers within 8 px of each other", async () => {
  const series = [mk(8, 300_000), mk(9, 320_000), mk(10, 310_000, true, 305_000)];
  const { el, done } = await mount(
    375,
    <BurnLines label="Burn" series={series} onOpen={() => {}} />,
  );
  const pts = [...el.querySelectorAll("circle")].map((c) => [
    Number(c.getAttribute("cx")),
    Number(c.getAttribute("cy")),
  ]);
  for (const [i, a] of pts.entries())
    for (const b of pts.slice(i + 1))
      expect(
        Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0)),
      ).toBeGreaterThanOrEqual(8);
  done();
});

it("keeps each month control 44 px wide on a touch screen", async () => {
  const saved = window.matchMedia;
  window.matchMedia = ((q: string) => ({ matches: q.includes("coarse") })) as typeof matchMedia;
  const series = Array.from({ length: 12 }, (_, i) => mk(i + 1, 300_000 + i));
  const { el, done } = await mount(
    375,
    <BurnLines label="Burn" series={series} onOpen={() => {}} />,
  );
  const links = [...el.querySelectorAll("g[role=link] rect")];
  expect(links.length).toBeGreaterThan(0);
  for (const r of links) expect(Number(r.getAttribute("width"))).toBeGreaterThanOrEqual(44);
  done();
  window.matchMedia = saved;
});
