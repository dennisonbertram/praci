# Visual inspection V3: Data room, Cap table, Contacts, Artifacts, Activity, search, command palette

Target: mock-data demo stack (web port 5381), user Maya Chen (Mock), dark theme. Viewports 1440x900, 375x812, shell at 1920x1080.
Screenshots: /tmp/uxloop4/V3/. Method: screenshots read by eye, layout-audit.js and geometry-audit.js per page, hover, Tab order, dialogs, drag overlay, resize.
Audit note: layout-audit.js reports contrast ratios of about 1.3 for most sidebar text in dark mode. By eye these are legible, so I treat them as an audit artifact and file nothing from them.

## Verdicts

| Page / state | 1440x900 | 375x812 | Notes |
|---|---|---|---|
| Data room list | Pass with findings | Pass with findings | Fits one screen, list scrolls inside its panel. V3-01, V3-09, V3-11 |
| Data room grid | Pass with findings | Pass with findings | V3-10 |
| Data room stats | Pass with findings | Pass | V3-14 |
| Folder tree and path bar | Pass | Collapsed into a folder menu (good) | V3-17 |
| Preview panel | Pass with findings | Findings | V3-12, V3-13 |
| Upload / processing strip | Pass (drop overlay clear) | Pass | V3-09 |
| Cap table | Fail on L1/L2 (minor) | Pass | V3-02, V3-03 |
| Contacts | Pass | Pass | V3-04 |
| Artifacts grid / list | Pass with findings | Pass | V3-05, V3-06 |
| Activity panel | Pass | Findings | V3-16 |
| Search results (Data room) | Fail | Fail | V3-01 |
| Command palette | Pass with findings | Pass | V3-07, V3-08 |
| Shell at 1920x1080 | Pass | n/a | V3-15 |

No horizontal overflow (pageScrollX 0, geometry overflowSpills empty) on any page at 1440, 375 or 1920. No document-level scroll on any page.

## Findings

| ID | Page | Sev | Cat | What happened vs expected | Evidence | Suspected code | Proposed fix |
|---|---|---|---|---|---|---|---|
| V3-01 | Data room search, palette | P1 | bug | Observed. Searching "Bolt" or "Signed NDA" never returns "MOCK Signed NDA - Bolt Freight.pdf" (the failed, unread file). Maya's open question is "Bolt Freight is waiting on the NDA", and the placeholder promises "Search names and text". The untagged-file copy also says "you can still search it by name and text". Expected: a filename match returns the file. | dr-search-375.png, dr-search2-375.png ("Signed NDA" returns only Mutual NDA - Acme Ventures) | packages/db/src/data-room.ts:889 (search is websearch_to_tsquery over chunks only; unread files have no chunks; suspected, not traced to the end) ; apps/web/src/components/data-room/FilterBar.tsx:278 | Add a name match (ILIKE or a tsvector on data_room_items.name) as a second search leg so every item is findable by name. |
| V3-02 | Cap table | P2 | visual | Observed. The whole page body (header, 4 tiles, donut, table) is one scroll container (clientH 900, scrollH 1028). The header and the "Add contact" action scroll out of view. The donut card is about 240px tall for two legend rows, so the table starts at y=590 of 900 and only 7 rows show. Norms L1, L2, D2. | cap-1440.png, cap-scrolled.png | apps/web/src/pages/CapTable.tsx:498 | Keep the header fixed outside the scroller, shrink the donut card (donut beside the tiles) so the table gets the space. |
| V3-03 | Cap table | P2 | visual | Observed. The "Casey Advisor (Mock)" row is indented 8px more than other rows (x=352 vs 344) and has a third line "Comm... Independent advisor (M... casey.advisor@advisors.example..." truncated with no way to read it. Row text is 11px. Norms H6, C4. | cap-scrolled.png | apps/web/src/pages/CapTable.tsx (contact row variant; not traced) | Render contact rows with the same cell structure and padding as holder rows, and show email on hover or in a detail, not truncated. |
| V3-04 | Contacts | P3 | visual | Observed. Column headers start at x=344 but row text at x=352, an 8px offset between header and cells (also on Cap table). Norm H6. | con-1440.png | apps/web/src/pages/Contacts.tsx (table cell padding) | Give header cells the same left padding as body cells, or remove the cell inset. |
| V3-05 | Artifacts list | P2 | visual / copy | Observed. Sizes read "229 bytes", "437 bytes", which means nothing to a founder; Size column is left aligned. List rows are 56px for one line of text (Contacts rows are 37px), and the list shows no type or description that the grid shows. Norms C1, H6, D1. | art-list.png | apps/web/src/pages/Artifacts.tsx:590 region; apps/web/src/lib/format-bytes.ts | Drop the Size column (or show it only for files), right-align it if kept, set row height to about 40px. |
| V3-06 | Artifacts grid | P3 | visual | Observed. Right edges inside a card differ: type label ends at x=664, "5m ago" at x=640, card edge at 688. The "Doc/Sheet/Page" label repeats the icon beside it. Norms H6, C2. | art-1440.png | apps/web/src/pages/Artifacts.tsx (card) | Align the footer to the card padding and drop the type text or the icon. |
| V3-07 | Command palette | P2 | flow | Observed. Ranking puts an agent first for unrelated queries: "pilot" returns Chief first (snippet has no "pilot"), "bolt" returns Data room agent first. No match highlighting, so the reason is invisible. The artifact appears as "MOCK Customer Pipeline.csv" in the palette but "MOCK Customer Pipeline" on the Artifacts page (names differ). Norms C1, H5. | pal-q-1440.png, pal-375.png | apps/web/src/pages/Shell.tsx (palette search) | Rank by name match first, agents only on a name hit, highlight the matched text, use one display name for artifacts. |
| V3-08 | Command palette | P3 | visual | Observed. The empty palette shows 7 of 20 entries (Artifacts, Task board, Apps, Settings, agents are below the fold) with no scroll cue. No footer hint for Up/Down, Enter, Escape. Norms I6, A2. | pal-1440.png (listbox scrollH 1169 vs clientH 384) | apps/web/src/pages/Shell.tsx | Show a fade or scrollbar at the bottom and a one-line key hint footer. |
| V3-09 | Data room processing strip | P2 | flow | Observed. The strip is workspace-wide: it shows "Reading MOCK Board Minutes" while Maya is inside "Old drafts", and in search results. In a folder it stacks under the path bar, so two chrome rows (about 65px) sit above the table. In Stats it disappears. Expanded, the counts sit about 850px from their labels. "1 couldn't be read" is an 18px-tall button that does not take Maya to the failed file. Norms C3, D5, I4. | dr-folder-1440.png, dr-strip2.png | apps/web/src/components/data-room/ProcessingStrip.tsx:57 | Make "1 couldn't be read" apply a Failed filter, keep the strip single-line, put counts next to labels. |
| V3-10 | Data room grid | P2 | flow / visual | Observed. In grid, the failed card shows only "Failed" and "Try again"; the list shows the reason "This file isn't a readable PDF." and the folder path, the grid shows neither. At 375 the first card ("Northwind SAFE - Quill.pdf") renders a blank white thumbnail. Norms H5, I3. | dr-grid-1440.png, dr-grid-375.png | apps/web/src/components/data-room/ (grid card; not traced) | Show the failure reason (clamped) and folder in the grid card; use a type icon when the thumbnail has no content. |
| V3-11 | Data room mobile | P2 | visual | Observed. At 375x812 the toolbar takes 5 rows: menu, title+actions, search, folder+sort, three filter chips. The first document starts at y=310 (38% of the screen). Add files is an unlabeled "+" icon. Norms D2, I5. | dr-375.png | apps/web/src/components/data-room/FilterBar.tsx | Fold Type/Party/Date into one "Filters" button with a count; keep search and sort on one row. |
| V3-12 | Preview panel | P2 | visual / a11y | Observed. Mobile preview sheet: header icons (open, download, expand, more, close) are about 24px targets (norm I4: 44px on touch); the metadata block ends cut off ("Size" row half visible) inside a 690px sheet; empty gray area under the page image. Desktop panel scrolls 32px for the Size row. | dr-prev-375.png, dr-preview-1440.png | apps/web/src/components/data-room/ (preview panel) | Enlarge icon hit areas to 44px on touch, reduce page-image height to fit metadata. |
| V3-13 | Preview panel | P2 | copy | Observed. "Not tagged yet. Files are tagged once you let Praci read documents; you can still search it by name and text." is long, says "it" for files, offers no action to let Praci read, and is untrue today (V3-01). AGENTS.md: every word is UI. | dr-prev-375.png | apps/web/src/components/data-room/ (untagged message) | Replace with a short "Not tagged" plus an action, or remove; reveal only on hover. |
| V3-14 | Data room stats | P3 | visual | Observed. The "Sources" card holds one row ("Upload 67") but is as tall as "Types" (about 300px), a dead band. The bar chart has only the max value ("10") and start/end months; hovering a bar highlights it but shows no tooltip within 0.5s (not waited longer). Norms D2, C4. | dr-stats-1440.png, dr-stats-hover.png | apps/web/src/components/data-room/DataRoomStats.tsx:264 | Let the grid rows size to content, or hide Sources when there is only one source; add a value tooltip to bars. |
| V3-15 | Data room at 1920 | P3 | visual | Observed. The Name column is about 850px wide, so the eye travels about 800px from filename to type and date; the Parties column truncates ("Northwind, Quill Ca...") (tooltip not checked). Norm H6. | dr-1920.png | apps/web/src/components/data-room/ (table columns) | Cap the Name column width and let the table sit left, or distribute columns. |
| V3-16 | Activity / sidebar drawer | P3 | visual | Observed. The Activity panel state persists after reload, including on mobile: in the 375 drawer it takes the space of the chat list, leaving one chat row visible. Times differ in format ("7m ago" in Activity vs "7:38 AM" in the chat list). Norm H5. | drawer-375.png, act-1440.png | apps/web/src/pages/Shell.tsx (sidebar) | Reset Activity to closed when opening the mobile drawer; use one time format. |
| V3-17 | Folder tree | P3 | a11y | Observed. treeitems have aria-expanded=null though folders have children (the tree cannot collapse, so a deep tree always grows). Norm A2. | DOM check | apps/web/src/components/data-room/FolderTree.tsx | Add aria-expanded and a collapse toggle, or mark as a flat list with levels. |
| V3-18 | Deep-link cold load | P3 | perf | Observed once. A first direct load of /app/contacts and /app/artifacts at 375 showed "Opening Praci..." and an empty composer-pill skeleton for over 3s; a repeat load took about 1s. Norm I2. | first contacts-375.png capture | apps/web/src/App.tsx (boot screen) | Show the page header skeleton instead of a composer pill while booting; measure the cold path. |

## Excellent as is

- Contacts desktop and mobile: dense 37px rows, clear columns, mobile merges organization under name and keeps Kind (contacts-375.png).
- Edit contact dialog: labeled fields, focus ring on first field, Delete visually separate from Save (con-detail.png).
- Data room list: container-query layout, row folder paths, status chips in words plus color, spinner for Reading, one-click "Try again" (dr-1440.png, dr-preview-1440.png).
- Drop overlay ("Drop to add to Data room") is clear and unobtrusive (dr-drag.png).
- Data room stats on mobile: 2x2 tiles and a chart that fits with no overflow (dr-stats-375.png).
- Search results show highlighted match snippets (dr-search-375.png).
- Folder tree collapses into a folder menu on mobile with New folder and Auto-sort kept (dr-375.png).
- Page-level fit: no document scroll at 1440x900, 375x812 or 1920x1080; inner panels scroll.
- Focus rings are visible on sidebar rows and "Actions" buttons; Skip to content link exists.
- Palette groups results (Contacts, Documents, Artifacts) and opens on Cmd+K.
