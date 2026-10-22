import { moreBarHeight, scrollingList } from "./rows-below";

/**
 * Ends the scrolling sidebar list on a row boundary, with the "+N more" bar in the margin below
 * it, so no row or space heading is ever cut in half at rest. A space heading counts only when
 * the row under it fits too. Run after layout changes; it measures from the list's natural
 * height (height plus its own margin), so repeated calls settle on the same value.
 */
export function endOnWholeRow(
  scrollers: (HTMLElement | null)[],
  rowSelector = "[data-roster-row],[data-roster-fold]",
) {
  const list = scrollingList(scrollers) ?? scrollers.find((el) => el?.style.marginBottom);
  for (const el of scrollers) if (el && el !== list) el.style.marginBottom = "";
  if (!list) return;
  const bar = moreBarHeight();
  const margin = Number.parseFloat(list.style.marginBottom) || 0;
  const natural = list.clientHeight + margin;
  const top = list.getBoundingClientRect().top - list.scrollTop;
  const rows = [...list.querySelectorAll<HTMLElement>(rowSelector)].map((row) => ({
    head: row.hasAttribute("data-roster-head"),
    bottom: row.getBoundingClientRect().bottom - top,
  }));
  const limit = natural - bar + 0.5;
  let fit = 0;
  rows.forEach((row, i) => {
    const next = rows[i + 1];
    if (row.bottom > limit || (row.head && next && next.bottom > limit)) return;
    fit = Math.max(fit, row.bottom);
  });
  const overflows = list.scrollHeight > natural + 1;
  const next = overflows && fit > 0 ? natural - fit : 0;
  if (next !== margin) list.style.marginBottom = next ? `${next}px` : "";
}
