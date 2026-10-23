# Visual inspection V2 (iteration 22)

Scope: Inbox (consent card, sorting, sorted piles, To do, a thread with an attachment, attachment preview, Cleanup, Ask agent panel), Finance (overview, Accounts, Burn), Legal (Contracts, Deadlines, Graph), agent chat with a mail approval card, Artifacts. Mock-data demo stack, signed in as the demo founder, dark theme. Viewports 1440x900, 375x812 and 1920x1080 (shell). Screenshot file names are given without paths.

Method notes
- Ran the layout audit and the geometry audit on every state; interacted with mouse and keyboard (Tab trace of the Inbox, Escape, dropdowns).
- The layout audit's contrast check reports ratios near 1.3 for nearly all text in the dark theme (for example the sidebar page names). Rendered screenshots show normal contrast, so these were treated as audit false positives and discarded.
- Touch emulation (`pointer: coarse`) was not available, so no touch-target finding is reported. Raw audit hits on 18-20 px links were discarded for that reason.
- The demo account is shared with other walkers. Other sessions created chats, an approval toast and toggled Hide amounts during the walk, so counts and some states are not mine. The Quill/Quinn audit-reply thread and the "Legal agent" chat under "Empty space" belong to other walkers; I only looked at them and did not act on them.
- The dev server is slow under load; timings below are from that stack only.

## Verdicts

| Page / state | 1440x900 | 1920x1080 | 375x812 |
|---|---|---|---|
| Inbox, before consent | Pass | n/a | not checked |
| Inbox, after Allow ("Sorting your mail...") | Fail (V2-04) | n/a | not checked |
| Inbox, sorted (collapsed To do, Needs reply, Show N more) | Pass (V2-16) | Pass | Fail (V2-02) |
| Thread + attachment + preview | Pass | n/a | not checked |
| Ask agent panel in the thread dialog | Pass (V2-10) | n/a | not checked |
| Cleanup | Pass | n/a | not checked |
| Finance overview | Pass (V2-05, V2-12) | n/a | Pass |
| Finance Accounts | Pass (V2-08) | n/a | not checked |
| Finance Burn | Pass (V2-03 once stuck on Loading) | n/a | not checked |
| Legal Contracts | Pass (V2-12) | n/a | Pass |
| Legal Deadlines | Pass (V2-07) | n/a | not checked |
| Legal Graph | Pass after load (V2-03) | n/a | not checked |
| Space switcher menu | Fail (V2-01) | n/a | not checked |
| Chat with mail approval card | Pass (V2-09) | n/a | Pass (V2-09) |
| Artifacts | Pass (V2-06, V2-13) | n/a | not checked |
| App shell (sidebar, drawer, toast) | Pass (V2-11, V2-14) | Pass | Pass |

No page scrolls as a whole at any viewport (`pageScrollY` 0, `pageScrollX` 0, no horizontal overflow). Long pages scroll inside their panel (Finance 1278 px, Inbox 1189-2054 px depending on state). Legal Contracts is 906 px tall in a 900 px panel (6 px of inner scroll, see V2-12).

## Iteration 21 fixes verified (observed)

- Legal Contracts is now a list at 1440 with the amount at the right edge; no sideways scroll (was V2-01 P1 in iteration 21). Auto-renewal is folded into one line.
- Finance burn chart: the "Financing, Oct $250,000" label is fully visible above the plot on the overview and Burn page (was V2-02).
- Finance phone header: the sync line wraps ("synced just now", then "1 non-USD transaction not counted") and the period summary has no orphan "23" (was V2-05).
- Approval toast shows a chevron at its right edge, so it reads as clickable (was V2-13).
- The To do card collapses to one line; Cleanup says in one line why it is empty ("Nothing to clean up. Senders need 3 or more messages, ...").
- "Show N more" is now aligned with the row text, not the row edge (partly: 355 vs 344 px, see V2-16).

## Findings

| ID | Page | Sev | Cat | What happened vs expected | Evidence | Suspected code | Proposed fix |
|---|---|---|---|---|---|---|---|
| V2-01 | Space switcher on Legal, Inbox and other non-finance pages | P2 | copy (C1, H5) | Observed. The company dropdown next to the page title opens with the heading "Show finances for" on Legal (and the same shared control sits on Inbox). On Legal it does not switch finances. Expected: a neutral heading such as "Company". The list also shows seeded spaces such as "Reconnect needed" and "Empty space", which is expected on the demo. | switcher.png | `apps/web/src/components/finance/ui.tsx` line 128 (shared `SpaceName`) | Replace the heading with "Company" (or drop it); the trigger's aria-label already says "Company: ... Switch company". |
| V2-02 | Inbox, phone | P2 | visual (C3, I1) | Observed. In the Earlier pile the urgency reason is a bare grey dot before the subject ("Fictional Law Group", "DocuSign via Auditwell LLP", "Fictional Law Group - Trademark response draft"). Urgent, Important and Action all look the same, and the word the owner decision requires ("other urgent mail shows its reason word") is invisible on a phone; the text only exists as a hover title and screen-reader text. At 1440 the word is shown ("Urgent", "Action"). | inbox-375b.png, inbox-sorted2-1440.png | `apps/web/src/components/inbox/InboxRow.tsx` lines 347-349 (dot is `@md:hidden`, `title` only) | Show the reason word in small text before the subject on narrow rows, or use three distinct marks plus the word on the first line. |
| V2-03 | Legal Graph; Finance Burn | P2 | perf (I2) | Observed on the shared dev stack. Opening the Graph tab showed "Building graph..." in a grey box for about 25 s before the three columns appeared (checked at 2, 8 and 33 s). Once, opening Burn from the overview left the page on "Loading..." with skeleton blocks for more than 20 s (header showed only the back button); a reload then rendered it in about 2 s, and I could not reproduce it on later visits. Cannot say how much is dev-mode load from other walkers (suspected). | legal-graph-1440.png, fin-burn-1440.png | Legal graph tab and Finance Burn route (lazy chunks or queries, not traced) | Re-time on a production build; if still slow, show the graph tab content progressively and give the Burn route an error or retry state instead of an indefinite skeleton. |
| V2-04 | Inbox, first sort after Allow | P2 | flow (L5, C3) | Observed. After clicking Allow on "Let Praci sort your mail", the list was replaced by "Sorting your mail..." and five empty grey rows for about 25 s; none of Maya's mail was visible, while before the click she could read all of it. Expected: keep the unsorted rows visible (dimmed, per the Pass-20 decision) with the sorting note above them. | inbox-sorted-1440.png | `apps/web/src/pages/Inbox.tsx` sorting state (not traced) | Render the unsorted list under the "Sorting your mail..." line instead of skeleton rows. |
| V2-05 | Finance overview | P3 | visual (L4) | Observed (carried over from iteration 21, was V2-04). Breakdown card is 313 px tall and Upcoming card 346 px, so their bottom edges differ by 33 px. | fin-1440.png, geometry audit `grid.items-start` | `apps/web/src/pages/Finance.tsx` grid uses `items-start` | Use `items-stretch`, or show the same number of rows in both. |
| V2-06 | Artifacts grid | P3 | visual (L5, H6) | Observed (carried over, was V2-06). "MOCK Investor Update - September" wraps to two lines next to its "v2" badge, so that card is 95 px tall against 72 px for the others. | art-1440.png | artifacts card component | Truncate the title to one line and keep the badge on that line, as the list view does. |
| V2-07 | Legal Deadlines | P3 | visual (D5, H1) | Observed (carried over, was V2-07). Every one of 9 rows repeats Ask agent, Done and Dismiss at equal weight; together they outweigh the title. "Show closed" sits 11 px left of the Dismiss column edge. | legal-dl-1440.png | legal deadlines row component | Keep "Done" visible; show Ask agent and Dismiss on hover/focus or in a menu; align "Show closed" to the same right edge. |
| V2-08 | Finance Accounts | P3 | visual (H5, D2, H6) | Observed. The Week/Month/Quarter/Year control has no framed container (the overview's has one). The "Total cash" card is 170 px wide with an empty band to its right. On the balance chart the last two ticks "Oct 21" and "Oct 23" are 4 px apart while the others are 68 px apart. | fin-accounts-1440.png | accounts page and its chart tick code | Reuse the overview's range control; let the cash card span the row or sit beside the chart; drop the Oct 21 tick when it would collide. |
| V2-09 | Chat mail approval card | P3 | copy/a11y (I8, C2) | Observed. With several accounts connected the card starts on "From: Choose an account" and Send is disabled (`disabled` attribute, no title and no aria-describedby), so nothing says why Send is grey. The header also repeats the recipient in truncated form ("Needs approval - alex@nort...") while the To row shows it in full (phone and desktop). | draft-1440.png, m-approval.png | `apps/web/src/components/MailApprovalCard.tsx` line 473 (`disabled={busy || allowDisabled || needsAccount}`), line 267 (header recipient) | Link the disabled Send to a short hint ("Choose an account") via aria-describedby and visible text; drop the address from the header. |
| V2-10 | Thread dialog with Ask agent panel | P3 | visual (L4) | Observed. With the agent panel open the dialog spans x=336 to 1432 at 1440 wide: 20 px from the sidebar on the left, 8 px from the window on the right. Without the panel the dialog is 770 px wide and also not centered on the content area. | askagent-1440.png | thread dialog container sizing | Center the dialog in the content area with equal gutters, or cap its width so the right gutter matches 20 px. |
| V2-11 | Sidebar keyboard order | P3 | a11y (A2, I7) | Observed. The scrollable chat list is its own Tab stop with no accessible name (Tab order: Skip, Search, Show sidebar, Inbox, then the chat list container, then the account button). Keyboard users land on a nameless region between the pages and the account menu. | Tab trace; focused element is the `rk-scroll` list wrapper | sidebar chat list wrapper (`data-sidebar-group`) | Give the wrapper `tabIndex={-1}` or a label ("Chats") and a visible focus ring. |
| V2-12 | Finance Subscriptions; Legal Contracts | P3 | visual (H6, C1, L1) | Observed. At 1440 the Subscriptions table has about 800 px between the vendor and the "Per month" figure, so a row is hard to track. On Legal Contracts the $ amounts at the far right have no label (value of what?) and the list is 906 px tall in a 900 px panel (6 px of scroll). | fin-bottom.png, legal-1440.png | Finance subscriptions table; Legal contracts list | Cap the table width or add row hover; label the amount ("per year"/"total") in the first row or a column header; trim 8 px of padding in Legal. |
| V2-13 | Artifacts split view | P3 | visual (D5, C4) | Observed. In the list beside the viewer, long names truncate ("MOCK All-hands Notes - O...", "MOCK Seed Fundraising Pl...") while every row repeats "10m ago". The vertical rule between list and viewer stops at y=697 instead of the panel bottom. Month cells show raw ISO ("2026-04"). | art-open-1440.png | artifacts list and table viewer | Drop the relative time when all rows match or move it to a tooltip so names get the space; extend the rule; format months as "Apr 2026". |
| V2-14 | First-run tour card | P3 | visual (D2, L3) | Observed. On first load the tour card sits over the bottom of the chat list ("Leadership sync" half hidden) and has an empty band between its sentence and the Skip tour / Next row (card is 140 px for one sentence). The fixed spot is the owner's decision; only the empty band is reported. | s1.png | tour card component | Tighten the card to its content. |
| V2-15 | To do card (open) | P3 | visual (H6) | Observed. The due date at the right of each to-do ("Nov 21", "Oct 22") is aligned to the top of the row about 4 px above the title baseline. | todo-open-1440.png | to-do row in Inbox | Align the date to the title baseline. |
| V2-16 | Inbox list footer | P3 | visual (H6) | Observed. "Show 15 more" starts at x=355 while the rows' left edge is 344 and their sender text starts at 384. Geometry audit near-miss edges [344, 347] repeat on every Inbox state. | inbox-sorted2-1440.png | Inbox list footer button | Align the label with the sender column or the row edge. |

Dismissed: contrast ratios from the layout audit (dark-theme false positives); 18-20 px link heights (no touch emulation); "Hide amounts" appearing on once during the walk (another walker's per-user toggle on the shared account); focus return to the attachment chip after closing the preview was not re-measured (the Escape on the thread dialog returned focus to its row); the "Legal agent" chat under "Empty space" (could not attribute it to this walk, so no claim about the Pass-20 rule that opening an empty space does not create a chat).

## Excellent as is

- Inbox sorted view: collapsed "To do 4", Needs reply with a reason chip ("To do - Thu, Oct 29", "Urgent", "Action"), "Show N more" and the Cleanup empty line are calm and plain. Opening To do shows four clear rows with a source line and a colored due date.
- Thread dialog and attachment preview: one primary (Reply), Archive and Ask agent beside it, the PDF rendered inline, "Added" and "Download" in the preview header, Escape closes in order.
- Ask agent panel: short suggestion chip ("Draft a reply"), the Mail card appears in the panel, and on a phone the card is full width with actions collapsed to "..." and a composer that says "Needs your answer".
- Finance: the five KPI cards, the range control, the burn chart with the financing marker fully visible, Accounts that fit one screen, and numbers that reconcile (accounts sum to the $1,633,221 cash total; burn by account is 86% + <1% + 14%).
- Legal phone list: value, dates and due text read well with no horizontal scroll; Legal Graph shows three readable columns once loaded.
- Approval toast: bottom-right, persistent, with a chevron and a close button; sits above the page content on desktop and phone.
- Shell at 1920x1080: content is capped at 1440 and centered, sidebar and header regions align, no page scroll. Phone drawer lists pages with badges and a short chat list with "+N more".
