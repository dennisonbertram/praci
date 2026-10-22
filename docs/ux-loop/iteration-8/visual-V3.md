# Visual inspection V3 (iteration 8)

Session uxl8-V3. Target: mock-data demo stack only (web port 5381). Pages: Data room (list, grid, stats, folder tree, path bar, preview, upload and processing), Investors (the cap table page), Contacts, Artifacts, Activity, command palette (Cmd+K), mail search results.
Viewports: 1440x900 and 375x812 for every page, 1920x1080 for the shell (Data room, Investors), and 1280x800 as a one-screen check. Screenshots are in `/tmp/uxloop8/V3/`.

Method and limits:
- `layout-audit.js` and `geometry-audit.js` ran on every captured page (`*.layout.json`, `*.geo.json`). The contrast results are false positives (transparent backgrounds on a dark theme, ratios 1.2 to 1.3), so none are reported. My own contrast check could not parse the oklab colors, so text contrast was judged by eye only.
- Touch targets were measured with Playwright using `hasTouch`, `isMobile` and `(pointer: coarse)` confirmed true. Sign-in worked in this run.
- The demo stack went down and was reseeded during the walk (about 10:56 PM), and the session had to be signed in again. Load times below may include load from other walkers.
- I uploaded two invented text files to the Data room to see upload and processing, then deleted both (confirm dialog seen).
- Not exercised: Refresh from Carta, Document date filter popup, drag and drop, 200% zoom, Data room stats and charts under touch emulation, real Box or Gmail import.

## Verdicts

| Page | 1440x900 | 375x812 | 1920x1080 |
|---|---|---|---|
| Data room list | Pass. One screen, list scrolls inside its panel. P3 notes only. | Pass. Folder picker, Filters toggle, compact rows. | Pass. |
| Data room grid | Pass. | Not captured. | Not captured. |
| Data room stats | Pass, strong. | Pass. | Not captured. |
| Data room folder, path bar, preview | Pass. | Not captured (preview sheet passed in iteration 7). | Not captured. |
| Data room upload and processing | Pass with P3 (toast covers controls). | Same. | Not captured. |
| Investors | Pass with P2 (disabled button, duplicate SAFE list). Page scrolls inside its own panel (1517 px of content in 824 px). | Pass. | P3: content capped at about 1025 px, 550 px empty on the right. |
| Contacts | Pass, excellent. | Pass, excellent. | Not captured. |
| Artifacts | Pass. P3 age alignment. | Pass, now a compact list. | Not captured. |
| Activity panel | Fail on fit (P2): chat list squeezed to nothing. Slow first load (P2). | Same. | Not captured. |
| Command palette | Pass, strong. | Pass, results slow to appear (P3). | Not captured. |
| Mail search results | Pass. Slow to load (P2, see V3-05). | Not captured. | Not captured. |

`pageScrollY` and `pageScrollX` were 0 on every page and viewport, including 1280x800. No horizontal overflow at 375.

## Findings

Severity: P0 blocks or misleads, P1 a person stumbles, P2 visibly below excellent, P3 polish. "Observed" means seen on screen or measured. "Suspected" means inferred.

| ID | Page | Sev | Cat | What happened vs expected | Evidence | Code (suspected) | Proposed fix |
|---|---|---|---|---|---|---|---|
| V3-01 | Activity (sidebar) | P2 | visual | Observed. With Activity open, the Activity block takes the middle of the sidebar and the chat list shrinks to its group header only: at 1440x900 and at 375x812 no chat row is visible, and the Activity list scrolls inside about 190 to 210 px (clientH 211, scrollH 324). Maya opens Activity and loses the list of her chats. Norm L1, D2, L7. | `/tmp/uxloop8/V3/activity-1440b.png`, `/tmp/uxloop8/V3/activity-375.png`, layout-audit scrollers | `apps/web/src/pages/ActivityList.tsx` and the sidebar layout in `pages/Shell.tsx` (suspected) | Give Activity a max height (about 40% of the sidebar) and keep at least three chat rows visible below it. |
| V3-02 | Activity (sidebar) | P3 | visual | Observed once at 375. A "Working" heading showed with no row under it (blank band before the divider). At 1440 the same heading had "Legal agent" under it, so this is a transient empty state. Norm I8. | `/tmp/uxloop8/V3/activity-375.png` | `ActivityList.tsx` section render (suspected) | Hide a section heading when it has no rows. |
| V3-03 | Activity (sidebar) | P2 | perf | Observed. After clicking Activity the sidebar showed grey skeleton rows for about 12 to 20 s before "Needs you" and "Working" appeared. Norm I2. Cause not determined; the stack was busy and had just been reseeded. | `/tmp/uxloop8/V3/activity-1440.png` (skeleton), `activity-1440b.png` (loaded) | not determined | Measure the Activity request on a quiet stack; if it is slow there, cache the last result and show it while refreshing. |
| V3-04 | Shell, Data room | P2 | perf | Observed. After a page reload the sidebar showed skeleton rows for 7.6 s on Data room and 2.2 s on Investors (two runs, shared stack). Contacts and Investors table skeletons were also seen for several seconds in earlier loads. Norm I2. | `/tmp/uxloop8/V3/tab-focus-1440.png` (sidebar still skeleton while the page is ready) | not determined | Same as V3-03; also render the page links (static) before the chat list data arrives. |
| V3-05 | Mail search results | P2 | perf | Observed. After Enter in the palette ("Search mail for halcyon"), the Inbox showed "Reading your mail…" with five empty bars for more than 4 s, and the results appeared by about 9 s. Norm I2. | `/tmp/uxloop8/V3/mailsearch-1440.png` (first capture was the loading state; loaded state captured after) | `apps/web/src/pages/Inbox.tsx` search (suspected) | Show results progressively, or add a time estimate once past 3 s. |
| V3-06 | Investors | P2 | flow | Observed. The "Draft reply" button in Action items was greyed out (opacity 0.5, `disabled`) at 375 with no label change or progress; later it was enabled again. The code disables it while `audit.drafting` is true. Maya sees a dead button and cannot tell the agent is working. Norm I2, I8. | `/tmp/uxloop8/V3/cap-375.png` (dimmed), `cap-carta-menu-1440.png` (enabled again) | `apps/web/src/components/investors/ActionItems.tsx:68-76` | Change the label to "Drafting…" with a spinner while `audit.drafting`. |
| V3-07 | Investors | P2 | flow | Observed. The four SAFE holders (Priya Placeholder, Lee Notarealperson, Sora Angel, Tomas Operator) appear twice: as SAFE rows in the Cap table card and again in the "SAFEs and funds" list below. The list rows also end in an unlabeled "—" and a "..." menu, and the list includes Dana Fakename and Jamie Placeholder, who have no SAFE row above. Maya cannot tell what the "—" is or why the lists differ. Norm C2, C4. | `/tmp/uxloop8/V3/cap-1440-bottom.png` | `apps/web/src/pages/Investors.tsx` (SAFEs and funds tab, around line 1240) and `pages/investors/` | Label the right-hand value in the list (for example the SAFE amount), or show only holders that are not already in the table. |
| V3-08 | Investors | P2 | flow | Observed. The header has "Add contact" next to "Ask". The Pass-5 decision says the Cap table header has only Ask. Contacts are now edited from the table rows, so the header button is a second path to the same thing. I am reporting a deviation from the decision, not re-opening it. Norm H5, C2. | `/tmp/uxloop8/V3/cap-1440.png` | `apps/web/src/pages/Investors.tsx:1037-1041` | Drop the header button, or confirm the decision was changed. |
| V3-09 | Investors | P3 | visual | Observed. Content is capped at `max-w-5xl` (about 1025 px). At 1920x1080 there is a 550 px empty band to the right of the cards and table; the two KPI cards fill only two thirds of the card width, and "Equity raised" shows a bare "—" with no reason (the code never counts SAFE money, `Investors.tsx:131`). Norm D2, L4, C4. | `/tmp/uxloop8/V3/cap-1920.png` | `Investors.tsx:310,1126,1240` (`max-w-5xl`); `Summary` at line 126 | Let the three cards share the full card width, and show "No priced round yet" or a tooltip instead of a bare dash. |
| V3-10 | Data room | P3 | copy | Observed before the reseed. After files were imported, a strip read "Imported 3 files" followed by two file names, and it stayed visible when moving to another folder and when the preview opened (it then wrapped to two lines). The count and the names disagree. Norm C2, C4. | `/tmp/uxloop8/V3/dr-folder-1440.png`, `dr-preview-1440.png` | `apps/web/src/components/data-room/format.ts:75` (`importedText`) and `pages/DataRoom.tsx` strip | List the names that match the count, or name only the count ("Imported 3 files") with a View link. |
| V3-11 | Data room | P3 | visual | Observed. The upload toast sits top right over the header controls. At 1440 it covers "Sort: Added" and the sort arrow; at 375 it covers the whole search and filter row while the upload runs (0% shown). It goes away by itself. Norm L3, L5. | `/tmp/uxloop8/V3/up-1.png`, `long-1440.png`, `long-375.png` | toast placement (suspected, toast viewport offset) | Place upload toasts at the bottom of the list panel. |
| V3-12 | Data room | P3 | visual | Observed. The Status column shows "—" for 63 of 67 ready files at 1440, so most of the column is a dash. At 375 the same files show "— · Oct 21, 2026" under the name for untyped files. Norm D5, H5. | `/tmp/uxloop8/V3/dr-1440.png`, `dr-375.png` | `apps/web/src/components/data-room/ItemRows.tsx` Status cell | Leave the cell empty for ready files, as only Reading and Failed need words. |
| V3-13 | Data room | P3 | visual | Observed at 375. The AI consent card ("Let Praci read your documents", Allow, Not now) takes about 95 px above the list and stays above the Stats view, where it is not relevant. Appears only while the setting is off, which is the state after the reseed. Norm D2, I5. | `/tmp/uxloop8/V3/dr-375.png`, `dr-stats-375.png` | `pages/DataRoom.tsx` consent card | Show the card only in List and Grid views, or collapse it to one line. |
| V3-14 | Artifacts | P3 | visual | Observed. In grid view the age ("5m ago", "just now") floats about 230 px from the card's left text edge and 50 px from the right edge, where the type label ("Doc", "Sheet") is right aligned. It lines up with neither edge. Norm H6. | `/tmp/uxloop8/V3/art-1440.png`, `activity-1440b.png` | `apps/web/src/pages/Artifacts.tsx` card footer | Left-align the age with the title, or right-align it with the type label. |
| V3-15 | Contacts, Investors | P3 | visual | Observed. "Add contact" is the white high-emphasis button on Contacts, where it is the main action, and an outline button on Investors. Same action, two weights. Norm H5, H1. This is fine if V3-08 removes the Investors button. | `/tmp/uxloop8/V3/contacts-1440.png`, `cap-1440.png` | `Contacts.tsx`, `Investors.tsx:1037` | Same variant on both, or remove from Investors. |
| V3-16 | Command palette | P3 | perf | Observed at 375. About 2 s after typing "bolt" only the input showed, with no loading hint; grouped results appeared about 3 s later. At 1440 results showed within 2 s. Norm I2. | `/tmp/uxloop8/V3/palette-375.png` (two captures) | search request in the palette (suspected) | Show a small spinner in the input after 300 ms. |
| V3-17 | Mail search results | P3 | copy | Observed. The row "Alex Firmware [MOCK] Firmware 2.4 release notes" matched "halcyon" but nothing visible says why, and matched words are not highlighted in rows (the palette does highlight). Norm C4, I6. | `/tmp/uxloop8/V3/mailsearch-1440.png` | Inbox search result row (suspected) | Underline the matched term and show the snippet that contains it. |

Resolved since iteration 7 (checked this run): clicking a cap table holder now opens "Edit contact" with the note "Contacts are your address book. They do not change Carta." (was a "Save as a contact" form); the table is capped in width and has a Total row; Artifacts at 375 is a compact list; the stuck "Reading for N min" row now says "Taking longer than usual" with a Try again button; the palette now has icons on every row, puts "Search mail for" first and uses a white bar for the active row; mail search hides the Important/Updates/Newsletters tabs and shows "4 results".

Touch (pointer: coarse, 375x812): Contacts and Investors had no visible target under 44 px. Artifacts titles are 20 px tall, but a tap 16 px below the title still opened the artifact, so the row is the target. Data room row checkboxes are 18x18, but taps 20 px away on every side still hit the checkbox, so the hit area is at least about 40 px. No valid touch finding.

## Excellent as is

- Data room upload path: a new file appears at the top of the list at once as "Reading", a toast shows the (long) name with a percentage, and within about 30 s it is typed ("Note", "Legal document"), filed into a folder and tagged with a party. Long names wrap to two lines with an ellipsis and the row grows without shifting columns (`up-1.png`, `tab-focus-1440.png`, `long-after-1440.png`).
- Data room delete confirmation names the full file and says "This can't be undone." (`del-confirm-1440.png`).
- Data room stats view: four KPI cards, a documents-by-date chart, ranked Types and Top parties bars; fits one screen and reads at a glance. "Read and searchable 97%" is clearer than the old wording (`dr-stats-1440.png`, `dr-stats-375.png`).
- Data room grid view: real page thumbnails, consistent card sizes, a Failed card with reason and Delete in place (`dr-grid-1440.png`).
- Failed and stuck rows: red "Failed" in words plus colour with a plain reason and Delete; stuck rows say "Taking longer than usual" with Try again (C3, I3).
- Data room 375 layout: folder dropdown with flattened paths, Filters toggle, compact rows (`dr-375.png`, `dr-filters-375.png`).
- Investors: a Total row (100.0%), a stacked ownership bar with a legend, an honest SAFE footnote in the figures, and an edit dialog with a clear Delete that is separate and not dominant (`cap-1440.png`, `cap-holder-1440.png`).
- Contacts: clean table, one search and one Kind filter, no wasted space at 1440 or 375 (`contacts-1440.png`, `contacts-375.png`).
- Artifacts at 375: dense, readable, one row per artifact with the whole row as the tap target (`art-375.png`).
- Command palette: instant at desktop, grouped, underlined matches, keyboard hint footer, white active bar instead of an accent colour (`palette-q-1440.png`).
- Keyboard: roving tab stop in the sidebar (only the current page is a tab stop), logical order through the Data room header, filters, folder tree and table, and a clear focus ring on the active row (`tab-focus-1440.png`).

## Raw measurements

- layout-audit: `pageScrollY` 0 and `pageScrollX` 0 on every page at 1280x800, 1440x900, 1920x1080 and 375x812. Inner scrollers: Data room list 781 px client and about 2960 px scroll at 1440; Investors main panel 824 and 1517 at 1440; Data room stats 781 and 960. Activity list 211 and 324 at 1440.
- geometry-audit: no horizontal overflow and no overflow spills on any page. "Uneven rows" reports were sidebar chat rows only (title and time on different widths), which is intended.
- Off-scale spacing values (6, 10, 11, 14, 18 px) appear on every page, as in iteration 7. No page was visibly worse for it.
- Load timings (shared stack, one run each): sidebar ready 7.6 s (Data room reload) and 2.2 s (Investors reload); Activity skeleton 12 to 20 s; mail search more than 4 s to first results.
