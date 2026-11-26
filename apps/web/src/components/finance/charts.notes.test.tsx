// @vitest-environment jsdom

import type { CashPoint, FinanceChartNote } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { BurnLines, noteBucketIndex } from "./charts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const months: CashPoint[] = ["2026-07", "2026-08", "2026-09"].map((m, i) => ({
  start: `${m}-01`,
  end: `${m}-${i === 1 ? "31" : "30"}`,
  outCents: 100_000 * (i + 1),
  revenueCents: 0,
  financingCents: 0,
  partial: false,
}));
const quarter: CashPoint[] = [
  { ...months[0]!, start: "2026-07-01", end: "2026-09-30", partial: false },
];

it("maps a pinned date to the bucket that holds it, whatever the bucket size", () => {
  expect(noteBucketIndex(months, "2026-08-01")).toBe(1);
  expect(noteBucketIndex(months, "2026-08-31")).toBe(1);
  expect(noteBucketIndex(months, "2026-06-30")).toBe(-1);
  expect(noteBucketIndex(quarter, "2026-08-01")).toBe(0);
});

it("marks the bucket of each note, on a month and again on a quarter", async () => {
  const note: FinanceChartNote = { id: "n1", day: "2026-08-01", text: "Hired two", mine: true };
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 600,
  });
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  const notes = { notes: [note], onAdd: async () => {}, onDelete: async () => {} };
  const render = (series: CashPoint[], granularity: "month" | "quarter") =>
    act(async () =>
      root.render(
        <BurnLines
          series={series}
          granularity={granularity}
          label="Burn"
          onOpen={() => {}}
          notes={notes}
        />,
      ),
    );
  await render(months, "month");
  const markers = el.querySelectorAll("[data-testid=burn-note-marker]");
  expect(markers).toHaveLength(1);
  expect(markers[0]?.textContent).toBe("Hired two");
  // The marker sits on August, the second bucket.
  expect(markers[0]?.closest("g[role=link]")?.getAttribute("aria-label")).toContain("Hired two");
  await render(quarter, "quarter");
  expect(el.querySelectorAll("[data-testid=burn-note-marker]")).toHaveLength(1);
  act(() => root.unmount());
});
