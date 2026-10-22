import type { KeyboardEvent } from "react";

// The sidebar's page rows and chat rows are one tab stop, like a listbox: Tab enters it once and
// leaves it (plus the first row, so Tab reaches the pages), and the arrow keys move between rows. Without this a long list puts dozens of Tab
// presses before the page. Rows (pages, chats, space headings) carry `data-roster-row`; a row's
// wrapper (`data-roster-item`) holds its Actions button (`data-roster-actions`), which is a tab
// stop only while its row is.

const rowsIn = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>("[data-roster-row]")];

/** The row a focused element belongs to: the row itself, or the Actions button beside it. */
export const rosterRowId = (target: HTMLElement) =>
  target.closest<HTMLElement>("[data-roster-row]")?.dataset.rosterRow ??
  target.closest<HTMLElement>("[data-roster-item]")?.dataset.rosterItem;

/** Makes one row (and its Actions button) tabbable: the last focused, else the open chat, else the first. */
export function syncRosterTabStops(root: HTMLElement | null, stopId: string | null) {
  if (!root) return;
  const rows = rowsIn(root);
  const stop =
    rows.find((row) => row.dataset.rosterRow === stopId) ??
    rows.find((row) => row.getAttribute("aria-current") === "page") ??
    rows[0];
  for (const row of rows) {
    const index = row === stop ? "0" : "-1";
    // The first row (a page) stays reachable with Tab even when a chat is the stop.
    row.setAttribute("tabindex", row === rows[0] ? "0" : index);
    row
      .closest("[data-roster-item]")
      ?.querySelector("[data-roster-actions]")
      ?.setAttribute("tabindex", index);
  }
}

/** Up, Down, Home and End move focus between rows. Alt+Arrow (reorder) and a lift in progress are left alone. */
export function moveRosterFocus(root: HTMLElement | null, event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  if (!root || event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
  if (!target.hasAttribute("data-roster-row") || target.getAttribute("aria-pressed") === "true")
    return;
  const rows = rowsIn(root);
  const index = rows.indexOf(target);
  const next =
    event.key === "ArrowDown"
      ? rows[index + 1]
      : event.key === "ArrowUp"
        ? rows[index - 1]
        : event.key === "Home"
          ? rows[0]
          : event.key === "End"
            ? rows.at(-1)
            : undefined;
  if (!next) return;
  event.preventDefault();
  next.focus();
}
