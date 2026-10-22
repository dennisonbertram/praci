/** Height of the "+N more" bar that covers the foot of the list while rows remain below. */
export const MORE_BAR_HEIGHT = 28;

/**
 * How many sidebar rows are not fully in view above the "+N more" bar, or 0 when the list is
 * scrolled to its end (or does not scroll). The list scrolls in whichever of `scrollers` is a
 * real scroll container right now: the chats alone on a tall screen, the pages and chats together
 * on a short one or a phone.
 */
export function rowsBelow(
  scrollers: (HTMLElement | null)[],
  rowSelector = "[data-roster-chat],[data-roster-fold]",
) {
  const scroller = scrollers.find((el) => {
    if (!el) return false;
    const style = getComputedStyle(el);
    return (
      style.display !== "contents" &&
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight + 1
    );
  });
  if (!scroller || scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1)
    return 0;
  const edge = scroller.getBoundingClientRect().bottom - MORE_BAR_HEIGHT;
  let count = 0;
  for (const row of scroller.querySelectorAll<HTMLElement>(rowSelector)) {
    if (row.getBoundingClientRect().bottom > edge + 0.5) count += 1;
  }
  return count;
}
