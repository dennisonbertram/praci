import type { MouseEvent } from "react";

/**
 * A ledger row opens its record on a click anywhere on it; its checkbox, links, buttons and
 * menu keep their own click. Keyboard users have the name or label button in the row.
 */
export const openOnRowClick = (open: () => void) => (event: MouseEvent<HTMLElement>) => {
  const target = event.target as HTMLElement;
  // React bubbles clicks from portals (the row menu, its dialogs) through the row: only a click
  // on the row itself counts.
  if (!event.currentTarget.contains(target)) return;
  if (!target.closest("button, a, input, select, label, [role=checkbox]")) open();
};
