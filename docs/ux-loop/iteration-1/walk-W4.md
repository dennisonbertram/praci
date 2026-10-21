# Walk W4: Data room (mock-data demo stack, 1440x900)

Walker session uxl1-W4. Target: demo web :5381 only. Screenshots: /tmp/uxloop1/W4/ (s01..s55). Console: clean (no errors, only Vite/React debug lines).
Caveats: the demo room already held about 130 items from earlier walks and other walkers share it (an import row from another walker showed up in my view). The room was not empty, so empty-state and consent-card stories could not be walked. Uploads used the file input (the "Add files" path); drag-and-drop was simulated with a synthetic drop event on the Inbox only. Steps are counted as clicks/inputs the user makes.

## Story verdicts

| Story | Verdict | Steps actual/ideal | Note |
|---|---|---|---|
| DRM-101 zip upload | PASS | 2/2 | Card shows "Opening", then reading count; a 30-file zip landed in folder "docs" (the zip's inner folder), not the root. Real 1.2 GB / 340-file zip not tried. |
| DRM-102 processing strip + Details | PASS (with findings) | 3/3 | Strip, Details list and "All files processed" work. Strip never ends in this demo because a seeded file is stuck at Reading (W4-17). |
| DRM-103 password zip | PASS | 2/2 | Red line "This zip is password-protected". |
| DRM-104 10,000+ files and unsafe paths | PASS | 2/4 | Both red lines shown. The re-zip step not run. Copy gives no next step (W4-12). |
| DRM-105 failed file, retry | FAIL (partly) | 5/4 | Strip count is not actionable (W4-01); Try again shows a toast but the row stays Failed (W4-14). |
| DRM-106 too large to search inside | PASS | 2/3 | Note exists but is 12px muted text (W4-11 copy). |
| DRM-107 drop from another page / folder gone | PARTIAL | 2/3 | Drop on Inbox shows overlay, card, "Uploaded". Deleted-folder recovery not run. |
| DRM-108 Stats and failed counts | PASS | 2/2 | Cards and bars render; Retry error state not reachable. |
| DRM-109 long diligence day | SKIPPED | n/a | Needs consent card, 340-file zip and Gmail; parts covered by 101, 102, 105, 117, 118. |
| DRM-110 import while strip shows | BLOCKED | n/a | Google Drive item is not offered in the demo Import menu. |
| DRM-111 tree and path bar | PASS | 3/3 | Path bar and tree highlight work; three chrome rows stack above the list (W4-06). |
| DRM-112 resize folder column | PASS | 1/1 | Keyboard steps 32px, Home 180, End max, double-click 244, width kept on reload. |
| DRM-113 narrow window | PASS | 4/4 | Folder pill and icon buttons present; New folder "Inside" defaults to the open folder. |
| DRM-114 Stats drill-down | PASS | 3/3 | Types row sets the Type filter; folder-scoped Stats works. Sparse "over time" chart looks odd (W4-13). |
| DRM-115 PDF preview, full screen | PASS | 3/3 | Open in new tab, Download, Full screen, Esc all fine. |
| DRM-116 spreadsheet preview | PASS | 2/2 | Sheet tabs Common/Options/SAFEs work. CSV "Load more" not tried. |
| DRM-117 Send to agent | PASS | 4/3 | Legal agent sits below the scroll in a 14-item submenu (W4-18). Chip attached in composer. |
| DRM-118 Auto-sort and Undo | FAIL (partly) | 4/4 | Took about 45 s; 89 rows in one flat list; toast says "Sorted 89", Undo says "Undid 99" (W4-03, W4-04). |
| DRM-119 Import menu (Email, Drive, Box) | PARTIAL | 4/3 | Email dialog and import work. Drive item absent; Box goes to OAuth (BLOCKED, not tried). Result row reads "Imported 2 files" after one import (W4-06). |
| DRM-120 Cap table Documents list | PASS | 2/2 | Appears only after a file is in Finance / Cap Table (I created the folder and uploaded one). Opens preview by ?item=. |
| DRM-121 quarter-end long journey | SKIPPED | n/a | Needs consent card and a clean room; parts covered above. |
| DRM-001 empty state | BLOCKED | n/a | Room not empty. |
| DRM-002 / 005 upload, duplicate | PASS | 2/2 | "Already in Finance / Invoices / Fundraising 2026" with View. |
| DRM-003 drop on other page | PASS | 2/2 | Synthetic drop on Inbox: overlay then "Uploaded". |
| DRM-004 large file | PASS | 1/1 | 56 MB file stored; preview says "Too large to search inside". Uploaded file was already in the room. |
| DRM-006 upload into open folder | PASS | 2/2 | File landed in Finance / Cap Table. |
| DRM-007 / 008 reading and failed | PASS | 1/1 | "Reading" then ready; failed row shows reason and Try again. |
| DRM-009 consent card | BLOCKED | n/a | No consent card shown on the Data room; Legal page shows its own consent card. |
| DRM-012 view/sort remembered | PASS | 2/2 | Grid saved across reload. |
| DRM-020, 021, 039, 040, 042, 043, 044 | BLOCKED | n/a | Need real Gmail/Drive; only the Email picker opened (mock mail). |
| DRM-024, 025, 026, 029 URL folder/Back/stale id/item | PASS | 2/2 each | Back walks the folder history; bad folder id gives "That folder no longer exists"; bad ?item= is ignored silently (W4-15). |
| DRM-027, 028, 036 | SKIPPED | n/a | Folder rename/delete elsewhere not run (time). |
| DRM-037 Load more | PASS | 1/1 | Load more works; no remaining count. Failed file buried at row 100+. |
| DRM-038 grid sub-folders | PASS | 1/1 | Folder tile plus thumbnail tiles. |

## Findings

| ID | Sev | Cat | Page/story | What happened vs expected | Evidence | Suspected code | Proposed fix |
|---|---|---|---|---|---|---|---|
| W4-01 | P1 | flow | DRM-105, 108, 121 | Observed. Strip and Stats say "2 couldn't be read" / "Failed 2", but neither is a control. One failed file is at row 100+ (needed 5 "Load more" clicks, found "MOCK Signed NDA - Bolt Freight.pdf"). Expected one click to the failed files. | s09, s54 | components/data-room/ProcessingStrip.tsx:55, DataRoomStats.tsx | Make the failed count a button that sets a Status: Failed filter, and make Stats Status rows pickable. |
| W4-02 | P1 | visual | DRM-013, 036 | Observed. With the preview pane open, search results show the name column cut to "MOCK ..." for every row, so results cannot be told apart. | s17 | components/data-room/ItemRows.tsx (search result row width) | Give the name column a minimum width or hide Type/Added in search results when the pane is open. |
| W4-03 | P2 | bug | DRM-118 | Observed. Toast "Sorted 89 items", then Undo toast "Undid 99". Counts disagree. | s39, s40 | components/data-room/upload-toasts.ts:248-257, pages/DataRoom.tsx:765 | Count the same operations in both toasts (exclude or include created folders in both). |
| W4-04 | P2 | flow | DRM-118 | Observed. Review phase took about 45 s with only a file-name list and a timer; result was 89 identical-looking rows in one "Move" list, including documents already filed sensibly (e.g. Finance invoices, SAFE out of Legal). Apply says only "Apply". Expected a short grouped summary and a count on the button. | s36-s38 | components/data-room/AutoSortDialog.tsx | Group by destination folder with a "Select all/none" and label the button "Apply 89 moves"; default to loose items only. |
| W4-05 | P2 | visual | DRM-105, 121 | Observed. A failed PDF's preview shows the browser viewer error ("Error / Failed to load PDF document.") in a 540px black frame above the app's own "Couldn't read this file"; Try again/Delete are below the fold. | s06, s07 | components/data-room/Preview.tsx:218-223 | Do not render FileViewer for a failed item; show the heading, reason and buttons first. |
| W4-06 | P2 | flow | DRM-101, 111, 119 | Observed. Up to four chrome rows (path bar, "Imported N files" row, processing strip, search scope) push the list down about 120px. The import row persists across folders and reloads and merged my 1 import with another walker's earlier one ("Imported 2 files"). | s14, s28, s47 | components/data-room/ImportActivity.tsx | Show the import row only on the folder it affects, auto-dismiss it, and count only the latest batch. |
| W4-07 | P2 | visual | DRM-110, 119 | Observed. The merged strip wraps ("Importing 0 of / 1", "Processing 1 / file") with the preview open and at phone width. | s46, s48, s35 | components/data-room/ProcessingStrip.tsx:31 | Add whitespace-nowrap to the counts and let the file name truncate. |
| W4-08 | P2 | a11y | DRM-030, 105 | Observed. At 390px, Details and Dismiss are 24x24, row menus and view toggles 28px, Try again 24px high (target 44). Also on desktop. | s35 measurement | ProcessingStrip.tsx:89 (size-6), ItemRows.tsx row menu | Raise hit areas to 44px on touch widths. |
| W4-09 | P2 | visual | DRM-105, many | Observed. Toasts overlap each other and the preview pane at bottom right (agent-finished notice over "That folder no longer exists"; upload toasts over "Couldn't read this file"). | s50, s06, s08 | upload-toasts.ts and the app notification stack | Put all toasts in one stack with spacing, or keep the preview's lower area clear. |
| W4-10 | P2 | flow | DRM (Ask agent) | Observed. The Data room agent names "MOCK Office Lease - 100 Placeholder Street.pdf" in bold but it is not a link or chip, so Maya cannot open the cited file. | s49 | Data room agent message rendering (DataRoomRefChips.tsx not used for answers) | Render cited file names as DataRoomRefChips that open ?item=. |
| W4-11 | P3 | copy | DRM-106 | Observed. "Too large to search inside" is 12px muted text with no hint (search by name; split). | s55 | Preview.tsx:235 | Raise to text-sm and add "Search by file name instead." only if needed. |
| W4-12 | P3 | copy | DRM-104 | Observed. "This zip has more than 10,000 files" and "password-protected" give no next step. | s05 | data-room zip error strings (upload-toasts.ts) | Append "Split it into smaller zips." / "Remove the password and try again." |
| W4-13 | P3 | visual | DRM-114 | Observed. Stats "Documents over time" with two months of data draws two full-width slabs; "Largest files" shows a tiny stub bar. | s10 | DataRoomStats.tsx | Cap bar width or switch to a list when fewer than 4 buckets. |
| W4-14 | P3 | flow | DRM-105 | Observed. After "Try again", toast "Reading fake.pdf again" appears but the row stays "Failed"; no Reading state seen within 1 s. Unverified whether the retry failed instantly. | s08 | PreviewActions.tsx / use-data-room-list.ts | Set the row to Reading immediately (optimistic). |
| W4-15 | P3 | flow | DRM-029 | Observed (known). A bad ?item= id is dropped with no message, unlike a bad ?folder= id. | s50 area | pages/DataRoom.tsx:191-213 | Show "That file no longer exists". |
| W4-16 | P3 | copy | DRM-016, 106 | Observed. The root is "All items" in the tree, "No folder" in the Move dialog, "None" in the preview Folder field. | s25 snapshot, s55 | ItemDialogs.tsx:296, Preview.tsx:264 | Use "All items" in all three. |
| W4-17 | P3 | flow | DRM-102 | Observed. Seeded "MOCK Board Minutes - October.pdf" stays Reading forever, so "Processing 1 file" never clears and inflates counts (e.g. "Processing 2 files" for one import). Possibly demo seed only. | s03, s46 | demo seed / reading job timeout | Fix the seed or time out Reading jobs to Failed. |
| W4-18 | P3 | flow | DRM-117 | Observed. Send to agent lists 14 agents (288px, scrolls); "Legal agent" is below the fold for a legal document, and "New Bot" is first. | s20 | ItemMenu.tsx | Put agents that read the Data room first or add type-ahead. |
| W4-19 | P3 | bug | DRM-001..007 | Observed. Files uploaded at 21:11 local (Oct 20) show "Added Oct 21, 2026", earlier items show Oct 20. Looks like UTC date vs local; unverified. | s03 | format.ts dateText | Format dates in the viewer's time zone. |
| W4-20 | P3 | visual | DRM-038, 012 | Observed. Grid tiles show the document date while the toolbar says "Sort: Added", so tiles look unsorted (May 2026, Sep 2025, Aug 2026, Jul 2026). | s52 | ItemRows.tsx:614 (uses facets.docDate) | Show the date the sort is on, as the list does (dateOf). |
| W4-21 | P3 | flow | DRM-113 | Observed. The search query stays when changing folders, so a freshly created empty folder shows "No results" instead of its empty state. | s28 | pages/DataRoom.tsx | Keep, but show "No results in <folder>" with Clear search, or clear search on folder change. |
| W4-22 | P3 | visual | DRM-102 | Observed. In Details, counts sit at the far right edge, detached from the labels. | s04 | ProcessingStrip.tsx | Place the count next to its label. |

## Excellent

- Resizable folder column: keyboard, double-click reset and remembered width work exactly as described (DRM-112).
- Stats view is clear, scoped to the open folder, and drilling into a Types row returns a filtered list in 3 steps (DRM-114).
- Duplicate upload message names the existing folder and offers View; stale folder id explains itself with a toast.
- PDF full screen reuses the loaded file; Esc returns to the pane; grid thumbnails of PDFs look good.
- Search "No results" explains what search covers and offers Clear filters.
