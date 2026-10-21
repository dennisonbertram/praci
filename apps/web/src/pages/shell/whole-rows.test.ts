// @vitest-environment jsdom

import { expect, it } from "vitest";
import { endOnWholeRow } from "./whole-rows";

// jsdom has no layout, so the geometry is supplied: a 100px-tall list of 30px rows.
function list(rows: number, height = 100) {
  const el = document.createElement("div");
  const margin = () => Number.parseFloat(el.style.marginBottom) || 0;
  Object.defineProperty(el, "clientHeight", { get: () => height - margin() });
  Object.defineProperty(el, "scrollHeight", { get: () => rows * 30 });
  el.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  for (let i = 0; i < rows; i++) {
    const row = document.createElement("div");
    row.dataset.rosterRow = String(i);
    row.getBoundingClientRect = () => ({ bottom: (i + 1) * 30 }) as DOMRect;
    el.append(row);
  }
  return el;
}

it("gives up the leftover height so the last visible row is whole", () => {
  const el = list(6);
  endOnWholeRow(el);
  expect(el.style.marginBottom).toBe("10px");
  endOnWholeRow(el);
  expect(el.style.marginBottom).toBe("10px");
});

it("leaves a list that fits alone, and clears an old margin", () => {
  const el = list(3);
  el.style.marginBottom = "10px";
  endOnWholeRow(el);
  expect(el.style.marginBottom).toBe("");
});
