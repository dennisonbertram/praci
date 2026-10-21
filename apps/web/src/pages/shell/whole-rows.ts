/**
 * Ends a scrolling list on a row boundary: when rows overflow, the list gives up the leftover
 * height (as bottom margin) so no row is cut in half at rest. Run after layout changes; it
 * measures from the list's natural height, so repeated calls settle on the same value.
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
  // Never give up more than one row's worth, so a list with one tall child keeps its height.
  const leftover = overflows && fit > 0 ? natural - fit : 0;
  const next = leftover > 0 && leftover < 80 ? leftover : 0;
  if (next !== margin) scroller.style.marginBottom = next ? `${next}px` : "";
}
