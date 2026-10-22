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
