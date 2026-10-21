# Visual inspection V3 (iteration 5)

Session uxl5-V3. Target: mock-data demo stack (web :5381), signed in as the seeded mock founder. Pages: Data room (list, grid, stats, folder tree, preview, Add files menu, processing strip), Cap table, Contacts, Artifacts, Activity, sidebar search, command palette. Viewports 1440x900, 1280x800, 1920x1080 (shell) and 375x812. Screenshots are in /tmp/uxloop5/V3/. Audits: layout-audit.js and geometry-audit.js on every page at 1440 and 375; hover, Tab order, menus and dialogs by hand.

Not measured: touch targets. agent-browser device emulation did not switch `pointer: coarse` on (checked with matchMedia), so no touch-target finding is made (owner rule). The contrast list from layout-audit.js (ratios 1.2 to 1.4 on white text) is a false positive on this dark theme and is not used.

## Verdicts

| Page | 1440x900 | 1280x800 | 1920x1080 | 375x812 |
|---|---|---|---|---|
| Data room list | Pass, one screen, inner list scrolls | Not captured | Fail (V3-07) | Pass, compact toolbar |
| Data room grid | Pass (V3-19 polish) | Not captured | Not captured | Not captured |
| Data room stats | Pass with gaps (V3-08) | Not captured | Not captured | Not captured |
| Data room preview | Pass, three panes fit | Not captured | Not captured | Pass, inset sheet |
| Cap table | Fail (V3-01) | Fail (V3-01, worse) | Pass with V3-17 | Pass with V3-10 |
| Contacts | Excellent | Not captured | Not captured | Excellent |
| Artifacts | Pass (V3-02, V3-12) | Not captured | Not captured | Pass |
| Activity panel | Pass with V3-14 | Not captured | Not captured | Not captured |
| Search and palette | Pass with V3-03/04/05 | Not captured | Not captured | Search only |

L1: pageScrollY was 0 on every page and viewport; no horizontal overflow anywhere.

## Findings

| id | page | sev | cat | What happened vs expected | Evidence | Code (suspected) | Fix |
|---|---|---|---|---|---|---|---|
| V3-01 | Cap table | P1 | bug | Observed. The donut legend's share-count column is cut off at the card edge: "8,400,0" and "1,600,0" at 1440; at 1280 the percentages are clipped too. Expected the full numbers. At 375 and 1920 it fits. Text right edge 1429 vs card clip edge 1412. | cap-1440.png, cap-1280.png | apps/web/src/components/cap-table/OwnershipDonut.tsx:500, :632 (`w-20 shrink-0` columns in a card that does not shrink) | Let the legend shrink the donut or wrap the share-count column at card widths under about 530px. |
| V3-02 | Artifacts, Contacts, all lazy pages | P2 | perf | Observed. After clicking Artifacts the main area is completely blank for about 2 to 3 s (main text length 45 = header only). Contacts shows one unshaped grey block for about 5 s. Expected the page's row skeleton at once. Artifacts has a skeleton in code, so the blank is the route chunk. Dev server may exaggerate it. | art-1440.png (blank), contacts-1440.png | apps/web/src/pages/Shell.tsx:5462 `<Suspense fallback={null}>` | Use the shared list skeleton as the Suspense fallback and shape the Contacts skeleton like rows. |
| V3-03 | Search | P2 | flow | Observed. Cmd+K and the sidebar Search box are two search surfaces with different scopes: the palette lists Pages, Contacts, Documents and agents; the sidebar lists Documents, Mail and Chats. Maya gets different answers for the same word. Norm H5, C2. | cmdk-q-1440.png, s3.png | apps/web/src/pages/shell/command-palette.tsx vs apps/web/src/pages/SpaceSearch.tsx | Feed both from one result set, or make the sidebar box open the palette. |
| V3-04 | Sidebar search | P2 | visual | Observed. Every chat result carries a "Message" badge (6 identical), the same chat repeats (Chief x2, Leadership sync x3) with no date, the query word is not highlighted, and document names are cut to "MOCK Pilot Agreement - Bolt Frei…". Norm D5, C4. | s3.png | apps/web/src/pages/SpaceSearch.tsx:85 | Drop the badge, group snippets per chat with a date, highlight the match, allow two-line names. |
| V3-05 | Command palette | P2 | copy | Observed. Searching "halcyon" returns contacts "Dana Counselor" and "Morgan Pretend" with no company or email and no highlight, so the match looks wrong. Documents do highlight. Contact rows also lack the icon the page rows have. Norm C4, H5. | cmdk-q-1440.png | apps/web/src/pages/shell/command-palette.tsx | Show organization as secondary text and highlight the matched part. |
| V3-06 | Data room | P2 | copy | Observed. The Add files menu reads Upload, Email, Box. "Email" reads like composing mail; on mobile the trigger is a bare "+". Norm C1. | dr-add-1440.png, m-dr-add.png | apps/web/src/components/data-room/DataRoomImportMenu.tsx:13 | Label the items "Upload files", "From email", "From Box". |
| V3-07 | Data room list | P2 | visual | Observed at 1920. The Name column absorbs all spare width (about 830px of blank between Name and Type) while Parties is fixed at about 130px and truncates ("Northwind Robotic…", "Halcyon Logistics (…"). Eye travel is long and the useful column is cut. Norm D2, H6, C4. | dr-1920.png | apps/web/src/components/data-room/ItemRows.tsx:205 (column widths) | Cap the Name column and give Parties the spare width. |
| V3-08 | Data room stats | P2 | a11y | Observed. The date chart shows one y label ("10") and two x labels; hovering a bar highlights it but shows no month or count; the bars are `rect` elements with no label or title. Norm I2, A2. | stats-hover.png | apps/web/src/components/data-room/DataRoomStats.tsx | Add a hover tooltip (month, count) and an aria-label per bar. |
| V3-09 | Cap table | P2 | copy | Observed. "10,000,000" appears twice (Fully diluted tile and donut centre). "Amount raised $350,000" equals the SAFE total, while the caption below says "SAFEs (4, $350,000) are not included until they convert", so Maya cannot tell what the $350,000 includes or what the caption excludes. Norm C2, C1. | cap-1440.png | apps/web/src/pages/CapTable.tsx (summary tiles) | Remove the donut centre total or the tile; say "SAFEs are not in the share counts" and place it with the share tiles. |
| V3-10 | Cap table, 375 | P2 | flow | Observed. The holders list, the main content, starts below the fold: tiles plus donut take about 650px of 812. The tab pill wraps to two rows ("Auditors", "Other"). Row meta is cut mid-word: "Advisor C… Independe… casey.advisor…". Share counts are hidden, only ownership %. Norm L7, C4. | m-cap.png, m-cap2.png | apps/web/src/pages/CapTable.tsx; OwnershipDonut.tsx | Collapse the donut to a compact bar on phones, scroll the tabs in one row, show one meta line. |
| V3-11 | Cap table | P3 | flow | Observed. Only rows with a saved contact open (cursor pointer); the founder's own row and most others do nothing and show no hint why. Focus returns to the row after the dialog (good). Norm I1. | cap-row2.png | apps/web/src/pages/CapTable.tsx:~900 (`onOpen` only when `contact`) | Let every holder open a read-only card with "Add as contact". |
| V3-12 | Artifacts | P3 | visual | Observed. List view shows only Name and Added, the type shown on grid cards (Doc, Sheet, Page) is just a tiny icon; Filters offers search and date only, no type; opening Filters pushes the list down 44px (L5). | art-list-1440.png, art-filters-1440.png | apps/web/src/pages/Artifacts.tsx | Add a Type column and a type filter; reserve the filter row height. |
| V3-13 | Shell, keyboard | P2 | a11y | Observed. 89 tab stops sit in the sidebar before the page content (each chat row has two: row and Actions). A skip link exists. Norm I7. | Tab walk 1 to 16 stays in the sidebar | apps/web/src/pages/Shell.tsx sidebar list | Make the sidebar chat list one roving-tabindex group. |
| V3-14 | Activity | P3 | visual | Observed. The panel opens inside the sidebar and pushes the chat list down about 90px at 1440x900; "Loading activity…" holds an empty band for about 4 s; summaries are cut ("Selected choice name: Name Bo…") and each row says "just now" plus "Running". Norm L5, D5. | act-1440.png | apps/web/src/pages/ActivityList.tsx:109 | Show a skeleton, give summaries two lines, drop the repeated status. |
| V3-15 | Toasts | P3 | visual | Observed. Failure toasts ("Legal agent failed", "Investor Relations (mock) failed") sit over table rows at 1440 and over the nav drawer at 375, with no visible close button. Probably demo noise (no model key), but the placement is real. Norm L3, I3. | cap-row-1440.png, m-nav.png | notification toaster in packages/ui-web | Add a close control and keep toasts out of the drawer. |
| V3-16 | Data room strip | P2 | flow | Observed, likely a mock state. "Processing 1 file, Reading MOCK Board Minutes - October.pdf" stayed unchanged for more than 10 minutes, with no age, progress or cancel. Maya cannot tell stuck from slow. Norm I2, C3. | dr-1440.png, dr-add-1440.png | apps/web/src/components/data-room (processing strip) | Show elapsed time and offer Retry after a timeout. |
| V3-17 | Cap table, 1920 | P3 | visual | Observed. Tiles and toolbar span to x=1892, the holders table stops at x=1368, leaving the Sort control floating over empty space. Norm L4. | cap-1920.png | apps/web/src/pages/CapTable.tsx (table max width) | Let the table fill the toolbar width or cap the toolbar to the table. |
| V3-19 | Data room grid | P3 | visual | Observed. Failed card lists the error, then the folder ("Product") after it, while other cards put type and date there; processing and failed cards have no thumbnail. | dr-grid-1440.png | apps/web/src/components/data-room (grid card) | Keep one field order on every card. |

## Excellent as is

- Contacts page at both widths: dense, aligned, four plain columns, organization shown as secondary text on mobile.
- Data room failed file: plain message "This file isn't a readable PDF." with a Try again button, red only for the failure, in list and grid.
- Data room at 375: one compact toolbar (search, Filters, folder menu, New folder, Auto-sort, Sort); the folder menu shows full paths.
- Data room 1440 with preview open: three panes fit one screen and the list switches to a stacked layout.
- Stats cards and ranked bars (Types, Top parties, Status) read at a glance.
- Artifacts grid cards: uniform, type labelled, one line of description.
- Focus returns to the row after closing the contact dialog; skip-to-content link exists; every icon button in main has an accessible name (script check found none unlabeled).
- No page scroll and no horizontal overflow at any tested size.
