# J4 proposal C: pinned smart-list row (Things Inbox, Apple Mail Inboxes, Linear Inbox)

## Pattern
Best-in-class apps give the one triage destination a pinned row at the top of the list, outside the ordinary list of items. Things puts Inbox above Today and the projects, Apple Mail lists "Inboxes" above accounts and mailboxes, and Linear puts Inbox first in the sidebar. The pinned row is the same row style as the rest, carries a count, and is never repeated lower in the list.

## Idea
Inbox becomes a standalone row directly under the Activity card, above PERSONNEL, with no section label. It is removed from the PAGES list, so there is one Inbox entry. Everywhere (phone, outer display, sidebar) the order is the same: Activity, Inbox, Personnel, Pages.

## Edits
- PH-Home, PG-A-Home, Main: after the Activity card add one row (solid #252523 card, radius 18, same 44 px row recipe as Pages: mail icon, "Inbox", "3 need reply" pill, chevron). Delete the Inbox row from the PAGES card, leaving Finance, Legal, Cap table, Data room, Team computer.
- Frames with no Activity card (Loading, Could not load agents, Empty space, Scrolled to the end): the Inbox row sits first under the header (or after the "Connect a model" card on the No model frame). Loading shows a skeleton row with no count, not a stale count.
- Split sidebar: Inbox is a pinned row under the Activity row, then PERSONNEL, then PAGES (Finance, Legal, Cap table, Data room, Artifacts). This removes the Pages-before-Personnel mismatch.

## What the persona sees
On PH-Home the Inbox row is at y about 395 to 447, Chief at about 485 and Mercury at about 647; Pages begin below the fold but they are reference destinations. On the Duo outer display the Inbox row is at y about 290 to 340, with all four agents still on screen (Mercury ends near y 560 of 678). The Pages label follows near y 590.

## Trade-offs
- One new row style position, but no new component: it reuses the Pages row recipe.
- Inbox is no longer "a page among pages". Mitigated because the row looks the same and opens the same screen.
