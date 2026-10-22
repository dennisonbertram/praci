# Walk J3 (iteration 19): phone width 375x812, touch emulated

Target: demo stack web :5381 as the seeded mock founder. Browser session uxl19-J3. The browser was set to 375x812 with CDP touch emulation (`matchMedia('(pointer: coarse)')` was true, `maxTouchPoints` 5), so touch-target numbers are valid. Screenshots: /tmp/uxloop19/J3/. The geometry audit ran on sign-in, Chief, Inbox, Finance, Data room, the approval chat and Settings; the touch-target script (every visible link/button/input under 44 px) ran on each screen.

## Story verdicts

| Story | Verdict | Steps actual/ideal |
|---|---|---|
| Sign-in on a phone (welcome, Sign in, form) | PASS. Inputs 48 px, Show password 44, Forgot password 118x44, Sign in 44. No overflow. | 4/4 |
| Sidebar drawer (open, open page, account menu) | PASS with one P3 (J3-03). Rows and menu items all 44+ px. | 2/2 |
| Inbox triage (list, open mail, Archive, Undo) | PASS. Rows, row checkboxes, More, tabs, "Show 19 more" all 44 px. Archive toast with Undo sits at the bottom. | 4/4 |
| Finance overview (chart, breakdown, upcoming) | PASS with one P2 (J3-01). Month targets in the chart are 44x128. | 3/3 |
| Data room browse and preview | PASS with one P3 (J3-02). | 3/3 |
| Agent chat with an approval (new bot, ask to email, toast, card, Send) | PASS. Toast names the recipient; card buttons are 44 px; card collapses to "Sending..." after Send. | 8/6 (new-bot setup is 3 of the 8) |
| Settings (General, Privacy and approvals, Models, Memory) | PASS. Switch rows are 277x44 hit areas; no overflow. | 3/3 |

Browser console: only Vite debug lines. No page errors.

## Findings

| id | page | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| J3-01 | Finance header, phone | P2 | visual | OBSERVED. The sticky header is 128 px tall, about 16% of an 812 px screen, and stays pinned while the page scrolls. Its status line is cramped: "Northwind ..." and "synced j..." are cut off, and "· 1 non-USD transaction not counted" wraps to three lines and starts with a stray bullet. Expected: one short line, or a header that gives the space back on scroll. | 08-finance.png, 09-finance2.png, 10-chart.png (header same height at scroll 300 and 700) | `apps/web/src/pages/Finance.tsx:412` (sticky wrapper), the status row inside it | On phones put the source, sync time and non-USD note on one wrapping line below the title (or hide them in the "..." and show only when non-zero), and do not keep that row sticky. |
| J3-02 | Data room preview dialog | P3 | flow | OBSERVED. The preview shows Open and Download twice: as toolbar icons (Open in new tab, Download) and as labelled buttons in the body. A first-time user sees two controls for each action. | 12-preview.png | `apps/web/src/components/data-room/PreviewActions.tsx` and the preview header | Keep the labelled buttons on phones and drop the duplicate toolbar icons (or the reverse). |
| J3-03 | Sidebar drawer, phone | P3 | visual | OBSERVED. With 9 page rows and a few bots, only about 2 chats (Chief and one more) are visible above Integrations and the account row, and the second row is partly faded. The chat list scrolls, but nothing hints at more below the fade. The Pages section can be collapsed, which fixes it for users who know that. | 04-drawer.png, 13-create.png, 24-drawer2.png | sidebar layout in the Shell/Sidebar component (not traced) | Start the Pages section collapsed on phones when the user has more than a few chats, or reduce page row height to 40 px on phones while keeping a 44 px hit area. |

## Praise (observed)

- All measured touch targets at phone width are 44 px or more across sign-in, drawer, Inbox, Finance, Data room, approval card and Settings. The Settings switches are small (32x18), but each sits in a 277x44 labelled row, so the whole row is the target.
- The mail approval toast now names the recipient ("Review before sending email to Sam Ortiz <...>"), sits above the composer, and opens the card on tap. This fixes last pass's J3-04 complaint about an unrelated subject. The composer says "Waiting for approval", then "Needs your answer".
- The approval card is full width with Send, Discard and Edit at 44 px high, and it collapses to a "Sending..." row after Send.
- The Finance chart has 44 px wide month targets and the breakdown rows link through to categories.
- No horizontal page overflow on any screen visited (`pageOverflowX` 0).

## Not covered / notes

- Geometry audit `unevenRows` and `overflowSpills` (16 px) were reported on Chief, Inbox and Data room, but they were icon-plus-label rows and container padding. The screenshots show nothing wrong, so none is a finding.
- A bar in the Finance breakdown looked wider than its track in one screenshot, but the DOM widths were correct (Rent 315/315, Servers 303/315), so I treated it as an emulation artefact and did not report it.
- Not walked: Cleanup screen, Updates/Newsletters tabs, mail Reply composer on a phone, the Legal/Investors/Fundraising pages, and the first-run tour. The Ask agent in an open email was only seen as a button.
- I sent one mock email to Sam Ortiz (emulated Gmail) from my own bot thread "J3 phone walker" and archived then undid one Inbox message. I opened the preview of one Data room file. Nothing was deleted.
