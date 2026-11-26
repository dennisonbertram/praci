// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (strings: TemplateStringsArray) => strings[0] }),
}));

import { Sparkline, trendOf } from "./Sparkline";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("compares the last value with the first", () => {
  expect(trendOf([100, 90, 120])).toBe("up");
  expect(trendOf([100, 130, 90])).toBe("down");
});

it("calls a move under half a percent flat, and no usable start flat", () => {
  expect(trendOf([1, 1.002, 0.999, 1.003])).toBe("flat");
  expect(trendOf([])).toBe("flat");
  expect(trendOf([0, 5])).toBe("flat");
});

async function render(values: number[]) {
  const el = document.createElement("div");
  await act(async () => createRoot(el).render(<Sparkline values={values} />));
  return el;
}

it("names the direction and uses the success or destructive tone", async () => {
  const up = (await render([1, 2])).querySelector("svg");
  expect(up?.getAttribute("aria-label")).toBe("Price up");
  expect(up?.getAttribute("class")).toContain("text-success");
  const down = (await render([2, 1])).querySelector("svg");
  expect(down?.getAttribute("aria-label")).toBe("Price down");
  expect(down?.getAttribute("class")).toContain("text-destructive");
});

it("draws nothing for fewer than two values", async () => {
  expect((await render([5])).querySelector("svg")).toBeNull();
});

async function renderWith(props: { values: number[]; label?: string; neutral?: boolean }) {
  const el = document.createElement("div");
  await act(async () => createRoot(el).render(<Sparkline {...props} />));
  return el;
}

it("keeps the default label and tone for price callers", async () => {
  const svg = (await renderWith({ values: [1, 2] })).querySelector("svg");
  expect(svg?.getAttribute("aria-label")).toBe("Price up");
  expect(svg?.getAttribute("class")).toContain("text-success");
});

it("uses the caller's label and the neutral tone for spend", async () => {
  const rising = (
    await renderWith({ values: [1, 2], label: "Figma spend trend", neutral: true })
  ).querySelector("svg");
  expect(rising?.getAttribute("aria-label")).toBe("Figma spend trend");
  // Rising spend is not success: neutral stays muted whatever the direction.
  expect(rising?.getAttribute("class")).toContain("text-muted-foreground");
  expect(rising?.getAttribute("class")).not.toContain("text-success");
  const falling = (
    await renderWith({ values: [2, 1], label: "Figma spend trend", neutral: true })
  ).querySelector("svg");
  expect(falling?.getAttribute("class")).toContain("text-muted-foreground");
  expect(falling?.getAttribute("class")).not.toContain("text-destructive");
});
