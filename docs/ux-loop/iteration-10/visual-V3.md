# Visual review V3: Data room, Investors, Contacts, Artifacts, Activity, search, Cmd+K

Target: mock-data demo stack (web :5381). Screenshots: /tmp/uxloop10/V3/. Viewports: 1440x900, 375x812, and 1920x1080, 1280x800, 1024x768 for the Data room.
Note: other walkers share the demo account, so the Data room consent card disappeared mid-walk (Allow was clicked elsewhere) and extra files and spaces appeared.
Touch-target sizes were not judged without touch emulation. The Data room row menu uses `pointer-coarse:opacity-100` and `pointer-coarse:size-11`, so it is correct on touch.

## Verdicts

| Page | 1440x900 | 375x812 | Notes |
|---|---|---|---|
| Data room list | Pass | Pass | No page scroll (L1) at 1024, 1280, 1440, 1920. Inner panels scroll. |
| Data room grid | Pass | not captured | Thumbnails are white pages on a dark UI. Acceptable. |
| Data room stats | Pass | not captured | Clear tiles and bars. |
| Data room preview | Pass | Pass | Mobile preview is a dialog. Focus returns to the row on close. |
| Data room at 1024 | n/a | n/a | P2, toolbar uses 4 rows (V3-02). |
| Investors | Pass (only P0/P1 reported) | Pass | No P0/P1 found. |
| Contacts | Pass | Pass | Dense and clean. Row opens an edit dialog (V3-07). |
| Artifacts | Pass | Pass | Cards on desktop, list on phone. |
| Activity panel | P2 (V3-01) | not captured | |
| Cmd+K palette and search results | Pass | Pass | P3 notes (V3-05, V3-06). |

## Findings

| ID | Page | Sev | Cat | What happened vs expected | Evidence | Code | Proposed fix |
|---|---|---|---|---|---|---|---|
| V3-01 | Activity (sidebar) | P2 | visual / flow | Observed: the Activity panel is capped at about 85px of scroll area at 1440x900 (header included about 126px). It shows 1 of 3 entries ("Needs you" row), with no scroll cue. The "Working" item and "Show 11 finished runs" are hidden until the user scrolls inside the tiny box. "Needs you" rows also appear again in the chat list below (violates C2). Expected: all "Needs you" items visible (L2, I6). | activity-1440.png, activity2.png; measured clientH 85 / scrollH 205 | apps/web/src/pages/ActivityList.tsx:133 (`lg:max-h-[max(14vh,7.5rem)]`) | Let the panel grow to fit "Needs you" rows (about 30vh) and add a fade or count cue when it scrolls. |
| V3-02 | Data room | P2 | visual | Observed: at 1024x768 the toolbar takes 4 rows (about 218px, 28% of the height) before any row. Sort sits alone on a right-aligned row between search and filters. At 375 with Filters open, Sort again sits alone on its own row. Expected: related controls grouped (D4, L6). | dr-1024b.png, dr-375-filters.png | apps/web/src/components/data-room/FilterBar.tsx and the toolbar in pages/DataRoom.tsx (suspected) | Keep Sort in the same row as the filter chips and let the chips wrap together. |
| V3-03 | Data room | P2 | flow | Observed: a file stays at "Reading for 4 min", then 5 and 6 min, with no explanation or action in the row. Only a Failed file shows a Delete button. The row menu does have Delete. The demo has no model key, so this may be a demo artifact. Expected: after a threshold, "Taking longer than usual" plus Retry (C3, I3). | dr-375-filters.png, dr-menu.png | components/data-room/ItemRows.tsx (Marker, status text), suspected | Show a stalled state after N minutes with a Retry button. |
| V3-04 | Data room list | P3 | a11y | Suspected: row "More actions" and the checkbox are `tabindex=-1`. Only the first row is a Tab stop, with arrows and `x` as the keyboard route. This is deliberate and documented in code, but nothing tells a keyboard user that the row menu opens with the context-menu key or Shift+F10. | tab order walk (list 22+8 stops) | components/data-room/ItemRows.tsx:96-125 | Add a one-line keyboard hint in the list's accessible description or the Ask or help tips. |
| V3-05 | Cmd+K | P3 | flow | Observed: typing "Halcyon" selects "Search mail for 'halcyon'" first, above the Contact and Document matches. Enter therefore leaves the palette for a mail search (it works: 4 results with highlights). The list shows 3 documents, and I did not verify that it scrolls for more. | palette-q-1440.png, search-1440.png | command palette component (not located) | Select the best direct match first and put "Search mail for" last. |
| V3-06 | Cmd+K (phone) | P3 | visual | Observed: long document titles truncate and can cut off the highlighted match ("MOCK Statement of Work - Halcy..."). | palette-375.png | | Truncate in the middle or wrap to two lines. |
| V3-07 | Contacts | P3 | flow | Observed: clicking a contact opens an Edit form directly. There is no read view and no related mail, documents or chats for that person. Maya cannot answer "what do I have with Morgan?" from here. | contacts-drawer.png | | Show a read-only summary first, with related items, and an Edit action. |
| V3-08 | Data room row menu | P3 | visual | Observed: "Share with investors" wraps to two lines in the row menu while other items are one line. | dr-menu.png | components/data-room/ItemMenu.tsx | Widen the menu or shorten to "Share". |
| V3-09 | Artifacts (first load) | P3 | perf | Observed: the first direct load of /app/artifacts stayed on "Opening Praci..." then "Still opening... Try again" for over 5s, twice. After Try again or a reload, it opened in about 1s. Probably cold dev-server compilation (suspected), so not necessarily a product bug. | artifacts-1440.png (after retry) | | None unless it reproduces on a production build. |

## Excellent as is

- Data room: one-screen layout at 1024 to 1920 with the list, folder tree and preview each scrolling inside their own panel.
- Data room list rows: file name over folder path, status chips ("Reading", "Failed" with a plain reason and Delete), and the Parties column hidden at narrow widths via container queries.
- Data room stats: four tiles, date histogram and ranked bars read quickly.
- Data room phone layout: folder dropdown, labelled icon buttons, an inline Filters panel, a preview dialog, and a dismissable "Imported 3 files" strip.
- Row actions are hover-only on desktop and always visible, 44px, under `pointer: coarse`. Focus returns to the row after the preview closes.
- Contacts: dense 37px rows, a clear primary "Add contact", a clean edit dialog on desktop and phone, and a delete that is visually separate.
- Artifacts: card grid on desktop, compact list on phone, version badge and type labels.
- Search: palette groups (Mail, Contacts, Documents) with underlined matches, and the inbox search results page with highlighted terms, "4 results" and "No more results".
- Investors: the page fits one screen with an inner scroll and no horizontal overflow at 375.
