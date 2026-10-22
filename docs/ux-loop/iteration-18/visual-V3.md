# Iteration 18, visual inspection V3 (Data room, Investors, Contacts, Artifacts, Activity, search, Cmd+K)

Target: demo stack web :5381 (mock data), user Maya Chen (Northwind Robotics), dark theme. Screenshots: `/tmp/uxloop18/V3/`.
Viewports: 1440x900 (all pages), 375x812 (all pages), 1920x1080 (shell, Data room, Artifacts, Activity), 1280x800 (Data room preview).
Tools: layout-audit.js and geometry-audit.js on every page and viewport.

Method limits (stated plainly):
- `agent-browser set device` only sets the viewport; `matchMedia('(pointer: coarse)')` stayed false. Touch-target sizes were therefore NOT judged (the app has `pointer-coarse:` size rules, so raw 28-32 px measurements at 375 are not valid findings).
- layout-audit.js `lowContrast` reports ratios of 1.2-1.4 for every white label on the dark theme. The text is clearly legible in the screenshots, so this is a tool false positive (transparent backgrounds), not a finding.
- No real accounts, no OAuth. I uploaded one invented text file (`v3-note.txt`) to the demo Data room.

## Verdicts

| Page / state | 1440x900 | 375x812 | Verdict |
|---|---|---|---|
| Data room, list | Fits one screen, list and tree scroll inside panels, no page scroll | Clean stacked rows, filters collapse behind "Filters" | Good. See V3-02, V3-03, V3-08 |
| Data room, grid | Even cards, failed card has inline Delete | not captured separately | Good. See V3-02 |
| Data room, stats | Tiles, chart, ranked lists scroll inside panel | Stacks cleanly | Good. See V3-08 |
| Data room, folder tree and path bar | Tree plus breadcrumb correct, folder highlight right | Tree becomes an "All items" menu | Good |
| Data room, preview | Docked panel good at 1440, loses tree at 1280 | Centered sheet, two Open/Download pairs | See V3-03, V3-09 |
| Data room, upload | Row appears at top with auto-sort, "Uploaded / View" toast | not tested | Good (tiny file processed instantly, no processing strip seen) |
| Investors (cap table) | Fits, inner scroll | Header ok, action title truncated | Owned by another session, only P0/P1 counted: none |
| Contacts | Dense 36 px rows, whole row opens edit dialog | Name + org stack, Kind column | Excellent |
| Artifacts, grid/list/empty/detail | Fine, large cards | List default, clean | See V3-12, V3-13 |
| Activity panel | Broken density at 1440 and 1920 | Good in the drawer | See V3-01 |
| Search results / Cmd+K | Excellent grouping and highlight | Top sheet, tap-outside closes | See V3-04 to V3-07 |
| 1920x1080 shell | Sidebar fixed 316 px, content stretches | n/a | Good, see V3-13 |

## Findings

| ID | Page | Sev | Cat | Observed / suspected | What happened vs expected | Evidence | Code | Proposed fix |
|---|---|---|---|---|---|---|---|---|
| V3-01 | Activity (sidebar panel) | P1 | flow | Observed | Opening Activity on desktop shows the "Needs you" list inside a 76 px high nested scroller (clientH 76, scrollH 393). One approval row is visible and the next is cut in half, although there are 4 approvals waiting. At 1920x1080 it is still about 2 rows (the Pages list above keeps its 360 px). On the 375 drawer the same list shows all 4 rows. Expected: the place that says what needs Maya shows all waiting items without a peephole scroll. Norms L1, D2, I6 | `/tmp/uxloop18/V3/act-1440.png`, `act-1440-scrolled.png`, `act-1920.png`, `act-375.png` | `apps/web/src/pages/ActivityList.tsx:179` (`max-h-[45vh] lg:max-h-[40%]` inside a 384 px scroller) | While Activity is open, collapse the Pages block (or give Activity at least 60% and a 3-row minimum) so the Needs you rows are all visible |
| V3-02 | Data room, failed file | P2 | flow | Observed | A failed file has no visible way to retry. List view shows only the red reason and "Failed" pill; "Try again" is inside the hover-only "..." menu. Grid view shows a full-width Delete button (the destructive action) as the only visible action. The failed filter view reached from the red badge has the same problem. Expected: the recovery action is the visible one, Delete stays in the menu. Norms H2, I3, I1 | `dr-failedview.png`, `dr-failed-menu.png`, `dr-grid-1440.png` | DataRoom list row actions and grid card in `apps/web/src/pages/DataRoom.tsx` / `components/data-room/` | Show a "Try again" button on failed rows and cards; move Delete into the menu |
| V3-03 | Data room, preview at 1280x800 | P2 | flow | Observed | With a file open at 1280 wide the folder tree disappears and the list switches from table to stacked rows. The breadcrumb shows only "All items", so Maya cannot change folder without closing the preview. At 1440 the tree stays. Norms I6, L5 | `dr-1280-preview.png` vs `dr-preview-1440.png` | `apps/web/src/pages/DataRoom.tsx:745-772` (`@min-[1100px]/bd:flex`, "tree needs a wider page") | When the tree is hidden, show a folder button (same menu as on phones) next to the breadcrumb |
| V3-04 | Cmd+K | P2 | visual | Observed | Result rows are about 48 px high for a single-line label, so only 8 of the 11 Pages fit before Chats and Agents start. Tool surface, norm D1 (28-36 px rows) | `cmdk-1440.png` | `apps/web/src/pages/shell/command-palette.tsx` row padding | Use about 36 px rows for the Pages group (keep two-line rows only for results with a snippet) |
| V3-05 | Cmd+K | P3 | visual | Observed | The selected row's marker is a 2 px left border on a rounded row, so it curves into a bracket shape instead of a straight bar. Norm H5/H6 | `cmdk-search.png`, `cmdk-none.png` | `command-palette.tsx` selected style | Use an inset bar or a full-row background without a border |
| V3-06 | Cmd+K, no results | P3 | copy | Observed | "No matches" is followed directly by a highlighted "Search mail for 'qqqzzz'" action, which reads as a contradiction. Norm C1/C3 | `cmdk-none.png` | `command-palette.tsx` | Drop "No matches" when the mail row is shown, or word it "Nothing in Praci. Try mail:" |
| V3-07 | Cmd+K, phone | P3 | a11y | Observed once | Opened with Meta+K, then closed by tapping outside at 375: focus went to the "Skip to content" link, which rendered over the hamburger and the page title until blurred. Desktop Esc returned focus to the previous button correctly. Norm I7 | `drawer-375.png` | Palette close handler / focus restore | When there is no trigger element, return focus to `main` instead of the document start |
| V3-08 | Data room, phone | P3 | flow | Observed | List/grid/Stats toggles and Sort are hidden behind "Filters" (by design in code). Opening Stats moves the Filters button from the search row to the folder row (layout shift) and adds three chip rows before any number. Norms I6, L5 | `dr-375.png`, `dr-375-filters.png`, `dr-375-stats.png` | `components/data-room/FilterBar.tsx:432-452` | Keep Filters in one place in all views |
| V3-09 | Data room preview, phone | P3 | visual | Observed | The sheet shows Open and Download twice: icons in the header and "Open"/"Download" buttons in the body. Norm C2 | `dr-375-preview3.png` | `components/data-room/PreviewActions.tsx` `PdfPhoneFallback` plus header `IconAction`s | Hide the header pair below sm, or drop the body buttons |
| V3-10 | Data room, failed row | P3 | copy | Observed | One failure is stated three times: Type "Unreadable", "Failed" pill, and "This file isn't a readable PDF." Norm C2 | `dr-folder-1440.png`, `dr-kbd.png` | list row cells | Show Type "Unreadable" only when not failed, or drop the pill because the red line says it |
| V3-11 | App load (deep link) | P2 | perf | Observed, suspected cause | A fresh load of `/app/data-room` showed skeleton, then "Still opening... Try again" at about 7 s, and became usable at about 9-10 s. Client-side navigation is instant. Probably the unbundled Vite dev server (thousands of module requests), not the product build | `dr-1440.png` (the "Still opening" state) | n/a | Re-measure on a production build before acting |
| V3-12 | Artifacts | P3 | visual | Observed | Grid cards are about 145 px tall for icon, type, title and a one-line description, and the same list becomes 41 px rows in list view but about 110 px rows in the split detail view, so density jumps three times. Norms D1, H5 | `art-1440.png`, `art-list-1440.png`, `art-detail.png` | `apps/web/src/pages/Artifacts.tsx` | Share one row height between list and split list |
| V3-13 | Artifacts list / table views at 1920 | P3 | visual | Observed | Name at x=364 and Type/Added at x=1650+, a 1300 px gap with nothing to guide the eye. The sheet artifact table has the same wide gap between Month and Net burn. Norm H6 | `act-1920.png`, `art-detail.png` | no max-width on the list | Cap the content width (about 1100 px) or add a hover row band |
| V3-14 | Contacts | P3 | a11y | Observed once | Opening the edit dialog by clicking a non-focusable cell with the mouse and pressing Escape put focus on "Add contact" instead of the row. The keyboard path (name button, Enter, Esc) returns to the name correctly. Norm I7 | n/a (DOM check) | contacts row click handler | Make the row restore focus to the row's name button |

Out of scope (Investors page is owned by another session, below P1, not counted):
- Phone: the only Action item reads "Audit request - [M..." because the title truncates; the subject is lost (`inv-375.png`).
- Desktop: contacts under the "SAFEs and funds" tab have a right column that shows only "-" with no header (`inv-1440-b.png`).

## Excellent as is

- Contacts: dense 36 px rows, whole row opens a clear edit dialog, Delete is red and separated from Save, empty-free layout at 1440 and 375 (`con-1440.png`, `con-375.png`).
- Cmd+K search: results grouped (Documents, Contacts, Chats, Artifacts, Mail) with underlined matches, snippets, and a "Search mail for" fallback; phone sheet closes on tap outside (`cmdk-search.png`, `cmdk-art.png`).
- Data room list, tree, path bar, filters, stats view and docked preview at 1440 and 1920: one screen, inner panels scroll, columns aligned, "Failed" pill and badge-to-failed-view work (`dr-retry.png`, `dr-stats-1440.png`, `dr-1920.png`, `dr-failedview.png`).
- Keyboard: sidebar uses roving arrow keys through every page and chat, the list rows take arrow keys with a strong white focus ring, Tab order runs sidebar, header, filters, tree, list.
- Row menu content for a failed file is well ordered ("Try again" first, Delete red and last) (`dr-failed-menu.png`).
- Artifacts empty search: one line plus "Clear filters" (`art-empty-1440.png`).
- Activity on the phone drawer shows all waiting approvals with reason words (`act-375.png`).
- No horizontal overflow at 375 on any page; geometry audit found no overflow spills or wrapped controls on Contacts, Investors or Artifacts.
