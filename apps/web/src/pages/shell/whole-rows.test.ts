// @vitest-environment jsdom

import { expect, it } from "vitest";
import { MORE_BAR_HEIGHT } from "./rows-below";
import { endOnWholeRow } from "./whole-rows";

// jsdom has no layout, so the geometry is supplied: a 200px-tall list of 30px rows.
function list(rows: number, opts: { height?: number; heads?: number[]; expanded?: boolean } = {}) {
  const height = opts.height ?? 200;
  const el = document.createElement("div");
  el.style.overflowY = "auto";
  const margin = () => Number.parseFloat(el.style.marginBottom) || 0;
  Object.defineProperty(el, "clientHeight", { get: () => height - margin() });
  Object.defineProperty(el, "scrollHeight", { get: () => rows * 30 });
  el.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  for (let i = 0; i < rows; i++) {
    const row = document.createElement("div");
    row.dataset.rosterRow = String(i);
    if (opts.heads?.includes(i)) {
      row.dataset.rosterHead = "";
      row.setAttribute("aria-expanded", String(opts.expanded ?? true));
    }
    row.getBoundingClientRect = () => ({ bottom: (i + 1) * 30 }) as DOMRect;
    el.append(row);
  }
  return el;
}

// 200px minus the 28px bar leaves 172px: five whole 30px rows (150px).
it("ends on the last row that clears the bar, leaving the bar in the margin", () => {
  const el = list(10);
  endOnWholeRow([el]);
  expect(Number.parseFloat(el.style.marginBottom)).toBe(200 - 150);
  expect(200 - 150).toBeGreaterThanOrEqual(MORE_BAR_HEIGHT);
  endOnWholeRow([el]);
  expect(el.style.marginBottom).toBe("50px");
});

it("leaves out a space heading whose first row does not fit", () => {
  const el = list(10, { height: 200, heads: [4] });
  endOnWholeRow([el]);
  // Rows 0-3 fit (120px); heading 4 ends at 150 and fits, but row 5 ends at 180 and does not.
  expect(el.style.marginBottom).toBe("80px");
});

it("keeps a collapsed space heading whose next row belongs to another space", () => {
  const el = list(10, { height: 200, heads: [4], expanded: false });
  endOnWholeRow([el]);
  // Heading 4 ends at 150 and fits; row 5 (another space) is not paired with it.
  expect(el.style.marginBottom).toBe("50px");
});

it("leaves a list that fits alone, and clears an old margin", () => {
  const el = list(3);
  el.style.marginBottom = "10px";
  endOnWholeRow([el]);
  expect(el.style.marginBottom).toBe("");
});

it("clears the margin on a list that no longer scrolls", () => {
  const inner = list(3);
  const outer = list(10);
  inner.style.marginBottom = "40px";
  endOnWholeRow([outer, inner]);
  expect(inner.style.marginBottom).toBe("");
  expect(outer.style.marginBottom).toBe("50px");
});
