# Walk J3: phone width (375x812) sweep

Session uxl9-J3, demo stack (web 5381), signed in as the seeded mock founder. Screenshots: /tmp/uxloop9/J3/.

Method: agent-browser with the iPhone 15 user agent, viewport 375x812, and CDP `pointer: coarse` + touch points emulation (confirmed `matchMedia('(pointer: coarse)')` true, maxTouchPoints 5). Touch targets measured with that emulation. The geometry audit and a 44px target script were run on each screen. No horizontal page overflow on any screen (pageOverflowX 0). The demo user is shared, so another walker was driving the Mercury agent chat at the same time.

## Story verdicts

| Story / journey | Verdict | Steps actual/ideal |
|---|---|---|
| Sign-in at phone width (page) | PASS | 4/3 (landing "Sign in" link, email, password, submit); form is clean, targets >= 44 |
| Sidebar drawer (STORY-APP-009 area) | PASS | 2/2; every row 44-70px tall, close X present, badges visible |
| Inbox triage: STORY-INB-031 | PASS with findings | 6/7; More menu items 44px, archive gives Undo toast; message opens full screen with Reply, Archive, Ask agent. A late layout shift sent one tap to the wrong message (J3-03) |
| Email agent panel + held Mail card (Draft a reply) | PASS | 3/3; Send and Discard are 44px; could not complete Send (my script clicked the wrong element), so the sent state is unverified |
| Finance overview | PASS with findings | 2/2; no overflow, all buttons 44px |
| Data room browse and preview | PARTIAL | 4/4; list and metadata preview good, "Full screen" does not enlarge the PDF (J3-02) |
| Agent chat with approval (Mercury agent "Send $1,200") | PARTIAL | 2/2; card clear and Allow once / Deny stacked full width. The pending card turned to Denied before I tapped (another walker was driving that chat), so the approve outcome is UNVERIFIED |
| Settings (General, Privacy and approvals, Models, Memory, Voice) | PASS | 4/4; switches 32x18 visually but a 44px hit area (measured by hit testing) |
| Command palette from the drawer Search | FAIL (minor) | see J3-01 |

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| J3-01 | Drawer Search, palette | P2 | flow | OBSERVED: tapping Search in the phone drawer opens the palette, but document.activeElement stays the drawer's own Search input, so typing goes nowhere until the user taps the palette field again. Expected: palette input focused (keyboard opens). | 29-search.png, 30-search2.png, activeElement check | apps/web/src/pages/shell/command-palette.tsx:396 (autoFocus) vs the drawer's focus handling in Shell.tsx | Close the drawer before opening the palette, or restore focus to the palette input after it mounts. |
| J3-02 | Data room preview | P2 | flow | OBSERVED: "Full screen" on a phone gives a dialog of the same size. The PDF stays page-width, text is about 7px and unreadable, no zoom. A "Open in new tab" tooltip also stays stuck after the tap. | 19-preview.png vs 20-expanded.png | apps/web/src/components/data-room/PreviewActions.tsx:142 and the Preview dialog | On phone, make Full screen fill the viewport and fit PDF width to it with pinch zoom, or open the native viewer. |
| J3-03 | Inbox (STORY-INB-031) | P2 | bug | OBSERVED once: after archiving, a To do card (two items, "3 more") was inserted above the list about ten seconds later and moved rows down about 260px; my tap landed on a different message (Legal notice instead of Morgan Pretend). On a fresh reload the shift is only about 20px. SUSPECTED: To do card renders after its query, pushing the list. | 07/08 screenshots, 05-inbox vs later inbox | apps/web/src/pages/Inbox.tsx (To do card) | Reserve the card's space or render it with the list; do not insert above rows the user may be tapping. |
| J3-04 | Email agent, notifications | P3 | visual | OBSERVED: the "needs approval" toast sits on top of the held Mail card header and stayed more than 25 seconds (still "just now"), while the same approval is already on screen. | 10-draft.png, 11-draft-card.png | toast for approvals in the app shell | Do not toast an approval already visible in the open chat, or auto-dismiss it. |
| J3-05 | Finance burn chart | P3 | a11y | OBSERVED: the month columns of the chart are 22px wide (22x134 to 24x153) as tap targets under touch emulation. | targets script on 16-finance.png | apps/web/src/pages/Finance.tsx (burn chart) | Use a tap-to-select on the whole chart width, or widen to 44px. |
| J3-06 | Finance header | P3 | visual | OBSERVED: space name is cut to "Northwind Ro..." while the sync status ("Mercury, Brex . synced just now") takes the rest of the row. | 16-finance.png | apps/web/src/pages/Finance.tsx (header row) | Let the sync status shrink or move below. |
| J3-07 | Finance Subscriptions | P3 | visual | OBSERVED: column header "Per month" wraps to two lines at 375px. | 17-fin-1800.png | apps/web/src/pages/Finance.tsx:955 | Use "Monthly" or nowrap. |
| J3-08 | Data room toolbar | P3 | visual | OBSERVED: list/grid/stats toggles wrap onto their own row, right aligned, leaving the left blank under the folder and wand icons. | 18-dataroom.png | data room page header | Put the view toggles in the same row or overflow them into the filters menu. |
| J3-09 | Email agent chat | P3 | visual | OBSERVED: tool rows under "Working... . 3 tools" truncate to "Mail sea..." and "Mail sen..." with ample width; the label wraps over two lines. | 11-draft-card.png | tool-activity row in chat | Allow the tool name to use the full row. |
| J3-10 | Settings sections | P3 | visual | OBSERVED: Models, Memory and Voice intro text starts about 6px under the header divider, while General cards start 20px below; Models also has a large blank gap before "Providers". | 28-Models.png, 28-Memory.png vs 25-settings.png | account settings overlay section wrappers | Use the same top padding in every section. |
| J3-11 | Approval card details | P3 | visual | OBSERVED: expanded Details shows blank lines above "Amount". | 23-details.png | approval card details block | Trim leading blank lines in the details text. |
| J3-12 | Agent chat load | P3 | perf | OBSERVED: Investor Relations chat showed grey skeleton bubbles for about 3.5 seconds on the demo. Not measured with throttling. | 14-ir-chat.png (before and after) | chat history fetch | Not blocking; check the history query time. |

## Praise
- Touch targets: with pointer: coarse, the drawer rows, message actions, Inbox menus, Finance buttons, data room toolbar, preview header and Settings controls are all 44px or larger, apart from J3-05.
- No horizontal overflow on sign-in, Chief, Inbox, message, Finance, Data room, preview or Settings.
- The phone Inbox (pile tabs, always-visible More, Undo toast), the full-screen message and the email agent panel read well.
- The failed data room file says "This file isn't a readable PDF." with a Delete button next to it.
- The approval card (Mercury) is clear: the sentence, Details, then full-width Allow once and Deny.

## Not verified
- Sending the held reply and approving the Mercury payment (shared demo state; see table).
- Real on-screen keyboard behaviour (palette position, composer) cannot be seen in headless Chromium.
- Stories needing Docker/OAuth: none were needed.
