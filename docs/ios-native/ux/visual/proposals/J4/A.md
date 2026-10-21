# J4 proposal A: minimal change, Pages above Personnel everywhere

## Idea
Adopt the order that Split already uses on every Home surface: Activity, then Pages, then Personnel. Inbox stays the first row of Pages, so "3 need reply" moves up the screen without any new element. Nothing else changes.

## Edits
- PH-Home, PG-A-Home, Main: move the PAGES block (label plus card) above the PERSONNEL block in every frame.
- Split: no change.

## What the persona sees
On PH-Home (393x852) Activity ends near y=383, then Pages (six rows, about 264 px) ends near y=700, then the PERSONNEL label and Chief at about y=760. Inbox is visible. On the Duo outer display (466x678) Pages ends near y=560, so Chief is the only agent row that fits and the other three are below the fold.

## Trade-offs
- Inbox is fixed, but the main conversation list (Personnel, which is recency sorted and holds Chief) is pushed down on every device. The product is chat with agents first, so the most used list gets worse to fix the second most used one.
- The six Pages rows are mostly static (Cap table and Data room have no count), so the extra space above Personnel carries little news.
- Smallest diff, no new component, lowest build risk.
