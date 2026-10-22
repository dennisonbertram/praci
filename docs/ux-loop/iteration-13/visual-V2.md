# Visual inspection V2 (Inbox, Finance, Legal, agent chat, artifacts)

Session uxl13-V2, demo stack (web 5381), signed in as the seeded mock founder. Screenshots are in `/tmp/uxloop13/V2/`.
Viewports: 1440x900 (all pages), 375x812 (Inbox, thread, attachment, email agent, Finance, Legal, chat, drawer), 1920x1080 (Inbox and Finance shell), 720x450 (200 percent zoom check on Inbox).

## Method limits

- Touch emulation was not available: `agent-browser set device` did not switch `pointer: coarse` on (it stayed false). No touch-target findings are made. Sizes below are desktop measurements only.
- The demo account is shared with other walkers. Other walkers changed state while I worked: they allowed AI sorting in Inbox, created bots ("Cash Watcher J2", "New Bot", "Empty space" Space), sent a mock reply, filed a $1,200 Mercury request and turned Hide amounts on. I turned Hide amounts back to Show on Finance to read the figures. I created one fresh bot thread ("New Bot", 6:16) and one email-agent draft on the Halcyon questionnaire mail (not sent).
- Populated Cleanup was not observed (demo shows "Nothing to clean up").
- The layout-audit contrast check reports ratios of about 1.3 for nearly all dark-theme text. These are false positives (background detection), so no contrast finding is made from the script. Rendered text was legible in every screenshot.

## Verdicts

| Page / state | 1440x900 | 375x812 | Notes |
|---|---|---|---|
| Inbox, before sorting (consent card) | Pass | not captured | One card, two buttons. List fits; main column scrolls inside (page scroll 0). |
| Inbox, first sort | n/a | Pass | 7 s skeleton, then rows with "Sorting your mail..." and dimmed rows (matches the 15 s rule in Inbox.tsx:761). |
| Inbox, sorted (To do, Needs reply, Show N more, Other mail, Earlier) | Pass | Pass | 5 rows then "Show 14 more". Hover swaps the dot for a checkbox and the date for actions. |
| Updates / Newsletters / Digest | Pass | not captured | Clean. Digest is a pressed toggle. |
| Thread dialog + attachment preview | Pass | Pass | Focus returns to the attachment chip on Escape. |
| Email agent panel + Mail approval card | Pass | Pass | Full-screen swap with a back arrow on phone. |
| Cleanup (empty) | Pass | not captured | Compact empty state. |
| Compose | Pass | not captured | |
| Finance overview | Needs work (V2-01, V2-03) | Pass | Fits one screen with inner scroll. Breakdown card has a dead band. |
| Finance Accounts | Pass | not captured | |
| Finance account detail | Needs work (V2-02) | not captured | |
| Legal Contracts | Pass with P3 (V2-04) | Pass with P3 (V2-08) | |
| Legal Deadlines / Graph | Pass | not captured | Graph labels are 11 px (V2-07). |
| Artifacts grid and viewer | Pass | not captured | |
| Agent chat (Chief, new bot, settings) | Pass | Pass | Settings panel is full screen on phone. |
| Sidebar drawer | n/a | Pass | |
| 1920x1080 shell (Inbox, Finance) | Pass | n/a | Content column stays centered with equal gutters. |
| 200 percent zoom (Inbox) | Pass | n/a | No loss of content. |

## Findings

| id | page / story | sev | category | what happened vs expected | evidence | suspected location | proposed fix |
|---|---|---|---|---|---|---|---|
| V2-01 | Finance overview | P2 | visual | Observed. The Breakdown card stretches to the height of the right column (Upcoming plus Subscriptions). Its 7 rows end about a third of the way down, leaving roughly 480 px of empty card at 1440 and about 330 px at 1920. Norm D2 (no dead bands). | `25-finance-bottom-1440.png`, `43-finance-1920.png`; card height 760 px, rows end at y=390 | `apps/web/src/pages/Finance.tsx` around lines 700-735 (the comment at 734 already addresses the right column only) | Make the Breakdown card `self-start`, or move Subscriptions to span both columns under the two cards. |
| V2-02 | Finance account detail (Mercury Treasury) | P2 | visual | Observed. "Balance over time" for an account whose balance never changes draws the line on the x axis with one y tick ($1.1M) and about 140 px of empty chart above it. Norm D2. | `27-acct-detail-1440.png` | `apps/web/src/components/finance/charts.tsx` (balance line scale, around line 40) | When min equals max, pad the domain by a few percent so the line sits mid-chart, or collapse the card to a one-line "Flat at $1.15M". |
| V2-03 | Finance overview, Burn chart | P3 | visual | Observed. The "Financing, Oct ↑ $250,000" marker floats above the $150k top gridline, detached from any series, because $250k is off the axis scale. | `24-finance-shown-1440.png`, `28-finance-375.png` | `apps/web/src/components/finance/charts.tsx` (financing marker, near line 379) | Draw the marker on the baseline with its label, or let the axis grow to include it. |
| V2-04 | Legal Contracts | P3 | visual | Observed. The Status column is empty for 10 of 11 rows (only "Draft" has a value) yet reserves about 75 px and a header. Norm C2/D2. Test at Legal.test.tsx:898 hides it only when every row is "active". | `30-legal-1440.png` | Legal contracts table (column group `col.w-[22%]` / `w-[19%]`) | Hide the Status column unless two or more rows have a non-default status, or show the draft chip next to the title. |
| V2-05 | Legal row to Data room preview | P2 | perf | Observed once, dev stack. Opening a contract from Legal lands in the Data room with the preview as an unlabelled pulsing grey box for about 15 s before the PDF appears. No progress text, no failure state. Norm I2 (progress over 1 s). Could be the dev server loading the PDF viewer; unverified on a production build. | `31-legal-detail-1440.png`, `31c.png`; DOM showed `div.animate-pulse.h-48` until it cleared | `apps/web/src/components/data-room/` preview pane (loading branch) | Preload the viewer, and add "Loading preview" text plus a failure state after a timeout. |
| V2-06 | Inbox rows, keyboard focus | P3 | a11y | Observed. A focused mail row gets the browser default `outline: auto 1px` at 50 percent alpha, while buttons next to it use a 3 px ring. It is visible (see screenshot) but weaker and inconsistent. Norm I7/H5. | `44-focus-row-1440.png`; computed outline `auto 1px oklab(.94 0 .007 / .5)` | `apps/web/src/components/inbox/InboxRow.tsx` | Give the row the same `focus-visible:ring-3 ring-ring/50` as other controls. |
| V2-07 | Legal Graph | P3 | visual | Observed. Node and column labels are 11 px in 200x38 boxes with large empty gutters either side of the three columns. Norm D1. | `48-graph-1440.png` | Legal graph component | Raise node text to 12-13 px (the boxes have room) and widen the columns. |
| V2-08 | Legal Contracts, phone | P3 | visual | Observed. Each contract is a card with five key/value rows (about 185 px), so 11 contracts take about 1900 px and only 4 fit per screen. Rows with no value (Value "—", Next deadline "—") still print. Norm D5. | `46-legal-375.png` | Legal contracts mobile list | Drop rows whose value is empty and put Parties under the title. |
| V2-09 | Finance, "Show all N" and "Burn" links | P3 | a11y | Observed on desktop. "Show all 9" is 52x16, "Show all 16" 56x16, "Burn" 39x16 px, all under the 24 px minimum in I4. Touch size was not measured (see method limits). | layout-audit `smallTargets` on `23-finance-1440.png` | `apps/web/src/components/finance/ui.tsx`, `pages/Finance.tsx` | Add vertical padding (`py-1`) to the links so they reach 24 px without moving the layout. |
| V2-10 | Finance account detail, Yield table | P3 | copy | Observed. The Yield table shows cents ($4,100.00, $95.00) while every other Finance figure is whole dollars. Norm H5. | `27-acct-detail-1440.png` | `apps/web/src/pages/finance/FinanceAccounts.tsx` (yield table formatter) | Use the shared whole-dollar formatter. |
| V2-11 | Inbox thread dialog + email agent | P3 | visual | Observed. Opening the agent panel widens the dialog from x=336 to x=143, so the open message jumps left by about 190 px. Norm L5. | `11-more-1440.png` vs `12-emailagent-1440.png` | Thread dialog container | Open the dialog at its final width when the panel was last used, or animate the move. |
| V2-12 | Attachment preview | P3 | visual | Observed. A three-row CSV opens in a dialog about 750 px tall; two thirds is empty. The dialog is also wider (960 px) than the thread dialog (770 px). Norm D2. | `10-attach-1440.png` | Attachment preview dialog | Size the dialog to its content with a minimum height. |
| V2-13 | Inbox rows, hover actions | P3 | flow | Observed. Unsorted rows show 2 hover actions (Archive, Mark read); sorted rows show 4 (plus Star and Mute). The set changes with sort state. Norm H5. May be intended. | `04-inbox-hover-1440.png` vs `08-showmore-1440.png` | `apps/web/src/components/inbox/InboxRow.tsx` | Show the same set for both, or document the difference. |
| V2-14 | Agent chat replies | P3 | copy | Observed. A bot reply names accounts "Mercury checking", "Mercury savings" and "Uploaded-statement checking" while Finance lists "MOCK Checking", "MOCK Savings" and "MOCK Community Bank". Likely model paraphrase. Norm C1 (one concept, one name). | `38-approval-1440.png` vs `26-accounts-1440.png` | Finance tool output / agent prompt | Have the Finance tool return the exact account names and tell the agent to quote them. |

No P0 or P1 problems were found in the V2 surfaces.

## Excellent as is

- Inbox pre-sort and sorted states: one consent card, then a calm sorted list. Sections "Needs reply" (5 rows plus "Show N more"), "Other mail today" and "Earlier" read clearly. Unsorted rows dim after 15 s as decided.
- Row hover: the unread dot becomes a checkbox and the date becomes actions without moving the text, and the same controls appear on keyboard focus.
- Inbox shell: the sticky header holds title, search, tabs and the four actions; the list scrolls inside the main column (page scroll 0 at every viewport), and the layout works at 200 percent zoom.
- Updates, Newsletters and the Digest view (cards with "Open" and a single "Archive all 8 messages from 5 senders" action).
- Thread dialog and attachment preview: spreadsheet view with Add to Data room and Download, Escape returns focus to the attachment chip, and icon-only buttons keep accessible names on phone.
- Email agent panel and the Mail approval card (From, To, preview, Send, Discard, Edit, Show more). On phone it becomes a full-screen view with a back arrow.
- Finance on phone: five tiles reflow to 1 + 2 + 2, Breakdown bars sit under their rows, and Upcoming shows date plus tag under the vendor.
- Finance Accounts: totals reconcile to the sum of the rows ($1,633,221), clear grouping into Cash accounts and Crypto.
- Legal Deadlines: dense, dated, consistent actions per row. Contracts table keeps Value right-aligned.
- Artifacts: grid and list/viewer split work, and the viewer keeps Download and expand in the header.
- Compose dialog, new bot thread with its settings panel (Name focused, Audience, Skills), and the phone drawer.
- 1920x1080 shell: content stays centered with equal gutters; nothing stretches.
