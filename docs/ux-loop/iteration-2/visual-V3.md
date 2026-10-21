# Visual review V3 (uxl2-V3): Data room, Cap table, Contacts, Artifacts, Activity, search, Cmd+K

Target: mock-data demo stack (web port 5381), signed in as the mock founder. Screenshots are in `/tmp/uxloop2/V3/`.
Viewports: 1440x900 for all pages, 375x812 for all pages, 1920x1080 for the Data room shell. `layout-audit.js` and `geometry-audit.js` were run on each page and viewport. Horizontal overflow was 0 everywhere.
Persona: Maya, a first-time founder, looking for a document, checking who owns what, and chasing a failed upload.

Audit note: `layout-audit.js` reports contrast 1.2 to 1.4 for sidebar text. The screenshots show it legible, so this is treated as a script false positive (transparent sidebar background) and not reported.

## Verdicts

| Page | 1440x900 | 375x812 | Verdict |
|---|---|---|---|
| Data room list | Fits one screen; list scrolls inside its panel. Tree, strip and rows are tidy. First-run tour covers content (V3-01). | Works, but chrome takes 42% of the height (V3-12). | Good, 3 issues |
| Data room grid | Clean cards, status text aligned across a row. | Not captured separately (same list chrome as above). | Excellent |
| Data room stats | Good tiles and chart. Sources card is mostly empty (V3-14). | Good. | Good |
| Data room preview | Rows reflow when it opens, PDF text unreadable (V3-06). | Not exercised. | Needs work |
| Data room search results | Highlighted snippets are good; column layout is off (V3-07). | Not exercised. | Needs work |
| Cap table | Main column scrolls inside the panel. Donut card has a dead band; table is below the fold; sticky header leaks (V3-02, 03, 04). | Reflows cleanly; same dead band in donut card. | Needs work |
| Contacts | Clean, but rows are 56px for one line and the page scrolls 65px (V3-10). | Excellent reflow (Name and Kind, organization as subline). | Good |
| Artifacts | Card grid and list/detail are strong. Minor repetition (V3-15). | Excellent list and detail with back arrow. | Good |
| Activity | Useful grouping (Needs you, Working), but it squeezes the agent list (V3-09). | Not exercised. | Needs work |
| Cmd+K palette | Looks right and keyboard-first; scope is narrow (V3-08). | Not exercised. | Needs work |

## Findings

All are observed unless marked suspected.

| ID | Page | Sev | Cat | What happened vs expected | Evidence | Suspected code | Proposed fix |
|---|---|---|---|---|---|---|---|
| V3-01 | Data room, first visit | P2 | visual | The 1/9 tour popover ("Chat with Chief here...") sits at x 315-600, y 484-582. It covers the "Legal" folder and the first letters of three document names in the main area. Expected: a popover points at its target without hiding unrelated content (L7). | `dr-1440.png` | Tour popover placement (not located) | Place the tour popover inside the sidebar column or flip it so it does not overlap the content pane. |
| V3-02 | Cap table | P2 | visual | The donut card is 490px tall; the donut plus 2-row legend end about 200px before the card does. With the stat cards it pushes the ownership table (the main job of the page) to y 830, below the fold at 1440x900. Violates D2 and L2. The same empty band shows at 375 (card 444px, content about 270px). | `cap-1440.png`, `cap-375.png` | `apps/web/src/components/cap-table/OwnershipDonut.tsx:349-352` (wrapper height; suspected) | Size the card to its content, or place the donut beside the legend so the table starts higher. |
| V3-03 | Cap table | P2 | bug | After scrolling, the sticky column header sits about 35px below the top of the panel, so rows ("Early employees", half of "Unallocated pool") show above it. Expected: the header pins at the panel edge and rows scroll under it. | `cap-scroll.png` | Sticky `top` offset in the cap table header (suspected, `pages/CapTable.tsx`) | Pin the header at `top: 0` of its scroller, or give it an opaque background that spans to the panel edge. |
| V3-04 | Cap table | P2 | flow | The default "All" tab lists 24 rows, 14 of which are contacts with no shares (Auditor, Other, advisors) and show only dashes for Shares and Ownership. Maya has to scroll past them to see that SAFEs carry no ownership yet. Violates C2 and D5. | `cap-scroll.png` | `pages/CapTable.tsx` (filter default) | Default to holders; keep the other tabs for non-holders. |
| V3-05 | Data room, processing strip | P2 | visual | At 1440 the strip is two lines: "Processing 1 file / Reading ...pdf" and "1 couldn't be read" below, in 12px bold with no button look and an 18px tall target. The same failure is already shown in the row (red "Failed" pill, message, Try again), so the fact appears twice (C2). At 375 "Processing 1 / file" wraps to two lines. Clicking the link does filter to Failed and show a removable chip, which is good. | `dr-1440b.png`, `dr-375.png`, `dr-strip.png` | `components/data-room/ProcessingStrip.tsx:57-62` | Put the failed count on the same line as a chip-style button, with no wrap; drop the wrap of the "Processing" label at narrow width. |
| V3-06 | Data room, preview | P2 | visual | Opening the preview narrows the list to about 510px, so every row changes from a one-line table row to a 3-line stacked row and the whole list jumps (L5). The PDF preview shows a 742-byte page at a scale where the text is unreadable, with a grey empty band (about 100px) under it. The "Not tagged yet. Files are tagged once you let Praci read documents..." paragraph is explanatory copy shown on every untagged file (C4). | `dr-preview.png` | `components/data-room/Preview.tsx`; list container query in `ItemRows.tsx` (suspected) | Keep rows in the table layout, or keep a fixed compact layout while the preview is open; fit the preview to the page width and drop the empty band. |
| V3-07 | Data room, search results | P2 | visual | Results use a 4-column table packed into the left half: the Name column is about 220px, so titles wrap ("MOCK Statement of Work - Halcyon / Logistics.pdf"), while the snippet below gets about 800px. The Status column header is present with nothing in it, leaving a wide gap. Violates L4 and H6. | `dr-search.png` | Search-results row in `ItemRows.tsx` (suspected) | Use the normal column widths for results and render the snippet under the name inside the Name cell. |
| V3-08 | Cmd+K palette | P1 | flow | Typing "Halcyon" returns one result, the Chief chat. The data room has 3 Halcyon documents, Contacts has 3 Halcyon people, and Artifacts and Legal items exist. A founder using the global palette to find something gets one agent message. The empty-state Pages list omits Artifacts, orders Legal differently from the sidebar and says "Apps" where the sidebar says "Connect apps" (H5, I6). If searching only pages and chats is intended, nothing on screen says so. | `cmdk-empty.png`, `cmdk-halcyon.png` | Palette source not located | Include documents, contacts and artifacts in palette results (or label the scope in the placeholder, for example "Search pages and chats"); align the page list with the sidebar. |
| V3-09 | Activity | P2 | visual | Activity opens inline in the sidebar. First it shows "Loading activity..." (20px), then expands to about 250px, moving the agent list down so only one agent (Chief) is visible. Status reads well ("Needs you", "Needs input", "Running", in words). Violates L5 and L3. | `act-1440.png` | Sidebar activity section (not located) | Reserve the section height while loading, cap its height with an inner scroll, or open Activity as a popover. |
| V3-10 | Contacts | P2 | visual | 15 one-line rows are 56px each (tool surface wants 28 to 36px, D1). Content height is 965px at 1440x900, so the page scrolls 65px for 15 rows (L1). Unlike Data room and Cap table there is no "Northwind Robotics" subtitle or Ask-agent button (H5). | `con-1440.png` | Contacts table row padding in `pages/Contacts.tsx` (suspected) | Reduce row padding to about 40px so a typical list fits one screen. |
| V3-11 | All pages at 375 | P2 | a11y | Touch targets below 44px in the 375px emulation: Add files and Import 32x32, view toggles 34x28, filter chips 28px high, the processing-strip link 18px high, Contacts name buttons 20px high. Suspected: the recent touch-target change may apply only to coarse pointers, which this headless browser does not emulate. Not confirmed on a device. | geometry measurement at 375 | `ux1/touch-targets` change (PR 494) | Verify on a coarse-pointer device; if absent, apply the 44px minimum under the narrow breakpoint as well. |
| V3-12 | Data room 375 | P2 | visual | Header, view toggles, search, folder/sort row and filter row take about 340px, 42% of the screen, before the first document. "Northwind Robotics" sits below the toolbar instead of beside the title. Violates L1 and D2. | `dr-375b.png` | `pages/DataRoom.tsx` header layout (suspected) | Collapse filters and sort behind one "Filter" button at narrow width; keep the subtitle on the title line. |
| V3-13 | Data room 1920 | P3 | visual | The table ends at x 1752 while the strip, header chevron and toolbar run to x 1900, leaving about 150px of blank gutter on the right. The Parties column truncates ("Halcyon Logistics (...") despite the free space. L4. | `dr-1920.png` | Table max-width in `ItemRows.tsx` (suspected) | Let the table fill the panel, or cap the whole panel width. |
| V3-14 | Data room stats | P3 | visual | The Sources card is about 300px tall and holds one row ("Upload 67"), so half the card is empty (D2). Search, filters and Sort stay visible although Sort has no effect on stats (I5). | `dr-stats.png` | `components/data-room/DataRoomStats.tsx` | Size the Sources card to its content (or merge it into the stat tiles); hide Sort in stats view. |
| V3-15 | Artifacts | P3 | visual | Every card shows the same Chief author and 7m age (D5). MD and CSV cards use the same generic document icon while also showing the type badge. The last card is taller because its description wraps to 3 lines. List view rows are 56px for one line (D1). | `art-1440.png`, `art-list.png` | `ArtifactFileCard.tsx` | Show the author only when more than one bot has produced artifacts; use type-specific icons or drop the badge. |
| V3-16 | Artifacts (cold open) | P3 | perf | On a direct navigation at 375 the list showed 4 skeleton bars at +2s and was loaded by about +6s. Single sample, not measured with a timer. | `art-375.png` (second capture) | not investigated | Measure on a warm and cold load before acting. |
| V3-17 | Contacts edit dialog | P3 | copy | Hint "Contacts are your address book. They do not change Carta." is a standing explainer (C4). It may be needed because Casey Advisor appears in both places; if so, show it only when a contact also appears on the cap table. | `con-detail.png` | `components/Contact*` dialog (not located) | Show the hint conditionally or remove it. |

Not exercised: delete on Artifacts (hover-only trash icon has a proper accessible name, confirmation not tried), Import from Email or Box (real-provider flow, BLOCKED), file upload with a real file (native picker), Cmd+K at 375, preview at 375, Activity at 375.

## Excellent as is

- Data room keyboard flow: Tab order is toolbar, search, filters, folders, strip, rows. Every row has a visible focus ring and its row-action button has a specific accessible name.
- Data room grid view: consistent cards, thumbnails, status text aligned across a row, failed card with Try again in place.
- Data room failure handling: red Failed pill, plain message ("This file isn't a readable PDF."), Try again on the row, and a shortcut that filters to failures with a removable chip.
- Search results: relevance sort switches automatically and matches are highlighted in the snippet.
- Folder picker at 375: the tree becomes a flat path list with a check on the current folder.
- Stats view: four clear tiles, a readable time chart, ranked bars.
- Contacts at 375: Name and Kind with organization as a subline; no overflow.
- Contact edit dialog: focus lands in Name, focus returns to the row on close, Delete is distinct and set apart from Cancel and Save.
- Artifacts list-plus-viewer: master/detail on desktop, single pane with back arrow on mobile; "Isolated preview" lock has a name; the download and maximize buttons are labeled.
- Activity grouping: "Needs you" and "Working", with status in words and color.
- Cmd+K: opens instantly, search field focused, active row clearly marked, Escape closes.
- No horizontal overflow on any page at 375, and the Data room shell fits one screen at 1440x900 and 1920x1080 with inner scrolling.
