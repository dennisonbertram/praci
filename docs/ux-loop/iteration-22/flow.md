# Iteration 22 - FLOW critic

Target: mock demo (web :5381), session uxl22-FLOW at 1440x900, mock founder account (AI consent not given on that account, so the Inbox "To do" card and sorted piles were not on screen). A second session signed up a fresh invented user (walker-flow22) to re-measure first run. Other walkers were using the demo, so some state (a "New Bot", a payment attempt, an "Investors agent" row) was not mine. Screenshots are in the walker's scratch folder (file names only below). Not exercised: Connect Gmail/Calendar and bank connection (OAuth, BLOCKED), approvals and payments (read the existing result only), skills, phone width.

## Iteration 21 flow findings, re-checked

| Iteration 21 | Result now |
|---|---|
| FLOW-01 Page agents expand shows nothing | Fixed. Expanding scrolls the group header up and shows both rows (`pa.png`). |
| FLOW-02 /app/settings is "Page not found" | Fixed. It opens Settings over the Chief chat. |
| FLOW-03 To do card repeats Needs reply | Not verified: this account has not allowed AI, so no card shows. |
| FLOW-04 Cmd+K lists page agents | Fixed. Empty palette shows 11 pages (nine pages, Integrations, Settings) and nothing else (`cmdk.png`). |
| FLOW-05 "New group" vs "New space" | Fixed. Menu reads New bot, New group chat, New space (`create.png`). |
| FLOW-06 Legal table clips Next deadline | Fixed. Legal is now a plain list; main scrollWidth equals clientWidth (1124) (`legal.png`). |
| FLOW-07 skeleton 5 to 9 s | Mostly gone: Fundraising ready in 2 s, Data room in 2 to 4 s. Investors is still slow, see FLOW-04. |

## Findings

### FLOW-01 Legal has two buttons that run the same scan
- Page: Legal. P2, flow/copy. Observed: the header has "Scan now" and, one row below the tabs, "32 Data room documents not yet checked by Legal" has its own "Check now" button (`legal.png`). Both call the same `scan()`. A founder cannot tell whether "Check now" is a smaller or different action, and the page keeps two names for one verb.
- Code (observed): `apps/web/src/pages/Legal.tsx:339` (Check now) and `:385` (Scan now).
- Fix: keep only the header "Scan now"; leave the unchecked count as plain text, or make "Check now" the only button and drop "Scan now" while documents are unchecked.

### FLOW-02 Investors says $350,000 raised; Fundraising and Finance show $250,000 funded
- Page: Investors, Fundraising, Finance. P1, flow (misleading figure). Observed: Investors "Equity raised $350,000, $50,000 committed" (`inv2.png` text read, `investors.png`). Fundraising lists two SAFEs: $250,000 Funded and $50,000 Sent (`fund.png`). The Finance chart marks "Financing, Oct $250,000" (`fin.png`). The Invested column in the cap table shows a dash on every row, so the extra $100,000 appears nowhere on screen. Iteration 21 saw $250,000 here. Pass-13 decided Equity raised counts only Funded SAFEs; a founder who adds the two pages cannot make them agree.
- Code (suspected cause): when no holder has an amount, the Carta summary total stands alone and may already include SAFEs (`packages/core/src/cap-table.ts:85-98`); the demo Carta snapshot sets `amountRaisedUsd: 350_000` (`packages/testkit/src/cli/demo/data.ts:1475`). It may be a seed mismatch rather than app logic; the app still prints a figure it cannot explain.
- Fix: when the figure comes from the Carta total, say so in the hint ("per Carta, as of Oct 1"), or make the demo seed equal Funded SAFEs plus the stated priced round so the page can show how it adds up.
- Note: Investors/Fundraising belong to another session; reported because it is P1.

### FLOW-03 A sidebar row says Failed and "Starting up..." while its chat shows a normal answer
- Page: sidebar roster (Investors agent). P2, copy/flow. Observed: the row shows the failed-state icon (`data-kind="failed"`, title "Failed") and the status line "Starting up..." with the working avatar (`pa.png`). Opening the chat shows no error: "An audit request arrived... I've asked the Inbox agent to retrieve the email... I haven't drafted a reply yet" (`inv-agent.png`). The row contradicts the chat, and "Starting up" is a computer-boot phase, not something a founder acts on.
- Code (suspected): the status line comes from the run phase (`apps/web/src/lib/run-phase.ts:9`, `computer_wait`) and the icon from an older unseen failed notification (`apps/web/src/components/sidebar-glance.tsx:81`), shown together without checking which is newer.
- Fix: show the failed mark only when the latest run failed; hide the "Starting up" line once the chat has a reply from that run.

### FLOW-04 Investors stays blank for about 11 s on a hard load
- Page: Investors. P2, perf (measured, with other walkers active). Observed: after `open /app/investors`, body text stayed at 76 characters (only the header and buttons) for about 11 s, then the table rendered. Fundraising on the same session was ready in 2 s; Data room in under 4 s. A blank page with no skeleton rows looks like a broken page.
- Code (suspected): the page waits for the Carta snapshot and the SAFE list before drawing the Action items and table.
- Fix: draw the table skeleton at once and fill the Action items card as it arrives; re-time on an idle demo before treating this as the app's cost.

### FLOW-05 A blocked payment reply sends the person to the Integrations hub
- Page: bot chat (payment reply). P2, flow, partly suspected. Observed: the reply says "Turn on Allow changes for Mercury under Integrations to enable payment requests. Open Integrations" and the link goes to `/app/integrations` (`nb.png`). From the hub the person must find Mercury, open it and reach the "Allow changes" switch (`McpDetail.tsx:333`), then confirm a dialog (`:404`). I did not click through; the count is from the code.
- Code: link text rule in `packages/adapters/src/executor.ts:8703`; fallback link `[Open Integrations](/app/integrations)`.
- Fix: link to the Mercury detail view (or open the Allow changes confirmation directly) instead of the hub.

### FLOW-06 First run starts with an extra landing click
- Page: first run. P3, flow. Observed: landing shows "Sign up" and "Sign in"; clicking Sign up reaches the form (Name, Email, Password, Create account), then "Run my company", then typing the question and Enter, then Allow: 9 actions to a real answer, one more than iteration 14's 8, the difference being the landing click (`s1.png` to `s6.png`). The answer is useful: "Add a bank account in Finance so I can check your cash... Open Finance", and Finance shows "No accounts yet - Add account" (`s6.png`, `s7.png`).
- Fix: when someone arrives from the sign-up call to action (or has no account on this browser), open the sign-up form directly; keep the landing for cold visits only.

### FLOW-07 The tour card covers the chat list rows on the seeded account
- Page: sidebar on the Chief chat. P3, visual/flow. Observed: while stop 1/9 is showing, the card sits over the lower part of the roster, so "Leadership sync (mock)" is cut off mid-row and Page agents and Archived are hidden (`inbox.png`). Pass-13 keeps the card in a fixed spot; the overlap is a side effect for accounts with five or more chats. Skip tour is one click and the card is absent on the fresh account's short roster.
- Fix: let the roster list end above the card (reserve the card height as bottom padding on the list) while the tour is active.

## Not findings (checked this pass)
- Hard navigation to /app/settings works; Settings keeps General, Privacy and approvals, Models and Advanced (`set.png`).
- Integrations appears in the sidebar and the account menu (`menu.png`): recorded decision (passes 6 and 8).
- The Data room row has a link and a separate "1 file failed" button: recorded decision (pass 15).
- Browser notifications sit in General only; time zone sits in General only (`set.png`). No second copy seen.

## Journey scorecard
| Journey | Actual / ideal | Verdict |
|---|---|---|
| First run: sign-up, first ask | 9 actions to a real answer (landing click, 3 fields, Create, Run my company, type and Enter, Allow); Connect Gmail/Calendar cards inline in Chief; connecting is BLOCKED (OAuth) | good; FLOW-06 |
| First run: tour | appears on the first page opened; nine stops, Skip is one click | good; FLOW-07 |
| Daily: inbox triage | Inbox 1 click; with AI not allowed it shows one "Let Praci sort your mail" card (Allow / Not now) above Today and Earlier groups (`inbox2.png`); sorted state not seen | n/a for sorted state |
| Money: runway check | Finance 1 click; five tiles in the first row, "Runway 24.2 mo, Until October 2028"; Chief gives the same cash and burn | minimal |
| Raise: Legal, Data room, Investors, Fundraising | 1 click each; Data room shows the unreadable NDA inline with its reason; figures disagree between Investors and Fundraising | FLOW-01, FLOW-02, FLOW-04 |
| Agents: create bot, approval | Create menu to New bot is 1 click and opens a chat with a blank-slate greeting; payment attempt ends in a link to the hub | FLOW-05 (approval card not exercised) |
| Integrations / Settings | 1 and 2 clicks | good |

## Praise (observed)
- Finance first screen: five tiles, one burn chart with the financing marker, Breakdown and Upcoming 30 days, nothing else (`fin.png`).
- Empty Cmd+K shows only pages (`cmdk.png`); Page agents expand now scrolls into view.
- Chief's first-run card turns into inline Connect cards for Gmail and Google Calendar, and an unconnected bank gets "Add a bank account in Finance" with a link to an empty state that has one button (`s4.png`, `s6.png`, `s7.png`).
- Integrations: Connected first, each card names what it reads, and shows which bot uses it and a button to the page that uses it (`integ.png`).
- Data room: failed file shown inline in red with its reason (`dr.png`). Legal list now fits at 1440 px (`legal.png`).
