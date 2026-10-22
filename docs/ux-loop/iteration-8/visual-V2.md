# Visual inspection V2 (iteration 8): Inbox, Finance, Legal, agent chat, Artifacts

Inspector: uxl8-V2. Target: mock-data demo stack (web :5381). Viewports 1440x900, 375x812 (touch emulation on, `pointer: coarse` confirmed true), 1920x1080 (shell, Finance only). Tools: `layout-audit.js` and `geometry-audit.js` on every capture, plus human interaction. Screenshots are under `/tmp/uxloop8/V2/`.

Caveats
- The demo stack was shared with other walkers. It restarted once mid-walk (session lost, new space id), and other walkers changed state (Allow on AI sorting, a "New Bot", agent messages). Slow loads below may be partly caused by that load.
- The demo has no model key, so agent answers cannot be judged. The email agent's "Failed to fetch" was caused by the stack being down at that moment and is not counted as a defect, except for the raw error wording (V2-09).
- Not walked: Cleanup with real candidates (empty on this data), Reply-with-draft card, secret request card, held "Share with {name}?" cards, Digest "Archive all" action, Finance sub-pages other than Accounts, contract detail.

## Verdicts

| Page / state | 1440x900 | 375x812 (touch) |
|---|---|---|
| Inbox list, consent card | Pass. Sticky header, list scrolls inside; page scroll 0. | Pass. Header buttons are 44px; rows readable. Small checkboxes (V2-06). |
| Inbox sorted (Needs reply, Updates, Newsletters, To do) | Pass, strong. | Pass with V2-06, V2-12. |
| Digest | Pass with V2-11, V2-14. | Not walked. |
| Cleanup | Pass (compact empty state), small misalignment V2-13. | Not walked. |
| Thread dialog, attachment preview, More menu | Excellent. Focus returns to the attachment chip after Escape. | Pass. Full-screen sheet, 44px actions. |
| Email agent panel | Pass layout. V2-09 (error wording), V2-15. | Not walked. |
| Finance overview | Pass, strong. V2-07 (empty column) only. | Pass with V2-05 (sync status has no visible words). |
| Finance Accounts | Pass. | Not walked. |
| Legal Contracts / Deadlines / Graph | Pass with V2-04, V2-08. | Pass; card layout shows full names. V2-16. |
| Agent chat (Investor Relations, Inbox agent, Finance helper) | Pass layout; V2-01, V2-02, V2-03. | Not walked (drawer and Activity panel seen). |
| Artifacts grid and detail | Pass. V2-10, V2-17. | Not walked. |
| Shell at 1920x1080 | Pass. Content is capped at about 1440px and centred; sidebar was a collapsed icon rail from my own mobile toggle, so not a finding. | n/a |

L1 (one screen) holds on every page at 1440 and 1920: `pageScrollY` was 0 everywhere and long content scrolls in an inner panel.

## Findings

| ID | Page / story | Sev | Cat | What happened vs expected | Evidence | Suspected code | Proposed fix |
|---|---|---|---|---|---|---|---|
| V2-01 | Agent chat, Finance helper (STORY-APP chat run) | P1 | flow | Observed: a run shows "Thinking 8m 49.8s" with the sidebar row "Working..." and an unread dot. No stall or failure state appears after nine minutes (demo has no model key). Expected: after a bounded time, say it is taking longer than usual and offer Stop and Retry (heuristics C3, I2, I3). | `/tmp/uxloop8/V2/chat-fin-1440.png` | thinking row in the thread; `lib/roster-status.ts` | Show a "Taking longer than usual" line with Retry after about 2 minutes and mark the sidebar row stalled. |
| V2-02 | Sidebar, Activity panel, chat | P1 | copy | Observed: one concept has three names: section "Needs you" (`Shell.tsx:6805`, `ActivityList.tsx:172`), row status "Needs your answer" (`lib/roster-status.ts:26`), badge "Needs input" (`components/sidebar-glance.tsx:63`). Violates C1 (one concept, one name) and H5. | Mobile Activity panel capture; desktop sidebar snapshot ("Page agents Needs you 5") | files listed | Pick "Needs your answer" and use it in all three places. |
| V2-03 | Sidebar, Inbox agent thread | P1 | bug (suspected) | Observed: the Inbox agent row says "Needs your answer" (also after reload), but the open thread contains no unanswered question; the only card reads "Answered: Approve". Activity later listed "Inbox agent: Chief asked: Please email jo... Needs input" and "Message from another agent". Suspected: an input request from another agent (or a second thread also named "Inbox agent") is not shown or answerable where the row sends her. Mixed with other walkers' activity, so not proven. | `chat-inbox-top.png`, `chat-inbox-bottom.png`, `drawer-375.png` | `lib/roster-status.ts`; thread rendering of agent-to-agent messages | Make the row open the exact item that needs input, and render agent-to-agent requests as answerable cards. |
| V2-04 | Legal, Contracts table (STORY-LEG) | P2 | visual | Observed: the contract name column is about 234px and truncates every name ("MOCK Insurance Policy - Shieldwe..."), while columns on the right have slack. The Parties and Renewal cells have a `title`; the name cell does not, so the full name is unreadable on hover. Violates C4. | `legal-1440.png`; code `pages/legal/LegalContracts.tsx:180` (no title) vs `:183`, `:192` | same | Give the name column more width or allow two lines, and add `title` to the name cell. |
| V2-05 | Finance overview, 375px | P2 | visual | Observed: the sync status shows only a green dot and a refresh icon. The text "Mercury, Brex · synced just now" is collapsed to 1px wide (screen readers get a label). Violates C3 (status in words plus colour). | `fin-375.png`; element widths measured: text span 1px | `pages/Finance.tsx:439` area | Show "Synced just now" as text next to the dot at phone width, or put it in the refresh button's tooltip and the summary row. |
| V2-06 | Inbox list and To do, 375px touch | P2 | a11y | Observed with `pointer: coarse`: row select checkboxes are 16x16 and To do checkboxes 20x20, always visible on touch. Violates I4 (44px on touch). Everything else measured at 44px or more. | `small.js` output on `inbox-375`; `inbox-375.png` | `components/inbox` row and `TodoCard` | Pad the checkbox hit area to 44px (invisible padding) and keep the glyph size. |
| V2-07 | Finance overview, Subscriptions | P3 | visual | Observed: the "3-mo change" column holds one value in the visible rows and is empty otherwise, so it reads as a dead column (D2). | `fin-bottom-1440.png` | `pages/Finance.tsx` subscriptions table | Show the column only when at least a few rows have a value, or move the change next to the amount. |
| V2-08 | Legal, Deadlines | P2 | visual | Observed: every one of 12 rows repeats "Ask agent / Done / Dismiss" (36 buttons), and "Mock demo data: added by hand" noise sits under most rows. Violates D5, H1 (no single primary action per row). | `legal-deadlines-1440.png` | `pages/legal/LegalDeadlines.tsx` | Show Done as the row action and move Ask agent and Dismiss into a row menu; show the extra lines only on expand. |
| V2-09 | Email agent panel | P2 | copy | Observed: a failed send shows a bare red "Failed to fetch". It says neither what happened nor what to do (I3). The text came from the stack being down, but a real network drop would show the same. | `askagent2-1440.png` | agent panel error rendering | Map network failures to "Could not reach Praci. Your message is kept. Try again." with a Retry button. |
| V2-10 | Artifacts detail | P3 | a11y | Observed: the "Isolated preview - no access to your account" lock is a plain span with a `title`, not focusable, so keyboard and touch users cannot reach it (I7). | DOM: span `title` on the lock icon | `pages/Artifacts.tsx` | Make it a button with an `aria-label` and a tooltip. |
| V2-11 | Inbox Digest | P2 | flow | Observed: Newsletters shows 3 rows (Docuflow Sales shown once, with a Junk tag), while Digest shows 4 groups, "Docuflow Sales - 2 messages", and "Archive all 6". The counts do not match between the two views, so "Archive all 6" archives mail she did not see listed. | `news-1440.png`, `digest-1440.png` | Inbox Digest component | Use one source for both views, or state why the list hides some mail. |
| V2-12 | Inbox, 375px, To do | P3 | visual | Observed: "Tomorrow" is drawn in the destructive red for a normal due date; red should mean overdue or failure (H4). | `inbox-375.png` | `components/inbox/TodoCard.tsx` | Use muted text for tomorrow and red only for overdue. |
| V2-13 | Cleanup | P3 | visual | Observed: the empty-state text starts at x=356 while the Inbox grid starts at x=344, a 12px shift between Inbox and its sub-page (L4). | `cleanup-1440.png` | Cleanup page | Share the Inbox horizontal padding. |
| V2-14 | Digest cards | P3 | visual | Observed: in each card the sender name is indented 16px relative to the subject line below it (373 vs 357), a left-edge miss (H6). | `digest-1440.png` | Digest card | Align the sender and subject to one left edge. |
| V2-15 | Inbox, consent card to sorting | P3 | visual | Observed: the list top moves 28px between the consent card, the "Sorting your mail..." line and the sorted list (L5). Spinner ended after under a minute, so no stall. Not seen with a stable page state otherwise. | `inbox-1440.png`, `inbox-sorted-1440.png` | `pages/Inbox.tsx:1514` area | Reserve a fixed height for the banner slot. |
| V2-16 | Legal at 375px | P3 | visual | Observed: contract cards take about 500px each, so ten contracts need about five screens; the "Last scan" line sits directly under the header with no gap; tabs "Contracts 10" and "Deadlines 12" touch. | `legal-375.png` | `LegalContracts.tsx` mobile card | Drop Term and Value into one line each and add 8px spacing under the header. |
| V2-17 | Artifacts grid | P3 | visual | Observed: in each card the "9m ago" right edge (640) does not align with the type label right edge (663) (H6). Also, the 1920 shell leaves a 55px empty band above the page title. | `artifacts-1440.png`, `fin-1920.png` | `pages/Artifacts.tsx` card | Right-align the time with the type label. |
| V2-18 | Cold page loads | P2 | perf | Observed: after a full reload, Artifacts, Legal and the chat thread show skeletons for about 7 to 15 seconds, with the sidebar empty for the first part. Finance Accounts loaded in about 3 seconds once warm. The stack was busy with other walkers, so this may be inflated. | timed polls during the walk; `legal-1440.png` (first capture), `artifacts-1440.png` | not located | Re-measure on a quiet stack; render the sidebar from cache first. |

## Excellent as is

- Inbox thread dialog: clear title, Reply as the single filled action, Archive and Ask agent secondary, attachment chip with its own menu; Escape returns focus to the chip.
- Attachment preview: filename, Add to Data room and Download in one row, PDF fills the panel; excellent.
- Inbox sticky header with the list scrolling underneath; tabs Important, Updates, Newsletters; "Needs reply" grouping and one-line AI summaries read well.
- Inbox on a phone: 44px header buttons, full-screen thread sheet, no horizontal overflow (page overflow X 0).
- Finance overview at 1440 and 1920: five KPI tiles with plain captions, one chart, breakdown and upcoming side by side, strong hierarchy, no page scroll.
- Finance Accounts: clear back affordance, "Brex does not share it" explains the dash.
- Legal on a phone: contracts as labelled cards without truncation.
- Artifacts master-detail: list left, preview right, Download and Maximize, sandbox noted.
- Chat bubbles use bot colour as the only identity colour; the question card with two option buttons is compact and clear.
