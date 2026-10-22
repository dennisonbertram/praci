# Visual critique V3: Data room, Investors (P0/P1 only), Contacts, Artifacts, Activity, search, Cmd+K

Stack: mock demo (web 5381). Viewports 1440x900, 375x812, 1920x1080 (Data room shell). Screenshots in /tmp/uxloop16/V3/.
Audits: layout-audit.js and geometry-audit.js run on Data room (1440, 1920, 375), Contacts, Artifacts. Pointer emulation: `pointer: coarse` stayed false even with the iPhone 12 device, so no touch-target finding is raised.
Method note: other walkers share this demo account, so sidebar groups, unread counts, and the AI consent card changed during the walk. None of that is reported.

## Verdicts

| Page / state | 1440x900 | 375x812 | 1920x1080 |
|---|---|---|---|
| Data room list | Good: one screen, list scrolls inside its panel. Type and Parties columns truncate (V3-01) | Good: path picker and search are clean. Preview is blank (V3-02) | Name column has wide dead slack (V3-01) |
| Data room grid | Good | No grid view offered (V3-10) | not checked |
| Data room stats | Good | No stats view offered (V3-10) | not checked |
| Data room preview, filters, Add files | Excellent | Preview broken (V3-02) | not checked |
| Contacts | Good, table narrower than header (V3-08) | Good | not checked |
| Artifacts (grid, list, open) | Grid cards mostly empty (V3-05) | Good | not checked |
| Activity (sidebar panel) | Works, squeezes the chat list (V3-12) | in drawer, not checked | not checked |
| Cmd+K and search results | Excellent | Slow, start-truncated titles (V3-03, V3-04) | not checked |
| Investors | No P0/P1 seen (owned by another session) | Action item title truncated to "Audit request - [M..." (noted, P2, out of scope) | not checked |

App surfaces fit one screen at every viewport checked (pageScrollY 0, pageScrollX 0, no horizontal overflow on 375).

## Findings

| ID | Page | Sev | Cat | What happened vs expected | Evidence | Suspected code | Fix |
|---|---|---|---|---|---|---|---|
| V3-01 | Data room list | P2 | visual | Observed. Type and Parties are narrow fixed columns that truncate ("Investor docu...", "Halcyon Logistics (...", "Northwind Robotic...") while the Name column holds hundreds of empty px (about 800 px at 1920). Eye travel from name to type is long. Norms C4, D2, H6. | dr-1440.png, dr-1920.png, dr-upload-top.png | apps/web/src/components/data-room/ItemRows.tsx (table column widths) | Let Type and Parties take the slack (or cap Name width) so "Investor document" never truncates. |
| V3-02 | Data room preview | P2 | bug | Observed. At 375 the preview dialog shows a 311x292 blank iframe for a PDF (blob URL, `#toolbar=0`), with no loading text or fallback. Desktop renders it. Cause of blank is suspected (PDF in iframe at narrow width), not confirmed. Norm I8. | dr-375-preview2.png | apps/web/src/components/data-room/Preview.tsx | On narrow screens render a page image or show "Open" / "Download" in place of the empty frame. |
| V3-03 | Search results | P2 | visual | Observed. At 375 Documents titles truncate from the start ("...Agreement - Halcyon Logistics.pdf", "...t of Work - Halcyon Logistics.pdf") while a third ends with "...". Two different documents look alike and the leading part of the name is lost. Norm C4, H5. | cmdk-375b.png | command palette result row (apps/web, search/command component) | Truncate titles at the end and keep the highlighted match in the snippet line only. |
| V3-04 | Cmd+K | P2 | perf | Observed. Typing "halcyon" showed only a spinner for about 8 to 10 s at 375 (both search/query and dataRoom/search returned 200); "bolt" at 1440 took about 2 s. Measured under load from parallel walkers, so latency is partly environmental. No "Searching..." text. Norm I2. | cmdk-375.png, cmdk-375b.png | search/query and dataRoom/search RPCs | Show results per source as they arrive, and add a words-plus-spinner state. |
| V3-05 | Artifacts grid | P2 | visual | Observed. Cards are about 150 px tall with roughly half empty, show no date, and tiny "Doc/Sheet/Page" labels. Fewer items per screen than the list view. Norm D2, D5. | art-1440.png | apps/web artifacts grid card | Shrink card height to content and add "Added" to the card. |
| V3-06 | Data room | P3 | a11y | Observed. The "1 file failed" badge button is 19x25 px (under the 24 px minimum), at desktop pointer. Norm I4. | layout-audit smallTargets | sidebar Data room row badge button | Widen the hit area to at least 24x24. |
| V3-07 | Data room | P3 | a11y | Observed. Tab lands on "Resize folders" with no visible focus ring (all other stops have one). Norm I7. | tab sweep (boxShadow none, outline none) | ResizableFolders.tsx | Add a focus-visible ring to the separator. |
| V3-08 | Contacts | P3 | visual | Observed. Table right edge is 1240 px while the header actions end at 1412 px (896 px table width); right gutter does not align. Norm L4. | contacts-1440.png, measured | Contacts page table container max-width | Match the table width to the header gutter, or give the header the same max-width. |
| V3-09 | Data room list | P3 | visual | Observed. The failed file has a blank Type cell while other untyped files say "Not tagged". Norm H5, C3. | dr-1440.png | ItemRows.tsx type cell | Show "Not tagged" or "Unreadable" consistently. |
| V3-10 | Data room (phone) | P3 | flow | Observed. Phone Data room offers no Grid or Stats view (the View control is hidden); stats are desktop only. Sort in the Filters sheet was not opened, so unverified. Norm P1 (parity). | dr-375.png | Data room header view toggle | Decide whether stats should exist on phone; if not, ignore. |
| V3-11 | Cmd+K | P3 | flow | Observed. Empty palette lists eight pages but not GTM (in the sidebar) and no Settings or Integrations. Norm I6. | cmdk-1440.png | command palette page list | Build the page list from the same source as the sidebar and add Settings and Integrations. |
| V3-12 | Activity | P3 | visual | Observed. Opening Activity inline takes about 190 px of the sidebar and leaves about two chat rows visible. Norm L3. | activity-1440.png | sidebar Activity panel | Cap the Activity panel height and let it scroll. |
| V3-13 | Data room upload | P3 | flow | Observed. A file uploaded while viewing "All items" landed in the "Product" folder with no mention in the toast ("Uploaded / View"). Cause unknown. Norm C3. | dr-upload-top.png | upload default folder logic | Say the destination folder in the toast. |
| V3-14 | Data room filters | P3 | visual | Observed. Type/Party menu items show no counts and no checked state in the menu when none selected; unverified with a selection. Norm I8. | dr-filter-1440.png | FilterBar.tsx | Show counts next to each option. |
| V3-15 | Hard load | P3 | perf | Observed twice. Opening /app/investors and /app/artifacts directly showed "Still opening... Try again" after about 7 s, then loaded. Data room and Contacts loaded in about 1 s. Likely Vite dev-server module load under contention (suspected, over 7,000 script requests in the session). | inv-1440.png, artifacts-375.png | app bootstrap | Verify on a production build before acting. |

## Excellent as is

- Data room preview pane: large thumbnail, clear metadata table, Open/Download/Expand/More/Close in one row.
- Data room mobile folder picker: a flat "Archive / Old drafts / 2025" menu with a check, plus Auto-sort; better than a tree at 375.
- Data room stats view: four tiles, date histogram, types and parties as ranked bars, no decoration.
- Consent card with Allow and Not now, one line of copy.
- Failed file: red row, plain reason ("This file isn't a readable PDF."), Delete behind a confirmation dialog.
- Desktop Cmd+K: grouped Documents, Contacts, Chats, Mail, with highlighted matches and a key hint footer.
- Contacts edit dialog: five fields, Delete and Save clearly separated.
- Contacts and Artifacts at 375: clean reflow, no overflow, back arrow in the artifact viewer.
- Artifact viewer: "Isolated preview" lock has an accessible name; Download and Maximize are clear.
- No page scroll and no horizontal overflow on any page at 1440, 1920, or 375.
