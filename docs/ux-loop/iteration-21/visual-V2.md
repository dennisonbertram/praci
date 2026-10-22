# Visual inspection V2 (iteration 21)

Scope: Inbox (consent card, sorted piles, To do, a thread with an attachment, attachment preview, Cleanup), Finance (overview and Accounts), Legal (Contracts, Deadlines, Graph), agent chat with a mail approval card, Artifacts. Mock-data demo stack, signed in as the demo founder. Viewports 1440x900, 1920x1080 (shell) and 375x812. Screenshot file names are given without paths.

Method notes
- Ran the layout audit and the geometry audit on every state. Interacted with the mouse and keyboard (Tab order, Escape, hover rows, hover chart).
- Touch emulation was not available in the browser tool (`pointer: coarse` stayed false for the iPhone device preset), so no touch-target finding is reported. Raw audit hits on small mobile links were discarded.
- The stack was shared with other walkers, so counts such as unread mail and the number of chats in the sidebar changed during the walk. Timings below were taken against a dev stack under that load.

## Verdicts

| Page / state | 1440x900 | 1920x1080 | 375x812 |
|---|---|---|---|
| Inbox, before consent | Pass | n/a | Pass |
| Inbox, sorted (To do, Needs reply, Show N more) | Pass | n/a | Pass |
| Email thread + attachment preview | Pass (focus returns to the attachment after Escape) | n/a | Pass (full-screen sheet) |
| Cleanup | Pass | n/a | not checked |
| Finance overview | Fail (V2-02, minor V2-04) | Pass with V2-02 | Fail (V2-05, V2-02) |
| Finance Accounts | Pass (V2-08) | n/a | not checked |
| Legal Contracts | Fail (V2-01) | Pass | Pass (list layout) |
| Legal Deadlines | Pass (V2-07) | n/a | not checked |
| Legal Graph | Pass | n/a | not checked |
| Agent chat with mail approval card | Pass | n/a | Pass (V2-09) |
| Artifacts | Pass (V2-06) | n/a | Pass |
| App shell (sidebar, toast) | Pass | Pass | Pass |

No page scrolls as a whole at 1440x900 or 1920x1080 (`pageScrollY` 0, no horizontal page overflow at any viewport). Finance overview scrolls inside its panel (content 1278 px tall), which satisfies L1.

## Findings

| ID | Page | Sev | Cat | What happened vs expected | Evidence | Suspected code | Proposed fix |
|---|---|---|---|---|---|---|---|
| V2-01 | Legal, Contracts | P1 | visual (L6, L4) | Observed. At 1440 the Contracts table is 1120 px wide inside a 1068 px container, so the "Next deadline" column is cut off at the right edge and the right gutter is gone; at 1280 it is 1122 px in 964 px (186 px hidden behind a sideways scroll). The deadline is the most useful column for Maya. Expected: all columns visible with the same right gutter as the header. At 1920 it fits (1440 in 1604). | legal-1440.png, legal-dl-1440.png (same table), container measurements | `apps/web/src/pages/legal/LegalContracts.tsx` lines 125 and 158: the list and table switch at `@4xl` (896 px), but the table needs about 1120 px | Switch to the table at a wider container breakpoint (about `@6xl`) or let Parties and Term shrink so the table fits at 1280. |
| V2-02 | Finance overview | P2 | visual (H5, C4) | Observed. The Financing label ("Financing, Oct 1 ... $250,000") is cut off at the top edge of the Burn chart at all three viewports, because the $250k marker is above the $150k axis top. The October point is two bare markers with no area or Revenue mark. Expected: the full label readable. | fin-1440.png, hov.png (tooltip shows the full values), d1920-fin.png, m-finance.png | `apps/web/src/components/finance/charts.tsx` near lines 722-745: label drawn at `top - 12` (minus 14 per extra row) without reserved headroom | Reserve about 28 px above the plot for the off-scale label, or place it inside the plot when off-scale. |
| V2-03 | Finance overview | P3 | visual (D2) | Observed. Subscriptions sit below the fold even at 1920x1080 (content 1278 px). Scrolling is inside the panel, so L1 holds, but nothing hints at more content below. | fin-bottom.png | Finance.tsx layout | Optional: leave as is; the panel scroll fade could hint at more. |
| V2-04 | Finance overview | P3 | visual (L4) | Observed. The Breakdown card is 312 px tall and the Upcoming card 346 px, so their bottom edges differ by 34 px. | fin-1440.png, geometry audit `grid.items-start` heights [312, 346] | Finance.tsx grid uses `items-start` | Use `items-stretch` or limit both lists to the same row count. |
| V2-05 | Finance overview, phone | P2 | visual (L6, C4) | Observed. The sync status row shows only "syncing…" (the name "Mercury, Brex" is cut off) with a large gap before "1 non-USD not counted". The summary line wraps leaving "22" alone on a line ("Spent so far this month · Oct 1 – 22 · ↑ 0.5% vs Sep 1 – 22"). | m-finance.png | Finance.tsx header status row and period summary | Let the status row wrap onto two lines instead of truncating; shorten the summary or keep date ranges together with a non-breaking space. |
| V2-06 | Artifacts | P3 | visual (L5, H6) | Observed. The card with a "v2" badge is 92 px tall while its siblings are 72 px, because the badge sits on its own line. | art-1440.png | artifacts card component | Put the badge on the title line (as the phone list already does). |
| V2-07 | Legal, Deadlines | P3 | visual (D5, H1) | Observed. Every one of 9 rows repeats three buttons (Ask agent, Done, Dismiss) with equal weight; together they outweigh the title. Expected: one row action visible, the rest on hover or in a menu. Owner decision on Legal (scan never closes a deadline) is not affected. | legal-dl-1440.png | Legal deadlines row component | Show the actions on row hover or focus, keep "Done" visible. |
| V2-08 | Finance Accounts | P3 | visual (H5, D2) | Observed. The Week/Month/Quarter/Year control has no framed container here (the overview has one) and defaults to Year while the overview defaults to Month. The "Total cash" card is 170 px wide and left aligned, leaving a band to its right. | fin-accounts-1440.png | accounts page | Reuse the overview's range control and default, and let the cash card span the row or sit beside the chart. |
| V2-09 | Chat approval card, phone | P3 | copy (C2, C4) | Observed. The card header truncates the recipient ("Needs approval · priya@place…") while the To row repeats it in full. | m-chat-approval.png | mail approval card header | Drop the address from the header on narrow widths. |
| V2-10 | Cold page loads | P2 | perf (I2) | Observed on the shared dev stack. A cold load of the Inbox took about 23 s to show the list (an "Opening Praci…" splash, then a grey skeleton row set with "First sync can take a minute", then the list). An agent chat took about 9 s to replace its skeleton. For a signed-in person with mail, "First sync" is misleading while the list is simply loading. Cannot say how much is dev-mode and concurrent walkers (suspected). | m-thread.png (skeleton), timing loops | `apps/web/src/pages/Inbox.tsx` ~line 1707: `slowSync && !everSynced && !data?.syncedAt` | Re-time on a production build; show "Reading your mail…" unless the account has truly never synced. |
| V2-11 | Sidebar, first-run tour | P3 | visual (L3, D2) | Observed. On first load the tour card covers the bottom of the chat list ("Leadership sync" is cut in half behind it) and has an empty band between its text and its buttons. | inbox-1440.png | tour card component | Reserve space for the card in the list or tighten the card height. |
| V2-12 | Sidebar status lines | P2 | copy (C1) | Observed. Chief and Inbox agent rows read "Waiting for the computer…" while a run starts. "Computer" is jargon for Maya; it is about the bot's workspace starting. | chat-send-1440.png, chat-inbox-1440.png | `apps/web/src/lib/run-phase.ts` line 9 | Use "Getting ready" (already used for the next phase) or "Starting up". |
| V2-13 | Toast | P3 | visual (I1) | Observed. The "Inbox agent needs approval" toast is one large button, but nothing shows it is clickable (only the X is visibly a control). It does open the right chat. | art-1440.png; toast markup | notification-toast component | Add a small "Review" text or chevron. |
| V2-14 | Inbox, sorted | P3 | visual (I1, H6) | Observed. "2 more" (To do) and "Show 15 more" are plain grey text, and "Show 15 more" starts 10 px left of the list edge (focus box at x=334, rows at 344). | inbox-sorted-1440.png, Tab order trace | Inbox list footer | Style as ghost buttons and align to the row edge. |

Dismissed: a persistent focus ring on the sidebar Search box in early screenshots was not reproduced once the page settled; not reported. The "4 Data room documents not yet checked" figure on Legal was 4 at 1440 and 35 on the phone view; this may be other walkers' uploads, so it is not reported as a bug (unverified).

## Excellent as is

- Inbox sorted view: the To do card, Needs reply with a reason chip ("To do - Today", "Urgent"), "Show N more", and the one-line empty explanation in Cleanup are calm and clear.
- Email thread dialog and attachment preview: sensible hierarchy (Reply is the one primary), "Add to Data room" and "Download" next to the file, focus returns to the attachment after Escape.
- Phone thread sheet: collapsed earlier messages with a "Sent" marker, actions in one row.
- Finance: KPI row, chart hover tooltip (Out, Revenue, Financing together), numbers reconcile (Accounts add up to the $1,633,221 cash total).
- Legal phone list: the table becomes a readable list with value and due date inline (better than the desktop table, see V2-01).
- Legal Deadlines: overdue state is clear in words and color; reasons are shown under each title.
- Legal Graph: three readable columns, labels fit.
- Mail approval card: From, To, body, one primary Send, Discard beside it; the composer says "Needs your answer".
- Approval toast: bottom-right, persistent, with an X, and it carries across pages and onto the phone.
- Tab order through the Inbox is logical (sidebar, search, actions, tabs, To do, rows).
