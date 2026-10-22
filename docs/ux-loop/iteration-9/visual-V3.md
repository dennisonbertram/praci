# Visual inspection V3 (iteration 9)

Session uxl9-V3. Target: mock-data demo stack only (web port 5381, signed in as the seeded mock founder). Pages: Data room (list, grid, stats, folder tree, path bar, preview, add menu, filters), Investors, Contacts, Artifacts, Activity (sidebar), command palette (Cmd+K), mail search results.
Viewports: 1440x900 and 375x812 for every page; 1920x1080 and 1280x800 for the shell (Data room, Investors, Contacts, Artifacts). Screenshots: `/tmp/uxloop9/V3/`.

Method and limits:
- `layout-audit.js` and `geometry-audit.js` ran on each capture (`*.layout.json`, `*.geo.json`). `pageScrollY` and `pageScrollX` were 0 on every page at all four viewports.
- Touch targets were measured with Playwright (`hasTouch`, `isMobile`, `(pointer: coarse)` confirmed true) at 375x812 on Data room, Investors, Contacts, Artifacts. agent-browser has no 375x812 touch device, so its 375 captures are visual only.
- The stack was busy (other walkers) and the session was signed out once mid-walk; I signed in again. Load times below include that load.
- A sidebar "Hide sidebar" click by me left the persisted rail mode on for a few captures (`data-room-1280.png`, `investors-1920.png` first run). That was my action, not a bug; the rail layout is judged in V3-11 only.
- Not exercised: drag and drop, upload (no new data written by me), Refresh from Carta, Document date popup, 200% zoom, real keyboard overlay on a phone.

## Verdicts

| Page | 1440x900 | 375x812 | 1920x1080 / 1280x800 |
|---|---|---|---|
| Data room list | Pass. One screen, list scrolls in its panel. P3 notes (V3-12, V3-13). | Pass. Two control rows, compact rows. | Pass. |
| Data room grid | Pass with P3 (V3-06). | P2: cards about 305 px tall (V3-05). | Pass, 9 columns at 1920. |
| Data room stats | Pass, strong (after a 3 to 8 s skeleton, V3-04). | Pass. | Not captured. |
| Data room folder, path bar, preview | Pass. P3 breadcrumb size (V3-12). | Not captured (sheet passed in iteration 8). | Not captured. |
| Investors | Pass with P2 (V3-03 empty Updates card). Scrolls inside its panel (1805 px in 824 px). | Pass. | P3: table stretches to 1810 px at 1920 (V3-08). |
| Contacts | Pass, excellent. | Pass, excellent. | Pass. |
| Artifacts | Pass, age now right aligned. | Pass, dense list. | Pass. |
| Activity (sidebar) | P2: Pages list squeezed to 144 px (V3-01). | P2: chat list gone, empty "Working" (V3-01, V3-02). | Not captured. |
| Command palette | Pass, strong. P3 (V3-14). | Pass, spinner now shown while searching. P3 (V3-14). | Not captured. |
| Mail search results | Pass, fast on this run. P3 (V3-15). | Not captured. | Not captured. |

## Findings

Severity: P0 blocks or misleads, P1 a person stumbles, P2 visibly below excellent, P3 polish. Observed means seen or measured on screen. Suspected means inferred from code.

| ID | Page | Sev | Cat | What happened vs expected | Evidence | Code (suspected) | Proposed fix |
|---|---|---|---|---|---|---|---|
| V3-01 | Activity (sidebar) | P2 | visual | Observed. Turning Activity on caps the Pages group at 16vh. At 1440x900 the group is 143 px tall and shows 2.5 of 8 pages ("Legal" is cut in half); Investors, Contacts, Data room and Artifacts need scrolling inside that small window. At 375 the Activity block takes the drawer and the chat list shrinks to its group header (no chat row visible). Norm L7, I6. | `/tmp/uxloop9/V3/activity-1440.png`, `activity-375.png`; scroller client 143 / scroll 374 | `apps/web/src/pages/Shell.tsx:4391` (`lg:max-h-[16vh]` when `activityMode`) | Keep Pages at its normal height and let the Activity list take the remaining space (or collapse Pages to the page icons) while Activity is open. |
| V3-02 | Activity (sidebar) | P3 | visual | Observed at 375. A "Working" heading showed with no row under it, leaving a blank band before the divider (also seen in iteration 8). The 1440 capture had "Finance helper (mock)" under the same heading. Norm I8. | `/tmp/uxloop9/V3/activity-375.png` | `apps/web/src/pages/ActivityList.tsx` | Hide the heading when its list is empty. |
| V3-03 | Investors | P2 | flow | Observed. The Updates card shows two grey ghost rows with a "New update" button and no words, for more than 25 s. The `investors/updates` call had returned an empty list immediately (checked with a fetch), so this is the empty state, and it looks like content that never finishes loading. Maya cannot tell "no updates yet" from "still loading". Norm I8, C3. | `/tmp/uxloop9/V3/investors-bottom2-1440.png`, `investors-bottom-375.png` | `apps/web/src/pages/Investors.tsx:384-389` (`updates.length === 0` renders two `UpdateRowPlaceholder`); `apps/web/src/components/investors/Placeholders.tsx` | Replace the ghost rows with one line such as "No updates yet" next to the New update button, or keep the ghost rows and add that line. |
| V3-04 | All four pages | P2 | perf | Observed. Cold opens were slow and uneven on a shared stack: Artifacts "Still opening... Try again" after 41 s, 49 s and 57 s in three of five opens (3 s in the others); Data room 2 to 17 s; Investors and Contacts 27 to 33 s once; Data room Stats showed a skeleton for more than 3 s and about 8 s. Mail search was 1 s. The cause is not determined (other walkers were using the stack), so treat as unconfirmed until measured on an idle stack. The wording "Still opening... / Try again" is clear. Norm I2. | `/tmp/uxloop9/V3/artifacts-375.png`, `artifacts-1920.png`, `dr-stats-1440.png` | not located | Measure sidebar and page data requests on an idle stack; if still above 3 s, load page data in parallel with the sidebar instead of after it. |
| V3-05 | Data room grid | P2 | visual | Observed at 375. Grid cards are about 305 px tall and two across, so a screen shows about 2 cards. Text-file cards put a few tiny lines of preview at the top and leave about 100 px of empty space above the name. The list shows 8 files in the same height. Norm D2, D5, L5. | `/tmp/uxloop9/V3/dr-grid-375.png` | `apps/web/src/components/data-room/` grid card (fixed thumbnail aspect) | Use a shorter thumbnail (landscape ratio) and fit text cards to their content on phone widths, or default phones to the list view. |
| V3-06 | Data room grid | P3 | visual | Observed at all widths. The "..." menu button sits on top of the first preview line of text files ("Invented note a for Northw..."), clipping the text. PDF previews put the button on a dark chip, so those are fine. Norm H6. | `/tmp/uxloop9/V3/dr-grid-1440.png`, `dr-grid-375.png` | data room grid card | Give text previews a top padding equal to the button row, or use the same dark chip. |
| V3-07 | Data room | P3 | visual | Observed. The Parties column truncates names ("Halcyon Logistics (...", "Placeholder Street ...") while the Status column to its right is empty for ready files, so the column to the right wastes about 110 px. Norm D2, C4. The full name is in the hover title (checked). | `/tmp/uxloop9/V3/dr-folder-1440.png` | `apps/web/src/components/data-room/` list columns | Give Status a narrow fixed width, or hide it when no row in view needs it. |
| V3-08 | Investors | P3 | visual | Observed. At 1920x1080 the cap table now fills 1810 px. Holder is at the left and Security starts about 1000 px later, so the eye loses its row; the two KPI cards are 880 px wide for one number each. At 1440 it reads well. Norm H6, D1. | `/tmp/uxloop9/V3/investors-1920.png` | `apps/web/src/components/cap-table/CapTableEditor.tsx:274` (`@lg:grid-cols-[minmax(0,1fr)_9rem_...]`) and the page container | Cap the table card at about 1100 px, as iteration 8 did, or add a faint row hover line across the row. |
| V3-09 | Investors | P3 | copy | Observed. "Equity raised" shows a bare "—" with no reason, and the SAFEs and funds list ends rows with an unlabeled "—" (only Priya's row says "Invited Oct 22"). The Action items card has a brighter outline than the cards below it with no stated reason. Norm C3, H5. Carried from iteration 8 (V3-07, V3-09). | `/tmp/uxloop9/V3/investors-1440.png`, `investors-bottom-1440.png` | `apps/web/src/pages/Investors.tsx` | Show "No priced round yet" under the dash; label the right column of the contacts list or drop the dash; use the normal border on Action items. |
| V3-10 | Investors | P3 | flow | Observed once. "Draft reply" in Action items was greyed out at 375 with no label change; it was enabled when I looked again. It is disabled while the agent drafts. Norm I2, C3. | first `investors-375.png` capture | `apps/web/src/pages/Investors.tsx` (`audit.drafting`) | Change the label to "Drafting..." while disabled. |
| V3-11 | Shell, rail mode | P3 | visual | Observed at 1280 and 1920 with the sidebar collapsed to the icon rail. A 56 px top band holds only the sidebar toggle, and the page header sits about 56 px lower than with the full sidebar (Investors title at y=96 instead of 40), so each page loses about 56 px of height. Bot avatars in the rail have no visible labels; I did not check their accessible names. Norm D2, A2 (unverified). | `/tmp/uxloop9/V3/data-room-1920.png` (rail), `data-room-1280.png` | `apps/web/src/pages/Shell.tsx` rail layout | Put the toggle in the rail and start the page header at the top, as in the full sidebar layout. |
| V3-12 | Data room | P3 | a11y | Observed with `layout-audit.js`. The breadcrumb buttons in the path bar ("All items" 47x16, "Legal" 30x16) are under the 24 px target norm on desktop. Under touch emulation no target on any of the four pages was under 44 px except the Artifacts title links (20 px tall), where the whole row is the tap target (observed in iteration 8, not re-tapped). Norm I4. | `/tmp/uxloop9/V3/dr-preview-1440.layout.json`; `/tmp/uxloop9/V3/pw/touch.mjs` output | data room path bar | Pad the breadcrumb buttons to 24 px tall. |
| V3-13 | Data room | P3 | copy | Observed. The Status column in the list is empty for ready files (header "Status", no dash now), so only Reading and Failed rows have anything in it. Norm D2. Same fix as V3-07. | `/tmp/uxloop9/V3/data-room-1440.png` | list columns | See V3-07. |
| V3-14 | Command palette | P3 | visual | Observed. The empty palette lists 7 of 8 pages; Artifacts is hidden under the list with no scroll cue, at 1440 and 375. At 375, results for "bolt" took several seconds on the busy stack and a spinner showed (better than iteration 8, which showed nothing). The box sits mid-screen at 375; whether the on-screen keyboard covers it was not tested. Norm I6, I2. | `/tmp/uxloop9/V3/pal-empty-1440.png`, `pal-empty-375.png`, `pal-q-375.png` | palette list max height | Fit all pages (or add a fade at the bottom edge); anchor the phone palette near the top. |
| V3-15 | Mail search | P3 | copy | Observed. "Alex Firmware: Firmware 2.4 release notes" matched "halcyon" with no visible reason, and matched words are not highlighted in rows (the palette does). Norm C4. Carried (iteration 8 V3-17). | `/tmp/uxloop9/V3/mailsearch-1440.png` | Inbox search results row | Highlight the match or show the matching snippet. |
| V3-16 | Sidebar (all pages) | P3 | visual | Observed. On Contacts the "Investor Relations (mock)" row wraps to two lines and a small green flag glyph sits beside the time, lower than the time text, next to the unread dot. Meaning of the flag is not stated. Norm H6, C3. | `/tmp/uxloop9/V3/contacts-1440.png`, crop `crop-side.png` | sidebar chat row | Align the flag with the time and give it a label, or drop it. |
| V3-17 | Sidebar (all pages) | P3 | bug | Observed. A bot created by another walker is listed as "Ops WeeklyOps Weekly" (name and title run together without a space). Out of my pages, and I do not know how it was created. Suspected: a name plus title concatenation in the row label. | `/tmp/uxloop9/V3/investors-1920.png` | sidebar chat row label | Show the bot name only (titles are removed from bot settings). |

## Resolved since iteration 8 (checked this run)

- Artifacts grid: the age is now right aligned at the card bottom, in line with the type label (was V3-14).
- Investors: the duplicate SAFE list is gone; the cap table shows SAFEs, and "SAFEs, if converted at cap" is a separate small summary; the page now has Updates and a Contacts card with the "SAFEs and funds" and "Board" tabs.
- The palette at 375 shows a spinner while searching (was V3-16).
- Mail search from the palette landed on `/app/inbox?q=...` with "4 results" for "halcyon" and an empty state with Clear for a nonsense query.
- Edit contact from an Investors holder row says "Contacts are your address book. They do not change Carta."

## Excellent as is

- Contacts at 1440 and 375: one search, one Kind filter, clean table, dialog with labeled fields, Save disabled until a name exists, Delete separated from Cancel and Save (`contacts-1440.png`, `contacts-add-1440.png`, `contacts-375.png`).
- Data room stats: four KPI cards, a documents-by-date chart, ranked bars; fits one screen at 1440 and reads at 375 (`dr-stats-1440.png`, `dr-stats-375.png`).
- Data room list and preview: clear path bar, labeled icon buttons in the preview toolbar (Open in new tab, Download, Full screen, More, Close), truncated cells carry the full text in their title, failed rows say what happened in words and offer Delete, stuck rows say "Taking longer than usual" with Try again.
- Data room grid with real page thumbnails and a Failed card with reason (`data-room-1920.png`).
- Data room 375: folder dropdown, Filters toggle, two compact control rows, compact rows (`dr-375.png`).
- Command palette at 1440: grouped results (Mail, Contacts, Documents, Chats), underlined matches, a "Search mail for..." fallback that always offers the next step, keyboard hints.
- Keyboard: Tab order through the Data room is logical (view toggles, Add files, Ask, search, filters, sort, folder tree, table) with a visible ring on each stop (`tab-focus-1440.png`).
- Activity block content: "Needs you" first with amber "Needs your answer" in words, then "Working", finished runs folded behind a count (`activity-1440.png`).
- Investors edit dialog and ownership bar with legend and Total row (`cap-holder-1440.png`, `investors-1440.png`).
- Artifacts at 375: one dense row per artifact, whole row tappable.

## Raw measurements

- `pageScrollY` 0, `pageScrollX` 0 on every page at 1280x800, 1440x900, 1920x1080 and 375x812.
- Inner scrollers at 1440: Data room list 781 px client, about 2955 px scroll; Investors main panel 824 and 1805; sidebar Pages group 143 and 374 with Activity on.
- Touch (Playwright, pointer coarse true, 375x812): Data room 0, Investors 0, Contacts 0 visible targets under 44 px (excluding 1 px hidden inputs and skip link); Artifacts 10 title links 20 px tall, rows are the targets.
- Load timings (busy shared stack, one run each): Data room 2, 4, 5, 10 and 17 s; Artifacts 1, 3, 41, 49 and 57 s; Investors 1 to 4 s and once 27 s; Contacts 0 to 2 s and once 33 s; Stats skeleton up to 8 s; Activity skeleton under 2 s; mail search 1 s.
