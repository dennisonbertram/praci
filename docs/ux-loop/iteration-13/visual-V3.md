# Visual inspection V3 (iteration 13)

Scope: Data room, Investors (P0/P1 only), Contacts, Artifacts, Activity, Cmd+K palette. Target: mock-data demo stack (web port 5381). Viewports 1440x900, 375x812, shell at 1920x1080. Screenshots: /tmp/uxloop13/V3/. Audits run: layout-audit.js and geometry-audit.js on every page and viewport.

Limits: agent-browser could not emulate a coarse pointer (`matchMedia('(pointer: coarse)')` stayed false, even with `set device`), so no touch-target findings are reported. The demo account is shared with other walkers, so some state changed during the walk (consent card gone, new bots in the sidebar, Hide amounts on). I treated those as not mine. The contrast ratios of 1.2-1.4 that layout-audit.js reports for sidebar text are false positives (it cannot resolve the translucent backgrounds; the screenshots show good contrast).

## Verdicts

| Page | 1440x900 | 375x812 | Notes |
|---|---|---|---|
| Data room list | Pass | Pass | One screen, no page scroll, list and sidebar scroll inside panels. Folder tree, breadcrumb, filters, failed row with inline Delete all clear. |
| Data room grid | Pass | not captured | Thumbnails, uniform cards, failed card has its own state. |
| Data room stats | Pass with P3 | not captured | Tiles and chart fit; inner panel scrolls. |
| Data room preview | Pass | Pass (modal card) | Three-pane layout at 1440, centered modal on phone. |
| Data room search / empty | Pass | not captured | Snippet highlighting; "No results" plus Clear search. |
| Investors | Pass (P0/P1 only) | Pass | No P0/P1. See note on the Updates empty state below. |
| Contacts | Pass | Pass | Dense table, edit dialog is tidy. |
| Artifacts grid / list / viewer | Pass | Pass | Viewer is a split view on desktop and a full-screen page with back arrow on phone. |
| Activity (sidebar) | Pass | not captured | Inline panel pushes the chat list down; chat list scrolls under it. |
| Cmd+K palette | Pass | Pass | Grouped results, highlights, no-match state offers mail search. |
| Shell 1920x1080 | Pass with P3 | n/a | Sidebar and content scale; long gaps between columns in the Data room table. |

## Findings

| ID | Page | Sev | Cat | What happened vs expected | Evidence | Code | Fix |
|---|---|---|---|---|---|---|---|
| V3-01 | Data room, folder tree | P2 | bug (observed once, not reproduced) | With the preview pane open, clicking the Contracts folder changed the breadcrumb to "All items > Legal > Contracts" and the URL to `?folder=...`, but the list kept showing all items, even after 3 s. Reload showed the correct two files. Two later folder clicks (Invoices, Bank statements) filtered correctly. | folder2.png vs folder3.png | Not found (folder filter in the Data room page component; suspected stale query while the preview is open) | Refetch the list whenever the folder param changes, regardless of preview state. |
| V3-02 | Data room, preview pane | P3 | a11y (I7) | Escape does not close the desktop preview pane; only the X does. Observed: preview stayed open after Escape twice. | addfiles.png | suspected: preview is a pane, not a dialog | Close the preview on Escape when focus is inside it. |
| V3-03 | Data room table at 1920 | P3 | visual (D2) | Name column takes ~700 px while Type/Added/Parties sit at the far right, and the Status column is empty except for one row. The eye travels about 700 px between name and type. | dr-1920.png | observed | Cap the Name column width, or show Status only when a row is failed or processing. |
| V3-04 | Data room stats | P3 | visual (C3) | Bar chart has "10" as the only y label and only the first and last months on the x axis; individual bars are not labeled. Hover was not tested. | dr-stats-1440.png | observed | Label bars on hover (or add a baseline 0 and quarter ticks). |
| V3-05 | Data room list | P3 | a11y (I4) | Select-all checkbox is 18x18 px (measured with a fine pointer, so not a touch finding). | dr-1440b.layout.json | observed | Enlarge the hit area to 24x24. |
| V3-06 | Contacts, after closing Edit contact | P3 | visual (H5, I7) | Focus returns to the name button and shows two nested rings: a pill around the name and a square ring around the row. | con-375.png | observed | Show one focus ring (on the row or on the button). |
| V3-07 | Contacts at 375 | P3 | copy (C4) | Long emails truncate ("jamie@placeholder-ventures.exampl...") with no title attribute. Tapping the row opens the edit dialog, which shows the full email, so the loss is small. | con-375.png; DOM check: 2 truncated emails without title | observed | Add `title` with the full value. |
| V3-08 | Sidebar Activity toggle | P3 | visual (H1) | While Activity is open, its icon becomes a solid white circle, the brightest element in the sidebar, brighter than the page's primary action. | act-1440.png | observed | Use the muted selected style that the other toggles use. |
| V3-09 | Artifacts grid | P3 | visual (D5) | Cards are 166 px tall and carry an icon, a type word, a title, a one-line summary and a time that is "6m ago" on all ten. The grid shows 9 items per screen where the list view shows all 10 with room to spare. | art-1440.png, art-list.png | observed | Optional: show a thumbnail or first lines of content in the card, or drop the identical timestamp from cards. |

## Notes outside the severity bar

- Investors page (owned by another session, only P0/P1 reported): the Updates section with no updates shows two gray ghost rows with no words. They read as a stuck loading state (it still looked that way after 12 s). `Investors.tsx` renders `UpdateRowPlaceholder` when the list is empty (line ~411). This is P2 at most; flagging for the owning session.
- Approval toast ("[MOCK] Vendor security questionnaire needs approval") persists bottom-right and covers table rows on Contacts, Artifacts and the Data room. This follows the Pass-9 decision, so it is not a finding. It has no Review/Open button, only a dismiss X.
- Page artifact "MOCK Cash Dashboard" shows real-looking amounts in its isolated preview while Hide amounts is on. Hide amounts is defined as hiding money in app UI only, so not reported.

## Excellent as is

- Data room search: matching text is highlighted in context with the folder path, and the empty result has a compact "No results / Clear search".
- Failed file row: states the reason ("This file isn't a readable PDF.") and offers Delete in the row, with a red Failed pill.
- Data room phone layout: folder selector as a native-style menu, Filters button revealing the filter row, preview as a centered modal card.
- Cmd+K palette: grouped results (Contacts, Documents, Chats) with highlighted matches and dates; no-match state says what was searched and offers "Search mail for ..."; same component works at 375 wide.
- Contacts table and edit dialog: dense 37 px rows, clear columns, Delete separated from Cancel/Save.
- Artifacts viewer: split view on desktop, full-screen with back arrow on phone, isolated-preview lock labeled for assistive tech.
- One-screen fit: none of these pages scroll the page itself at 1440x900 or 375x812; inner panels scroll (layout-audit pageScrollY 0 on every capture).
