/** The most height the list gives up: a larger gap above the footer reads as dead space. */
const MAX_GAP = 8;

/**
 * Ends a scrolling list on a row boundary when that costs at most MAX_GAP px (as bottom margin);
 * a bigger leftover stays as a partly shown row, which the edge fade and snapping scroll mark as
 * more to see. Run after layout changes; it measures from the list's natural height, so repeated
 * calls settle on the same value.
 */
export function endOnWholeRow(scroller: HTMLElement | null, rowSelector = "[data-roster-row]") {
  if (!scroller) return;
  const margin = Number.parseFloat(scroller.style.marginBottom) || 0;
  const natural = scroller.clientHeight + margin;
  const top = scroller.getBoundingClientRect().top - scroller.scrollTop;
  let fit = 0;
  for (const row of scroller.querySelectorAll<HTMLElement>(rowSelector)) {
    const bottom = row.getBoundingClientRect().bottom - top;
    if (bottom <= natural + 0.5) fit = Math.max(fit, bottom);
  }
  const overflows = scroller.scrollHeight > natural + 1;
  const leftover = overflows && fit > 0 ? natural - fit : 0;
  const next = leftover > 0 && leftover <= MAX_GAP ? leftover : 0;
  if (next !== margin) scroller.style.marginBottom = next ? `${next}px` : "";
}
