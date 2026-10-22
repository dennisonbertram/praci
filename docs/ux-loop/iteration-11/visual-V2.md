# Visual inspection V2 (iteration 11)

Scope: Inbox, Finance, Legal, agent chat with approval cards, Artifacts on the mock-data demo stack (web port 5381, space Northwind Robotics, user Maya). Viewports 1440x900, 375x812, and 1920x1080 for the shell. Screenshots are in `/tmp/uxloop11/V2/`. Norm IDs come from `visual-heuristics.md`.

Method notes and limits:
- The page-fit audit (`layout-audit.js`) and `geometry-audit.js` were run at 1440 and 375. The contrast list in `layout-audit.js` reports ratios of about 1.3 for nearly all text on the dark theme, which is a tool artifact (it ignores the real background), so no contrast finding is made from it.
- Touch-target size was NOT assessed. `set device "iPhone 15"` did not enable `(pointer: coarse)` here, so any target measurement would be invalid under the owner rule.
- Other walkers shared this demo user at the same time (Chief and Mercury chats, sidebar Spaces such as "Empty space", "Mail needs reconnect", "Mail rate-limited" appeared mid-run). I did not send messages or answer approvals. Chat state in the screenshots is theirs.
- Not reached: Inbox digest card (not present in the seed state), real Gmail-dependent flows, the Compose dialog, secret-request and "Share with" cards (none present in the chats I opened).

## Verdicts

| Page / state | 1440x900 | 375x812 | Notes |
|---|---|---|---|
| Inbox, before sort (consent card) | Pass | not captured | Fits one screen, header sticky, list scrolls inside its panel. Updates/Newsletters tabs show before consent as decided. |
| Inbox, sorted (To do, Needs reply) | Pass, strong | Pass | No page scroll at either width. To do card pushes first mail to y=466 on phone (V2-12). |
| Inbox, Updates tab | Pass | not captured | V2-11. |
| Inbox, cleanup | Pass | not captured | Compact empty state. |
| Inbox filter menu | Pass | not captured | Tooltip stays after the menu closes (V2-13). |
| Mail thread dialog + attachment preview | Pass, strong | Pass | Truncated address lines on phone (V2-14). |
| Finance overview | Pass (inner scroll only) | Pass | V2-05, V2-06, V2-07, V2-08. |
| Finance Accounts | Pass, fits one screen | not captured | Excellent. |
| Finance vendor page | Pass | not captured | V2-04. |
| Legal Contracts | Needs work | Pass | V2-01, V2-02. |
| Legal Deadlines | Needs work | not captured | V2-03. |
| Legal Graph | Pass | not captured | Legible two-line labels, edges stay between neighbouring columns. V2-09 (one slow load). |
| Agent chat (Chief, Investor Relations, Mercury agent) | Pass | Pass (Mercury) | V2-10, V2-15. |
| Artifacts grid and detail | Pass | not captured | V2-16, V2-17. |
| Shell at 1920x1080 | Pass | n/a | Content capped at 1440 and centered, gutters equal (about 80px each side). |
| Phone drawer | Pass | Pass | V2-18. |

No P0 findings. No page scroll (`pageScrollY` = 0, `pageScrollX` = 0) on any page or viewport I measured.

## Findings

All observed unless marked suspected. Evidence paths are in `/tmp/uxloop11/V2/`.

| ID | Page | Sev | Cat | What happened vs expected | Evidence | Code | Fix |
|---|---|---|---|---|---|---|---|
| V2-01 | Legal, Contracts tab (1440) | P2 | visual | The contract name, the main column, is cut off at 227px ("MOCK Insurance Policy - Shield…") while the Status column (76px) is empty on 9 of 11 rows and Parties has spare width. The name is cut exactly where it tells contracts apart. Norms D2, C4. Full name is only in a mouse-hover `title`, not reachable by keyboard. | `legal-1440.png`; header widths Contract 227, Parties 205, Status 76, Term 173, Renewal 151 | Contracts table in `apps/web/src/pages/Legal.tsx` (column widths) | Give Contract the flexible width, let it wrap to two lines, and show Status only as a badge appended to the name (or drop the column when no row has one). |
| V2-02 | Legal, Contracts tab (1440) | P2 | visual | Term ("Dec 2, 2025 – Dec 2, 2026") and Renewal wrap to two lines, so 9 rows are 57px tall and the SAFE/Term sheet rows are 37px. Row height is uneven and the table is taller than needed. Norms L5, D3. | `legal-1440.png` | same table | Keep dates on one line (`whitespace-nowrap`, shorter "Dec 2, 2025 – 2026" form) so every row has one height. |
| V2-03 | Legal, Deadlines tab (1440) | P2 | flow | "Renews automatically: ..." rows are informational but carry the same Ask agent / Done / Dismiss controls as real tasks such as "Send non-renewal notice" and "Pay Cascade Robotics onboarding fee". Ten rows with three equal-weight controls each (30 controls) bury the 3 or 4 items that need action; the Done button on a renewal notice has no clear meaning. Norms H2, I5. | `legal-deadlines-1440.png` | Deadlines list in `apps/web/src/pages/Legal.tsx` | Show Done only on actionable deadlines, and put Dismiss and Ask agent in a row "..." menu; render renewals as plain date rows. |
| V2-04 | Finance vendor page (Globex Cloud) | P2 | flow | Tiles say "Per month $2,016 / Usual charge" and "Change +35% Sep vs Jun". The bar chart is titled "Monthly spend Apr to Sep" and stops at Sep, but the table's newest charge (Oct 16) is $2,400, 19% above Sep. The page's one alarming number hides the latest spike. Norm C2 (facts must agree on one screen). | `fin-vendor-1440.png` | vendor page in `apps/web/src/pages/` (Finance vendor view), chart range | Include the latest month in the chart and compute Change from the latest charge, or label the tile "through Sep". |
| V2-05 | Finance overview, Subscriptions table (1440 and 1920) | P2 | visual | Vendor name and its amount are 640px apart at 1440 (about 1100px at 1920); the reader's eye cannot follow a row without the hover highlight. Per month and Last charge are pushed to the right edge. Norms D2, H6. | `finance-bottom-1440.png`, `finance-1920.png` | `SubscriptionsTable`, `apps/web/src/pages/Finance.tsx:940` | Cap the table's content width (about 720px) or put the amount next to the vendor and keep Last charge secondary. |
| V2-06 | Finance overview, Subscriptions table | P3 | visual | The Globex Cloud row is 72px tall (name plus "+35%" chip) against 38px for the others, and its amount and date are vertically centered, not aligned with the name line. Norms L5, H6. | `finance-bottom-1440.png` | `SubscriptionsTable` row | Put the "+35%" chip inline after the name, as "Similar to Cursor Seats" already is on the Devin row. |
| V2-07 | Finance overview, Burn chart | P3 | visual | The current month "Oct*" is drawn as a dashed line falling from about $120k to about $20k, which reads as burn collapsing while the tile says $67,621 a month. The Financing marker sits at the top gridline but is labeled $250,000 (above the $150k axis), so it looks clipped. "So far" is only a footnote. Norm C3/H5 (visual claim vs number). | `finance-1440.png`, `finance-375.png` | Burn chart component in `apps/web/src/components/finance/` | Do not extend the line to the partial month (show it as a dot with "so far"), and extend the axis or add an off-scale arrow for the $250,000 marker. |
| V2-08 | Finance overview (375) | P3 | visual | Five stat tiles use a 2-column grid, so Treasury yield sits alone on a full-width row, and the space name truncates to "Northwind Rob…" with no way to read it. Norms D2, C4. | `finance-375.png` | Finance header and tile grid, `apps/web/src/pages/Finance.tsx` | Let the last tile span two columns with a smaller layout (or hide Treasury yield when it is below the fold); let the space name wrap or show on its own line. |
| V2-09 | Legal, Graph tab | P3 | perf (one-off) | On the first open the Graph tab showed only a flat grey block (the `Skeleton`) for more than 12 seconds with no "still loading" text. On later opens it rendered in under 1 second, so the slow load was not reproduced (demo stack was shared with other walkers). Norm I2. | `legal-graph-1440.png` (skeleton), later render | `GraphTab`, `apps/web/src/pages/Legal.tsx:405` | Add a "Loading relationships..." line to the skeleton and an error/timeout state after about 10 seconds. Suspected cause: contention, not confirmed. |
| V2-10 | Chief chat (1440) | P1 | flow/copy | Two assistant bubbles in a row contradict each other about money: "I've asked Mercury to pay Acme Servo Supply $300 ... but I don't have its confirmation yet" then "Mercury did not submit your $300 payment request ... a different payment ($1,250) is pending approval". Both end with a link that goes to the Mercury agent. After a payment request Maya cannot tell whether anything is pending. Norm C3 (status legible). | `chat-chief2-1440.png` | Chief's handoff summary (agent prompt / forwarded Mercury reply), not a UI component | Make Chief post one outcome message per request (requested, not submitted, or approved), and drop the first interim message once the final one arrives. |
| V2-11 | Inbox Updates tab (1440) | P3 | visual | Important groups rows under "Today" / "Earlier" headings; Updates has no headings and starts 40px below the tab bar, so two tabs of one list look different. Norm H5. | `updates-1440.png` vs `inbox-sorted-1440.png` | `apps/web/src/pages/Inbox.tsx` | Use the same day grouping on every pile. |
| V2-12 | Inbox sorted (375) | P3 | density | The To do card is 220px tall and the first mail row starts at y=466 of 812; on a phone Maya sees two to-dos and 4 mails on first screen. Norm D1. | `inbox-375.png` | To do card in `Inbox.tsx` | Show one to-do plus "4 more" on phones, or make the card collapsible and remember the choice. |
| V2-13 | Inbox filter menu (1440) | P3 | visual | After Escape closes the Filter menu, the "Filter" tooltip stays on screen under the button until the pointer moves. Norm I8. | `inbox2-1440.png` | tooltip trigger on the filter button | Hide the tooltip when the menu closes. |
| V2-14 | Mail thread (375) | P3 | copy | Sender and recipient addresses are cut ("<riley@bookkeepin…", "<mock-founder@northwind.example.te…") with no way to read them in full. Norm C4. | `thread-375.png` | `apps/web/src/components/inbox/InboxMessageDialog.tsx` | Let the "to" line wrap, or tap the sender to reveal the address. |
| V2-15 | Mercury agent chat (1440) | P3 | visual | Two approval cards for the same payment have identical text ("Send $1,250.00 to Acme Servo Supply (Mock) from MOCK Checking ••1111?"), one Denied and one Approved, with no time or request number. A later reader cannot tell which result belongs to which request. Norm C2/C3. | `chat-mercury-1440.png` | approval card component, `apps/web/src/components/` (tool approval card) | Add the time of the request to the card footer next to the result. |
| V2-16 | Artifacts detail (1440) | P3 | visual | The list pane does not scroll the open item into view: the selected "MOCK Q3 Board Deck" row is half cut off at the bottom of the list. Norm I6. | `artifact-1440.png` | `apps/web/src/pages/Artifacts*.tsx` | Scroll the selected row into view when the detail opens. |
| V2-17 | Artifacts header | P3 | visual | The Artifacts header has a bottom border line; Inbox, Finance and Legal headers do not. Norm H5. | `artifacts-1440.png` vs `inbox-sorted-1440.png` | page header in `apps/web/src/pages/Artifacts*.tsx` | Use the same header treatment on all pages (suspected: intentional because of the two-pane layout; check). |
| V2-18 | Phone drawer | P3 | a11y | When the drawer opens, focus lands on the "Activity" icon button (a ring is drawn on it), not on Search or the first page link. Norm I7. | `drawer-375.png` | mobile drawer open handler | Focus the Search box (or the close button) on open. |

## Excellent as is

- Inbox sorted state: To do card, "Needs reply 8 unread" heading, one-line summaries, unread dots and sticky header. Reads like a finished product.
- Mail thread dialog and PDF attachment preview: compact, correct actions (Reply, Archive, Ask agent), preview with Add to Data room and Download in the header, Escape closes in order.
- Finance Accounts page: fits one screen at 1440x900, honest "Brex does not share it" for the missing card balance.
- Finance overview: tiles with a clear scale, labeled period switch, drill-down chevrons on every row, no page scroll with inner panel scrolling at both widths.
- Legal Graph: readable two-line node labels, edges only between neighbouring columns, "Select an item to see its relations".
- Approval card: Question with amount and account in the title, Details collapsed, one primary "Send $1,250.00" and a plain Deny, then a clear Approved/Denied state.
- Artifacts: two-pane list and preview, Download and expand, type chips.
- 1920 shell: content capped at 1440, centered, equal gutters.
- Keyboard: a "Skip to content" link exists, focus rings (outline or box-shadow) are visible on all 14 tab stops I sampled, tab order inside the Inbox header is logical.
