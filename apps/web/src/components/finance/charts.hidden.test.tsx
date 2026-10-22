// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { axisTicks, BurnLines, LineChart } from "./charts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => setHideAmounts(false));

it("draws the line without a money axis while amounts are hidden", async () => {
  await withWidth(async (el) => {
    const root = createRoot(el);
    setHideAmounts(true);
    await act(async () =>
      root.render(
        <LineChart
          label="Projected cash"
          height={160}
          values={[300, 200, 100, 0]}
          labels={["Oct", "Nov", "Dec", "Jan"]}
        />,
      ),
    );
    // The shape and the dates stay; no dollar figure and no box standing in for the chart.
    expect(el.querySelector("svg polyline")).not.toBeNull();
    expect(el.querySelector("[data-testid=chart-hidden]")).toBeNull();
    expect(el.textContent).toContain("Oct");
    expect(el.textContent).not.toContain("$");
    await act(async () => setHideAmounts(false));
    expect(el.textContent).toContain("$");
    act(() => root.unmount());
  });
});

it("draws a chart that first appeared hidden once amounts are shown again", async () => {
  const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 600,
  });
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  setHideAmounts(true);
  await act(async () =>
    root.render(
      <LineChart label="Balance" height={160} values={[3, 2, 1]} labels={["a", "b", "c"]} />,
    ),
  );
  await act(async () => setHideAmounts(false));
  expect(el.querySelector('svg[aria-label="Balance"]')).not.toBeNull();
  act(() => root.unmount());
  if (width) Object.defineProperty(HTMLElement.prototype, "clientWidth", width);
});

it("scales the Burn lines to spend, and cuts a much larger raise at the top with its amount", async () => {
  const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 600,
  });
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  const day = (d: number, outCents: number, financingCents = 0) => ({
    start: `2026-10-0${d}`,
    end: `2026-10-0${d}`,
    outCents,
    revenueCents: 0,
    financingCents,
    partial: false,
  });
  await act(async () =>
    root.render(
      <BurnLines
        label="Burn"
        height={200}
        granularity="day"
        series={[day(1, 400_000), day(2, 300_000, 25_000_000)]}
        onOpen={() => {}}
      />,
    ),
  );
  expect(el.querySelector("[data-testid=financing-clipped]")?.textContent).toBe(
    "Financing, Oct 2 ↑ $250,000",
  );
  // The raise is a marker on its date, not a line ramping up to it.
  expect(el.querySelector("[data-testid=burn-financing-line]")).toBeNull();
  // The spend line sits high in the plot instead of being a sliver under a $300k axis.
  const firstY = Number(
    el
      .querySelector("[data-testid=burn-out-line]")
      ?.getAttribute("d")
      ?.match(/^M[\d.]+,([\d.]+)/)?.[1],
  );
  expect(firstY).toBeLessThan(60);
  act(() => root.unmount());
  if (width) Object.defineProperty(HTMLElement.prototype, "clientWidth", width);
});

it("draws one $0 gridline, not '$0, $0, $0', when there is nothing to plot", async () => {
  const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 600,
  });
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  const empty = {
    start: "2026-10-01",
    end: "2026-10-01",
    outCents: 0,
    revenueCents: 0,
    financingCents: 0,
    partial: true,
  };
  await act(async () =>
    root.render(<BurnLines label="Burn" granularity="day" series={[empty]} onOpen={() => {}} />),
  );
  const labels = [...el.querySelectorAll("text")]
    .map((t) => t.textContent)
    .filter((t) => t?.startsWith("$"));
  expect(labels).toEqual(["$0"]);
  // A lone period still running is a hollow dot.
  expect(el.querySelector("[data-testid=burn-out-end]")).not.toBeNull();
  act(() => root.unmount());
  if (width) Object.defineProperty(HTMLElement.prototype, "clientWidth", width);
});

it("keeps every period a keyboard link on touch screens", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const opened: string[] = [];
  await withWidth(async (el) => {
    const root = createRoot(el);
    const day = (d: number) => ({
      start: `2026-10-0${d}`,
      end: `2026-10-0${d}`,
      outCents: 100_000,
      revenueCents: 0,
      financingCents: 0,
      partial: false,
    });
    await act(async () =>
      root.render(
        <BurnLines
          label="Burn"
          granularity="day"
          series={[day(1), day(2)]}
          onOpen={(m) => opened.push(m.start)}
        />,
      ),
    );
    expect(el.querySelector("[data-testid=burn-touch-target]")).not.toBeNull();
    const links = [...el.querySelectorAll('g[role="link"]')] as SVGGElement[];
    expect(links).toHaveLength(2);
    await act(async () =>
      links[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
    );
    expect(opened).toEqual(["2026-10-01"]);
    act(() => root.unmount());
  });
  vi.unstubAllGlobals();
});

const withWidth = async (run: (el: HTMLElement) => Promise<void>) => {
  const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 600,
  });
  const el = document.createElement("div");
  document.body.append(el);
  try {
    await run(el);
  } finally {
    el.remove();
    if (width) Object.defineProperty(HTMLElement.prototype, "clientWidth", width);
  }
};

it("draws Out as a line with a gradient area, a dashed last segment for today, and a hover tooltip", async () => {
  await withWidth(async (el) => {
    const root = createRoot(el);
    const spend = [0, 2_000, 700_000, 5_000, 9_000];
    const series = spend.map((outCents, i) => ({
      start: `2026-10-0${i + 1}`,
      end: `2026-10-0${i + 1}`,
      outCents,
      revenueCents: i === 3 ? 12_000 : 0,
      financingCents: 0,
      partial: i === spend.length - 1,
    }));
    await act(async () =>
      root.render(<BurnLines label="Burn" granularity="day" series={series} onOpen={() => {}} />),
    );
    const area = el.querySelector("[data-testid=burn-out-area]");
    expect(area?.getAttribute("fill")).toMatch(/^url\(#.+-out\)$/);
    const gradientId = (area?.getAttribute("fill") ?? "").slice(5, -1);
    expect(document.getElementById(gradientId)?.querySelectorAll("stop")).toHaveLength(2);
    expect(el.querySelector("[data-testid=burn-out-line]")?.getAttribute("d")).toContain("C");
    expect(
      el.querySelector("[data-testid=burn-out-partial]")?.getAttribute("stroke-dasharray"),
    ).toBe("4 4");
    expect(el.querySelector("[data-testid=burn-out-end]")).not.toBeNull();
    expect(el.textContent).not.toContain("So far");
    // The curve never dips below the zero line (the largest y is the baseline).
    const base = Number(
      el
        .querySelector("[data-testid=burn-out-area]")
        ?.getAttribute("d")
        ?.match(/L[\d.]+,([\d.]+)/)?.[1],
    );
    for (const n of (
      el.querySelector("[data-testid=burn-out-line]")?.getAttribute("d") ?? ""
    ).match(/[\d.]+,[\d.]+/g) ?? [])
      expect(Number(n.split(",")[1])).toBeLessThanOrEqual(base);
    expect(el.querySelector("[data-testid=burn-tooltip]")).toBeNull();
    await act(async () =>
      el
        .querySelectorAll("g[role=link]")[2]
        ?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
    );
    expect(el.querySelector("[data-testid=burn-tooltip]")?.textContent).toContain("Oct 3");
    expect(el.querySelector("[data-testid=burn-tooltip]")?.textContent).toContain("$7,000");
    expect(el.querySelector("[data-testid=burn-crosshair]")).not.toBeNull();
    act(() => root.unmount());
  });
});

it("keeps the last axis label and carries a skipped year onto the next label shown", () => {
  const labels = ["Feb '26", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  labels.push("Jan '27", "Feb", "Mar");
  expect(axisTicks(labels, 3).filter(Boolean)).toEqual(["Mar '26", "Jun", "Sep", "Dec", "Mar '27"]);
  expect(axisTicks(["a", "b"], 1)).toEqual(["a", "b"]);
});

const bucket = (start: string, end: string, outCents: number, partial = false) => ({
  start,
  end,
  outCents,
  revenueCents: 0,
  financingCents: 0,
  partial,
});

const axisLabels = (el: HTMLElement) =>
  [...el.querySelectorAll("g[role=link] text")].map((t) => t.textContent);

it("labels weeks, months, quarters and years, and names the bucket in the tooltip", async () => {
  await withWidth(async (el) => {
    const root = createRoot(el);
    const render = (
      granularity: "week" | "month" | "quarter" | "year",
      series: ReturnType<typeof bucket>[],
    ) =>
      act(async () =>
        root.render(
          <BurnLines label="Burn" granularity={granularity} series={series} onOpen={() => {}} />,
        ),
      );
    await render("week", [
      bucket("2026-10-05", "2026-10-11", 10_000),
      bucket("2026-10-12", "2026-10-18", 20_000, true),
    ]);
    expect(axisLabels(el)).toEqual(["Oct 5", "Oct 12*"]);
    await render("month", [
      bucket("2025-12-01", "2025-12-31", 10_000),
      bucket("2026-01-01", "2026-01-31", 20_000),
      bucket("2026-02-01", "2026-02-28", 30_000, true),
    ]);
    expect(axisLabels(el)).toEqual(["Dec '25", "Jan '26", "Feb*"]);
    await render("quarter", [
      bucket("2026-07-01", "2026-09-30", 10_000),
      bucket("2026-10-01", "2026-12-31", 20_000, true),
    ]);
    expect(axisLabels(el)).toEqual(["Q3 '26", "Q4 '26*"]);
    await act(async () =>
      el
        .querySelectorAll("g[role=link]")[0]
        ?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
    );
    const tip = el.querySelector("[data-testid=burn-tooltip]")?.textContent;
    expect(tip).toContain("Q3 '26");
    expect(tip).toContain("$100");
    await render("year", [
      bucket("2025-01-01", "2025-12-31", 10_000),
      bucket("2026-01-01", "2026-12-31", 20_000, true),
    ]);
    expect(axisLabels(el)).toEqual(["2025", "2026*"]);
    act(() => root.unmount());
  });
});

it("dashes only the last segment, and keeps few buckets at the left edge", async () => {
  await withWidth(async (el) => {
    const root = createRoot(el);
    const segments = (id: string) =>
      (el.querySelector(`[data-testid=${id}]`)?.getAttribute("d")?.match(/C/g) ?? []).length;
    const render = (series: ReturnType<typeof bucket>[]) =>
      act(async () =>
        root.render(
          <BurnLines label="Burn" granularity="week" series={series} onOpen={() => {}} />,
        ),
      );
    await render([
      bucket("2026-09-28", "2026-10-04", 10_000),
      bucket("2026-10-05", "2026-10-11", 30_000),
      bucket("2026-10-12", "2026-10-18", 20_000, true),
    ]);
    expect(segments("burn-out-line")).toBe(1);
    expect(segments("burn-out-partial")).toBe(1);
    // Three buckets of a 600px chart do not spread over the full width.
    const x = (i: number) => Number(el.querySelectorAll("g[role=link] text")[i]?.getAttribute("x"));
    expect(x(0)).toBeLessThan(100);
    expect(x(2)).toBeLessThan(300);

    // Two buckets: the one segment is the last, so it is the dashed one.
    await render([
      bucket("2026-10-05", "2026-10-11", 10_000),
      bucket("2026-10-12", "2026-10-18", 20_000, true),
    ]);
    expect(segments("burn-out-line")).toBe(0);
    expect(segments("burn-out-partial")).toBe(1);
    act(() => root.unmount());
  });
});

it("draws a single bucket as a dot, with no line, dashed segment or area", async () => {
  await withWidth(async (el) => {
    const root = createRoot(el);
    await act(async () =>
      root.render(
        <BurnLines
          label="Burn"
          granularity="week"
          series={[bucket("2026-10-12", "2026-10-18", 18_000, true)]}
          onOpen={() => {}}
        />,
      ),
    );
    expect(el.querySelector("svg")).not.toBeNull();
    expect(el.querySelector("[data-testid=burn-out-end]")).not.toBeNull();
    for (const id of ["burn-out-line", "burn-out-partial", "burn-out-area"])
      expect(el.querySelector(`[data-testid=${id}]`)).toBeNull();
    act(() => root.unmount());
  });
});

it("draws the grouped Burn chart without figures while amounts are hidden", async () => {
  await withWidth(async (el) => {
    const root = createRoot(el);
    setHideAmounts(true);
    await act(async () =>
      root.render(
        <BurnLines
          label="Burn"
          granularity="quarter"
          series={[
            bucket("2026-07-01", "2026-09-30", 10_000),
            bucket("2026-10-01", "2026-12-31", 20_000, true),
          ]}
          onOpen={() => {}}
        />,
      ),
    );
    expect(el.querySelector("svg")).not.toBeNull();
    expect(el.querySelectorAll("text:not([aria-hidden])")).not.toHaveLength(0);
    expect([...el.querySelectorAll("text")].some((t) => t.textContent?.startsWith("$"))).toBe(
      false,
    );
    act(() => root.unmount());
  });
});

it("anchors the last axis label of a line chart inside the svg", async () => {
  await withWidth(async (el) => {
    const root = createRoot(el);
    await act(async () =>
      root.render(
        <LineChart
          label="Crypto"
          height={160}
          values={[3, 2, 1]}
          labels={["Oct 1", "Oct 2", "Oct 21"]}
        />,
      ),
    );
    const anchors = [...el.querySelectorAll("text")].map((t) => [
      t.textContent,
      t.getAttribute("text-anchor"),
    ]);
    expect(anchors.at(-1)).toEqual(["Oct 21", "end"]);
    act(() => root.unmount());
  });
});
