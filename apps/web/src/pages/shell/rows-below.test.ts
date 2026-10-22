// @vitest-environment jsdom

import { expect, it } from "vitest";
import { MORE_BAR_HEIGHT, rowsBelow } from "./rows-below";

const BOTTOM = 400;

function list(scrollTop: number, rowBottoms: number[]) {
  const el = document.createElement("div");
  el.style.overflowY = "auto";
  Object.defineProperties(el, {
    clientHeight: { value: 300 },
    scrollHeight: { value: 600 },
    scrollTop: { value: scrollTop, writable: true },
  });
  el.getBoundingClientRect = () => ({ bottom: BOTTOM }) as DOMRect;
  for (const bottom of rowBottoms) {
    const row = document.createElement("div");
    row.dataset.rosterChat = "";
    row.getBoundingClientRect = () => ({ bottom }) as DOMRect;
    el.append(row);
  }
  return el;
}

it("counts rows past the foot of the list, including a half-hidden one under the bar", () => {
  const edge = BOTTOM - MORE_BAR_HEIGHT;
  // Whole row, then a row half under the bar, then two below the fold.
  expect(rowsBelow([list(0, [edge - 10, edge + 20, 450, 500])])).toBe(3);
});

it("shows nothing once the list is scrolled to its end, or when it does not scroll", () => {
  expect(rowsBelow([list(300, [100, 450])])).toBe(0);
  expect(rowsBelow([null, document.createElement("div")])).toBe(0);
});

it("measures the first real scroll container, skipping one that is display: contents", () => {
  const contents = list(0, [450]);
  contents.style.display = "contents";
  expect(rowsBelow([contents, list(0, [100, 450])])).toBe(1);
});
