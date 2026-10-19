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

it("does not draw a finance chart while amounts are hidden, so its shape shows no trend", async () => {
  const el = document.createElement("div");
  document.body.append(el);
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
  expect(el.querySelector("svg")).toBeNull();
  expect(el.textContent).toContain("Chart hidden while amounts are hidden");
  await act(async () => setHideAmounts(false));
  expect(el.querySelector("[data-testid=chart-hidden]")).toBeNull();
  act(() => root.unmount());
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
  expect(el.querySelector("[data-testid=financing-clipped]")?.textContent).toBe("↑ $250,000");
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
