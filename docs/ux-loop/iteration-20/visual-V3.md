# Visual inspection V3 (iteration 20)

Group: V3. Target: mock-data demo stack (web :5381). Pages: Data room, Investors (P0/P1 only), Contacts, Artifacts, Activity, search results, Cmd+K.
Viewports: 1440x900 everywhere; 375x812 for Data room, Contacts, Artifacts, drawer, Cmd+K; 1920x1080 for the Data room shell.
Screenshots: /tmp/uxloop20/V3/ (outside the repo). layout-audit.js and geometry-audit.js were run on each captured state.

Limits of this pass
- Touch emulation was not available (agent-browser reported `pointer: coarse` false even after `set device`), so no touch-target finding is made. Mouse-sized targets below 24 px were noted only when they were not the page's own conventions.
- The demo stack restarted mid-session and was reseeded. Other walkers share it, so extra sidebar groups ("Empty space", "Mail needs reconnect"), new Northwind .txt files and an approval toast in the screenshots are other walkers' side effects, not defects.
- Auto-sort ran on the demo model; its duration is demo-specific.

## Verdicts

| Page / state | 1440x900 | 375x812 | Notes |
|---|---|---|---|
| Data room list | Pass (one screen, inner scroll, 711 px list scroller) | Pass | Folder picker, filters and path bar all work |
| Data room grid | Pass | Pass | White PDF thumbnails glare on the dark theme (V3-10) |
| Data room stats | Pass with finding | Pass with finding | V3-03, V3-11 |
| Data room preview | Pass | Pass (dialog, no inline PDF) | List collapses to compact rows beside the preview |
| Processing strip | Fail (V3-02) | not seen | |
| Data room search | Fail (V3-04, V3-05) | not tested | Highlighting and snippets are good |
| Cap table / Investors | No P0/P1 | not tested | Owned by another session |
| Contacts | Pass | Pass | Row and dialog are clean |
| Artifacts grid / list / detail | Pass | Pass | V3-08 |
| Activity panel | Fail (V3-01) | not tested | |
| Cmd+K | Pass | Pass | V3-12 |
| Shell at 1920x1080 | Pass with finding | n/a | V3-09 |

## Findings

| ID | Page | Sev | Cat | What happened vs expected | Evidence | Suspected location | Proposed fix |
|---|---|---|---|---|---|---|---|
| V3-01 | Activity (sidebar) | P1 | bug | Observed: "Show 7 finished runs" makes the link disappear and nothing visible happens. The finished list is rendered inside a 171 px scroller (scrollHeight 730) whose clipped "Finished" heading sits just below the fold, while roughly 230 px of the sidebar below the Archived row is empty. Expected: the list opens in view and uses the free height. (L1/L3/I2.) | /tmp/uxloop20/V3/act-finished2.png (looks unchanged), act-finished3.png (after scrolling the inner box) | apps/web/src/pages/Shell.tsx:4931-4937 (flex-col scroll container wrapping ActivityList), apps/web/src/pages/ActivityList.tsx:216 (`min-h-0 flex-1 overflow-y-auto`) | Give ActivityList the remaining sidebar height (or scroll it into view on expand) so finished runs show immediately. |
| V3-02 | Data room processing strip | P2 | flow | Observed: after 20+ s the strip still reads "Processing 1 file - Reading MOCK Board Minutes - October.pdf" with the progress bar stuck, while the AI-consent card ("Let Praci read your documents", not yet allowed) sat above it. The strip says work is under way; the likelier cause (suspected, not confirmed) is that reading waits for consent. The row stays "Not tagged". (C3.) When expanded, the count "1" also sits 11 px right of the table edge. | /tmp/uxloop20/V3/dr-strip-1440.png, dr-strip-open.png | apps/web/src/components/data-room/ProcessingStrip.tsx:56-75 | When consent is missing, show "Waiting for permission to read" with the Allow action instead of "Processing". |
| V3-03 | Data room stats | P2 | flow/a11y | Observed: every stat row and the "Failed 1" tile is a button that filters the list (clicking Invoice jumped to a Type: Invoice grid), but they use the default cursor, have no hover cue in the tile and no hint. "Failed 1" is not coloured and is not marked as a link to the failed files. Expected: clickable things look clickable (I1) and a failure count draws the eye (H4). | /tmp/uxloop20/V3/dr-stats-1440.png, dr-stats-typeclick.png; DOM: tiles are BUTTON, cursor default | apps/web/src/components/data-room/DataRoomStats.tsx:68, :103-105, :135-138 | Add pointer cursor and hover background to tiles and rows, and use the destructive colour on Failed when the count is above zero. |
| V3-04 | Data room search in a folder | P2 | flow | Observed: searching inside Finance / Bank statements for "cobalt" shows "No results" with a "Clear search" button. The way to widen the search is a 12 px bold word "Search all items" in a thin strip above, with default cursor and no underline, so it reads as a label. Expected: the empty state offers the useful next step as a button. (I1/I5.) | /tmp/uxloop20/V3/dr-search-1440.png; computed: BUTTON, cursor default, no underline, weight 500 | apps/web/src/pages/DataRoom.tsx:841-852 and :878-905 | In the empty state, add "Search all items" as the primary button beside Clear search. |
| V3-05 | Data room search results (list) | P2 | visual | Observed: with snippets, the Name column is about 300 px wide, so a 6-line snippet makes rows about 150 px tall, while Type, Added and Parties columns get wide, mostly empty space. Only 4 results fit in 700 px. Expected: the column that carries the content gets the width. (D2/H6.) | /tmp/uxloop20/V3/dr-search-all.png | apps/web/src/components/data-room/ItemRows.tsx (table col widths); apps/web/src/pages/DataRoom.tsx list table | While searching, give Name about 55% width and drop or narrow the Added column. |
| V3-06 | Data room failed file | P2 | flow | Observed: a failed file ("This file isn't a readable PDF.", red) has the same row menu as a healthy file: Send to agent, Share, Move, Rename, Delete. No Replace, Retry or Download-and-fix; the only way to recover is Delete then Add files. "Send to agent" is offered for a file that cannot be read. Expected: the red message has an action next to it. (I3.) | /tmp/uxloop20/V3/dr-failed-menu.png | apps/web/src/components/data-room/ItemMenu.tsx; ItemRows.tsx:175-180 | For failed rows, show "Replace file" (and hide Send to agent) in the menu and as a link under the message. |
| V3-07 | Data room list while processing | P2 | visual | Observed: with the preview open, three new rows and a processing strip were inserted above the selected row, moving it from y=260 to y=465 (205 px) while it was being read. Expected: stable layout while reading (L5). Live inserts at the top are expected, so this is a suspected design gap: keep the scroll anchor on the selected row. | /tmp/uxloop20/V3/dr-preview-more.png vs dr-preview-1440.png | apps/web/src/components/data-room/use-data-room-list.ts, pages/DataRoom.tsx list container | Use scroll anchoring (overflow-anchor) or hold new rows behind a "3 new files" pill while a preview is open. |
| V3-08 | Artifacts grid | P3 | copy | Observed: card titles and one-line descriptions truncate ("MOCK Investor Update - Septe...", "Decisions and owners from the October all-..."), partly because the "v2" badge takes title width, and there is no date, so the grid shows less than the list (which has Type and Added). No tooltip was checked. (C4.) | /tmp/uxloop20/V3/ar-1440.png | apps/web/src/pages/Artifacts.tsx (card) | Let titles wrap to two lines and move the v2 badge beside the date. |
| V3-09 | Data room list at 1920 | P3 | visual | Observed: Name is 620 px wide and Type starts 300 px after the filename ends, so the eye must cross a wide gap to read a row. Expected: a sensible max width for the table (H6). | /tmp/uxloop20/V3/dr-1920.png | apps/web/src/pages/DataRoom.tsx table | Cap the table at about 1200 px or let Name take only what it needs. |
| V3-10 | Data room grid | P3 | visual | Observed: bright white PDF thumbnails sit on dark cards and dominate the page; the failed file shows a plain icon so it looks like the odd one out. Only the folder is missing from the card (the list shows it). (H2/H4.) | /tmp/uxloop20/V3/dr-grid-1440.png | apps/web/src/components/data-room/ItemRows.tsx (grid card) | Dim thumbnails slightly in dark mode (about 90% opacity) and show the folder path under the name. |
| V3-11 | Data room stats | P3 | visual | Observed: in Stats the search box disappears but filter chips stay in place, leaving a 330 px empty gap at the left; at 375 the Filters pill drops to a row of its own on the right, adding an empty band. (L5.) | /tmp/uxloop20/V3/dr-stats-1440.png, dr-375-stats.png | apps/web/src/components/data-room/FilterBar.tsx | Keep the search box in Stats, or left-align the chips. |
| V3-12 | Cmd+K | P3 | visual/flow | Observed: (a) Documents results stop at 5 with no "See all in Data room" row, while Mail has one; (b) Enter/Esc in the footer are plain text next to arrow icons; (c) match highlight is an underline here but a filled mark in Data room search (H5); (d) on 375 the Pages group scrolls with no cue that Integrations and Settings are below. | /tmp/uxloop20/V3/ck-cobalt2.png, ck-375.png | apps/web/src/components/ (command palette) | Add "See all N documents" and use one highlight style; show key caps for Enter and Esc. |
| V3-13 | Activity panel | P3 | flow | Observed: opening Activity replaces the Pages list entirely, so Inbox, Finance and the rest are unreachable until the panel is closed; the only route is the Search box. Expected (suspected design intent): a clear way back, which the highlighted Activity icon only implies. (I6.) | /tmp/uxloop20/V3/act-1440.png | apps/web/src/pages/Shell.tsx:4936 | Keep the Pages list above the Activity section, or add a "Back to pages" row. |
| V3-14 | Data room, Auto-sort | P3 | copy/perf | Observed: the button is "Auto-sort" but the dialog is titled "Sort files" (C1). On the demo the scan took about 100 s; the dialog explains it ("Still looking. This can take a minute.") and shows a timer, which is good, but "Looking for changes" does not say what is being scanned. | /tmp/uxloop20/V3/dr-autosort.png, dr-autosort4.png | apps/web/src/components/data-room/AutoSortDialog.tsx:179 | Title the dialog "Auto-sort" and show "Checking 67 files". |
| V3-15 | Investors (info only) | P3 | visual | Observed: the "Action items" card's 1 px bright ring is clipped at its top edge by the scroll container (no top padding). Only P0/P1 are reported for this page, so this is noted, not counted. | /tmp/uxloop20/V3/inv2.png | apps/web/src/pages/ (Investors) | Add 1 px top padding to the scroller. |
| V3-16 | Shell sidebar | P3 | visual | Observed: with several groups, a row is cut off at the bottom of the scroller (half a Chief row above "+1 more", y=752). Fade mask is present, so it reads as scroll, but the "+N more" label is not a clear scroll cue. | /tmp/uxloop20/V3/dr-folder-1440.png | apps/web/src/pages/Shell.tsx:4930 | Snap the scroller to whole rows. |

Not findings (checked): Data room page fits 1440x900 with no page scroll (pageScrollY 0) and mobile has no horizontal overflow (pageOverflowX 0 in all captured states). Keyboard order goes sidebar, page header, search, filters, and every control shows a 3 px focus ring.

## Excellent as is
- Data room at 375: header, folder picker, Filters pill and the view toggle collapse cleanly; filter expansion pushes the list without overflow.
- Folder path bar (All items > Finance > Bank statements) and the folder tree with a hover "..." action.
- Preview pane: compact rows beside it, five named header actions, "Close preview", a clear mobile dialog with Open and Download.
- Stats chart: hover tooltip ("May 2026: 6"), row clicks that filter.
- Selection bar: docked at the bottom with count, Download, Email, Send to agent and close.
- Search snippets with highlighted matches (V3-05 aside).
- Contacts: dense, one-screen table; whole row opens an edit dialog with Delete placed apart from Save; mobile drops columns sensibly.
- Artifacts: grid, list and master-detail with right-aligned numeric columns.
- Cmd+K: grouped results (Artifacts, Documents, Contacts, Chats, Mail) with snippets and highlights, about 1.1 s to results; accessible-named controls throughout.
- Auto-sort dialog: proposals start unchecked, grouped by destination, with before and after paths.
