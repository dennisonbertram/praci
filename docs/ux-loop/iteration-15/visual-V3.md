# Visual review V3: Data room, Investors, Contacts, Artifacts, Activity, search, command palette

Group V3, session uxl15-V3, mock-data demo stack (web port 5381). Screenshots are in `/tmp/uxloop15/V3/` (outside the repo). Viewports: 1440x900, 375x812, and 1920x1080 for the shell. Dark theme. The demo account is shared with other walkers, so counts (badges, failed files, page agents) changed during the walk and that is not reported as a defect.

Method notes
- layout-audit.js and geometry-audit.js were run on Data room at 1440. The audit's "lowContrast" list (ratios near 1.2-1.4) is a false positive: the script cannot parse `oklab()` colours. Contrast was recomputed by hand: table headers 6.1:1, Failed label 5.5:1, all pass.
- Touch-target findings are not reported. agent-browser cannot emulate `pointer: coarse` (matchMedia stayed false even with device emulation), so the rule from pass 7 makes any measurement invalid. Unmeasured.
- Investors is owned by another session, so only P0/P1 would be reported there. None found.
- agent-browser's `set device` emulation broke Base UI popups (Add files menu and folder picker did not open). A fresh session without device emulation opened them fine, so this is a test artefact, not an app bug.
- Synthetic upload `v3-note.txt` (one line) was added to the Data room during the walk.

## Verdicts

| Page | 1440x900 | 375x812 | 1920x1080 |
|---|---|---|---|
| Data room list | Fits one screen, panel scrolls. Name column is starved (V3-01). | Works. Header block takes about 30% of the height (V3-05). | Fine. |
| Data room grid | Good. Gutter off by 16px (V3-02). | Good, 2 columns. | Good, 8 columns. |
| Data room stats | Good, tiles and rows drill down. Gutter (V3-02). | Good. | Not captured. |
| Data room preview | Excellent side panel. | Excellent centered dialog. | Not captured. |
| Data room search results | Snippet wraps to 5 lines in a narrow column (V3-01). | Not captured. | Not captured. |
| Investors | Fits one screen, inner scroll. No P0/P1. | No overflow. | Fits. |
| Contacts | Good. | Good (V3-08). | Columns spread too far (V3-07). |
| Artifacts | Good. | Good (list by default). | Good. |
| Activity | Works, duplicates sidebar rows (V3-04). | Replaces the Pages block in the drawer. | Not captured. |
| Command palette | Excellent (V3-09 is minor). | Excellent, anchored at top. | Not captured. |

No page scrolls horizontally at 375 and no page scrolls vertically at 1440 or 1920 (documentElement scrollHeight equals the viewport; pageScrollX 0 everywhere).

## Findings

| ID | Page | Sev | Cat | What happened vs expected | Evidence | Code (suspected) | Proposed fix |
|---|---|---|---|---|---|---|---|
| V3-01 | Data room list and search | P2 | visual (D2, H6) | Observed. Fixed columns (Type 144, Added 96, Parties 192, Status 80) leave the Name column about 280px of an 850px list. Names wrap to two lines ("MOCK Term Sheet Draft - Quill Capital.pdf") and search snippets wrap to five lines, while Parties and Status are empty in most rows. Expected: the primary column gets the space the empty columns waste. | `dr-list-1440.png`, `dr-search-1440.png`; col widths measured from the screenshot, code read | `apps/web/src/components/data-room/ItemRows.tsx:205-212` (`colgroup`) | Narrow Parties and Status, or show Status inside the name cell, so Name gets at least 40% of the list width. |
| V3-02 | Data room grid and stats | P3 | visual (L4) | Observed. Banner, filter bar and list rows end 28px from the right edge (x=1412). Grid tiles and stats cards end at x=1427 and start at x=573, a 12px gutter. Left edge of the file pane is 12px from the tree, the page gutter is 28px. Expected one outer gutter. | `dr-grid-1440.png`, `dr-stats-1440.png`; measured 1412 vs 1427 | `ItemRows.tsx:448` (`TILE_GRID ... p-3`), `DataRoomStats.tsx` | Use the same horizontal padding (`md:px-7`) as `PAGE_GUTTER_X` for tiles and stats. |
| V3-03 | Data room, Investors, Artifacts (direct load) | P2 | perf (I2) | Observed, cause suspected. Direct loads sat on "Opening Praci..." and then "Still opening... Try again" for 19s (Data room), 9s (Investors) and more than 12s (Artifacts) at 1440 and 375. Other loads of Contacts and Artifacts took under 1s. Other walkers were hitting the same demo stack, so this may be server load, but a first-time user would see a blank shell with a retry button. Expected: content or a page skeleton within about 2s. | Timed polling loop; `artifacts-1440.png` ("Still opening...") | `apps/web/src/components/ShellSkeleton.tsx:27` (only the shell skeleton, no page skeleton) | Check the first-load request (spaces/bots list) for the slow call under load; render the page header and an empty list skeleton while it loads. |
| V3-04 | Activity (sidebar) | P2 | flow (C2, L5) | Observed. The Activity panel lists an item that the bot list directly below already shows ("Investor Relations (mock) / Needs your answer" appears twice on one screen). Opening it also pushes the whole bot list down 140px. On a later walk Activity listed only "Legal agent needs your answer" while the Investor Relations row still said "Needs your answer", so the two disagree (suspected: Activity shows a different time window). Expected: one source of truth for what needs me. | `activity-1440.png`, `m-activity.png` | Sidebar Activity component (not located) | Show Activity as an overlay/popover, or hide rows from the bot list that already appear in Activity; make both read the same "needs answer" state. |
| V3-05 | Data room, phone | P2 | visual (D2, L2) | Observed. Before the first file row, the header, consent card, search plus Filters, folder picker plus new folder plus three view toggles use 243px of 812 (30%). With Filters open it is 330px with the consent card and 215px without it. The file list gets about 570px, 5 rows. Expected: tools collapse on a phone. | `dr-m.png`, `dr-m-filters.png` | `apps/web/src/pages/DataRoom.tsx:669-760` and `FilterBar.tsx` | Move the three view toggles into the Filters sheet or an overflow menu; make the consent card one line on phones. |
| V3-07 | Contacts, 1920 | P3 | visual (D1, H6) | Observed. Four columns spread across 1550px, so Name and Email are about 500px apart and the eye loses the row. At 1440 the same table reads well. | `contacts-1920.png` | Contacts table (columns share width equally) | Cap the table at about 1200px or use fixed widths for Email, Organization and Kind. |
| V3-08 | Contacts and Investors, phone | P3 | visual (H5, D3) | Observed. Contacts shows the space name "Northwind Robotics" jammed directly under the title row (no gap), Investors shows it with 24px air, Data room and Artifacts hide it on a phone. Expected one treatment. | `contacts-375.png`, `investors-375.png`, `dr-m.png` | `apps/web/src/components/PageHeader.tsx` | Hide the space name on phones for every page (as Data room does) or give it one consistent gap. |
| V3-09 | Command palette | P3 | copy (C1) | Observed. With no match the palette says "No matches in pages, documents, contacts" even though it also searches chats (the "pilot" query returned a Chats group). On a phone there is no close button or "Esc" hint (suspected: closes by tapping the backdrop). | `cmdk-none.png`, `m-cmdk.png` | Palette empty state (not located) | Say "No matches" and let the mail row speak for itself; add a Cancel on phones. |
| V3-10 | Data room, failed rows | P3 | visual (C2, H5) | Observed. A failed file shows the red icon, the red message, and the "Failed" pill (three signals for one fact). Its Parties cell is blank where other rows show an em dash, and the row is 96px against 56px, which breaks the row rhythm. | `dr-list-1440.png`, `focus-1440.png` | `ItemRows.tsx` (row cells) | Drop the pill when the message is shown, or drop the message in the list and keep it in the preview; show an em dash in Parties. |
| V3-11 | Data room 1440 | P3 | visual (H3, D3) | Observed from layout-audit. Eight font sizes (11, 12, 13, 14, 15, 16, 18, 21px) and off-scale spacing (6, 10, 11, 14, 18px) on one screen, including the sidebar. | layout-audit.js output | Global | Collapse 13/14/15 to two sizes and move 6/10/11/14/18 onto the 4/8 scale in the next cleanup. |
| V3-12 | Activity filter popover | P3 | visual (H5) | Observed. The popover is a small panel with a native select, a heavy focus ring, and a 12px "Status" label, glued to the sidebar edge and overlapping page content without elevation. Other menus in the app (Add files, folder picker) are styled menus. | `activity-filter.png` | Activity filter component | Use the same menu or popover component as the other menus. |

## Excellent as is

- Command palette: grouped results (Documents, Contacts, Chats), highlighted match text with snippets, a "Search mail for ..." fallback row, Move/Open/Esc footer, focus returns to the Search field on Escape. On a phone it anchors at the top above the keyboard.
- Data room preview: a side panel at 1440 and a centered dialog at 375, with open, download, expand, more and close controls, plus folder, source and size facts.
- Data room stats: four tiles, a date histogram, and Types, Top parties, Status rows that are buttons (drill down to the filtered list).
- Sidebar badge "Data room, 1 file failed" opens the list already filtered to Failed, with a removable "Status: Failed" chip.
- Data room folder picker on a phone: a flat menu of full paths ("Finance / Bank statements") with a check on the current one; Add files menu (Upload files, From email, From Box) is short and plain.
- Tab order in the Data room: search, filters, sort, folder tree as one stop, New folder, Auto-sort, resize handle, Select all, then rows, with a clear focus ring on the row.
- Artifacts: calm card grid with type labels (Doc, Sheet, Page), a version chip, and a compact list view as the phone default.
- Contacts at 1440 and 375: dense, readable table; the phone drops Email and keeps Organization under the name.
- Upload feedback: the row appears at the top at once and a toast says "Uploaded" with a View action.
- No horizontal overflow at 375 on any page and no page-level vertical scroll at 1440 or 1920 (L1 and L6 pass).

## Not covered

- Search results on a phone, Activity and shell at 1920 beyond the sidebar, and Stats and Preview at 1920 were not captured.
- Processing strip: the uploaded text file finished before it could be seen, so the in-progress state was not observed.
- Delete on a failed row was not exercised (shared demo data).
- Touch-target sizes (see method notes).
