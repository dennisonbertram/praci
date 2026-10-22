# Visual inspection V3 (iteration 19)

Session uxl19-V3. Target: mock-data demo stack (web port 5381), signed in as the mock founder. Screenshots: `/tmp/uxloop19/V3/`.
Scope: Data room (list, grid, stats, folder tree, path bar, preview, selection bar, upload, empty search), Investors (P0/P1 only), Contacts, Artifacts, Activity, Cmd+K search.
Viewports: 1440x900, 375x812, 1920x1080 (shell, Data room grid).

Method notes
- layout-audit.js and geometry-audit.js were run on every page at 1440 and 375. No page scroll (pageScrollY and X are 0) and no horizontal overflow on any page or viewport. Inner panels scroll.
- The audit's contrast check reports false 1.2-1.4 ratios on this dark theme (it cannot resolve the background). I sampled screenshot pixels instead: muted text measures 5.4-6.1:1, body text 14:1. No contrast finding.
- The device preset in agent-browser does not set `pointer: coarse`, so touch-target sizes could not be measured. `apps/web/src/styles.css:88` forces 44 px for buttons under `pointer: coarse`, so no touch finding is raised.
- Other walkers shared the stack: extra files, folders, chats and approval toasts appeared during the run. I uploaded one invented file (`walker-note.txt`) into Archive / Old drafts / 2025. The upload processing strip was never visible because the upload finished instantly (UNVERIFIED).

## Verdicts

| Page | 1440x900 | 375x812 | Verdict |
|---|---|---|---|
| Data room list | Dense, aligned, sticky header, selection bar docked in its own row, preview panel fine | Compact two-line rows; view switch hidden behind Filters | Good, 1 P2 |
| Data room grid | Clean; uneven gap between title and meta (1920: 8 columns fill well) | Two columns; filter panel eats 215 px | Good, 2 P3 |
| Data room stats | Good hierarchy; filter row jumps position | Same, filter row jumps | Good, 1 P2 |
| Folder tree / path bar | Excellent: tree keyboard works, breadcrumb, subfolder rows | Folder menu lists full paths | Excellent |
| Preview | Good | Dialog duplicates Open/Download | 1 P3 |
| Investors | Fits one screen, no P0/P1 | Good | No P0/P1 |
| Contacts | Clean table, edit dialog tidy | Email column dropped, org under name | Good, P3 |
| Artifacts | Cards oversized for their content; list table right edge off-grid | List default, good | 2 P3 |
| Activity (sidebar) | Squeezes the chat list to about 1.5 rows | Replaces Pages in the drawer; fine | 1 P2 |
| Cmd+K | Grouped results, highlighted matches, snippets | Pinned top, no footer hint | Excellent, 1 P3 |

## Findings

| id | page | sev | cat | what happened vs expected | evidence | suspected location | proposed fix |
|---|---|---|---|---|---|---|---|
| V3-01 | Data room list, keyboard | P2 | flow (I7) | OBSERVED: ArrowDown onto a row opens its preview (focus stays on the row). Pressing Enter on that same row then CLOSES the preview, because Enter toggles. Expected: Enter on the row opens or keeps the preview; only Escape closes. Result: a keyboard user who presses Enter to "open" the file loses the preview. | Measured: after ArrowDown preview open = true; after Enter = false. `/tmp/uxloop19/V3/kb-1440.png` | `apps/web/src/components/data-room/ItemRows.tsx:128-130` (`o.onToggle(item)`) | Make Enter and Space open the preview (move focus into it) and leave closing to Escape and the close button. |
| V3-02 | Data room, 375 | P2 | flow (I6) | OBSERVED: the List/Grid/Stats switch exists only inside the Filters panel on phones. The Filters button shows no hint that views live there, so a phone user cannot find Grid or Stats. | `m-filters.png` | `apps/web/src/components/data-room/FilterBar.tsx:265-330` | Put the view switch on the header row (icon menu next to Add) or label the Filters button "Filters and view". |
| V3-03 | Data room stats + grid, 375 | P2 | visual (L5) | OBSERVED: the Filters button jumps from the right of the search row (list) to a row of its own at the left (stats), and the open panel stays open in grid and stats, so the grid shows about 1.3 rows. Layout shifts when the view changes. | `m-grid.png`, `m-stats.png` | `FilterBar.tsx` (same block) | Keep the Filters button in one place for all three views and collapse the panel after a view is chosen. |
| V3-04 | Data room stats, 1440 | P3 | visual (L5) | OBSERVED: switching to Stats removes the search box and Sort, so Type/Party/Date move from x=676 to x=344. | `dataroom-1440.png` vs `stats-1440.png` | `FilterBar.tsx` | Keep the filter pills at a fixed x and only hide the search and Sort controls from the right. |
| V3-05 | Activity (sidebar), 1440x900 | P2 | visual (D2/L1) | OBSERVED: opening Activity takes about 40% of the sidebar (heading, two Needs-your-answer rows, Working, "Show 8 finished runs"), so the chat list shrinks to about 1.5 rows (Chief plus a cut-off New Bot). The person has to scroll the sidebar to reach a chat. | `activity-1440.png` (scroller 384 px high, content 886 px) | sidebar activity panel (Activity section in the app sidebar) | Cap the Activity block at about 3 rows with its own inner scroll, or show it as a popover. |
| V3-06 | Activity vs toast wording | P3 | copy (C1/H5) | OBSERVED: the same approval is "Inbox agent needs approval" in the toast and "Needs your answer" in Activity. One concept, two names. | `activity-1440.png` | `apps/web/src/lib/roster-status.ts:15` | Label approval items "Needs approval" in Activity (keep "Needs your answer" for questions). |
| V3-07 | Artifacts grid, 1440 | P3 | visual (D2/C2) | OBSERVED: cards are 150 px tall with a gap between title and subtitle. The type word (Doc/Sheet/Page, 11 px) repeats what the icon already says. No updated time on the card although the list view has "Added". | `artifacts-1440.png` | `apps/web/src/pages/Artifacts.tsx:829` | Shrink the card padding and replace the type word with "Added 4m ago". |
| V3-08 | Artifacts list, 1440 | P3 | visual (L4) | OBSERVED: table rule lines end at x=1388 while the header Ask button ends at x=1412 (24 px inset on the right vs 0 on the left). | `artifacts-list-1440.png` | `Artifacts.tsx` list wrapper | Use the same page gutter on both sides. |
| V3-09 | Data room grid, 1440 | P3 | visual (D4) | OBSERVED: card meta is pinned to the bottom, so short titles leave an empty band and long titles do not. Thumbnails of PDFs show unreadable 4 px text. | `grid-1440.png` | grid card in `ItemRows.tsx` | Let the meta follow the title directly. |
| V3-10 | Data room preview, 375 | P3 | visual (C2) | OBSERVED: for a file without a thumbnail the dialog shows Open and Download buttons while the header already has Open and Download icons. | `m-preview.png` | `Preview.tsx` | Drop the body buttons when the header icons are present. |
| V3-11 | Data room list, failed row | P3 | visual (H5) | OBSERVED: the failed file's Type cell is blank, while untagged files say "Not tagged". Expected: one wording per empty type. | `dataroom-1440.png` row "MOCK Signed NDA" | `ItemRows.tsx` type cell | Show "Not read" or "Failed" in the type cell for failed files. |
| V3-12 | Contacts, 375 | P3 | flow | OBSERVED: the email column disappears on phone and no email shows anywhere in the row. Clicking a row opens the edit form directly with the Name field focused, so a read-only look risks an accidental edit. | `contacts-375.png`, `contact-1440.png` | Contacts page | Show the email as a third line on phones; consider a read view first. |
| V3-13 | Cmd+K | P3 | flow | OBSERVED: "board" matches inside a word ("Dash**board**") and lists MOCK Cash Dashboard under Artifacts. Document hits show no folder or type, so v1 and v2 look alike. | `cmdk-board-1440.png`, `cmdk-search-1440.png` | palette search | Match word starts first; add the folder as a faint suffix on document rows. |
| V3-14 | Hard load of a page | P3 | perf | OBSERVED twice: a hard load of /app/artifacts stayed on "Opening Praci…" then "Still opening… Try again" for 8+ seconds (1440 and 375). Later loads took 1 s. Likely load on the shared stack (SUSPECTED, not reproduced). | `artifacts-1440.png` (first capture) | n/a | None unless it reproduces; the "Try again" state itself is fine. |

## Excellent as is

- Data room folder tree: arrow keys move through it, Enter selects, the path bar shows the full route, and subfolders appear as rows. Opening a search hit from Cmd+K lands in the right folder with the file previewed.
- Data room list: sticky column header, 56 px rows with path under the name, a docked selection bar ("2 of 70 selected / Select all 70" with Download, Email, Send to agent) that does not cover the last row, and an explicit Load more.
- Empty search result: compact "No results" with Clear search, and Sort switches itself to Relevance.
- Failed file: a red plain-words reason with an in-row "Try again" in list, grid and phone.
- Stats view: four numbers, a date chart, types and parties as bars; readable on phone.
- Focus rings are clear on header buttons, filters and rows; tab order on the toolbar is logical.
- Muted text contrast measures 5.4-6.1:1 everywhere sampled.
- Cmd+K: grouped results (Documents, Artifacts, Chats, Mail), matched letters underlined, snippets, pages including Integrations and Settings.
- Contacts edit dialog: short, labelled, Delete visibly separate from Save.
- Mobile Data room list and Contacts rows: two lines, no horizontal scroll, clean wrapping.
- 1920x1080: sidebar stays 316 px, the grid fills to eight columns, no dead band, no page scroll.
