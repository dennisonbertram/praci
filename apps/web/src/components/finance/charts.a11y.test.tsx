// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { LineChart } from "./charts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
function stubWidth() {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 600,
  });
}
afterEach(() => {
  if (width) Object.defineProperty(HTMLElement.prototype, "clientWidth", width);
  setHideAmounts(false);
});

async function label(node: ReactNode) {
  stubWidth();
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  await act(async () => root.render(node));
  const svg = el.querySelector("svg");
  const aria = svg?.getAttribute("aria-label") ?? "";
  act(() => root.unmount());
  el.remove();
  return aria;
}

it("summarises the line's start and end amounts for a screen reader", async () => {
  expect(
    await label(
      <LineChart
        label="Cash balance"
        height={160}
        values={[900_000, 820_000, 760_000, 640_000, 590_000, 480_000]}
        labels={["Jan", "Feb", "Mar", "Apr", "May", "Jun"]}
      />,
    ),
  ).toBe("Cash balance: Jan $9,000 to Jun $4,800");
});

it("keeps the amounts out of the label while amounts are hidden", async () => {
  setHideAmounts(true);
  const aria = await label(
    <LineChart
      label="Cash balance"
      height={160}
      values={[900_000, 820_000, 760_000, 640_000, 590_000, 480_000]}
      labels={["Jan", "Feb", "Mar", "Apr", "May", "Jun"]}
    />,
  );
  expect(aria).toBe("Cash balance: Jan to Jun");
  expect(aria).not.toMatch(/\d/);
});

it("ends a projection on its last real point and names the projected end", async () => {
  const aria = await label(
    <LineChart
      label="Runway"
      height={160}
      values={[900_000, 500_000, 100_000, 0]}
      labels={["Jan", "Feb", "Mar", "Apr"]}
      solidUntil={1}
      endMarker
      projectedLabel="Projected"
    />,
  );
  expect(aria).toBe("Runway: Jan $9,000 to Feb $5,000, Projected $0");
  expect(aria).not.toContain("Apr");
});

it("keeps the sign of a balance below zero, as the axis does", async () => {
  expect(
    await label(
      <LineChart
        label="Balance"
        height={160}
        values={[100_000, 40_000, -50_000]}
        labels={["Jan", "Feb", "Mar"]}
      />,
    ),
  ).toBe("Balance: Jan $1,000 to Mar −$500");
});

it("leaves projected amounts out too while amounts are hidden", async () => {
  setHideAmounts(true);
  const aria = await label(
    <LineChart
      label="Runway"
      height={160}
      values={[900_000, 500_000, 100_000, 0]}
      labels={["Jan", "Feb", "Mar", "Apr"]}
      solidUntil={1}
      endMarker
      projectedLabel="Projected"
    />,
  );
  expect(aria).toBe("Runway: Jan to Feb, Projected");
  expect(aria).not.toMatch(/\d/);
});
