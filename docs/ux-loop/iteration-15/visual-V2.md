# Visual critique V2 (uxl15-V2): Inbox, Finance, Legal, agent chat

Target: mock-data demo stack (web :5381). Signed in as the seeded mock founder. Screenshots: `/tmp/uxloop15/V2/`.
Viewports: 1440x900 (all pages), 375x812 (Inbox, thread, email agent, Finance, Legal, Artifacts, Chief, drawer), 1920x1080 (shell, Finance, Inbox, email dialog).
Method: screenshot read by eye, `layout-audit.js` and `geometry-audit.js` on Inbox, Finance, Legal, chat. Hover, Escape, focus return and menus tried.

Limits (stated so nothing is implied):
- Touch emulation (`pointer: coarse`) could not be switched on in this browser, so no touch-target finding is made. A 16px to-do checkbox and 22px task button on phone are unmeasured.
- Payment approval cards were not run (another walker's flow, and the demo model answers slowly). I did see a Mail approval card (Send / Discard) in an email-agent chat at 1920.
- The attachment PDF preview rendered blank in this headless browser; not judged.
- `layout-audit.js` reports contrast ratios of about 1.3 for nearly all sidebar text. That is the script mis-resolving transparent backgrounds; measured by hand, the orange user bubble is #111 on #f2622a (about 6:1). Not reported as a finding.
- Hide amounts flipped on and off during the walk (shared mock account, another session). Finance was judged in both states.

## Verdicts

| Page | 1440x900 | 375x812 | 1920x1080 |
|---|---|---|---|
| Inbox list (before consent, sorting, sorted) | Good. Sticky header, inner scroll, no page scroll. Skeleton and sorting status shift rows (V2-05). | Good. Clean rows, readable. | Good. Content capped at 1440, even gutters. |
| Inbox thread dialog | Good alone. With email agent open the panel covers the mail (V2-01, P1). | Good, full screen. Address wraps mid-address (V2-12). | Good, panel sits beside the mail. |
| Cleanup | Fine, empty state only (nothing to clean). | not captured | not captured |
| Finance overview | Strong. Two screens of content, scrolls inside pane. Chart marker issue (V2-03). | Good stacking. Status text truncated (V2-09). | Good. |
| Finance accounts and account detail | Excellent, one screen. | not captured | not captured |
| Legal contracts | Table rows tall and misaligned (V2-04). | Cards repeat five labels per contract (V2-06). | not captured |
| Legal deadlines and graph | Excellent deadlines list. Graph readable but busy. | not captured | not captured |
| Agent chat (Chief, Investor Relations, Finance helper, Inbox agent) | Good. Slow-answer state has Stop and Try again. | Good. | not captured |
| Artifacts list and document | Good. | Good. | not captured |
| Shell and Activity panel | Opening Activity can do nothing visible (V2-02, P1). | Drawer is good. | Good. |

## Findings

| id | page | sev | cat | status | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|---|
| V2-01 | Inbox thread, Ask agent | P1 | bug (L7, I1) | observed | At widths under 1568px the email agent panel is laid over the right half of the 768px dialog. The mail body is cut mid-sentence ("Can you che", "Thursday'") and the dialog's own previous, next and close buttons are hidden. The person cannot read the email while asking about it. At 1920 the panel sits beside the mail and works. | 12-ask-agent.png, 29b.png (1440); d1920-email-agent.png (good case). DOM: mail pane stays 736px wide under the panel. | `apps/web/src/components/inbox/InboxMessageDialog.tsx` around line 624 (`absolute inset-y-0 end-0 ... min-[1568px]:relative`) | Widen the dialog when the panel is open (about 1150px at 1280 and up), or add right padding to the mail pane so the panel never covers text. |
| V2-02 | Sidebar Activity | P1 | bug (I2, L2) | observed once at 1920x1080 | Clicking Activity opens the panel inside the sidebar list. If that list is scrolled (scrollTop 139) the panel opens above the visible area and nothing appears to happen. After scrolling the list to top, the panel shows one item with "Needs your answer" while three items are waiting (panel max height 160px). | d1920-activity3.png (nothing visible), d1920-activity4.png (panel after scrolling up). | `apps/web/src/pages/ActivityList.tsx:167` (`max-h-40 snap-start`) inside the scroller at `apps/web/src/pages/Shell.tsx:4702` | Scroll the list to top when Activity opens. Consider showing a "3 need you" count in the header so the hidden rows are known. |
| V2-03 | Finance overview burn chart | P2 | visual (H3, C3) | observed | The partial-month column "Oct*" draws two small dots stacked close together that read as an "8" glyph. The Financing note ("Financing, Oct up $250,000") floats about 110px above with a triangle that points at nothing. The dots have no visible label. | crop-chart.png, 17-finance-shown.png, m-finance.png | `apps/web/src/pages/Finance.tsx` burn chart (Out/Revenue dots for the partial month) | Draw the partial month as an outlined bar or labelled dot per series, and anchor the Financing marker on the axis next to its month. |
| V2-04 | Legal contracts table | P2 | visual (H6, D1) | observed | Contract column is top-aligned while Parties, Term, Renewal, Value are centered, so the first line of each row sits about 11px higher than its neighbours (row 1: 233 vs 244; row 9: 839 vs 850). Parties and Renewal wrap to two lines in fixed percentage columns, so rows are 57 to 78px tall and only 9 of 10 contracts fit at 900px. | 21-legal.png | `apps/web/src/pages/legal/LegalContracts.tsx` lines 195-250 (fixed `w-[..%]` columns, `whitespace-normal` cells, inline Title) | Vertically align all cells the same way (top is fine) and rebalance column widths so Renewal fits one line; aim for rows near 40px. |
| V2-05 | Inbox loading and sorting | P3 | visual (L5) | observed | Skeleton rows are 36px high, real rows 57px, so content jumps when mail loads. When "Sorting your mail..." appears, the list moves down about 12px and then rows leave the list as they are sorted into piles. | 06-inbox-allowed.png, 07-inbox-sorted.png, d1920-inbox.png | `apps/web/src/pages/Inbox.tsx:1627` and `:1673` (`Skeleton className="h-9"`) | Use the real row height for skeletons and reserve the status line height before sorting starts. |
| V2-06 | Legal on phone | P2 | visual (D5, D1) | observed | Each contract card repeats five labels (Parties, Term, Renewal, Value, Next deadline) and takes about 185px, so under four contracts fit a screen. With Hide amounts on, the Value line shows only "...". | m-legal.png | `apps/web/src/pages/legal/LegalContracts.tsx` (card list above the table, around line 170-188) | Drop labels that carry no new information: show parties under the title, term and renewal on one line, and the next deadline as a date chip; omit Value while hidden. |
| V2-07 | Inbox filter menu | P3 | copy (C2, H5) | observed | "Important" is both a tab and a filter item, and Filter also holds "Gmail tabs". Two controls with the same name filter differently. | 04-filter.png | `apps/web/src/pages/Inbox.tsx` filter menu | Rename the filter item (for example "Marked important") or remove it while the Important tab exists. |
| V2-08 | Finance with Hide amounts on | P3 | copy (C1, C3) | observed, may be intended | "Out so far this month ... ...% vs Sep 1 - 22" and "Globex Cloud ...%" read like broken values. The code masks change percentages on purpose (`finance-format.ts` line 134) because they reveal amounts, but the decision says Hide amounts hides money only. | 16-finance-1440.png, d1920-finance.png, m-finance.png | `apps/web/src/lib/finance-format.ts:134-150` | Leave the percentage out entirely while hidden instead of showing a masked "..%". Owner to confirm the percentage rule. |
| V2-09 | Finance header on phone | P3 | visual (C3, C4) | observed | Sync status truncates to "syncing..." and the Hide amounts control collapses to an unlabeled-looking icon beside it. | m-finance.png | `apps/web/src/pages/Finance.tsx` header | Let the sync text wrap under the title or drop to a dot with a tooltip, and keep the label on the amounts control. |
| V2-10 | Finance overview vs Accounts | P3 | visual (H5) | observed | The overview defaults the range control to Month inside a full-width bar; Accounts defaults to Year with a different, right-aligned pill style. Accounts also shows a 170px KPI card with an empty band to its right. | 17-finance-shown.png, 19-accounts.png | `apps/web/src/pages/finance/` (Accounts) | Use one range control component and one default across Finance pages. |
| V2-11 | Sidebar search on load | P3 | visual (H1) | observed | The sidebar Search box carries a thick white focus ring on first load of every page, which is the strongest mark on the screen. | 02-inbox-1440.png, 04-filter.png | Shell autofocus on search | Do not autofocus search on load, or use the quiet ring until the person presses Tab. |
| V2-12 | Inbox thread on phone | P3 | visual (D4, H6) | observed | The sender address wraps mid-address ("quill-/capital.example.test") and the date is squeezed on the same line. | m02-thread.png | `apps/web/src/components/inbox/InboxMessageDialog.tsx` header | Put the date on its own line under the sender on narrow widths. |
| V2-13 | App load (perf) | P3 | perf | observed | One page load makes 16 `routines/list` calls and 5 `bots/list` calls. Two cold loads in a row stayed on "Opening Praci..." and "Still opening... Try again" for over 10s (the dev server was serving unbundled modules, so this may be dev-only). | network log counts, m-legal first capture, d1920-finance first capture | `rpc/routines/list` called per bot in the sidebar | Fetch routines once for all bots. Re-check cold load time on a production build. |
| V2-14 | Finance overview height | P3 | layout (L1) | observed | The overview is 1274px tall at 900px viewport (1.4 screens). It scrolls inside its panel with a sticky header, so it passes L1, but Subscriptions is cut off at the fold. | 16-finance-1440.png, 18-finance-bottom.png | `apps/web/src/pages/Finance.tsx` | Optional: collapse Subscriptions to five rows. No change needed for L1. |

## Excellent as is

- Inbox row design: sender, subject plus summary line, time; unread dot and weight; hover actions; reason words (Urgent, Important, Action) only on rows that need them; "Needs reply" newest first with five rows and "Show N more"; the To do card with dates.
- Email dialog without the panel: one primary action (Reply), compact header, focus returns to the clicked row after Escape.
- Email agent panel at 1920 and on phone: beside the mail on wide screens, full screen on phone with a back arrow; the Mail approval card with Send as the single primary and Discard quiet.
- Finance accounts and account detail: one screen, clear hierarchy, right-aligned amounts, sign shown only on inflows.
- Legal Deadlines tab: overdue shown in words and color ("Overdue by 5 days"), three plain row actions, a clear date column.
- Data room opened from a Legal contract: "Back to Legal" link, preview with metadata.
- Chat: grouped bubbles, a NEW divider, a "4 new messages" pill, the single-choice question card, and the slow-answer state ("Taking longer than usual. Stop, Try again").
- Artifacts: even cards, list and preview split, clean phone version.
- Mobile drawer: full navigation in one column with unread and failure badges.
