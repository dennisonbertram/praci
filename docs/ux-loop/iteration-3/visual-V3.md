# Visual review V3: Data room, Cap table, Contacts, Artifacts, Activity, search, Cmd+K

Target: mock-data demo stack (web :5381), signed in as the mock founder, dark theme. Viewports 1440x900, 375x812, and 1920x1080 for the shell. Screenshots: `/tmp/uxloop3/V3/`. Run with `layout-audit.js` and `geometry-audit.js` on every capture. The audit's "low contrast" hits (ratio about 1.3) are false positives on dark-on-dark text and were checked by eye. Not run: 200% zoom, the Import menu, drag-and-drop, Auto-sort, Ask panel, and light theme.

## Verdicts

| Page | 1440x900 | 375x812 |
|---|---|---|
| Data room list | Good, fits one screen, inner list scrolls. Dead width in the Name column, truncated Type, failed file shown twice. | Weak. About 370px of 812 is chrome before the first file. |
| Data room grid | Works, tiles are small and left-packed. | Not captured separately. |
| Data room stats | Clear cards. The chart is misleading with few buckets. | OK, but list filters still show. |
| Data room preview | Good. | Good. |
| Cap table | One screen with inner scroll, but a 190px empty band in the donut card pushes the holders table below the fold. | Good, same empty band. |
| Contacts | Good and fast. Wide table leaves a dead column, email truncates. Right edge does not align with the header button. | Very good, table reflows to name plus organization. |
| Artifacts | Fits, cards are tall and generic. | Four cards per screen. |
| Activity | Broken: panel opens at 8px height, invisible. | Same. |
| Global search | Works but is squeezed into the sidebar. | Not walked. |
| Cmd+K palette | Clean. | Not applicable (no keyboard). |

## Findings

| id | page | sev | cat | status |
|---|---|---|---|---|
| V3-01 | Activity | P0 | bug | observed |
| V3-02 | Shell sidebar | P1 | visual | observed |
| V3-03 | Data room (mobile) | P1 | flow | observed |
| V3-04 | Data room stats | P2 | visual | observed |
| V3-05 | Cap table | P2 | visual | observed, cause suspected |
| V3-06 | Data room processing strip | P2 | visual | observed |
| V3-07 | Data room list | P2 | visual | observed |
| V3-08 | Contacts | P2 | visual | observed |
| V3-09 | Artifacts | P2 | visual | observed |
| V3-10 | Global search | P2 | flow | observed |
| V3-11 | Data room list (keyboard) | P3 | a11y | observed |
| V3-12 | Shell and Cap table first load | P2 | perf | observed once, dev stack |
| V3-13 | Cap table drill-down | P3 | copy | observed |
| V3-14 | Artifacts header | P3 | visual | observed |
| V3-15 | Agent toasts on mobile | P3 | visual | observed |
| V3-16 | Data room stats (list chrome) | P3 | flow | observed |

### V3-01 Activity panel opens at 8px height and cannot be seen (P0, bug, observed)
- Story: STORY-APP-124 to 127. Maya clicks the Activity (clock) button to see what needs her. The button turns active and the agent list moves 19px, but no list appears.
- DOM: `[data-testid=activity-list]` has clientHeight 8 and scrollHeight 249 (1440x900, 1920x1080) and 8/487 at 375. It holds the "Needs you" and "Working" regions and "Show 3 finished runs", so the one place that says an agent needs her answer is unreachable. At 375 it also pushes Artifacts out of the Pages list.
- Cause (suspected, strong): the list has `max-h-[40vh] overflow-y-auto` and sits inside the workspace column, which is a flex column that scrolls (`flex-1 overflow-y-auto`, scrollHeight 1070). An `overflow` element has min-height 0, so the flex layout shrinks it to its padding. Code: `apps/web/src/pages/ActivityList.tsx:135`.
- Evidence: `/tmp/uxloop3/V3/activity2-1440.png`, `activity-1920.png`, `activity2-375.png`.
- Fix: add `shrink-0` to that wrapper's class list.

### V3-02 Pages list clips "Artifacts" at 900px height (P1, visual, observed)
- Norm: L2, I6. The Pages block is `max-h-[40vh]` (360px at 900) but its content is 384px, so the last row (Artifacts) is cut in half on every page at 1440x900. At 1080 it fits. A half-cut row looks broken and hides a destination.
- Evidence: every 1440 screenshot, for example `contacts-1440.png`. Audit scroller: clientH 360, scrollH 384. Code: `apps/web/src/pages/Shell.tsx:4037`.
- Fix: size the block to its content up to a larger cap (for example `max-h-[min(50vh,28rem)]`), or tighten the row height from 50px to 44px so seven rows fit.

### V3-03 Data room header eats about 45% of a phone screen (P1, flow, observed)
- Norm: L2, D1, I4. At 375x812 the title, a wrapped toolbar (view toggles, Import, Add files, Ask), the "Northwind Robotics" subtitle under the toolbar, the search box, a folder and sort row, and a filter row take 370px before the first file. The subtitle lands below the toolbar instead of beside the title (H6). The strip text wraps as "Processing 1 / file" next to a truncated "Reading MOCK Board Minutes - Octobe…". Icon-only Import and Add files (a plain "+") are ambiguous for Maya.
- Evidence: `/tmp/uxloop3/V3/data-room-375.png`.
- Fix: on phones keep title plus Add files and a "More" menu, move Type, Party and Date into one Filter button, and drop the subtitle.

### V3-04 "Documents over time" chart is misleading with few buckets (P2, visual, observed)
- Norm: C3, D2. In Legal / Contracts the chart is two full-width grey bars (width about 410px each) with a "1" axis label and "Mar 2026" and "Apr 2026" labels, while both files show "Added Oct 21, 2026" in the list. The bars use document date, the list shows added date, and nothing says so. It looks like wrong data.
- Evidence: `/tmp/uxloop3/V3/dr-stats-1440.png`. Code: `apps/web/src/components/data-room/DataRoomStats.tsx:118-146`. Bars use `flex-1`, so few buckets stretch.
- Fix: cap the bar width (for example 24px) and title the chart "Documents by document date"; show the 10px axis labels at 12px.

### V3-05 Cap table donut card has a 190px empty band (P2, visual, observed)
- Norm: D2, L7. At rest the card is about 490px tall with content ending near 520px, leaving roughly 190px empty. Only one holder row of the table is visible at 1440x900 (`captable-1440.png`). The drill-down view (`cap-drill-1440.png`) uses the space, so the height is probably reserved for it (suspected, `apps/web/src/components/cap-table/OwnershipDonut.tsx:355-360`, absolute-positioned stage).
- Fix: size the card to its content at rest and animate the height when a class is opened.

### V3-06 Processing strip repeats the failure and reads as two sizes (P2, visual, observed)
- Norm: C2, H3. The strip says "Processing 1 file Reading …" in light grey and "1 couldn't be read" in bold white on a second line, while the same failed file already shows "Failed", the red reason and "Try again" in its row. The 2px progress line at 0% looks like a thick border above the table header. The Details chevron is a 24px target far at the right edge.
- Evidence: `dr-1440.png`, `dr-strip-open.png`. Code: `apps/web/src/components/data-room/ProcessingStrip.tsx:34, 57, 108, 130`.
- Fix: one line "Reading 1 file · 1 couldn't be read" with the count clickable to filter to Failed; hide the bar at 0%.

### V3-07 List columns: Type truncates while Name has dead width (P2, visual, observed)
- Norm: C4, D3. At 1440 the Name column spans about 520px with short names, while Type shows "Legal docume…" and "Investor docu…" with no tooltip. Failed rows grow to 120px with a 70px "Try again" and shift neighbours (L5).
- Evidence: `dr-upload2-1440.png`. Fix: give Type `min-w-[9rem]` and let Name shrink.

### V3-08 Contacts table: dead column and misaligned edge (P2, visual, observed)
- Norm: L4, C4. At 1440 the Name column is about 500px, Email is cut ("casey.advisor@advisors.exampl…") with no title attribute, and the table ends at x=1368 while "Add contact" ends at x=1411. At 1920 the table stops at x=1368 while the button is at x=1891. "Other" is the kind for 6 of 14 contacts (Robin Prospect at Bolt Freight, a customer), which tells Maya nothing.
- Evidence: `contacts-1440.png`, `activity-1920.png`. Fix: let the table fill the content width, give Email the spare width, and add a Customer kind or show the organization role.
- Excellent: the Edit contact dialog and the mobile reflow (see below).

### V3-09 Artifacts: tall cards with no preview (P2, visual, observed)
- Norm: D1, D5, C1. Every card has the same generic file icon and a 184px height; "MD", "CSV" and "HTML" badges are jargon for Maya. The mobile view shows four cards per screen and grid is the default there. The status "5m ago" is right-aligned under the description with a large gap.
- Evidence: `artifacts-1440.png`, `artifacts-375.png`. Fix: default to the list view on phones, show a small content preview or a kind icon per type, and use "Doc", "Sheet", "Page" labels.

### V3-10 Global search is confined to the sidebar and repeats "Message" (P2, flow, observed)
- Norm: C2, D5, I6. Searching "Bolt" replaces the sidebar with sections Documents (1), Mail (a "Search mail" row), and Chats (9 rows each tagged "Message"). The 316px width truncates the document name ("Bolt Frei…"), the query is not highlighted, and contacts, Cap table holders and artifacts are not searched (the contact Robin Prospect at Bolt Freight is not listed). Also, Cmd+K opens a second search field in the palette while the sidebar field stays focusable: typing went to the sidebar field and the palette stayed on its page list.
- Evidence: `gsearch-1440.png`, `cmdk-bolt-1440.png`. Fix: one search surface (the palette) with grouped results and highlighted matches.

### V3-11 Data room keyboard cost (P3, a11y, observed)
- Norm: I7. Each of 50 rows is a tab stop and its "More actions" button is another, so about 100 stops before "Load more". Focus rings are present (shadow or outline) everywhere checked except "Resize folders". Fix: make rows `tabindex=-1` with arrow-key navigation, keep the menu button.

### V3-12 Slow first paint on full load (P2, perf, observed once, dev stack)
- Norm: I2. `/app/data-room` took about 7s from navigation to the first list rows, with a blank sidebar (no skeleton) and a skeleton list; `/app/cap-table` at 375 showed "Still opening… Try again" after 9s, then loaded on its own. DOMContentLoaded was 838ms, so the wait is in app bootstrap. May be dev-server only; not repeated for the cap table.

### V3-13 Cap table drill-down does not name the class (P3, copy, observed)
- Norm: I6. After opening "Common (Mock)" the card shows only a back arrow, a small donut and a legend of holders; the class name appears nowhere, and the centre text is the highlighted holder at 10px. Percentages (47.62% for Maya) differ from the table (40.00%) with no label saying "of Common". Evidence: `cap-drill-1440.png`. Fix: add a heading "Common (Mock) · 8,400,000" and "of class" on the percent column.

### V3-14 Artifacts header differs from sibling pages (P3, visual, observed)
- Norm: H5. Contacts, Data room and Cap table show the company name beside the title and have no rule under the header; Artifacts has neither the subtitle nor a full-width divider at y=77. Fix: use the same page header component.

### V3-15 Agent toasts cover content on phone (P3, visual, observed)
- Norm: L3. "Inbox agent finished" overlays the Data room stats chart at 375 (`dr-stats-375.png`). Toasts also appear at 1440 over the list (`dr-upload2-1440.png`). They do dismiss, so P3.

### V3-16 Stats view keeps list-only filters (P3, flow, observed)
- Norm: I5. Search, Sort and the direction arrow stay visible in the stats view, though sorting does nothing there; on phone they cost 100px.

## Excellent as is

- Data room preview panel and mobile preview sheet: the file renders, actions are labeled icons, Close is obvious, and metadata (Folder, Source, Size) is quiet. `dr-preview-1440.png`, `dr-preview-375.png`.
- Data room folder tree, breadcrumb "All items > Legal > Contracts" and empty folder view: clear and compact.
- Upload feedback: the toast shows the file name, then "Uploaded" with "View", and the file appears first in the list.
- Failed file row: red reason, "Failed" badge and a "Try again" button in place.
- Contacts: compact empty state ("No matches", "Clear filters"), search works, mobile reflow to name plus organization and kind is the best phone table in this set, and the Edit contact dialog (labeled fields, Delete distinct on the left, one primary Save).
- Cap table summary cards, donut with drill-down, and tab and sort controls; mobile layout of the four summary cards.
- Cmd+K palette: single field, five to nine rows, active row clear, Escape closes.
- All five app surfaces at 1440x900 have no page scroll (pageScrollY 0, no horizontal overflow at 375).
