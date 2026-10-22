# Visual inspection V2: Inbox, Finance, Legal, agent chat, Artifacts

Session uxl14-V2. Target: mock-data demo (web port 5381). Walked 2026-10-22 at 1440x900, 375x812 and 1920x1080 (shell). Screenshots are in `/tmp/uxloop14/V2/`.

Limits of this walk:

- Touch emulation did not take effect (`matchMedia("(pointer: coarse)")` stayed false after `set device`), so no touch-target findings are reported.
- The host load average was above 100 during the walk, so full page loads took up to 13 s and one load showed "Still opening... Try again". That is an environment effect, not a finding. The fallback itself is good.
- The Mercury agent thread is shared with other walkers, so cards from other requests appear in it. They are not reported.
- No payment was approved. The only card that was live belonged to another walker.
- Contrast: `layout-audit.js` reports ratios of 1.2 to 1.4 for sidebar text. Those are false readings (transparent backgrounds). A direct computation gives 5.45:1 to 6.06:1 for the dimmest Finance text.

## Verdict per page and viewport

| Page / state | 1440x900 | 375x812 | 1920x1080 | Verdict |
|---|---|---|---|---|
| Inbox, consent card (before Allow) | Clear, one primary action | not captured | not captured | Excellent |
| Inbox, sorted piles (To do, Needs reply, Earlier) | No page scroll, list scrolls inside its panel | Reflows cleanly, no horizontal scroll | Shell only, not captured (slow load) | Good. V2-08, V2-12 |
| Inbox, Cleanup (empty) | Compact, one next step | not captured | n/a | Good |
| Inbox, thread dialog with attachment | Well structured, Reply is the one primary | Good | n/a | Excellent. V2-16 |
| Inbox, attachment preview | Clear, Add to Data room and Download | not captured | n/a | Excellent |
| Inbox, Ask agent panel | Works, panel takes right third | not captured | n/a | Good. V2-13 |
| Finance overview | Inner scroll only, KPIs good, chart busy | KPIs reflow into a 1+2+2 grid | Centered at 1440 max, even gutters | Needs work. V2-01 to V2-03, V2-14 |
| Finance Accounts / Burn / Runway | Runway fits one screen; Accounts and Burn have an empty band beside one card | not captured | n/a | Runway excellent; others good. V2-17 |
| Legal Contracts | Dense table, blank Status column | Card per contract, clear | n/a | Needs work. V2-04 |
| Legal Deadlines | Clear, overdue in words plus color | Good, ragged buttons | n/a | Good. V2-18 |
| Legal Graph | Hairball, needs sideways scroll | not captured | n/a | Below excellent. V2-05 |
| Chat with question card (Investor Relations) | Clear | not captured | n/a | Excellent |
| Chat with approval toast and card (Mercury agent) | Toast covers last messages when side panel is open | Card good | n/a | Needs work. V2-07, V2-09, V2-10 |
| Artifacts list and viewer | Master-detail works | List collapses to viewer with back arrow | n/a | Good. V2-19 |

Every surface measured `pageScrollY = 0` and `pageScrollX = 0` at all three sizes. No horizontal overflow.

## Findings

Status key: observed means seen in a screenshot or measured; suspected means inferred from code or one signal.

| id | Page / story | Sev | Cat | What happened vs expected | Evidence | Code | Proposed fix |
|---|---|---|---|---|---|---|---|
| V2-01 | Finance overview | P2 | visual | Observed. The Breakdown card ends and leaves a dead column about 450 px tall at 1440 (and the same at 1920), because the right column stacks Upcoming plus Subscriptions. Norm D2, L4. | `finance-bottom-1440.png`, `finance-1920.png` | `apps/web/src/pages/Finance.tsx:682` (`grid items-start gap-3 @3xl:grid-cols-2`) | Put Breakdown and Subscriptions in the left column and Upcoming in the right, or use two independent flex columns. |
| V2-02 | Finance overview and Burn | P2 | visual | Observed. The "Out" area ends with a hard vertical edge at Sep while the x-axis continues to "Oct*". It is not clear which series the Oct* dot belongs to, although "Out so far this month $20,484" is shown above. Suspected: the partial month is drawn only for Revenue. Norm C3, H5. | `finance-1440.png`, `fin-burn-1440.png` | `apps/web/src/components/finance/charts.tsx` (BurnLines) | Draw the month-to-date point on the Out line too, with the "So far" marker, or end the area at the last full month and drop the Oct* tick. |
| V2-03 | Finance overview | P3 | visual | Observed. The overview chart starts at Nov '25 with three flat $0 months that take about a quarter of the width. The Burn page starts at Mar '26. Same data, two ranges. Norm H5, D2. | `finance-1440.png` vs `fin-burn-1440.png` | `charts.tsx` range start | Start both charts at the first non-zero month. |
| V2-04 | Legal, Contracts | P2 | flow | Observed. The Status column is blank for 10 of 16 rows and shows a badge only for Draft or Unknown. A blank cell does not say "Active". The column also takes width while contract names wrap to two lines. Norm C1, C3, D2. | `legal-1440.png` | `apps/web/src/pages/Legal.tsx` (contracts table) | Show "Active" (or hide the column when every row is active) and give the width to Contract. |
| V2-05 | Legal, Graph | P2 | visual | Observed. Four columns do not fit; edges cross behind the Jurisdiction nodes and run off the right edge. The page admits it with "Scroll sideways to see the whole graph." For Maya the tab answers no question she has. Norm L6, C4. | `legal-graph-1440.png` | `apps/web/src/components/legal/LegalGraph.tsx:178` | Fit the graph to the panel (zoom to fit) and drop the sideways-scroll hint, or open it focused on one contract. |
| V2-06 | Legal | P3 | visual | Observed. "37 Data room documents not yet checked by Legal" is a full-contrast underlined link between the header and the tabs. It looks like a stray link, not a status with an action. The click works and lands on Data room filtered to "Legal: Not checked". Norm H5, I1. | `legal-1440.png`, `legal-link-1440.png` | `apps/web/src/pages/Legal.tsx:375` | Style it as a quiet notice row with an explicit "Review" action. |
| V2-07 | Approval toast over a chat | P2 | visual | Observed. With the bot settings panel open, the "Mercury agent needs approval" toast sits inside the chat column and covers the bottom of the last user bubble. It persists until dismissed (owner decision), so it can hide the latest reply. Norm L3. | `newbot-card3-1440.png` | toast host (stack anchored to the chat column) | Anchor the toast to the viewport bottom-right, outside the chat column, or reserve space above the composer while a toast is shown. |
| V2-08 | Inbox, Needs reply | P2 | flow | Observed. Rows are not in time order: 4:27 AM, Oct 20, 5:27 AM, 2:27 AM, 2:27 AM. No label says the order is by priority. Maya may read it as a bug or miss the newest mail. Norm I6, C3. Suspected cause: sort by urgency. | `inbox-piles-1440.png` | Inbox needs-reply pile sort | Sort by date within the pile, or label the pile "Most urgent first". |
| V2-09 | Chat, delegated payment | P1 | flow | Observed, partly suspected. After "Pay Acme Servo Supply $250", the New Bot thread ends at the chip "Messaged Mercury agent". The composer placeholder reads "Needs your answer", and the sidebar row reads "Message bot". The approval card is in the Mercury agent thread, and only the toast leads there. Owner decision says such a bot shows "Waiting for approval"; I saw no such text in the thread or the sidebar row. Part of the area was covered by the toast (V2-07), so confirm after fixing V2-07. Norm C3, I6. | `newbot-card3-1440.png`, `approval-1440.png` | sidebar row subtitle and composer placeholder | While a delegate approval is pending, show "Waiting for approval" in the sidebar row and thread tail, and keep the composer placeholder as "Message {bot}". |
| V2-10 | Approval card states | P2 | copy | Observed. A card whose request was replaced shows only "No longer active". Maya cannot tell if she did something wrong or if it timed out. The code already knows superseded versus expired. Norm C3, I3. | `approval-1440.png`, `approval-375.png` | `apps/web/src/components/AskCard.tsx:42` and `:264` (`!canAnswer` branch uses one generic string) | Say "Replaced by a newer request" for superseded and "Expired" for expired, in the card body too. |
| V2-11 | Finance agent payments | P2 | flow | Observed. Maya sees "Landlord Placeholder LLC" and "Cloudnine Hosting" on Finance, but the agent can pay only "Acme Servo Supply (Mock)" (the only Mercury recipient). The failure text is honest ("add the recipient at the bank first. No payment request was created.") but gives no link or next step. Likely a mock-data limit, but the dead end is real for a first-time user. Norm I3. | `newbot-card2-1440.png` | Mercury agent failure copy | Add a link to the Mercury recipients page (or an "Add recipient" instruction) to that message. |
| V2-12 | Inbox rows | P3 | visual | Observed. Hovering a row shows Archive and Mark read, and the snippet re-truncates earlier (about 90 px shorter). The row does not shift, but the text reflows. Norm L5. | `inbox-hover-1440.png` | Inbox row hover actions | Overlay the actions on a gradient over the snippet instead of reflowing it. |
| V2-13 | Inbox, email Ask agent | P3 | a11y | Suspected. After "Ask agent" opened the panel, focus stayed on the "More" button; the panel's input did not take focus. The test click may not move focus the way a real click does, so verify by keyboard. Norm I7. | `askagent-1440.png` | email dialog agent panel | Move focus to "Ask about this email" when the panel opens from the keyboard. |
| V2-14 | Finance overview | P3 | visual | Observed. KPI sublines, "Show all N", "Oct 1 - 22" and chart footnotes are 11 px. Contrast is fine (5.45:1) but the size is under the 13 px dense-tool floor. The subscriptions header "Last charge" also wraps to two lines at 1440. Norm D1. | `finance-1440.png`, `finance-bottom-1440.png` | `apps/web/src/pages/Finance.tsx`, `components/finance/ui.tsx` | Raise secondary text to 12 px and widen the "Last charge" column. |
| V2-15 | Inbox To do, chat stuck state | P3 | a11y | Observed. The To do checkbox is 16x16, and the "Stop" and "Try again" links on a stuck "Thinking 7m 59s" turn are 26x18 and 50x18. Under the 24 px desktop minimum. Touch not measured. Norm I4. | `inbox-piles-1440.png`, `chat-fh-1440.png` | Inbox To do card; chat stall row | Pad these hit areas to at least 24 px. |
| V2-16 | Inbox thread dialog | P3 | visual | Observed. The body text starts at 32 px while the header, buttons and attachment start at 16 px (clear on phone). Norm H6. | `thread-375.png` | email body `p-4` wrapper | Align the body to the header edge. |
| V2-17 | Finance Accounts and Burn | P3 | visual | Observed. One small KPI card (170 px) sits above a full-width row, leaving most of the row empty. On Burn, "By account" is short and leaves a gap under it. Norm D2. | `fin-accounts-1440.png`, `fin-burn-1440.png` | Accounts and Burn page headers | Put the KPI card in the page header row or beside the chart. |
| V2-18 | Legal Deadlines, phone | P3 | visual | Observed. Ask agent, Done and Dismiss start at a different x on each row because the date width varies (x = 235, 231, 218, 236). Norm H6, L4. | `legal-deadlines-375.png` | Deadline row layout | Give the date a fixed width, or put the buttons on their own aligned row. |
| V2-19 | Artifacts, Page type | P3 | visual | Observed. A Page artifact renders as a full white sheet in the dark app. It is an isolated preview so this is expected, but the glare is large. Norm H5. | `artifact-page-1440.png` | artifact viewer iframe | Optional: dim the frame or honor `prefers-color-scheme` in generated Page artifacts. |
| V2-20 | Sidebar (seeded spaces) | P3 | visual | Observed. Under "Empty space" there is a section header with nothing under it, and "Reconnect needed", "Mail needs reconnect" and "Mail rate-limited" each repeat a Chief or Inbox agent row. Probably demo fixtures; a real user with one space would not see this. Norm C2. | `finance-bottom-1440.png` | demo seed | None needed unless real users can reach an empty space header. |
| V2-21 | Finance overview chart | P3 | visual | Observed. The Financing marker for $250,000 sits on the $150k gridline. This is intentional (a capped marker with "Financing, Oct ↑ $250,000", test id `financing-clipped`), but a hollow dot on a gridline can be read as $150k. Norm C3. | `finance-1440.png` | `charts.tsx:615-630` | Add a visible "off scale" tick or an arrow glyph on the marker itself. |

## Excellent as is

- Runway page (`fin-runway-1440.png`): fits one screen, four KPIs, a plain "Count crypto" switch with its one-line consequence, and a cash breakdown that sums correctly (77,000 + 28,250 = 105,250).
- Finance overview KPI strip and its phone reflow (1+2+2) with no horizontal overflow; Accounts totals add up (the five cash accounts sum to $1,633,221).
- Inbox consent card ("Let Praci sort your mail" with Allow and Not now) and the Updates/Newsletters tabs being visible before consent.
- Inbox on a phone: header actions, search, To do card and rows reflow cleanly.
- Email dialog: a single primary (Reply), Archive, Ask agent and a More menu, with prev/next/close; Escape closes the menu, then the preview, and focus returns to the attachment button.
- Attachment preview: filename, Add to Data room, Download, rendered PDF.
- Icon-only header buttons have names and tooltips (Cleanup tooltip verified). The focus ring is a 3 px shadow, visible.
- Legal Deadlines: overdue marked in words and color, one clear action set per row, and a clean phone layout.
- Chat: the question card (Investor Relations) with two plain options; the approval card with one primary "Send $150.00" over "Deny", and the same card on a phone.
- The Mercury failure message states plainly that no payment request was created.
- Artifacts: master-detail list and viewer, with back arrow and Download on a phone; delete buttons have per-item names.
- Shell at 1920x1080: content caps at 1440 and stays centered with equal gutters; sidebar stays fixed width.
