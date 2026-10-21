# Visual review V3 (second run): Data room, Cap table, Contacts, Artifacts, Activity, search, command palette

Note: visual-V3.md already existed (written 17:51 by another run), so this run wrote to this file instead of overwriting it. Finding ids use the prefix V3B- to avoid clashing.

Target: mock-data demo stack (web :5381), signed in as the demo founder. Viewports 1440x900, 375x812, and 1920x1080 for the shell. Screenshots are in /tmp/uxloop1/V3/. Everything is observed unless marked "suspected". The demo stack was shared with other inspectors, so data changed during the walk (30 notes and a video were imported, dates rolled to Oct 21).

## Verdicts

| Page / state | 1440x900 | 375x812 |
|---|---|---|
| Data room list | Good (V3B-01, 02) | Weak (V3B-03, 04) |
| Data room grid | Fair (V3B-05) | not captured |
| Data room stats | Good (V3B-06) | not captured |
| Data room preview | Good (V3B-07) | Excellent (centered sheet with full metadata) |
| Data room search and empty | Excellent results; empty copy minor (V3B-08) | not captured |
| Processing strip | Fair (V3B-02) | Fair (V3B-03) |
| Cap table | Good (V3B-09, 10) | Good once loaded (V3B-11, 12) |
| Contacts | Good, plain (V3B-13) | Fair (V3B-14) |
| Artifacts | Good (V3B-15) | Good |
| Activity mode | Excellent | not captured |
| Command palette | Fair (V3B-16) | not captured |
| Shell at 1920x1080 | Fair (V3B-17) | n/a |

Measured: pageScrollY = 0 and pageScrollX = 0 on every page and viewport; no horizontal overflow at 375; all scrolling is inside panels. The layout audit "deadSpace" hit on the Data room was an off-screen column spacer (false positive). "lowContrast" hits on sidebar labels (1.32) come from transparent backgrounds; not counted.

## Findings

| id | page | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| V3B-01 | Data room list | P2 | visual | Every row repeats the same folder path under the name ("Finance / Invoices / Fundraising 2026" in five rows), and it truncates to "Fundr..." when the preview opens. Repeated chrome (D5, C2). | dr-1440.png, dr-preview-1440.png | components/data-room/ItemRows.tsx | Hide the path line when a folder is selected; in All items show it only when it adds information. |
| V3B-02 | Processing strip | P1 | flow | "2 couldn't be read" is plain text with no link to the failed files. The only expand control is a 16px chevron labelled "Details". A second "Imported 31 files" bar stacks above it, so two banners push the table down and persist (L3). | dr-strip-open-1440.png, dr-1920.png | components/data-room/ProcessingStrip.tsx:89, ImportActivity.tsx | Make "2 couldn't be read" a button that filters to Failed; merge import and processing into one row; enlarge the toggle. |
| V3B-03 | Data room list, mobile | P1 | visual | The header stacks toolbar icons, then the subtitle "Northwind Robotics" below them, then search, two rows of filter chips and two banners. The first file row starts at y=470 of 812, so about five rows show (L1, D2, I4). | m-data-room.png | pages/DataRoom.tsx | On mobile put filters behind one "Filters" button, put the subtitle beside the title, merge the banners. |
| V3B-04 | Data room list, mobile | P2 | a11y | Icon-only header buttons are about 32px; the banner toggle and the "All items" button are 16-18px tall (I4; 44px on touch). Import uses a download-tray icon without a label. | m-data-room.png, layout-audit smallTargets | pages/DataRoom.tsx | Raise touch targets to 44px; label or change the import icon. |
| V3B-05 | Data room grid | P3 | visual | Cards are about 296px tall with the title mid-card and the type pinned at the bottom, leaving a gap; fewer files fit per screen. | dr-grid-1440.png | components/data-room/FolderDocuments.tsx | Cap card height to its content. |
| V3B-06 | Data room stats | P3 | visual | The chart has one y label ("6") and no bar values. The Sources panel has two rows but is stretched to Types' height (D2). Sort stays visible though it does nothing here. | dr-stats-1440.png | components/data-room/DataRoomStats.tsx | Size panels to content, add bar tooltips, hide Sort in stats. |
| V3B-07 | Data room preview | P2 | bug | The side preview renders the PDF cropped on the right (text "Ch" is cut at the panel edge); the page is not scaled to fit width. Esc did not close the panel when focus was in the list (one try only). | dr-preview-1440.png | components/data-room/Preview.tsx | Fit PDF width to the panel; close on Esc from anywhere. |
| V3B-08 | Data room search | P3 | copy | Empty result: "No results" plus "Search looks for these words in names and text." The second line is an explainer (C4) and there is no "Clear search" action. | dr-empty-1440.png | pages/DataRoom.tsx:696 | Remove the sentence; add "Clear search". |
| V3B-09 | Cap table | P2 | visual | The header breaks at 1440 with the agent pane open: "Northwind R..." truncates and "Updated 4h ago" wraps to two lines. | cap-1440.png | pages/CapTable.tsx header | Drop the space name from the header (it is in the sidebar) and keep "Updated" on one line. |
| V3B-10 | Cap table | P2 | visual | Header, stats, donut and tabs scroll away together (scroller 900px, content 1342px), so table headers and filters are not pinned. The donut card is about 390px for two legend rows (D2). Table rows are 56px (D1 expects 28-36px). | cap-1440.png, cap-scrolled-1440.png | pages/CapTable.tsx | Shrink the donut card; make the table header sticky; reduce row height. |
| V3B-11 | Cap table, mobile | P1 | perf | Direct load of /app/cap-table at 375 stayed on "Opening your Space..." for over 15 seconds (once; nav load worked; not seen at 1440). During load the page first showed a different layout (contact list with Investors/Auditors tabs) and then reflowed (L5). May be load from other inspectors. | m-cap-table.png | components/ShellSkeleton.tsx | Recheck on a quiet stack; show a stat-tile skeleton, not a different list. |
| V3B-12 | Cap table, mobile | P3 | visual | Toolbar wraps to two rows with both a "+" icon and an "Add contact" button; Ask sits alone on a second row; the tab bar wraps to two rows. | m-cap-table.png, m-cap-table-2.png | pages/CapTable.tsx | Keep one add action; put Ask in the title row. |
| V3B-13 | Contacts | P3 | visual | "Add contact" is about 24px tall while Data room's "Add files" is about 30px (H5). Names are 20px-tall buttons; rows have no hover or avatar. | contacts-1440.png | pages/Contacts.tsx | Use one primary button size. |
| V3B-14 | Contacts, mobile | P2 | flow | Email and Organization columns disappear at 375; only Name and Kind remain, so Maya cannot see an investor's firm. | m-contacts.png | pages/Contacts.tsx | Show organization as a second line under the name. |
| V3B-15 | Artifacts | P3 | visual | All cards share one generic file icon, and names keep extensions plus a type tag, so type is shown twice (C2). | artifacts-1440.png | pages/Artifacts.tsx | Drop the extension or the chip. |
| V3B-16 | Command palette | P2 | flow | The default list shows only Bots. Pages (Cap table) appear only after typing; documents are not searched: "lease" returns the Redlines bot, not the "MOCK Office Lease" document. | cmdk-1440.png, cmdk-q-1440.png | pages/shell/command-palette*.tsx | Show a short Pages group by default and include Data room documents. |
| V3B-17 | Shell 1920x1080 | P2 | visual | The table does not cap its width: Name is about 860px wide and Type/Added/Parties/Status sit far right, so rows are hard to scan (H6). | dr-1920.png | components/data-room/ItemRows.tsx | Cap list width (about 1200px) or widen the other columns. |
| V3B-18 | Sidebar | P3 | flow | The sidebar list stayed scrolled 386px after opening Cap table, so the Pages list (and the current page) was out of view on Cap table, Contacts and Artifacts (I6). Suspected cause: scrollIntoView of the page agent. | cap-1440.png, contacts-1440.png | pages/Shell.tsx:1742 | Keep Pages pinned above the chat list or do not scroll for page items. |
| V3B-19 | Data room | P3 | copy | A "Hide amounts" eye button sits in the Data room header though the list shows no amounts. Suspected: it applies to invoice previews only. | dr-1440.png | pages/DataRoom.tsx:492 | Show it only when an invoice is open. |

## Excellent as is

- Data room search: relevance sort, highlighted snippets, filter chips.
- Data room preview on mobile: centered sheet with type, parties, tags, folder, source, size.
- Failed file row: red reason text plus inline "Try again".
- Activity mode: "Needs you" and "Working" groups, status words next to each item (C3).
- Cap table stat tiles with the 409A hint; donut with right-aligned numbers.
- Artifacts card grid; the palette returns focus to its opener on Esc (I7).
- No page scroll and no horizontal overflow at any viewport.

Side effect: I toggled Activity mode on and off in the demo user's sidebar; it is back off.
