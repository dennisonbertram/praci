# Visual critique V2 (uxl10-V2): Inbox, Finance, Legal, agent chat, Artifacts

Target: mock-data demo stack (web 5381), user Maya Chen (Mock), dark theme. Viewports: 1440x900 (all pages) and 375/390x812 with touch emulation (pointer: coarse confirmed). 1920x1080 and 1280x800 were not captured (time); the shell was only checked at 1440. Screenshots: /tmp/uxloop10/V2/. Another walker shared the same account, so Chief previews, the Inbox consent and the Legal scan state changed during the walk.
The layout-audit contrast figures (about 1.3:1 on white text) are an audit artefact on the dark theme (transparent backgrounds resolve to white) and are not reported.

## Verdicts

| Page / state | 1440x900 | 375x812 touch |
|---|---|---|
| Inbox list (Important, To do, hover actions) | Excellent: dense, grouped, no layout shift on hover, one screen with inner scroll | Good, one defect (V2-05) |
| Inbox first sort | Fails: empty skeleton for minutes (V2-01) | same |
| Inbox email dialog, attachment preview | Good; layout jump when Ask agent opens (V2-04) | not walked |
| Cleanup | Acceptable empty state (V2-12) | not walked |
| Finance overview and sub-pages | Good, minor polish (V2-08..10) | Good (V2-11) |
| Legal | Fails on the failed-scan banner (V2-02); table truncates key dates (V2-06) | Tabs overlap (V2-03) |
| Agent chat, question card, mail approval card | Excellent | Excellent, all targets >= 44px |
| Artifacts grid and master-detail | Good (V2-13) | not walked |

## Findings

| id | page | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| V2-01 | Inbox, first sort | P1 | flow | Observed: after consent, the list showed only "Sorting your mail…" plus 5 grey bars for at least 3 minutes (several reloads, each restarting the stall watch). Mail cannot be read, searched or opened meanwhile. Expected: rows within seconds, or an escape. The stall line only appears after two full poll cycles. | /tmp/uxloop10/V2/filter3-1440.png, reload-1440.png; later sorted by itself (inbox-again-1440.png) | apps/web/src/pages/Inbox.tsx:664 (sortingRows), :475-482 (auto-retry before stall) | Show unsorted rows with a "Sorting…" line after about 15s instead of waiting for two poll cycles. |
| V2-02 | Legal | P1 | flow/copy | Observed: red banner "Last scan failed: Legal needs your permission to read your documents before it can run." has only a dismiss X, no Allow button. Header says "Last scan 3h ago. Scans daily." (contradicts) and "Scan now" stays enabled though it will fail again. "34 Data room documents not yet checked by Legal" gives no action either. Norms C3, I3. | legal-1440.png | apps/web/src/pages/Legal.tsx (error banner) | Put the same Allow action (one Allow covers Data room and Legal) in the banner and disable Scan now until allowed. |
| V2-03 | Legal, phone | P1 | visual | Observed at 390: "Contracts 10" overlaps "Deadlines 13", the tab pill extends past the right gutter (button spill 19px; Graph touches the edge). Norm L6. | m-legal.png | apps/web/src/pages/Legal.tsx tab list (inline-flex, no wrap) | Make the tab list scrollable or drop counts below 400px. |
| V2-04 | Inbox email dialog | P2 | visual | Observed: pressing Ask agent widens the dialog from 770 to 1150px and re-centres it, so the email text moves left about 190px. Ask agent shows no pressed state. The panel's first item "Email thread, 1 message" repeats the email beside it. Norms L5, C2. | thread-1440.png vs askagent-1440.png | email dialog in apps/web/src/components/inbox | Open at the wide size when the panel is likely, or overlay the panel; show Ask agent as toggled. |
| V2-05 | Inbox, phone | P2 | a11y | Observed with pointer: coarse: row selection checkboxes are 16x16 (To do checkboxes 20x20); everything else in view is >= 44. Norm I4. | geometry eval; m-inbox.png | apps/web/src/components/inbox/InboxRow.tsx:361 | Wrap the checkbox in a 44px hit area on coarse pointers. |
| V2-06 | Legal contracts | P2 | visual | Observed at 1440: Term ("Dec 10, 2025 – Dec 10, 20…") and Renewal ("Auto-renews, 30 days no…") are truncated, the two facts the table exists for. Full text only in a title tooltip. Norm C4. | legal-1440.png | apps/web/src/pages/legal/LegalContracts.tsx | Let Term and Renewal wrap or give them width priority over Contract and Parties. |
| V2-07 | Legal deadlines | P2 | visual | Observed: each of 13 rows carries three buttons (Ask agent, Done, Dismiss) of near-equal weight, so the list reads as a wall of controls. Norms H1, D5. Overdue state (red date plus "Overdue by 5 days") is clear. | legal-deadlines-1440.png | apps/web/src/pages/legal/LegalDeadlines.tsx | Keep Done visible; move Ask agent and Dismiss to a row menu or hover. |
| V2-08 | Finance sub-pages | P3 | visual | Observed: the space picker is truncated to "Northwi…" on Accounts, Burn, Spend and Crypto but full on the overview, with room to spare. Norm H5. | accounts-1440.png, fin-burn-1440.png | finance page header | Do not truncate the picker below its full width. |
| V2-09 | Finance overview | P3 | visual | Observed: Breakdown card ends at y=827, Upcoming at y=853; the Burn legend squares and the two chart lines are hard to tell apart in the monochrome palette; the "Financing, Oct" label sits on the chart top edge. Norms L4, H4. | finance-1440.png | apps/web/src/pages/Finance.tsx | Stretch the pair to equal height; label lines directly. |
| V2-10 | Finance overview/Spend | P3 | visual | Observed: the period bar is a full-width card with four controls and one figure at the left, about 700px empty to the right (D2). "Spent so far $20,484" beside "Monthly burn $67,621" is two measures with no hint. | finance-1440.png, fin-spend-1440.png | Finance.tsx period bar | Shrink the bar to content. |
| V2-11 | Finance, phone | P3 | visual | Observed: the period card is about 340px tall for four tabs, one number and a caption (D2); sync text truncates ("synced just …"). | m-finance.png | Finance.tsx | Tighten vertical gaps in the period card at phone width. |
| V2-12 | Cleanup | P3 | flow | Observed: "Nothing to clean up…" plus an "Open Newsletters" button; compact and acceptable. The button's purpose is unexplained. | cleanup-1440.png | apps/web/src/components/inbox/InboxCleanup.tsx | Consider dropping the button when no newsletters exist. |
| V2-13 | Artifacts | P3 | visual | Observed: the page header has a bottom divider (y=77); Inbox, Finance and Legal headers have none. Norm H5. | artifacts-1440.png | apps/web/src/pages/Artifacts.tsx | Match the other pages' header treatment. |
| V2-14 | Sidebar status | P2 | copy | Suspected (demo has no model): the Inbox agent row shows "Waiting for the model…" while its chat holds a mail approval waiting for the user. Investor Relations shows "Needs your answer" for a question, so approvals should read the same. Norm C3. | approval-1440.png | Shell.tsx sidebar row status | Prefer "Needs your approval" when a card is pending. |
| V2-15 | Mail approval card | P3 | copy | Observed: header "Mail Needs approval · morgan@…" repeats the To row (truncated on phone). Norm C2. | approval-1440.png, m-approval.png | mail_send card component | Drop the address from the header. |
| V2-16 | Finance crypto | P3 | visual | Observed: "Balance over time" ends with a vertical drop from 107k to 105k on the last day (possibly the unpriced asset, so it may mislead); "Updated 1m ago" is wedged 12px under the header, unlike other pages. | fin-crypto-1440.png | FinanceCrypto.tsx | Mark the final point as partial; give the caption normal spacing. |
| V2-17 | Finance crypto | P3 | bug | Observed once: navigating by URL from /finance/spend to /finance/crypto left a blank page (empty body text) for more than 6s; a second load rendered. Not reproduced, possibly a dev-server reload. | first capture overwritten | unknown | Recheck on a production build. |
| V2-18 | Chat on phone | P3 | visual | Observed: the emoji/reply/save/more row shows under every message on touch, about 50px each, so long chats scroll further. Norm D5. | m-approval.png | message actions component | Show it on tap of the message. |

## Excellent as is

- Inbox list: grouped under "Needs reply", unread dots, 57px rows, hover actions replace the dot with a checkbox and do not shift layout; To do card; Important/Updates/Newsletters tabs.
- Email dialog: sender, recipients and Reply/Archive/Ask agent grouped; attachment chip with preview that returns focus to the chip on Escape; PDF preview offers Add to Data room and Download.
- Finance overview: five stat tiles read at a glance; sub-pages have a back button and Ask; Spend list with category filter and Pending/Posted status in words.
- Legal deadlines: overdue shown in text and colour.
- Chat: question card with two full-width options, mail approval card (From/To/Cc/body, one primary Send, Discard, Edit), "Taking longer than usual. Stop. Try again.", bottom-right approval toast above the composer, Jump to latest pill.
- Phone: no horizontal page overflow on Inbox, Finance or Accounts; approval card buttons and header controls all >= 44px.
- Artifacts master-detail with Download and expand.
