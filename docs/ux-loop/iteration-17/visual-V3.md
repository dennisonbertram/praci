# Visual inspection V3 (iteration 17)

Session uxl17-V3. Target: mock-data demo stack (web 5381). Pages: Data room, Investors (cap table), Contacts, Artifacts, Activity, search results, Cmd+K palette. Viewports: 1440x900, 375x812, 1920x1080 (shell), plus 1280x800 for the one-screen check. Screenshots are in /tmp/uxloop17/V3/.

Method notes. Layout and geometry audits were run on each page and state. The audit's low-contrast list (ratios near 1.3 on sidebar labels) is a false positive: measured text contrast is 6.06:1 for muted table text. Touch emulation (pointer: coarse) is not available in agent-browser (a device UA can be set but `matchMedia('(pointer: coarse)')` stays false), so no touch-target findings are reported. Other walkers share the stack, so extra files (r1/r3 notes, a signed SAFE) and a hidden GTM row appeared during the walk. Investors is only judged for P0/P1, per the Pass-9 decision.

## Verdicts

| Page | 1440x900 | 375x812 | 1920x1080 / 1280x800 |
|---|---|---|---|
| Data room list | Good, with column-width waste (V3-01) | Good | One screen at 1280 and 1920; slack distribution poor (V3-02) |
| Data room grid, stats, preview | Good (V3-04, V3-05) | Good; view toggles sit under Filters (V3-08) | Fits 1280x800 |
| Investors | No P0/P1 | No P0/P1 | Fits 1280x800 |
| Contacts | Good (V3-07) | Excellent collapse to name + organization | Fits 1280x800 |
| Artifacts | Good | Good | Fits 1280x800 |
| Activity (sidebar) | Weak: clipped list (V3-03) | Not separately reachable on the drawer in this pass | n/a |
| Search and Cmd+K | Excellent, one artifact (V3-06) | Excellent | n/a |

No page scrolls the document at 1280x800, 1440x900 or 1920x1080 (scrollHeight equals viewport height, no horizontal overflow); long content scrolls inside panels (L1 pass).

## Findings

| ID | Page | Sev | Cat | What happened vs expected | Evidence | Suspected code | Proposed fix |
|---|---|---|---|---|---|---|---|
| V3-01 | Data room list | P2 | visual | Observed. Type is a fixed 160px column and Status an 80px column that is empty on almost every row (only the failed file has a pill). The Name column gets about 280-300px, so names such as "MOCK Invoice 3023 - Delta Desk Rentals.pdf" wrap to two lines on every row (57px rows instead of 40px) and Parties truncates ("Acme Servo Supply (Mo..."). Expected names on one line while empty columns shrink (D2, D1, H6). | dr-folder-1280.png, dr-1440.png, up-3.png | apps/web/src/components/data-room/ItemRows.tsx:206-213 (`w-40`, `w-20`) | Narrow Type to about 112px and show the Failed pill inside the Name cell (or hide the Status column unless a row failed). |
| V3-02 | Data room list, 1920 | P2 | visual | Observed. With no width cap, the Name column takes all spare width (about 700px at 1920), pushing Type, Added and Parties far right, so the eye travels about 700px from a name to its type; Parties still truncates ("Northwind Robotics, Acme Vent..."). Expected slack shared with Parties or a capped table (H6, D2). | dr-1920.png | ItemRows.tsx:210 (Parties widths stop at 288px) | Give Parties a flexible share of the slack, or cap the Name column. |
| V3-03 | Activity (sidebar) | P2 | flow | Observed. The Activity block is a 76px scroll area inside the sidebar scroller. It shows only the first "Needs you" item; "Working - Finance helper - Running" and "Show 7 finished runs" are hidden below the cut with no fade or "N more" cue, and it is a second vertical scroller inside the sidebar scroller. Expected all groups visible, or a visible cue (L1, L3, I6). | act-1440.png (clipped), act-scrolled-1440.png (hidden content after scrolling the inner list: scrollH 166 vs clientH 76) | apps/web/src/pages/ActivityList.tsx:179 (`lg:max-h-[40%]` of a small parent) and :209 | Size the block to its group headers (at least one row per group) or add a bottom fade and a "+2 more" line. |
| V3-04 | Data room grid with preview open | P3 | visual | Observed. Titles clamp to two lines, so "MOCK Pilot Agreement - Bolt..." and "MOCK Pilot Agreement -..." are indistinguishable; the full name is only in a hover `title`. Row heights vary (242px, 200px) because the failed card carries extra text. | dr-grid-1440.png | ItemRows.tsx:708 (`line-clamp-2` below the 640px container width) | Use three lines when a preview is open, or keep the end of the name (party or suffix) visible. |
| V3-05 | Data room stats | P3 | visual | Observed. The hover tooltip ("Dec 2025: 9") sits on top of the chart title; the y axis shows only "10" and the x axis only first and last month. Whether bars can be reached by keyboard is suspected, not tested. | bar-crop.png | apps/web/src/components/data-room/DataRoomStats.tsx | Anchor the tooltip below the bar top inside the plot area; label the y axis at 0 and max. |
| V3-06 | Cmd+K palette | P3 | visual | Observed. The selected row shows a white marker on its left edge that renders as a clipped bracket "(" instead of a bar or a full ring. | pal-crop.png, pal-bolt-1440.png | cause not found; row class in packages/ui-web/src/components/ui/command.tsx:151 has no border (suspected focus or ring clipped by the list's overflow) | Use a fixed 2px inset indicator, or the background highlight alone. |
| V3-07 | Contacts | P3 | visual | Observed. The table is capped at 896px (`max-w-4xl`) and left-aligned, so its right edge (x=1240) does not line up with "Add contact" and "Ask" (x=1412) (L4). | con-1440.png | apps/web/src/pages/Contacts.tsx:186 | Let the table fill the page gutter, or cap the header the same way. |
| V3-08 | Data room phone | P3 | flow | Observed. List/Grid/Stats toggles exist only inside the Filters sheet, and in Stats view the toolbar leaves a lone right-aligned icon row under the chips (a dead band). Stats is hard to find (I6). | dr-375-filters.png, dr-375-stats.png | Data room toolbar (Filters collapse at phone width) | Keep the three view toggles beside the title row, or at least on the Filters row. |
| V3-09 | Search results | P3 | clarity | Observed. The failed file "MOCK Signed NDA - Bolt Freight.pdf" shows as a normal result with the folder "Product" and no failed state, while the Data room list shows it in red with no folder. The chat result "Investor Relations (mock)" matched "Bolt" with no snippet, so the reason is not visible (C3, C4). | pal-bolt-1440.png, dr-1440.png | Cmd+K search result rows in Shell.tsx | Add a "Failed" suffix on failed documents; show a snippet or the field that matched. |
| V3-10 | Cold load | P2 | perf | Observed. A direct open of /app/artifacts stayed on "Opening Praci..." and then "Still opening... Try again" for over 10s (about 13-15s until the page rendered). A Data room search showed the skeleton for 5-8s. The stack was shared with other walkers, so the cause is suspected load, not code. Needs a re-measure on a quiet stack. | art-1440.png (first captures) | not investigated | Re-measure alone; if confirmed, find which request (get-session or list) blocks first paint. |
| V3-11 | Toasts on phone | P3 | copy | Observed. A persistent notification ("Legal agent needs an answer") truncates its body mid-sentence ("...so I..."), so the question cannot be read without opening the chat. | m-shell-375.png | notification toast component | Allow three to four lines or end on a full clause. |
| V3-12 | Data room list | P3 | visual | Observed once. After "Upload files", the new row is inserted above the scrolled viewport and the visible rows jump down by about 56px, with no scroll anchoring (L5). The "Uploaded - View" toast is good. | up-0.3.png vs up-3.png | ItemRows list container | Anchor scroll to the first visible row, or scroll to the new row from the toast's View. |

Not reproduced (retracted): an empty Artifacts search appeared blank in one capture, but real typing shows "No artifacts match these filters." with "Clear filters", so no finding.

BLOCKED: Box import ("From Box" in Add files), and touch-target measurement under pointer: coarse.

## Excellent as is

- Cmd+K palette: grouped Documents, Contacts and Chats, matches underlined, snippets, Integrations and Settings listed as pages, footer key hints; on phone it opens top-anchored and shows the same groups.
- Data room: consent card with "Allow" and "Not now"; single "Add files" menu (Upload files, From email, From Box); path bar plus folder tree; "Uploaded - View" toast; uploads get typed and filed automatically ("Note", folder Product, party Northwind Robotics).
- Data room Stats: four clear numbers, histogram, ranked types and parties with tabular counts.
- Contacts: collapses to name plus organization and kind on phone; edit dialog is clean with a distinct but not dominant Delete; focus returns to the row after closing; "No matches / Clear filters" empty state.
- Artifacts: uniform cards, List/Grid toggle, tidy list with right-aligned relative time, real empty state with a clear action.
- One-screen rule: all four pages fit 1280x800, 1440x900 and 1920x1080 with panel scrolling only; no horizontal overflow at 375px.
- Keyboard: logical tab order in the Data room (header, filters, tree as one stop, list as one stop, Load more); visible focus rings.
- Contrast: muted text measured 6.06:1 on the page background.
