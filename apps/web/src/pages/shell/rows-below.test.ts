// @vitest-environment jsdom

import { expect, it } from "vitest";
import { MORE_BAR_HEIGHT, moreBarCover, rowsBelow } from "./rows-below";

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
    row.getBoundingClientRect = () => ({ top: bottom - 40, bottom }) as DOMRect;
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

it("counts rows under the taller 44px bar on a phone", () => {
  const original = window.matchMedia;
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
  try {
    // A row ending 40px above the foot is covered by a 44px bar but not a 28px one.
    expect(rowsBelow([list(0, [BOTTOM - 40])])).toBe(1);
  } finally {
    window.matchMedia = original;
  }
});

it("grows the bar over a row it would cut in half", () => {
  const edge = BOTTOM - MORE_BAR_HEIGHT;
  // The second row spans edge-20..edge+20, so the bar must start 20 px higher.
  expect(moreBarCover([list(0, [edge - 20, edge + 20, 450])])).toBe(20);
  expect(moreBarCover([list(0, [edge - 40, 450])])).toBe(0);
});

it("covers a row that is mostly in view above the bar, never leaving a partial row", () => {
  const edge = BOTTOM - MORE_BAR_HEIGHT;
  // The row spans edge-36..edge+4: 90% in view, still covered whole.
  expect(moreBarCover([list(0, [edge + 4, 450])])).toBe(36);
});
