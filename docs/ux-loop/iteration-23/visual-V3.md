# Visual inspection V3 (iteration 23): Data room, Investors, Contacts, Artifacts, Activity, search

Inspector: uxl23-V3. Target: the mock-data demo stack only. Persona: Maya, first-time founder (Northwind Robotics).
Viewports: 1440x900 (all pages), 375x812 (all pages), 1920x1080 and 1280x800 (Data room shell). Screenshots live outside the repo; file names are cited.
Method: layout-audit and geometry-audit run on Data room, Contacts, Investors and Artifacts at 1440 and Data room at 375; every screenshot was opened and looked at; keyboard tab order was walked on the Data room.

Limits (said plainly):
- The browser tool has no touch emulation (`pointer: coarse` stayed false even with a phone device preset). Touch-target sizes were therefore not judged; no touch-target finding is filed.
- The demo is shared with other walkers, so the Data room held extra files, folders and spaces that are not part of the seed. They are not reported as defects.
- Investors and Fundraising belong to another session: only P0/P1 considered there; none found.
- Not exercised: Data room upload and the processing strip (no file upload possible from here), Box and email import dialogs, Delete actions.

## Verdicts

| Page | 1440x900 | 375x812 | Verdict |
|---|---|---|---|
| Data room list | fits one screen, folder tree and list scroll inside their panels, path bar correct | tidy: search, Filters count, folder dropdown, view toggle | Good. Two small findings (V3-02, V3-03) |
| Data room grid | uniform tiles, fits | 2 up, clean | Good (V3-05) |
| Data room Stats | clean KPI cards, bars, chart | stacks to one column, readable | Excellent |
| Data room preview | side panel, list collapses to compact rows | centered dialog | Good (V3-04) |
| Data room empty search | compact "No results" plus Clear search, sort flips to Relevance | not captured | Good |
| Contacts | dense table, 37 px rows, edit dialog clean | Email column drops, organization moves under name | Excellent |
| Investors (P0/P1 only) | no P0/P1 | no horizontal overflow, no P0/P1 | Pass |
| Artifacts list/grid/open | uniform cards, split view with preview | list readable | Good (V3-06) |
| Activity panel | clear groups, status in words plus color | not captured | Good |
| Cmd+K palette | grouped results, highlighted matches, footer hints | not captured | Excellent |
| Cold load of any /app page | see V3-01 | | Needs work |

## Findings

| ID | Page / story | Sev | Cat | What happened vs expected | Evidence | Suspected code | Proposed fix |
|---|---|---|---|---|---|---|---|
| V3-01 | Any /app page, cold load by URL (seen on Artifacts and Contacts) | P2 | perf / flow | OBSERVED: on 2 of about 7 direct loads the whole workspace (sidebar and page) stayed on skeleton rows for 20 s or more, with no error and no retry; a reload fixed it. Likely server contention from about 8 parallel walkers (SUSPECTED), but the page gives Maya no sign anything is wrong. Expected: after a few seconds an error with Retry (I2, I3). On the loads that worked, the page appeared within 2 to 5 s. | art-1440.png (skeleton), measured wait 24 s on /app/contacts | app shell workspace loader (not located) | Show a "Could not load, Retry" state when the workspace queries have not settled after about 10 s. |
| V3-02 | Data room list, STORY-DRM list | P3 | visual | OBSERVED: the Type column is narrow and truncates "Investor docume…" (also "Investor document" in the 1920 view) while the Name column leaves 400 to 700 px of empty space. Name and Type are far apart, so the eye must travel across the row (H6, C4). | list-strip-1440.png, dr-1920.png, dr-1280.png | Data room list column template (not located) | Give Type enough width for the longest type label and shrink the empty part of Name. |
| V3-03 | Data room list, grid and consent card | P3 | copy | OBSERVED: while the "Let Praci read your documents" card is on screen, a second strip says "Waiting for permission to read". It states the same fact twice (C2). The strip also appears in list and grid but not in Stats, so the content shifts down 36 px between views (L5). | list-strip-1440.png, grid-1440.png, stats-1440.png | Data room processing strip | Hide the strip while the consent card is showing, or fold the waiting count into the card. |
| V3-04 | Data room preview, STORY-DRM preview | P3 | visual | OBSERVED: on desktop the preview shows only Folder, Source and Size for an untagged file; on mobile the preview of a tagged file also shows Type and Date. The desktop preview of an untagged file gives no hint that tagging is waiting for AI consent. Also the mobile preview shows a generic file icon where the desktop preview renders the page (different files, so partly SUSPECTED). | preview-1440.png, dr-prev-375.png | Data room preview panel | Show "Type: Not tagged" as a row so the fields match across files; confirm mobile renders the same page thumbnail. |
| V3-05 | Data room grid | P3 | visual | OBSERVED: a PDF that renders blank (Test-SAFE-Acme.pdf, uploaded by another walker) gets a plain white tile with no icon, so it looks broken (I8). Text-file tiles show raw text at the top and a large empty middle, unlike PDF tiles. | grid-1440.png | Data room grid tile thumbnail | Fall back to the file icon when the thumbnail has no content; render text tiles at the same density as PDFs. |
| V3-06 | Artifacts list | P3 | visual | OBSERVED: Name is about 800 px from Type and Added in the list; "MOCK Investor Update -…" truncates in grid cards beside the "v2" chip although there is room. | art-list-1440.png, art-1440.png | pages/Artifacts.tsx list row and card title | Cap the list row width or move Type next to Name; let the title wrap to two lines in cards. |
| V3-07 | Sidebar with extra spaces (shell) | P3 | flow | SUSPECTED, needs the owner's confirmation: an inactive space named "Empty space" is listed as a full section in the sidebar (with its page agents and "+4 more"). Pass-21 says inactive empty spaces appear only in the switcher. It may count as non-empty because other walkers opened its agents, so this could be correct. Same for sections named "Mail needs reconnect" and "Mail rate-limited" at 1920. | dr-1920.png, sidebar-state-1440.png | sidebar space grouping | Verify with a fresh account that a space whose agents have no messages is hidden from the sidebar. |

No P0 and no P1 findings in this group.

## Excellent as is

- Data room Stats view (desktop and phone): four KPI cards, a bar chart with first and last month labels, and ranked bars for types, parties and status. It reads at a glance.
- Folder tree plus path bar: scoped selection, correct breadcrumb ("All items > Archive > Old drafts > 2025"), the tree scrolls inside its own panel and "New folder" and "Auto-sort" stay pinned at the bottom.
- Type filter menu lists only the types present in the current folder; the applied filter shows as a removable "Type: Presentation" chip and the list updates at once.
- Empty search: "No results" with a Clear search button, compact (D2), sort switches to Relevance.
- Add files menu: three clear verbs (Upload files, From email, From Box).
- Failed file row: plain red message "This file isn't a readable PDF." with Replace file beside it; the sidebar badge, Stats "Failed 1" and the row all agree.
- Contacts: dense table, readable at 1440 and 375, dialog with clear destructive Delete separated from Cancel and Save, focus returns to the row after closing.
- Cmd+K palette: pages first, then grouped Documents, Chats and Artifacts with highlighted matches and footer key hints; Settings and Integrations are listed as pages.
- Activity panel: needs-approval and needs-answer items on top with word plus color status, running work grouped below, rows that it shows are hidden from the chat list below.
- Keyboard: Tab goes sidebar, header, search, filters, sort; page links use roving focus with arrow keys; focus rings are visible. Artifacts delete buttons appear on hover and on keyboard focus.
- Layout: no page scroll or horizontal overflow at 1440x900, 1280x800 and 375x812 on any page in this group (L1, L6).
