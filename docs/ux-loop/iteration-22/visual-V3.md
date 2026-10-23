# Iteration 22 - visual inspector V3

Group V3 pages: Data room, Cap table (Investors), Contacts, Artifacts, Activity, search results, command palette (Cmd+K).
Target: the mock-data demo stack only (web port 5381). Viewports: 1440x900 and 375x812 for every page, 1920x1080 and 1024x768 for the Data room shell.
Persona: Maya, first-time founder at Northwind Robotics. Screenshots are kept outside the repo; file names are quoted in the evidence column.

## Method and limits

- Each page and state was captured, then run through the layout audit and the geometry audit (`agent-browser eval`), then used by hand: hover, Tab order, menus, dialogs, filters, folder navigation, upload, long file name, no-results states, resize.
- The layout audit's contrast list is not usable on this dark theme (it reports 1.2 to 1.4 for every label, including plainly legible text). I judged contrast by eye and made no contrast findings.
- Touch emulation is unavailable: even with `set device "iPhone 15"` the page reports `pointer: coarse = false`. No touch-target finding is made. The Data room source uses `pointer-coarse:` size variants on rows, checkboxes and preview links (`ItemRows.tsx`, `Preview.tsx`); whether the toolbar toggles (34x28 at 1440 and 375) grow under a real coarse pointer is UNVERIFIED.
- The demo stack is shared with other walkers. Rows I did not create appeared during the run (a "New Bot", Mail needs reconnect sections, new Data room folders such as Cap table and Budget, the consent card disappeared). I did not report any of those. My own change: I uploaded one synthetic text file ("V3 upload test ...txt") to Finance / Invoices; another session's auto-sort later moved it to Archive / Test data.
- Hard page loads on the demo took several seconds with a skeleton. The page is served by the Vite dev server (hundreds of unbundled module requests), so this is a dev-mode artifact and not reported as a perf finding.
- Not exercised: deleting an artifact (trash icon on hover), Box and email import (need real accounts, BLOCKED), the processing strip with a slow file (the upload finished instantly, so the strip never showed), Carta menu on Investors.

## Verdicts

| Page | 1440x900 | 375x812 | Other |
| --- | --- | --- | --- |
| Data room list | Pass. One screen, list scrolls inside its panel (pageScrollY 0). Path bar, filter chips, preview pane, folder tree all work. | Pass. Toolbar folds into three compact rows, folder picker replaces the tree. | 1920: pass, Name column uses the space. 1024: pass, toolbar wraps to three rows cleanly. |
| Data room grid | Pass. Equal cards, thumbnails, long names clamp. | Pass. Two-up cards. | |
| Data room stats | Pass with notes (V3-05). Scrolls inside its panel. | Pass with notes (V3-05). | |
| Data room failed view | Fix needed (V3-02). | Not walked separately. | |
| Cap table (Investors) | Pass. One screen, scrolls inside panel. Judged lightly, owned by another session. | Pass with one truncation (V3-06). | |
| Contacts | Pass. Compact table, whole row opens the edit dialog. | Pass. Email column drops, organization moves under the name. | |
| Artifacts | Pass. Grid, list and master-detail all fit one screen. | Pass. | |
| Activity | Pass. Opens as a sidebar panel, filter popover works. | Not walked on its own (drawer). | |
| Search results (Cmd+K) | Excellent. | Excellent. Anchored to the top, results scroll inside. | |
| Empty Cmd+K | Excellent, no page agents listed, matches the Pass-21 decision. | | |

Pass-21 decisions checked here: page agents hidden from the empty palette (confirmed); Settings and Integrations listed as pages (confirmed); Data room sidebar row opens all files and the red badge opens the failed view (confirmed, URL `?status=failed`); Activity hides bot rows it already shows (confirmed: Investor Relations and Finance helper are absent from the chat list while shown in Activity).

## Findings

| ID | Page / story | Sev | Category | What happened vs expected | Evidence | Suspected location | Proposed fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| V3-01 | Data room list, STORY-DRM-010 | P2 | visual | OBSERVED. At 1440 the Name column is 335 px wide while the Type and Added columns have wide slack and the Parties column (224 px) is mostly "-". Names such as "MOCK Invoice 3022 - Cobalt Cloud Hosting.pdf" wrap to two lines, so row heights alternate 56 / 65 px. Norms D2, H6. Expected: the Name column gets the free width and rows are one height. | dr-1440.png, dr-filter3-1440.png; no wrap at 1920 (dr-1920.png) | `apps/web/src/components/data-room/ItemRows.tsx:210-214` (`w-40`, `w-24`, `w-56 @min-[900px]/list:w-[30%]`) | Narrow Type to about `w-32` and cap Parties below 30% so Name takes the remainder at 1440. |
| V3-02 | Data room failed view, STORY-DRM-008 | P2 | flow | OBSERVED. After the red badge opens "Status: Failed", the only row says "This file isn't a readable PDF." with no visible action. "Replace file" exists only in the hover "..." menu. Maya sees the problem and has to guess where the fix is. Norms I1, I6. | dr-failed-1440.png, dr-failed2.png | Row message in `ItemRows.tsx` (status row); menu item "Replace file" | Show a "Replace file" text button beside the error message on failed rows. |
| V3-03 | Data room list and grid, failed file | P3 | visual | OBSERVED. A failed row's folder path ("Product") is replaced by the error line, so the list loses where the file lives; Cmd+K still shows "Product". The grid card for the same file also uses a bare "..." without the dark circle that cards with thumbnails have. Norms H5, C2. | dr-failed-1440.png, dr-grid-1440.png, cmdk2-1440.png | `ItemRows.tsx` row and card overflow button | Keep the folder line and put the error on its own line; give the overflow button on thumbnail-less cards the same circle. |
| V3-04 | Data room stats and filters, STORY-DRM-110 | P3 | visual | OBSERVED. Switching to Stats removes the search box and Sort, but the filter chips keep their x position, leaving an empty 320 px gap at the left of the filter row (1440). At 375 the search row disappears and "Filters" sits alone on the right with a 50 px empty band above it. Norm L5. | dr-stats-1440.png, dr-stats-375.png | `apps/web/src/pages/DataRoom.tsx` around lines 823-850 (`statsView` branch) | Left-align the chips when search is hidden, or keep the search box (it filters stats too). |
| V3-05 | Data room stats | P3 | visual | OBSERVED. The month chart shows only "10" on the y axis and the first and last month on the x axis; no value labels on bars. Maya cannot read how many documents a month holds without hovering (hover not tested). Norm C3. | dr-stats-1440.png, dr-stats-375.png | `components/data-room/DataRoomStats.tsx` | Add a count tooltip on focus and hover (verify it exists) and a baseline "0". |
| V3-06 | Cap table, Action items, STORY-CAP-101 | P2 | copy | OBSERVED at 375. The audit request title is cut to "Audit request - [M..." beside "New" and "Draft reply", so the one fact Maya needs (which audit) is hidden. At 1440 the title is fully shown. Norm C4. Investors is owned by another session, so this is reported once and lightly. | inv-375.png | `apps/web/src/components/investors/ActionItems.tsx` (row, near line 133) | Let the title wrap to two lines on phone width and move the buttons under it. |
| V3-07 | Cap table, Contacts card | P3 | copy | OBSERVED. Each contact row ends in a bare "-" before the "..." menu with no column heading. Maya cannot tell what the dash means (norm C4). The lower-right "SAFEs, if converted at cap" block also has two unlabeled numeric columns (amount, percent). | inv-1440-b.png | `Investors.tsx` contacts list rows | Label the columns, or hide the dash when empty. |
| V3-08 | Artifacts grid, STORY-APP-129 | P3 | a11y | OBSERVED. Card descriptions are cut with an ellipsis ("Decisions and owners from the October all-...") and the card link has no `title`, so the full text is not reachable on hover (the Data room rows do set `title`). Norm C4. | art-1440.png; `title` attribute null on all cards | `apps/web/src/pages/Artifacts.tsx` card (near lines 610-620) | Add `title={description}` or allow two lines. |
| V3-09 | Artifacts list | P3 | visual | OBSERVED. The Added column is right-aligned at x=1364 while the row and divider lines end at x=1412, so numbers stop 48 px short of the edge, unlike the Data room table. Norm H6. | art-list-1440.png | `Artifacts.tsx` list columns | Make the Added cell flush to the table edge, or reserve the space only where a row action exists. |
| V3-10 | Activity panel, STORY-APP-124 | P3 | visual | OBSERVED. In "Finished" every row has a green dot and green "Done" (six rows at once), so the semantic success color is repeated until it stops meaning anything. The yellow "Needs your answer" row above it is the only item that needs action. Norm H4. | act2-1440.png | `apps/web/src/components/` Activity panel rows | Show finished runs in muted text and keep color only for "Needs your answer" and "Failed". |
| V3-11 | Command palette on phone | P3 | visual | OBSERVED. At 375 the results panel stops at about 45% of the screen height (365 px of 812) and scrolls inside, even when a keyboard is not open. Acceptable with the on-screen keyboard; with a hardware keyboard it wastes space. Low value, noted only. | cmdk-375.png | palette container | None required unless a hardware-keyboard case is wanted. |

The earlier suspicion that contact names are too small to tap (20 px buttons) is not a finding: the whole row opens the dialog (verified by clicking at the row's Kind column at 375).

## Excellent as is

- Cmd+K search results: grouped Documents, Contacts and Chats, matched terms highlighted, a snippet around the match, same layout on phone. The empty palette is short and lists only pages, Integrations and Settings.
- Data room master layout: folder tree, path bar ("All items > Finance > Invoices"), filter chips that show the active value with an x, sort that switches to Relevance during a search, and a compact "No results" state with "Clear search".
- Data room upload lands in the open folder and confirms with "Uploaded to Finance / Invoices" plus a "View" action.
- Preview pane: type, date, party chips, folder, source and size in a short key-value list, with open, download, expand and close icons that all have names.
- The three Data room views (list, grid, stats) share one toolbar position; the view choice is remembered across reloads and viewports.
- Data room at 1024: the folder tree collapses to an "All items" folder menu and the toolbar wraps to three tidy rows with no horizontal scroll.
- Keyboard: Tab order in the Data room follows the visual order (views, Add files, Ask, search, filters, sort, folders, list) and every stop shows a focus ring; the skip link is first in the document.
- Contacts: dense, scannable table; Edit dialog is short, focused on the first field, with Delete visually separate from Cancel and Save.
- Artifacts: master-detail view keeps the list as a side rail while a sheet shows; sheets render as a readable table with right-aligned numbers.
- Every audited page at every viewport had pageScrollX 0 and pageScrollY 0; the long content scrolls inside its own panel (L1, L6 met).
- Data room sidebar row and red "1 file failed" badge behave as decided in Pass 15.

## Findings list (for the caller)

V3-01 P2 visual Data room Name column too narrow at 1440; V3-02 P2 flow failed-file row has no visible Replace action; V3-06 P2 copy Cap table action item title truncated on phone; V3-03 P3 visual failed row loses folder path and bare overflow button; V3-04 P3 visual Stats view leaves a gap in the filter row; V3-05 P3 visual stats chart has no readable counts; V3-07 P3 copy unlabeled dash and columns on Investors contacts; V3-08 P3 a11y Artifacts card descriptions truncate without a title; V3-09 P3 visual Artifacts list Added column not flush; V3-10 P3 visual Activity Finished rows all green; V3-11 P3 visual phone palette height (noted only). No P0 or P1 found.
