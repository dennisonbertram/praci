// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { BurnBars, LineChart } from "./charts";

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

it("scales the Burn bars to spend, and cuts a much larger raise at the top with its amount", async () => {
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
      <BurnBars
        label="Burn"
        height={200}
        granularity="day"
        series={[day(1, 400_000), day(2, 300_000, 25_000_000)]}
        onOpen={() => {}}
      />,
    ),
  );
  expect(el.querySelector("[data-testid=financing-clipped]")?.textContent).toBe("↑ $250,000");
  // The spend bar fills most of the plot instead of being a sliver under a $300k axis.
  const tallest = Math.max(
    ...[...el.querySelectorAll("rect.fill-foreground")].map((r) =>
      Number(r.getAttribute("height")),
    ),
  );
  expect(tallest).toBeGreaterThan(100);
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
    root.render(<BurnBars label="Burn" granularity="day" series={[empty]} onOpen={() => {}} />),
  );
  const labels = [...el.querySelectorAll("text")]
    .map((t) => t.textContent)
    .filter((t) => t?.startsWith("$"));
  expect(labels).toEqual(["$0"]);
  act(() => root.unmount());
  if (width) Object.defineProperty(HTMLElement.prototype, "clientWidth", width);
});
