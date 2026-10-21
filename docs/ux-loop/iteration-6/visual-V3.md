# Visual inspection V3 (iteration 6)

Session uxl6-V3. Target: mock-data demo stack (web :5381), signed in as the seeded mock founder (Maya Chen, Northwind Robotics). Pages: Data room (list, grid, stats, folder tree, path bar, preview, Add files menu, row menu, upload, search), Cap table, Contacts, Artifacts, Activity panel, command palette (Cmd+K and the sidebar Search box). Viewports 1440x900 and 375x812 for every page; 1280x800 for Data room and Cap table; 1920x1080 for the shell (Data room, Cap table). Screenshots: /tmp/uxloop6/V3/. Audits: layout-audit.js and geometry-audit.js run on each page at 1440 and 375 (and 1280/1920 where noted), plus hover, Tab order, menus, dialog open/close and a synthetic file upload.

Limits of this run:
- Touch targets were not measured. `set device "iPhone 15"` resized the viewport but `matchMedia("(pointer: coarse)")` stayed false, so under the owner rule no touch-target finding is made.
- Timings are not valid. The machine load average was about 200 during the run (many parallel inspectors). Cap table stayed on its skeleton for 10 to 20 s and one reload showed "Still opening... Try again". I treat those as an environment effect, not a defect.
- The layout-audit contrast list and "overlaps" list (sidebar hover action buttons stacked over rows) are false positives on this dark theme and are not used.
- Mock data check: the seeded Chief chat says the Data room holds a Warrant Agreement, but a Data room search for "warrant" returns "No results". This is a seed inconsistency, not a UI finding.

## Verdicts

| Page | 1440x900 | 1280x800 | 1920x1080 | 375x812 |
|---|---|---|---|---|
| Data room list | Pass, one screen, list scrolls inside | Pass (pageScrollY 0) | Pass with V3-10 | Pass with V3-06 |
| Data room grid | Pass | Not captured | Not captured | Pass |
| Data room stats | Pass, tooltips work | Not captured | Not captured | Pass with V3-06 |
| Data room folder, path bar | Pass with V3-10 | Not captured | Not captured | Pass |
| Data room preview | Pass, three panes fit | Not captured | Not captured | Pass with V3-11 |
| Data room search | Excellent (snippets, highlights) | Not captured | Pass | Not captured |
| Cap table | Pass with V3-01, V3-02, V3-04 | Pass with V3-02 (summary takes 39% of the screen) | Fail on alignment (V3-01) | Pass with V3-05 |
| Contacts | Excellent | Not captured | Not captured | Excellent |
| Artifacts list | Pass | Not captured | Not captured | Fail (V3-03) |
| Artifacts grid | Pass with V3-12 | Not captured | Not captured | Fail (V3-03) |
| Artifacts open (master-detail) | Pass with V3-09 | Not captured | Not captured | Not captured |
| Activity panel | Pass | Not captured | Not captured | Not captured |
| Command palette | Pass with V3-07, V3-08 | Not captured | Not captured | Pass |

L1: pageScrollY was 0 and pageScrollX 0 on every page and viewport. No horizontal overflow anywhere.

## Findings

| id | page | sev | cat | What happened vs expected | Evidence | Code (suspected) | Fix |
|---|---|---|---|---|---|---|---|
| V3-01 | Cap table | P2 | visual | Observed. The summary cards and donut card span the full content width, but the filter bar and table are capped at 1024px and left-aligned. Table right edge is 1368 against a card edge of 1412 at 1440, and 1368 against 1892 at 1920, leaving a 520px empty strip beside the table. Contacts at 1440 has its table edge flush with the header buttons (1412). Norm L4 (one grid), H5. | cap-1440.png, cap-1920.png, contacts-1440.png | apps/web/src/pages/CapTable.tsx:729 and :848 (`max-w-5xl`) | Cap the summary row at the same max width as the table, or let the table use the full width like Contacts. |
| V3-02 | Cap table | P2 | visual | Observed. At 1280x800 the summary (four stat cards plus a 180px donut) fills y 123 to 431, 39% of the viewport, so the table shows about six rows and its header scrolls away with the cards. The donut has two slices (Common 84%, Option pool 16%) and repeats numbers the cards and table already show. Stat cards are 115px tall with the lower half empty, and only one has a caption. The card block and the donut card end at different heights (240 vs 308 at 1440, 363 vs 225 at 1920). Norm D2, D5, L4. | cap-1280.png, cap-1440.png, cap-1920.png | apps/web/src/pages/CapTable.tsx:~680-730; apps/web/src/components/cap-table/OwnershipDonut.tsx | Shrink the cards to content height, show the donut only when there are 3 or more slices (or collapse it as it is on mobile), and make the table header sticky. |
| V3-03 | Artifacts | P2 | visual | Observed. At 375 the header wraps onto three rows: title row empty except the menu, then Filters, view toggle and Ask on a second row, then "Northwind Robotics" on a third. Header is 129px against 56px on Data room and Contacts. It also shifts: while loading (skeleton) the header is one row, and when Ask appears it jumps to three rows and pushes the list down about 70px. Norm L5, L6, H5. | art-375-early.png (one row), art-375.png and art-grid-375.png (three rows) | apps/web/src/pages/Artifacts.tsx:286-340 (PageHeader with Filters toggle, two view toggles, AskBotButton) | Move the list/grid toggle into the Filters disclosure at phone width, as Data room does, and reserve the Ask slot while loading. |
| V3-04 | Cap table | P2 | flow | Observed. Clicking a holder row (River Cofounder) opens a dialog titled "Add email for River Cofounder (Mock)" with Name, Email, Organization, Kind (Other) and Notes. The row name is plain text with an underline only on hover, so nothing says it is clickable, and the title names one field of a five-field contact form. Maya, a cofounder, gets a form for saving a contact when she probably wanted holder details. Focus returns to the row on Escape (good). Norm I1, C1. | cap-row-1440.png | apps/web/src/components/ContactDialog.tsx:161; apps/web/src/pages/CapTable.tsx:892-905 | Title it "Save River Cofounder as a contact" when no email is known, and show a chevron or hover background on openable rows. |
| V3-05 | Cap table | P2 | copy | Observed. At 375 the Casey Advisor row's muted line shows three truncated fragments: "Advisor", "C...", "Independe...", "casey.advisor...". Nothing in the row can be read in full without opening it. Norm C4. | cap-375.png | apps/web/src/pages/CapTable.tsx:~945-965 (muted line joins kind, holding, email) | At phone width keep kind and one detail (organization or email), not all three. |
| V3-06 | Data room (375) | P2 | flow | Observed. At 375 the List/Grid/Stats switch and Sort are inside a disclosure labelled "Filters", so Stats is hard to find. When opened, chrome above the first file is 245px (30% of the viewport) in list view. In Stats the Filters button moves from the right to the left of the header row (L5). Norm I6, L5, I5. | dr-folder-375.png, dr-filters-375.png, dr-list-375.png, dr-stats-375.png | apps/web/src/components/data-room/FilterBar.tsx:313 | Keep the three view icons visible beside the folder button, leaving only type, party, date and sort in the disclosure; keep the Filters button in one place. |
| V3-07 | Command palette | P3 | flow | Observed. For "halcyon" the list is 384px high inside 615px of content with the scrollbar hidden (`no-scrollbar`). Contacts (2) and Chats (4) fill the view; Documents (3 Halcyon contracts) and Mail ("Search mail for...") are only visible after scrolling, and only the half-cut last chat row hints there is more. A founder searching a customer name probably wants the contract first. Norm I6, I5. | pal-halcyon-1440.png, pal-halcyon-3-1440.png | apps/web/src/pages/Shell.tsx:~2170-2210 (group order) | Cap each group at 3 rows with a "Show all" row, or order groups by best match. |
| V3-08 | Command palette | P3 | visual | Observed. Documents rows show only the file name; Contacts and Chats rows have a second line and Chats a date, so the Documents rows are plain and say nothing about folder or type. Norm H5. | pal-halcyon-3-1440.png | apps/web/src/pages/Shell.tsx:~2190 | Add the folder path as the second line for documents. |
| V3-09 | Artifacts (open sheet) | P3 | visual | Observed. An open spreadsheet artifact with 5 rows sits in a bordered card stretched to the full pane height, leaving about 540px of empty bordered area. Norm D2. | art-open-1440.png | Artifact viewer container in apps/web/src/pages/Artifacts.tsx | Size the card to its content. |
| V3-10 | Data room (list) | P3 | visual | Observed. Folder view shows a "Status" column header over an empty column (2025 folder). At 1920 in search results, Parties sits at x 1306 and Status at x 1804 with empty space between, so the row's right side is a wide void. Norm D2, H6. | dr-folder-1440.png, dr-1920.png | apps/web/src/components/data-room/ItemRows.tsx (table columns) | Hide the Status column when no row has a status; cap column widths. |
| V3-11 | Data room preview (375) | P3 | visual | Observed. The inset preview sheet puts the PDF at about 57% of the height with a grey 90px band under it, and the metadata rows below are cut at the sheet edge (Parties row clipped; Folder, Source and Size need an inner scroll, 690 of 788px). Norm L2-style fit, D2. | dr-preview-375.png | Preview sheet in apps/web/src/components/data-room | Let the PDF area shrink to its page and show Type, Date and Parties without scrolling. |
| V3-12 | Artifacts grid | P3 | visual | Observed. In each card the type label ("Doc", "Sheet") is about 6px higher than the centre of the 36px icon on its left. Norm H6. | art-grid-1440.png | Artifacts card in apps/web/src/pages/Artifacts.tsx | Align the label to the icon centre. |
| V3-13 | Data room failed row | P2 | flow | Observed text, suspected effect. A failed file reads "This file isn't a readable PDF." with only a "Try again" button. Retrying an unreadable file will probably fail again. Delete and Replace are only in the row menu (Try again, Move, Rename, Delete). Norm I3. | dr-list-1440.png, dr-rowmenu-1440.png | apps/web/src/components/data-room/ItemRows.tsx:254 | For an unreadable-file error, offer "Replace file" or "Delete" as the inline action instead of retry. |
| V3-14 | Sidebar (all pages) | P3 | a11y | Observed. A small green flag glyph appears between a chat title and its time (Chief, Investor Relations, Q3 board deck, Redlines rows). It is 12x16px, has no accessible name or tooltip, and sits where the title can wrap under it. Meaning could not be determined from the UI. Norm A2, C3. | art-1440.png, dr-search2-1440.png | packages/ui-web pixel icon in the sidebar chat row (Shell.tsx) | Give it an aria-label and tooltip, or remove it. |
| V3-15 | Cap table | P3 | visual | Observed. The Email column shows "—" in 8 of 9 rows and takes 224px at 1440. Norm D5. | cap-1440.png | apps/web/src/pages/CapTable.tsx (columns) | Hide Email unless some holder has one; show it in the muted line otherwise. |
| V3-16 | Cap table (loading) | P3 | visual | Observed under load. The skeleton is three flat bars across the full width, unlike the real layout (tabs, four cards, donut, table), so content shifts when it loads. Timing not valid (load average about 200). Norm L5. | cap-1920.png | apps/web/src/pages/CapTable.tsx loading state | Use a skeleton that matches the cards and table. |

## Excellent as is

- Data room search: matching text snippets with highlighted terms, folder shown, sort switches to Relevance (dr-search2-1440.png).
- Data room folder tree, path bar and breadcrumb: current folder highlighted, path bar clickable, folder view drops the redundant folder line from each row.
- Data room stats: compact tiles, bar chart with hover tooltip ("Dec 2025: 9"), ranked Types and Top parties bars.
- Row menu (Send to agent, Move, Rename, Delete in red after a separator) and Add files menu (Upload files, From email, From Box): short, clear, well grouped.
- Synthetic upload: the new file appears at the top as "Reading" at once, with a progress card (V3-synthetic-note.txt, 100%).
- Contacts at 1440 and 375: one screen, even row rhythm, no wasted columns, right edge aligned with header buttons; at 375 it drops to Name and Kind with the organization on a second line.
- Command palette: fixed size so it does not jump, match highlighting, selected-row bar, empty-state list of pages, usable at 375.
- Artifacts master-detail at 1440: list, preview, Download and expand actions, clear selected row.
- Focus order on Data room is logical (sidebar, view switch, Add files, Ask, search, filters, sort) and every control shows a focus ring (outline or shadow); focus returns to the opening row after the cap table dialog closes.
- Activity panel in the sidebar: grouped as Needs you and Working, status in words (Needs input, Running) plus colour.
- Failed and processing states in Data room are in words plus colour ("Failed", "Reading"), in list and grid.

## Not covered

1280x800 for Contacts, Artifacts, search and palette; 1920x1080 for the Artifacts and Contacts pages; the Data room upload strip with a failing upload (the upload produced a progress card, no failure); Activity panel at 375; touch targets (see Limits).
