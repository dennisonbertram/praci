# Visual V2: Inbox, Finance, Legal, agent chat (iteration 20)

Target: mock-data demo stack (web :5381), user Maya Chen, Northwind Robotics. Viewports 1440x900, 375x812, 1920x1080 (shell). Dark theme. Layout and geometry audits were run on every page and state; screenshots are in /tmp/uxloop20/V2/.

Limits of this walk
- The demo stack went down for about 3 minutes mid-walk and came back reseeded (signed out, tour back, fresh data). Other walkers share the same user, so sidebar space sections, Legal consent and one Inbox mail approval changed under me. I did not report those as bugs.
- agent-browser cannot emulate `pointer: coarse` (the iPhone 16 device preset still reported coarse=false). I filed no touch-target findings. Code check: `apps/web/src/styles.css:88-115` raises every button, tab and `.rk-tap` link to 44 px on coarse pointers, so the 28-32 px sizes measured at 375 px width are expected to grow on a real phone. Unverified on a device.
- Contrast numbers from layout-audit.js (ratio 1.3 on sidebar text) are false positives: the script reads a transparent background. Visually the text is clearly legible.

## Verdicts

| Page | 1440x900 | 375x812 | 1920x1080 |
|---|---|---|---|
| Inbox (Important list, To do, Needs reply) | Good once sorted; first load shows no mail for about a minute (V2-01) | Good | Good |
| Inbox Updates tab, Filter menu, Has attachment filter | Good | not walked | not walked |
| Cleanup (empty) | Good, one-line reason shown | not walked | not walked |
| Thread dialog and attachment preview | Good, Escape returns focus to the attachment | Good, full screen | not walked |
| Finance overview | Good; one dead band after expanding Upcoming (V2-03) | Sync status row is broken (V2-02) | Good |
| Finance category page (Rent) | Good | not walked | not walked |
| Legal (Contracts, Deadlines) | Good | Good | not walked |
| Agent chat (Chief, Investor Relations, Finance helper) | Good | Good; approval toast sits above the composer as decided | not walked |
| Mail approval card in chat | not seen on desktop | Readable; Send looks disabled without a reason while sending (V2-05) | not walked |
| Sidebar and drawer | Section footer clips a row (V2-04) | Drawer good | Same clipping |

No page scroll at 1440x900 or 1920x1080 on any page (pageScrollY 0, pageScrollX 0 everywhere, including 375 wide). Long content scrolls inside `div.@container.rk-scroll`.

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| V2-01 | Inbox first load (STORY-INB-025) | P1 | flow | Observed: opening Inbox right after the demo was seeded showed only "Sorting your mail..." and five grey bars for over 35 s (screenshots at about 5 s, 17 s and 37 s are identical). The mail was already in the account (Updates tab, with its rows, opened instantly) and the sidebar said 14 unread. Rows with a stalled notice appeared only after about a minute. Expected: the Pass-10 rule, unsorted rows dimmed after 15 s. Maya sees an empty inbox with unread mail for a minute. | /tmp/uxloop20/V2/inbox-1440.png, inbox-1440b.png, inbox-1440c.png | `apps/web/src/pages/Inbox.tsx:124-125` (6 polls x 5 s), `:520-535` (one silent restart, then stalled), `:772` (rows hidden until `stalled`) | Show the unsorted rows dimmed under the "Sorting your mail..." line after 15 s instead of waiting for two 30 s poll rounds. |
| V2-02 | Finance, phone (STORY-FIN) | P2 | visual | Observed: in the header status row the Space name is cut ("Northwind ..."), "synced just now" is cut to "synced j...", and "1 non-USD transaction not counted" wraps to three lines in a narrow column. The sync state is unreadable (C3, C4, L6). Desktop shows the same row on one line. | /tmp/uxloop20/V2/m-fin.png | `apps/web/src/pages/Finance.tsx:404-433` (status line in the header flex row) | On narrow widths drop the status row under the title as its own full-width line, and wrap the non-USD note there; keep only the refresh icon beside the title. |
| V2-03 | Finance overview, desktop | P2 | visual | Observed: "Show all 16" on Upcoming grows that card by about 330 px; the Breakdown card beside it stretches to match and shows a 400 px empty band under "Meals" (D2, L5). Collapsing restores the layout. | /tmp/uxloop20/V2/fin-upcoming.png (compare fin-1440.png) | Finance.tsx grid row that holds Breakdown and Upcoming (items stretch by default) | Align the two cards to the top (`items-start`) so Breakdown keeps its natural height. |
| V2-04 | Sidebar, all pages, desktop | P2 | visual | Observed: the Spaces list is capped; the last visible section is cut through the middle (a "RECONNECT NEEDED" header at y=753 half hidden, or a row sliver above "+1 more"), with a pinned "+N more" footer. At 1920x1080 three space headers appear (two with no rows) and "+1 more" under a half-visible row. Looks like a rendering fault, and the hidden rows are only reachable by scrolling a small area (D2, L5). Note: the extra spaces were created by other walkers, so this is the multi-space case. | /tmp/uxloop20/V2/fin-1440.png, kb-focus.png, w-fin.png | sidebar space list container (`rk-scroll rk-scroll-fade-y`, clientH 384 vs scrollH 413-469) | Cap the list at whole rows (or snap the scroll to row edges) and fold empty spaces into the "+N more" line instead of showing bare headers. Mark as suspected design intent if the cap is deliberate. |
| V2-05 | Mail approval card in chat | P3 | flow | Suspected (seen once, while another walker clicked Send): the Send button was disabled at half opacity with the label still "Send" and no reason or progress text. Expected a "Sending..." label (I2, I8). The card then collapsed to "Mail Sent". Not reproduced by me because the thread belonged to another walker. | /tmp/uxloop20/V2/m-approval.png (disabled state read through the DOM), m-approval2.png (after) | mail approval card component in `apps/web/src/components/EmailCards.tsx` (suspected) | Change the label to "Sending..." while the request is in flight. |
| V2-06 | Finance category page (Rent) | P3 | copy | Observed: "Oct 1 - 22" appears twice (headline card and Transactions title), and the "Monthly spend" chart covers Apr-Sep, so the current month in the headline is not in the chart (C2). | /tmp/uxloop20/V2/fin-rent.png | `apps/web/src/pages/finance/FinanceSpend.tsx` | Drop the repeated period from the Transactions title, or include the current month as a partial bar. |
| V2-07 | Inbox To do card and row hover tools, desktop | P3 | a11y | Observed: To do checkboxes measure 16x16, "Send the MAC addresses to Sam" title button 213x22, hover row icons about 12 px. Below the 24 px pointer minimum (I4). Coarse-pointer CSS covers phones. | /tmp/uxloop20/V2/inbox-imp.layout.json (smallTargets) | `apps/web/src/pages/Inbox.tsx` To do card and row toolbar | Give the checkbox a 24 px hit area (as `ui-web` does on touch) and widen the row-tool buttons to 24 px. |

## Excellent as is

- Cleanup empty state: one line says why it is empty and offers "Open Newsletters" (Pass-17 decision met).
- Inbox list rows: 57 px, one line, sender/subject/time in aligned columns, unread dot, hover tools that do not shift layout; phone version keeps the same structure with a "..." menu.
- Thread dialog: title, sender, Reply/Archive/Ask agent in one row, attachment chip with size and menu. Preview offers "Add to Data room" and "Download". Escape closes the preview and returns focus to the attachment; no dialog stays open after a second Escape.
- Keyboard: Skip to content first, logical tab order through sidebar then page controls, visible ring, tooltips on icon buttons (Compose).
- Finance: five stat cards at a glance, one clear range control, chart and tables fit 1440x900 with the content area scrolling inside; category page is clean. Phone version stacks cards well and lists keep 18+ px rows with chevrons.
- Server failure on the Rent page during the outage: "Could not reach the server" with a "Try again" button next to a working back button; the app recovered after sign-in.
- Legal: consent card with Allow / Not now above the tabs, contracts table fits one screen, deadlines list with plain overdue wording ("Overdue by 5 days") and Done / Dismiss; phone version drops the table for a readable list and shows "Scanning..." as a disabled state.
- Agent chat: grouped bubbles, bot-color identity, pinned composer, ask-user card with two clear options, approval toast bottom-right on desktop and above the composer on phone, "Needs your answer" and "Working..." shown in words in the sidebar.
- 375 px shell: no horizontal scroll anywhere; drawer is complete and tidy.
