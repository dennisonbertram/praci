# Visual inspection V2 (Inbox, Finance, Legal, agent chat, Artifacts)

Session uxl12-V2. Target: the mock-data demo stack (web port 5381), signed in as the seeded mock founder. Viewports 1440x900, 375x812 (mobile) and 1920x1080 (shell only). Screenshots are in `/tmp/uxloop12/V2/` (outside the repo).

Method notes:
- `layout-audit.js` and `geometry-audit.js` ran on every page state. The audit's "low contrast" list (ratios around 1.3) is a false positive: the dark theme uses transparent backgrounds and the script cannot resolve them. Readable text was confirmed by eye in every screenshot, so no contrast finding is filed.
- Touch emulation (`pointer: coarse`) was not available in this browser tool, so no touch-target findings are filed (per the owner's rule).
- Other walkers shared this demo stack, so counts changed during the walk (Legal went from 12 to 15 contracts and from 8 to 12 deadlines after another session's re-scan; the Inbox finished sorting on its own). Findings below that depend on shared state say so.

## Verdicts

| Page / state | 1440x900 | 375x812 | Verdict |
|---|---|---|---|
| Shell (sidebar, header) | Clean; sidebar chat list scrolls inside its panel | Drawer is clear; Activity toggle works | Good |
| Shell at 1920x1080 | Content capped at 1440 px and centred; Inbox fits one screen | not applicable | Good |
| Inbox, consent card | Compact, one primary action, "Not now" present | not checked | Good |
| Inbox, sorting in progress | Rows leave the list one at a time, list shifts (V2-04) | not checked | Needs work |
| Inbox, Important/Updates/Newsletters, Digest, Filter | Good; Digest is a clear summary with per-sender Open | Good; To do card + Needs reply group fit first screen | Good |
| Inbox, Cleanup | Compact empty state | not checked | Good |
| Inbox, thread with attachment, preview | Excellent (see list below) | Good, dialog fills screen | Excellent |
| Email agent panel | Good; panel opens beside the mail | not checked | Good |
| Finance overview | Scrolls inside its panel (V2-01), wasted width in Subscriptions (V2-02) | Good, stacks cleanly | Mostly good |
| Finance Accounts / account detail | Fits one screen, numbers reconcile | Company switcher clipped at right edge (V2-03) | Good with one defect |
| Finance Burn | Good; loading was slow (V2-12) | no overflow | Good |
| Legal, Contracts | Table works but truncates the notice period (V2-05) | Excellent card layout | Good |
| Legal, Deadlines | Clear, overdue handled well; repeated copy (V2-06) | Good | Good |
| Legal, Graph | Readable, has a hint line | not checked | Good |
| Agent chat (question card, approval cards, artifact link) | Good; approval states in words plus colour | Good | Good |
| Artifacts | Grid and master/detail both clean | List is clean | Good |

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| V2-01 | Finance overview | P2 | visual | OBSERVED. At 1440x900 the page content is 1265 px tall in a 900 px panel; the Subscriptions card is cut at the fold. Norm L1 (dashboards fit one screen at 1280x800 or larger, long content scrolls inside a panel). The page itself does not scroll (pageScrollY 0), the main panel does. | `14-finance-1440.png`, `15-finance-bottom.png`; layout-audit scroller clientH 900 / scrollH 1265 | `apps/web/src/pages/Finance.tsx:117` (single scrolling container for all cards) | Keep KPIs, chart and Breakdown/Upcoming on the first screen and make Subscriptions its own inner scroll or a tab, or shrink the chart height. |
| V2-02 | Finance overview, Subscriptions card | P2 | visual | OBSERVED. The table uses about 690 of 1070 px; the right 40 percent of the card is empty. Norm D2 (no dead bands). | `15-finance-bottom.png` | `apps/web/src/pages/Finance.tsx` (subscriptions table width) | Let the table fill the card or place Subscriptions beside another panel. |
| V2-03 | Finance Accounts at 375 | P2 | bug | OBSERVED. The "Northwind Robotics" company switcher is clipped by the right screen edge (button right edge 389 px, viewport 375). Norm L6. | `50-accounts-375.png`; DOM measure of the button: left 244, right 389 | `apps/web/src/components/finance/ui.tsx:113` (`shrink-0` on the trigger inside a non-wrapping header row) | Remove `shrink-0` or let the header row wrap so the trigger truncates. |
| V2-04 | Inbox while sorting | P2 | flow | OBSERVED. After Allow, the list is reshuffled for about 40 s: the loading skeleton gives way to rows, the status line height changes (list moves up 14 px), and rows leave Important one by one (unread count 11 to 10 to 9) while the reader may be pointing at a row. Norm L5 (stable layout). The "Sorting is taking longer than usual" message then appeared although sorting continued; the final sorted view (To do card, Needs reply group) appeared without any action. The retry copy may mislead. | `04-inbox-allowed-1440.png`, `05-inbox-sorted-1440.png`, `06-inbox-t40.png`, `07-inbox-failed.png`, `40-inbox-1920.png` | Inbox list sorting state (not located) | Hold the visible list until sorting completes, then swap once; keep the status line height fixed. |
| V2-05 | Legal, Contracts table | P2 | visual | OBSERVED. The Renewal column cuts the notice period ("Auto-renews, 30 days no..."), which is the fact Maya needs, while Contract and Parties wrap to two lines and the Status column (75 px) is empty in 9 of 12 rows. Norms C4 and D2. The full text is only in a tooltip (title attribute). | `18-legal-1440.png`; th widths Contract 235, Parties 150, Status 75, Renewal 182 | `apps/web/src/pages/Legal.tsx` (table colgroup, `w-[22%]`, `w-[19%]`) | Give Renewal the spare width or wrap it; fold Status into the Contract cell when set. |
| V2-06 | Legal, Deadlines | P2 | copy | OBSERVED (after another session's re-scan, 12 rows). Every derived row repeats "Derived from the expiration date and the notice period." and four "Expires:" rows are dated 2027 and 2028, below the horizon Maya acts on. Norm C2. SUSPECTED, not verified: the overdue "Q3 board consent signature" row present in the first view was gone after the re-scan; another walker may have marked it Done, so check that a re-scan never drops a hand-added overdue deadline. | `19-legal-deadlines.png` (before), `44-deadlines2.png` (after) | `apps/web/src/pages/Legal.tsx` (deadline row note) | Show the derivation note once per list or on hover, and collapse far-future expiry rows under a "Later" group. |
| V2-07 | Legal, Contracts to contract | P2 | flow | OBSERVED. Clicking a contract title opens the PDF in Data room (sidebar highlights Data room); Legal's extracted fields (parties, notice, deadline) are not shown beside it and there is no Back control except the browser's. Clicking any other cell does nothing although the row has a hover highlight. Norm I1 (affordance). | `21-contract.png`, `22-legal-row.png` | `apps/web/src/pages/Legal.tsx` (row link only on title cell) | Make the whole row open the same target and add a "Back to Legal" crumb on the opened item, or show a short contract detail panel. |
| V2-08 | Finance header sync chip | P3 | a11y | OBSERVED. The visible text is "Mercury, Brex · synced just now" but the accessible name is "Mercury, Brex, 1 non-USD not counted". Norm A2 (label in name); a voice-control user saying the visible words may not match. | snapshot ref e468 on `/app/finance` | `apps/web/src/pages/Finance.tsx` (sync link) | Start the accessible name with the visible text. |
| V2-09 | Finance Burn charts | P3 | visual | OBSERVED. The Financing marker is labelled "$250,000" but sits on the $150k gridline, so it is not on the axis scale. | `14-finance-1440.png`, `45-burn.png` | Finance burn chart component (not located) | Plot financing on its own scale or label the marker as off-scale. |
| V2-10 | Finance Accounts tile | P3 | visual | OBSERVED. "Card balance owed" shows only a dash with "Brex does not share it", a full tile of no data. Norm D5. | `16-accounts-1440.png` | `apps/web/src/pages/finance/FinanceAccounts.tsx:320` | Hide the tile unless a card balance exists, or show the note under Total cash. |
| V2-11 | Finance sub-pages performance | P2 | perf | OBSERVED, cause SUSPECTED. In-app navigation from Finance to Burn sat on the "Loading..." skeleton for 10 s on one attempt and over 20 s on another, while a direct load of the same URL took about 2 s. The first cold load of `/app/legal` took 25 s, a repeat 0.6 s. Likely load from several walkers on one demo stack; not verified on an idle stack. | `45-burn.png` (skeleton), timing loop output | not located | Re-time on an idle stack; if it persists, find the rpc call that blocks the Finance sub-page route. |
| V2-12 | Agent chat tool pills | P3 | visual | OBSERVED. In the Mercury agent thread a "Messaged New Bot" or "Message from X" pill follows nearly every message; repeated chrome with no new information. Norm D5. Duplicate cards here come from parallel walkers and are not reported. | `36-approval-1440.png`, `35-approval-375.png` | chat tool-call pill renderer (not located) | Group consecutive pills into one expandable line. |
| V2-13 | Inbox rows with attachments | P3 | visual | OBSERVED. The Q3 board deck row has no attachment mark; "(PDF attached)" is only in the subject. Norm I6 (recognition). The Filter menu has "Has attachment", so the data exists. | `11-riley-exp.png` | `apps/web/src/components/inbox/InboxRow.tsx` | Show a small paperclip next to the time on rows with attachments. |
| V2-14 | Legal Deadlines actions | P3 | visual | OBSERVED. Ask agent, Done and Dismiss repeat on each of 8 to 12 rows, so the right third of the page is button chrome. Norm D5/H1. | `19-legal-deadlines.png` | `apps/web/src/pages/Legal.tsx` (deadline row) | Show Done as the only visible action and move Ask agent and Dismiss into a row menu. |

## Excellent as is

- Email thread dialog: sender, recipient, date and four actions on a compact header, then body and attachment chip; at 375 it reflows without loss.
- Attachment preview: real PDF rendering, "Add to Data room" and "Download" in the header, Escape closes only the preview, focus returns to the attachment chip, then to the list row.
- Inbox keyboard model: one Tab stop per row, with hover actions reached by arrow keys (a deliberate pattern, covered by tests in `InboxRow.test.tsx`), so hover-only actions are still keyboard reachable.
- Email agent panel: opens beside the email, "Draft a reply" chip, clear composer.
- Digest: one card per sender, a single bulk action, per-sender Open.
- Finance Accounts page: fits one screen at 1440x900 and the account rows sum to the cash tile.
- Legal Deadlines: the overdue row leads the list with a red date and "Overdue by 5 days" in words.
- Legal Graph: four labelled columns and a hint line ("Select an item to see its relations").
- Legal at 375: contracts become label/value cards with no horizontal scroll.
- Artifacts: grid at desktop, list plus preview when one is open, list at 375.
- Approval cards state outcomes in words and colour ("Denied", "Approved here. Waiting for Mercury"); the approval toast sits bottom-right and persists as decided.
- Mobile drawer: pages, spaces and chats in one panel, with Activity as a toggle.
