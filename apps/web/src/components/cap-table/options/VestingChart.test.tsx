// @vitest-environment jsdom

import type { VestingEvent } from "@rakazo/core/equity";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { VestingChart } from "./VestingChart";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Add whole calendar months to a YYYY-MM-DD date, clamped to a UTC day. */
const addMonths = (iso: string, months: number) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1 + months, day ?? 1))
    .toISOString()
    .slice(0, 10);
};

/** Four years monthly with a one year cliff: the cliff, then monthly steps to the total. */
const cliffEvents = (): VestingEvent[] => {
  const total = 48_000n;
  const monthly = total / 48n;
  const start = "2023-01-01";
  const events: VestingEvent[] = [
    { date: addMonths(start, 12), shares: monthly * 12n, cumulative: monthly * 12n },
  ];
  for (let month = 13; month <= 48; month += 1) {
    const previous = events.at(-1)?.cumulative ?? 0n;
    const shares = month === 48 ? total - previous : monthly;
    events.push({
      date: addMonths(start, month),
      shares,
      cumulative: previous + shares,
    });
  }
  return events;
};

let root: ReturnType<typeof createRoot> | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

const render = async (node: ReactNode) => {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(node));
  return container.querySelector("svg");
};

/** Every vertex of a step path: the opening move plus each "H…V…" step. */
const vertices = (d: string): string[] => [
  ...(d.match(/M[^HV]*/) ?? []),
  ...(d.match(/H[^HV]*V[^HV]*/g) ?? []),
];

it("names the vested and total shares in the accessible label", async () => {
  const svg = await render(
    <VestingChart events={cliffEvents()} total={48_000n} asOf="2024-01-01" />,
  );
  expect(svg?.getAttribute("role")).toBe("img");
  expect(svg?.getAttribute("aria-label")).toBe("Vesting: 12,000 of 48,000 vested by 2024-01-01");
});

it("counts a later as-of date against the events", async () => {
  const svg = await render(
    <VestingChart events={cliffEvents()} total={48_000n} asOf="2025-01-01" />,
  );
  expect(svg?.getAttribute("aria-label")).toBe("Vesting: 24,000 of 48,000 vested by 2025-01-01");
});

it("renders nothing without events", async () => {
  const svg = await render(<VestingChart events={[]} total={48_000n} asOf="2025-01-01" />);
  expect(svg).toBeNull();
  expect(document.body.textContent).toBe("");
});

it("steps once per event after the start", async () => {
  const events = cliffEvents();
  const svg = await render(<VestingChart events={events} total={48_000n} asOf="2026-04-01" />);
  const path = svg?.querySelector("path");
  const points = vertices(path?.getAttribute("d") ?? "");
  expect(points).toHaveLength(events.length + 1);
  // The line starts at zero on the baseline and ends at the total.
  expect(points[0]).toBe("M4,136");
  expect(points.at(-1)?.endsWith("V22")).toBe(true);
});

it("marks the as-of date inside the range and drops it outside", async () => {
  const inside = await render(
    <VestingChart events={cliffEvents()} total={48_000n} asOf="2025-06-01" />,
  );
  const insideDashed = [...(inside?.querySelectorAll("line") ?? [])].filter(
    (line) => line.getAttribute("stroke-dasharray") !== null,
  );
  expect(insideDashed).toHaveLength(1);

  document.body.innerHTML = "";
  act(() => root?.unmount());
  const outside = await render(
    <VestingChart events={cliffEvents()} total={48_000n} asOf="2020-01-01" />,
  );
  const outsideDashed = [...(outside?.querySelectorAll("line") ?? [])].filter(
    (line) => line.getAttribute("stroke-dasharray") !== null,
  );
  expect(outsideDashed).toHaveLength(0);
});
