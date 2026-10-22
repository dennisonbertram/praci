# Visual V3 (iteration 21): Data room, Investors, Contacts, Artifacts, Activity, search, Cmd+K

Inspector: uxl21-V3. Target: mock-data demo stack only, signed in as the mock founder (Maya Chen, Northwind Robotics).
Viewports: 1440x900 and 375x812 for every page; 1920x1080 for the Data room shell. Dark theme only.
Screenshots are kept outside the repo (names: dr-1440, dr-grid-1440, stats-1440, preview-1440, dr-addmenu-1440, dr-upload-1/3, dr-empty-1440, dr-1920, dr-375, dr-stats-375, dr-grid-375, dr-prev-375, investors-1440/1440b/375, contacts-1440/375, contact-drawer-1440, artifacts-1440, activity-1440, cmdk-1440, cmdk-search-1440).

Caveats. The demo stack was shared with other walkers, so state changed during the walk (AI consent was granted by someone else, spaces and bots were added, and pages loaded slowly, 4 to 17 s). Touch-target sizes were NOT measured with pointer: coarse emulation, so no touch-target findings are made. Contrast numbers from layout-audit are invalid while a modal backdrop is open, and are not used. The tour was dismissed ("Skip tour") before measuring.

## Verdicts

| Page | 1440x900 | 375x812 |
|---|---|---|
| Data room list | Pass. One screen, list scrolls inside its panel (pageScrollY 0). Folder tree, path bar, filters and sort are clear. | Pass. Folder picker, Filters and view switch fit; no horizontal scroll. |
| Data room grid | Pass. | Pass. |
| Data room stats | Pass (the filter chips stay in place when the search box hides). | Pass. |
| Data room preview | Pass with finding V3-01 (consent shown twice). | Preview is a modal with Open / Download and no page image (V3-05). |
| Investors (Cap table) | Pass on fit (inner scroll). Findings V3-02, V3-06. | Pass. Table folds to Holder / Fully diluted with the share count under the name. |
| Contacts | Pass. Clean, one primary action. | Pass. Email column is dropped; organization moves under the name. |
| Artifacts | Pass with V3-04 (uneven card). | Pass. |
| Activity | Pass with V3-07. | Not opened (shown inside the drawer). |
| Cmd+K and search results | Excellent. | Not exercised separately. |
| Data room at 1920x1080 | Fits one screen. V3-08. | n/a |

## Findings

| Id | Page | Sev | Cat | What happened vs expected | Evidence | Suspected code | Proposed fix |
|---|---|---|---|---|---|---|---|
| V3-01 | Data room, preview open, before AI consent | P2 | visual | Observed. The "Let Praci read your documents / Allow / Not now" card appears twice at once: as the page banner and again inside the preview panel. Norm C2 (no duplication). Expected one prompt per screen. | preview-1440.png | `apps/web/src/components/AiDataSharing.tsx` (heading at line 154) rendered by both the page banner and the preview panel | Hide the preview-panel copy while the page banner is visible. |
| V3-02 | Investors | P2 | bug / flow | Observed. "Equity raised" shows a bare "—" for several seconds (4 to 17 s on this shared stack) before "$250,000 / $50,000 committed" appears, with no skeleton. A dash reads as "nothing raised" and the number then changes (L5, C3, I2). The component has a skeleton for `loading`, so the flag looks to clear before the SAFE list resolves (suspected). | investors-1440.png (dash) vs investors-1440b.png (value) | `apps/web/src/pages/Investors.tsx` lines 170-190 (`loading` / `raised`) | Keep the skeleton until the SAFE query has settled, not just until the cap table has loaded. |
| V3-03 | Data room, upload | P3 | flow | Observed. Upload works: an "Uploaded / View" toast shows and the row appears first in the list as "Not tagged". The "Upload files" input first matched by a generic file selector (single-file input) gave no feedback at all; the multi-file input is the real one. Not a defect for users (only the real menu item is reachable); noted so walkers target `input[type=file][multiple]`. | dr-up-1.png, dr-up-3.png | n/a | None. |
| V3-04 | Artifacts grid | P3 | visual | Observed. The card "MOCK Investor Update - September" is taller (about 92 px) than its neighbours (72 px) because the "v2" badge sits on its own line. Norm L5/H6. | artifacts-1440.png | `apps/web/src/pages/Artifacts.tsx` card (version badge) | Put the "v2" badge on the title line or reserve one line in every card. |
| V3-05 | Data room preview, phone | P3 | flow | Observed. Desktop shows the first page of the PDF; the phone preview shows only a generic file icon with Open and Download. Expected the same thumbnail (P1/H5). Mobile may deliberately skip the render for weight; not confirmed. | dr-prev-375.png vs preview-1440.png | Data room preview component | Show the page thumbnail in the phone modal, or state in code why it is skipped. |
| V3-06 | Investors table | P3 | visual | Observed. The "Invested" column is "—" in every row (including SAFE-funded holders being absent from the table), so a full column carries no information (D2, D5). | investors-1440b.png | `apps/web/src/components/cap-table/CapTableEditor.tsx` line 320 | Hide the column when no row has an amount. |
| V3-07 | Activity panel | P3 | flow | Observed. Opening Activity replaces the whole sidebar, including the Pages list, so Maya must close it to reach Inbox or Finance (I6, L7). Expected the pages to stay reachable, or a visible back control. The Activity button shows only a pressed state. | activity-1440.png | Sidebar Activity mode | Keep the Pages block above the Activity list, or add a labelled "Back" row. |
| V3-08 | Data room at 1920 | P3 | visual | Observed. In the list view the Name column is very wide, so Type, Added and Parties sit 600 px or more from the name, which makes rows hard to follow (H6). | dr-1920.png | `apps/web/src/pages/DataRoom.tsx` list columns | Cap the Name column width or let it share space equally above 1600 px. |
| V3-09 | Data room folder tree | P3 | bug | Observed. After opening "Legal / Contracts", the selected tree row sits half-hidden under the "New folder" footer at the bottom of the tree. Expected the active folder to scroll fully into view. | dr-addmenu-1440.png | Folder tree (scrollIntoView on selection) | Call `scrollIntoView({ block: "nearest" })` on the selected folder. |
| V3-10 | Data room, phone stats | P3 | visual | Observed. In Stats the Filters button gets its own row, right-aligned, with nothing on its left. | dr-stats-375.png | Data room phone toolbar | Put Filters on the same row as the folder picker and view switch. |

## Excellent as is

- Cmd+K: Pages first, agents with shortcuts, grouped results (Documents, Artifacts, Chats, Mail) with highlighted matches and snippets, footer with Move / Open / Close. Fast and clear.
- Data room: folder tree plus a clickable path bar (All items > Legal > Contracts); the sub-path line disappears inside a folder where it would repeat; compact "No results" plus "Clear search"; stats view with four figures, a month chart and ranked bars; a red failed-file line in plain words ("This file isn't a readable PDF."); keyboard order is logical and every control shows a focus ring.
- Contacts: dense, one primary action (Add contact), edit dialog has a quiet red Delete, Cancel and a single Save.
- Phone layouts reflow cleanly (no page scroll, no horizontal overflow on any page at 375 px).
- The Investors "Action items" card has a stronger outline by design (attention state); it is the one focal point on the page.
