# Visual inspection V3 (iteration 12)

Group V3: Data room, Investors (cap table), Contacts, Artifacts, Activity, search results, command palette.
Target: mock-data demo stack, web port 5381. Viewports 1440x900, 1280x800, 1920x1080 (shell), 375x812.
Screenshots: /tmp/uxloop12/V3/ (outside the repo). Audits run: layout-audit.js and geometry-audit.js on each state.

Limits of this pass
- Other walkers were using the same stack at the same time. Counts (inbox 14 to 11 to 12, Data room failed files 1 to 2, documents 67 to 69), new bots and an approval toast changed during the run. Those changes are not findings.
- The browser tool could not emulate `pointer: coarse` (matchMedia returned false even after `set device`). Touch-target sizes are therefore not reported. The code shows row "..." buttons use `pointer-coarse:opacity-100` (ItemRows.tsx:179), so hover-only reachability looks handled on touch (not observed).
- Not exercised: a real upload and the processing strip (the strip hides itself for two files or fewer by design, ProcessingStrip.tsx), email or Box import (OAuth, BLOCKED), the 15-second dimming of unsorted rows.
- Investors is owned by another session. Only P0/P1 are logged there; none were found.

## Verdict per page and viewport

| Page / state | 1440x900 | 1280x800 | 1920x1080 | 375x812 |
|---|---|---|---|---|
| Data room list | Pass. One screen, list and tree scroll inside (pageScrollY 0). | Pass. Parties column drops cleanly. | Pass with wide gaps between columns (V3-08). | Pass, heavy header (V3-01). |
| Data room grid | Pass. | not checked | not checked | Pass. |
| Data room stats | Pass. Failed card is not actionable (V3-05). | not checked | not checked | Pass, empty band at top (V3-07). |
| Folder view and path bar | Pass, small shift (V3-06). | not checked | not checked | Folder menu works, long flat list. |
| Preview pane / dialog | Pass (side pane). | not checked | not checked | Pass (centered dialog). |
| Bulk selection bar | Pass, pushes content (V3-04). | not checked | not checked | not checked |
| Search results / no results | Pass. Clear search offered. | not checked | not checked | not checked |
| Investors | Pass. No P0/P1. | not checked | not checked | Pass. |
| Contacts | Pass. | not checked | Wasted right band (V3-02). | Pass. Responsive columns. |
| Artifacts | Pass. | not checked | not checked | Pass. Auto list view. |
| Activity panel | Pass. Squeezes the bot list (V3-09). | not checked | not checked | Not reached (see V3-10). |
| Command palette | Pass. | not checked | not checked | Pass. |

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected location | proposed fix |
|---|---|---|---|---|---|---|---|
| V3-01 | Data room, phone | P2 | visual | Observed. Before the first file row the phone shows title, subtitle, search, folder button, view toggles, an "All items" path row and the import notice: 235 px of 812 (29%). With Filters open it is about 310 px (38%). The "All items" path row repeats the folder button right above it (C2, D2). Expected a compact header where the path row only appears inside a folder. | m-dr.png, m-dr-filters.png | apps/web/src/pages/DataRoom.tsx:791 (PathBar) | Hide the path row at the root on phones, since the folder button already names the location. |
| V3-02 | Contacts, wide | P3 | visual | Observed. The table is capped at 896 px (`max-w-4xl`). At 1920 it ends at x=1240 while Add contact / Ask end at x=1892, leaving a 650 px empty right band. At 1440 the edge is 170 px short of the header actions (L4, D2). | contacts-1920.png, contacts-1440.png | apps/web/src/pages/Contacts.tsx:170 | Let the table fill the content width, or align the cap with the search bar and keep the actions right-aligned to the table. |
| V3-03 | Data room, import notice | P3 | copy | Observed on 1440 and 375. The notice reads "Imported 2 files" followed by one file name, "b.txt", as a small button 28x18 px. A count of two with one name is unclear, and the name target is under 24 px high on desktop (C2, I4). Which file is the second one is not shown. | dr-search-1440.png, m-dr.png | apps/web/src/components/data-room/format.ts:76 and the notice component in DataRoom.tsx | Name every file, or show only the count with a "View" link that filters to the imported files. |
| V3-04 | Data room, selection | P2 | flow | Observed. Select all selects the 50 loaded rows ("50 selected") while the room holds 69 documents (stats card). There is no "Select all 69" step, so Maya may think Download / Email / Send to agent covers everything. The bar also inserts a 41 px row and pushes the table down (L5). Failed unreadable files are included in the selection. | dr-selectall-1440.png, dr-stats-1440.png | apps/web/src/pages/DataRoom.tsx near the "Load more" button (line 891) | After select all, show "50 of 69 selected, select all 69" and overlay the bar instead of shifting the table. |
| V3-05 | Data room, stats | P3 | flow | Observed. The "Failed 1" stat card is plain text. The sidebar badge and the row both say Failed, but the card gives no way to filter to the failed files (I1, C3). | dr-stats-1440.png | apps/web/src/components/data-room/DataRoomStats.tsx | Make the Failed card a button that applies the failed-status filter. |
| V3-06 | Data room, folder view | P3 | visual | Observed. Opening a folder swaps the "All items" label for a breadcrumb and the column header jumps from y=233 to y=242. The Status column also disappears, so Type moves from x=892 to x=972 (L5). | dr-1440.png vs dr-folder-1440.png | apps/web/src/components/data-room/PathBar.tsx, ItemRows.tsx (showStatus) | Give the path row a fixed height and keep a fixed column set, or reserve the Status column. |
| V3-07 | Data room stats, phone | P3 | visual | Observed. On the Stats tab the search field is hidden but its row is kept. Filters sits alone on a row with an empty band of about 40 px around it (D2). | m-dr-stats.png | apps/web/src/pages/DataRoom.tsx (toolbar) | Collapse the empty search row when the view is Stats. |
| V3-08 | Data room list, 1920 | P3 | visual | Observed. At 1920 the Name column is about 475 px wide and Type / Added start 500 px right of the names, and Status sits 400 px right of Parties. The eye has to cross wide blank space (H6, D2). | dr-1920.png | apps/web/src/components/data-room/ItemRows.tsx (column widths) | Cap the table width or grow only the Name column up to a maximum. |
| V3-09 | Activity panel | P3 | visual | Observed at 1440x900. Opening Activity pushes the Spaces and bot list down and leaves 418 px for it (about 5 rows), and "Needs your answer" crowds the snippet ("Should the October u…"). Expected the status label and snippet to fit without cutting the question. | activity-1440.png | apps/web/src/pages/ActivityList.tsx | Put the status label on its own line under the bot name, as in the bot list. |
| V3-10 | Mobile drawer | P3 | a11y | Suspected, not verified with a real keyboard. Opening the navigation drawer on a phone puts focus in the Search field with a strong ring (m-drawer.png). On a real phone that may raise the keyboard over the navigation list. Also the Escape key after the palette sent focus to the skip link, which then covered the hamburger. | m-drawer.png, m-drawer2.png | sidebar drawer open handler | Focus the dialog container rather than the Search field on touch devices. |
| V3-11 | Slow open | P3 | perf | Observed once. The first open of /app/data-room during the shared run showed "Still opening… Try again" for over 7 s, then loaded after a reload. The skeleton behind it is a chat skeleton with a composer pill, although the route is Data room. Could be load from other walkers; the API health check answered in 1 ms afterwards. | still-opening.png | apps/web/src/App.tsx (route skeleton) | Show a neutral page skeleton for non-chat routes. |
| V3-12 | Data room / Investors, mobile | P3 | copy | Observed. Rows with no document type show a leading dash: "— · Added Oct 22, 2026" (list on 1440 preview mode and phone, grid card). A dash with a dot reads as a missing value (C4). | dr-preview-1440.png, m-dr-grid.png | apps/web/src/components/data-room/ItemRows.tsx (meta line) | Omit the type segment when empty and show only "Added Oct 22, 2026". |
| V3-13 | Resize handles | P3 | a11y | Observed. "Resize folders" (hr, focusable) and "Resize sidebar" are reachable by Tab but show no focus indicator (outline none, geometry audit ring=false) (I7). | Tab walk at 1440 | Folders separator in DataRoom.tsx; sidebar resize button | Add a visible focus style to both. |
| V3-14 | Mobile toast spacing | P3 | visual | Observed on Artifacts at 375. The approval toast sits 90 px above the bottom edge on a page without a composer and covers the tenth artifact row (the list does not scroll). Decision says phones place it above the composer, so this is only the gap on non-chat pages. | m-drawer2.png | toast container offset | On pages without a composer, drop the reserved bottom offset. |

## Excellent as is

- Command palette (Cmd+K): grouped results (Contacts, Documents, Chats, Artifacts, Mail), highlighted match text with context snippets, key hints, a "Search mail for ..." fallback. Works the same on phone, anchored to the top.
- Data room list, grid and stats share one toolbar and one folder tree. Every view fits one screen at 1280 and 1440 with the list scrolling inside its panel (pageScrollY 0).
- Search in the Data room: highlighted match in the snippet, "No results" with a single "Clear search" action.
- Failed file row: red reason ("This file isn't a readable PDF.") with an adjacent Delete, in the list and in the grid card.
- Preview: side pane on desktop, centered dialog on phone, with open / download / expand / more actions and a short metadata block.
- Bulk selection bar offers exactly Download, Email, Send to agent, and a clear close button.
- Artifacts: switches to a dense list on phones, grid with a list toggle on desktop. Contacts keep Name and Kind on phone and fold the email under the name. Truncated emails carry a title attribute.
- Tab order through the Data room follows the visual order (header, search, filters, folders, list, load more).
