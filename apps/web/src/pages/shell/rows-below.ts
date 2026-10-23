/** Height of the "+N more" bar that covers the foot of the list while rows remain below. */
export const MORE_BAR_HEIGHT = 28;

/** Coarse pointers (phones) grow every button to 44px in styles.css, the bar included. */
export const moreBarHeight = () =>
  typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches
    ? 44
    : MORE_BAR_HEIGHT;

/** The first of `scrollers` that is a real scroll container with something to scroll to. */
export function scrollingList(scrollers: (HTMLElement | null)[]) {
  return scrollers.find((el) => {
    if (!el) return false;
    const style = getComputedStyle(el);
    return (
      style.display !== "contents" &&
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight + 1
    );
  });
}

/**
 * How many sidebar rows are not fully in view above the "+N more" bar, or 0 when the list is
 * scrolled to its end (or does not scroll). The list scrolls in whichever of `scrollers` is a
 * real scroll container right now: the chats alone on a tall screen, the pages and chats together
 * on a short one or a phone.
 */
export function rowsBelow(
  scrollers: (HTMLElement | null)[],
  rowSelector = "[data-roster-chat],[data-roster-fold],[data-roster-head]",
) {
  const scroller = scrollingList(scrollers);
  if (!scroller || scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1)
    return 0;
  // A list that ends on a whole row (see endOnWholeRow) keeps the bar in the margin below it.
  const barBelow = (Number.parseFloat(scroller.style.marginBottom) || 0) >= moreBarHeight();
  const edge = scroller.getBoundingClientRect().bottom - (barBelow ? 0 : moreBarHeight());
  let count = 0;
  for (const row of scroller.querySelectorAll<HTMLElement>(rowSelector)) {
    if (row.getBoundingClientRect().bottom > edge + 0.5) count += 1;
  }
  return count;
}
