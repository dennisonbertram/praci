# Visual inspection V3 (iteration 7)

Session uxl7-V3. Target: mock-data demo stack only (web port 5381). Pages: Data room, Cap table (sidebar label "Investors"), Contacts, Artifacts, Activity, command palette (Cmd+K), mail search results.
Viewports: 1440x900 and 375x812 for every page, plus 1920x1080 for Data room and Cap table. Screenshots are in `/tmp/uxloop7/V3/`.
Audits run on each page and state: `layout-audit.js` and `geometry-audit.js`. Contrast results from layout-audit (ratios around 1.3) are false positives caused by transparent backgrounds on a dark theme, and are not reported.

Method notes and limits:
- The agent-browser CLI cannot emulate touch. Touch targets were measured once with Playwright (`hasTouch`, `isMobile`, `pointer: coarse` confirmed true). A second Playwright run failed at sign-in (redirect loop), so only Data room was measured under coarse pointer.
- The demo stack is shared with other walkers. New files (Incorporation.txt, SAFE-Quill.txt, t1.txt) and chat rows appeared during the walk. Load-time numbers below may include that load.
- Not exercised: uploading a file (would write to the shared stack, so no upload/processing strip was seen), Refresh from Carta, opening Document date filter, drag and drop, 200% zoom.

## Verdicts

| Page | 1440x900 | 375x812 | 1920x1080 |
|---|---|---|---|
| Data room list | Pass with P2/P3 notes. One screen, list scrolls inside its panel, no page scroll. | Pass. Dense, folder picker and filters collapse well. | Pass. Parties column appears here only. |
| Data room grid | Pass. | Not separately captured (toggle present). | Not captured. |
| Data room stats | Pass, strong. | Not captured. | Not captured. |
| Data room preview | Pass with notes (list shrinks to compact rows). | Pass (modal sheet). | Not captured. |
| Cap table | Fail on loading time (P1) and row-click surprise (P1). | Pass; Shares column dropped, Ownership kept. | Fail P2: table too wide to read across. |
| Contacts | Pass, excellent. | Pass, excellent. | Not captured. |
| Artifacts | Pass with P3 notes. | Pass with P2 density note. | Not captured. |
| Activity (sidebar panel) | Pass with P2 copy defect. | Not captured. | Not captured. |
| Command palette and results | Pass, strong. | Pass. | Not captured. |
| Mail search results | Pass with P3 notes. | Pass. | Not captured. |

No page scrolled the document at any measured viewport (`pageScrollY` 0, `pageScrollX` 0, no horizontal overflow at 375).

## Findings

Severity: P0 blocks or misleads, P1 a person stumbles, P2 visibly below excellent, P3 polish. "Observed" means seen on screen or measured. "Suspected" means inferred.

| ID | Page | Sev | Cat | What happened vs expected | Evidence | Code (suspected) | Proposed fix |
|---|---|---|---|---|---|---|---|
| V3-01 | Cap table | P1 | flow | Observed. Clicking any holder row opens a form titled "Save Maya Chen (Mock) as a contact" (Name, Email, Organization, Kind, Notes). Maya clicked a row to look at a holding and is asked to create a contact, including for herself. Rows show only a pointer cursor, so nothing signals this. Norm I1, I3. | `/tmp/uxloop7/V3/cap-detail-1440.png` | `apps/web/src/pages/Investors.tsx` around lines 912-940 (`openRow`, `onOpen={... setEditing(openRow)}`) | For holders that are not contacts, do not open the contact form from the row; keep the explicit "Save as contact" link in the Email cell. Open a read-only holding detail only if one is needed. |
| V3-02 | Cap table | P1 | perf | Observed. The page showed skeleton blocks for roughly 8 s at 1440, 17 s once at 375, and over 30 s once (still skeleton at the 30 s check) before the table rendered. Contacts took about 9 s and also showed a skeleton sidebar. Cause not determined; the stack is shared with other walkers. Norm I2. | `/tmp/uxloop7/V3/cap-375.png` (skeleton, first attempt), `/tmp/uxloop7/V3/cap-1440.png` | Suspected: Carta cache read in the Investors loader, or dev-server contention | Re-measure on an idle stack. If it persists, render cached holders first and refresh in the background. |
| V3-03 | Cap table | P2 | visual | Observed. At 1920 the Name column is about 1050 px wide and Shares/Ownership sit about 1000 px from the name, which makes row tracking hard. The Email column stays about 210 px and truncates "casey.advisor@advisors.exampl…" while 7 of 9 rows show only a dash. At 1440 the same truncation happens with 560 px of free space in Name. Norm H6, D2, C4. | `/tmp/uxloop7/V3/cap-1920.png`, `/tmp/uxloop7/V3/cap-1440.png` | `apps/web/src/pages/Investors.tsx` table column classes | Cap the table width (for example max-w 1100) or give Email a flexible width; show full email on hover. |
| V3-04 | Artifacts (sheet) | P2 | visual | Observed. In the Burn by Month sheet, the "Net burn (USD)" header is left-aligned while the numbers are right-aligned about 400 px away. Norm H6 (numeric columns right-aligned). | `/tmp/uxloop7/V3/art-open-1440.png` | `apps/web/src/components/SheetPreview.tsx:190` (`text-start` on every header) | Right-align headers of columns whose cells are numeric (`isNumericSheetCell`). |
| V3-05 | Activity | P2 | copy | Observed. Finished-run preview text shows raw markdown: "Update from Investors agent: **Nor…". Norm C1. | `/tmp/uxloop7/V3/activity-more-1440.png` | `apps/web/src/pages/ActivityList.tsx` around line 457 (detail text) | Strip markdown from the one-line preview. |
| V3-06 | Data room | P2 | flow | Observed. A file shows "Reading for 3 min", then 4, 5, 14, 16 min over the walk, with a spinner and no way to cancel or retry (Delete exists only on Failed rows). In the mock this is a seeded state, so whether real files stall is unknown. Norm I2, I3. | `/tmp/uxloop7/V3/dr-1920.png` ("Reading for 14 min") | `apps/web/src/components/data-room/format.ts:98-105`, `ItemRows.tsx` | After a threshold (for example 10 min), show "Taking longer than usual" with a Retry action. |
| V3-07 | Artifacts | P2 | visual | Observed. At 375 each card is 168 px tall for a title and one line, so four fit per screen, and the list/grid toggle is hidden so there is no denser option. Norm D1, D2. | `/tmp/uxloop7/V3/art-375.png` | `apps/web/src/pages/Artifacts.tsx` card layout (suspected) | Use the compact list row on narrow screens, or drop the empty band between icon row and title. |
| V3-08 | Data room | P2 | a11y | Observed under touch emulation (pointer: coarse, 375x812). Row "Select {file}" checkboxes measured 18x18 px. All other measured controls on Data room were at least 44 px. Hit area of the surrounding label not verified. Contacts, Cap table and Artifacts had no sub-44 targets in the viewport. Norm I4. | Playwright run, output in session | `apps/web/src/components/data-room/ItemRows.tsx` checkbox | Add padding or a 44 px hit area to the row checkbox on coarse pointers. |
| V3-09 | Cap table | P2 | copy | Observed. Sidebar item, page title and URL say "Investors", but the page is the cap table (founders, option pool, advisors). The page also has an "Investors" tab and the contact kind "Investor", so one word has three meanings. The UX catalog calls the page "Cap table". Maya looking for "who owns my company" may not look under Investors. Not an owner decision in the list given. Norm C1, H5. | `/tmp/uxloop7/V3/cap-1440.png` | Sidebar label and page title | Needs an owner decision. If kept, rename the tab "Investors" to "Funds" or "Outside investors". |
| V3-10 | Data room | P3 | layout | Observed. Entering a folder adds a breadcrumb row, so the table header moves from y=134 to y=164, and the Type column moves from x=1084 to x=1164 because the Status column disappears. Norm L5. | `/tmp/uxloop7/V3/dr-1440.png` vs `/tmp/uxloop7/V3/dr-folder-1440.png` | `apps/web/src/components/data-room/PathBar.tsx`, `ItemRows.tsx` | Reserve the path-bar row on All items; keep column widths stable. |
| V3-11 | Data room | P3 | visual | Observed. The Parties column is hidden at 1440 (container is about 870 px, rule is 900 px) although Name is 515 px wide, while a Party filter exists. It appears at 1920. Norm H5. | `/tmp/uxloop7/V3/dr-1440.png`, `/tmp/uxloop7/V3/dr-1920.png` | `ItemRows.tsx:171,174` (`@min-[900px]/list`) | Lower the threshold to about 800 px, or show parties under the name when the column is hidden. |
| V3-12 | Artifacts | P3 | visual | Observed. Hovering a card swaps "10m ago" for a trash icon and truncates the age to "10m". Norm L5. | `/tmp/uxloop7/V3/art-hover-1440.png` | `apps/web/src/pages/Artifacts.tsx` card footer | Overlay the trash icon at the card corner instead of sharing the footer. |
| V3-13 | Artifacts | P3 | visual | Observed. List view has only Name and Updated; the age sits about 90 px short of the right edge; type is a 12 px icon. Norm H6, D2. | `/tmp/uxloop7/V3/art-list-1440.png` | `Artifacts.tsx` list columns | Right-align age to the edge and add a Type text column. |
| V3-14 | Shell | P3 | visual | Observed. Artifacts header has a bottom rule; Data room, Cap table and Contacts do not. Inbox content starts at x=356 and ends at x=1400, other pages at x=344 and x=1412. Norm L4, H5. | `/tmp/uxloop7/V3/art-1440.png`, `/tmp/uxloop7/V3/mailsearch-1440.png`, `/tmp/uxloop7/V3/contacts-1440.png` | Page header and gutter classes | Use one page gutter and one header rule rule across pages. |
| V3-15 | Activity | P3 | visual | Observed. Opening Activity inserts it above the chat list; at 1440x900 only one chat row (Chief) stays visible. Rows use "1m ago" while chat rows use clock times ("4:23 PM"). Norm L1, H5. | `/tmp/uxloop7/V3/activity-1440.png` | `ActivityList.tsx`, sidebar layout | Cap Activity height with its own scroll, and use one time format. |
| V3-16 | Command palette | P3 | visual | Observed. Page rows have icons; search results (contacts, documents, chats) have none. Chat result "[MOCK] Redlines…" shows the snippet "halcyon", which repeats the query. The "Search mail for" action is last, after scrolling past five groups. The active-row accent is blue, while the app is monochrome. Norm H4, H5, C4. | `/tmp/uxloop7/V3/search-1440.png`, `/tmp/uxloop7/V3/search-1440b.png` | Command palette component | Add type icons, hide a snippet that equals the query, move the mail action to the top when a query is typed. |
| V3-17 | Mail search results | P3 | flow | Observed. While showing search results the Important/Updates/Newsletters tabs stay (none selected) and there are two ways to clear (X in the box, "Clear" link). Matches are not highlighted in results, unlike the palette. Norm C2, I6. | `/tmp/uxloop7/V3/mailsearch-1440.png` | `apps/web/src/pages/Inbox*.tsx` (suspected) | Hide the tabs during search; keep one clear control; highlight matches. |
| V3-18 | Data room | P3 | visual | Observed. Empty values differ: "—" for no type on processing files, "Not tagged" in muted text for untagged type, and a blank Status cell for ready files. Norm H5. | `/tmp/uxloop7/V3/dr-1440.png` | `ItemRows.tsx:725` | Pick one empty marker. |
| V3-19 | Data room (mobile) | P3 | visual | Observed. When Filters opens at 375, the Sort pill sits alone on the right of its own row, above the filter chips. Norm D4. | `/tmp/uxloop7/V3/dr-375-filters.png` | `apps/web/src/pages/DataRoom.tsx` toolbar (suspected) | Put Sort on the same row as the filter chips. |
| V3-20 | Artifacts | P3 | a11y | Observed in the accessibility snapshot. The delete button name includes the file extension: "Delete MOCK Seed Fundraising Plan.md". Norm A2, C1. | agent-browser snapshot of `/app/artifacts` | `Artifacts.tsx` delete button label | Use the artifact title only. |
| V3-21 | Data room stats | P3 | copy | Suspected. The card "Searchable 97%" uses a word Maya may not connect to her documents. Norm C1. | `/tmp/uxloop7/V3/dr-stats-1440.png` | `apps/web/src/components/data-room/` stats | Say "Read and searchable" or show "65 of 67 read". |
| V3-22 | Cap table | P3 | flow | Proposal, not a defect. The table has no total row, so Maya cannot see at a glance that ownership sums to 100%. The Security filter menu (Common, Options) showed no checked mark; how to clear it was not tested. | `/tmp/uxloop7/V3/cap-security-1440.png` | `Investors.tsx` | Add a total row; show a check in the filter menu. |

## Excellent as is

- Data room stats view: four KPI cards, a documents-by-date chart, ranked Types and Top parties bars. Fits one screen and reads at a glance (`dr-stats-1440.png`).
- Data room 375 layout: folder dropdown with flattened paths ("Legal / Contracts"), a Filters toggle, compact two-line rows, and a modal preview sheet with Type, Parties, Tags, Folder, Source, Size (`dr-375.png`, `dr-375-folders.png`, `dr-375-preview.png`).
- Failed file row: red Failed chip, plain reason ("This file isn't a readable PDF."), Delete in the row. Status is shown in words plus colour (C3).
- Data room keyboard: Arrow keys move between rows and the preview follows focus; the focus ring is visible (`dr-focus-1440.png`).
- Contacts: clean table with search and one Kind filter; edit dialog autofocuses Name, Delete is separate and red but not dominant (`contacts-1440.png`, `contact-detail-1440.png`). At 375 the table drops to Name plus organisation and Kind with no overflow.
- Cap table header carries only Ask, as decided, with KPI cards that put the key numbers first and an honest footnote ("SAFEs are not in the share counts"). At 375 the cards reflow to 2x2 and the table keeps Ownership.
- Command palette: instant, grouped results, underlined match text (not colour alone), keyboard hint footer on desktop, no footer on mobile (`search-1440.png`, `palette-375.png`).
- Artifacts master-detail: the list stays on the left and the selected item shows on the right with Download and expand (`art-open-1440.png`).
- Sidebar badges (Inbox unread, Legal due soon, Data room failed file) match the decided set and have accessible names ("Data room, 1 file failed").

## Raw measurements

- layout-audit: `pageScrollY` 0 and `pageScrollX` 0 on every captured page and viewport. Inner scrollers: Data room list 781 px client / 2939 px scroll at 1440; Cap table none at 1440.
- Off-scale spacing values reported on all pages: 6, 10, 11, 14, 18 px (near-duplicates 4/6/8/10/11/12/14). Font sizes in use: 11, 12, 13, 14, 15, 16, 18, 21 px (eight sizes; Data room stats adds 20). Norm H3 and D3 are exceeded on every page, but no single page was visibly worse for it.
