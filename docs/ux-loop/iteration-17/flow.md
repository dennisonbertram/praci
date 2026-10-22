# Iteration 17 - FLOW critic

Target: mock demo (web :5381), session uxl17-FLOW, 1440x900, the existing mock founder account, read-only. Screenshots are in /tmp/uxloop17/flow/. Not re-measured: first-run sign-up, model, tour (it would create an account; iteration 14 measured 8 actions and the onboarding code is a single "Connect a model" step), bot creation, skills and approvals (they create data), phone width, OAuth (BLOCKED). The demo account is shared with parallel walkers, so extra chats in the sidebar ("Update Writer", unread counts on "Page agents") are theirs and are not findings.

## Findings

### FLOW-01 Legal has two buttons that do the same thing
- Page: Legal (raise journey). P2, flow. Observed (`p-legal.png`); code confirmed.
- Happened: the header has "Scan now" and, in a row below the tabs, "39 Data room documents not yet checked by Legal - Check now". Both call the same `scan()` function. Maya cannot tell what differs, and the header also says "Last scan 3h ago. Scans daily."
- Expected: one scan action. The unchecked-documents row keeps its count but has no button of its own, or the header button is hidden while that row is showing.
- Code: `apps/web/src/pages/Legal.tsx:313-322` ("Check now") and `:352-356` ("Scan now"), both `onClick={() => void scan()}`.
- Fix: delete the "Check now" button and let the row's count text be the only addition (the header "Scan now" already runs it).

### FLOW-02 GTM before Zernio is connected repeats "Not connected" seven times
- Page: GTM. P2, flow. Observed (`gtm2.png`).
- Happened: a "Connect Zernio - Needed to post approved text" card is followed by a Channels table. X, LinkedIn, Threads and Bluesky each read "Zernio / Approve every post / Not connected", the same words four times and the same fact as the card above. Reddit, Hacker News and Product Hunt each read "Draft only" three more times. The goal card says "Give the GTM agent a goal" in the place where a goal would appear, and also has a separate "Edit" button.
- Expected: until Zernio is connected, one line ("Posting to X, LinkedIn, Threads and Bluesky needs Zernio") and the draft-only channels as one line. The table appears when there is something to differ between rows.
- Code: `apps/web/src/pages/gtm/GtmChannels.tsx:11-51`.
- Fix: collapse channel rows that share one status into a single row, or hide the table until Zernio is connected.

### FLOW-03 A new-item dot hides the Data room's failed-file count, so the one way to the failed view disappears
- Page: sidebar, Data room row. P2, flow. Observed: the row showed a red "1" on some screens (`p-data-room.png`, `create.png`) and a plain white dot on others with the same failed file present (`n-Investors.png`, `pa.png`). Cause suspected: other walkers were adding files, which makes "unseen" greater than zero.
- Happened: `glanceBadge` returns the dot whenever `unseen > 0` and only otherwise returns the value, so the failed count (and the "only the badge opens the failed files" decision) is gone while something new is unseen. The row's accessible label becomes "new". The Inbox and Legal counts use the same rule.
- Expected: a failure keeps its red count; the "new" dot is shown only when there is no failure to count.
- Code: `apps/web/src/components/sidebar-glance.tsx:25-37` (the `unseen > 0` branch runs before `value`), used at `Shell.tsx:4843`.
- Fix: in `glanceBadge`, return the value first when `failure` is true and `value` is set.

### FLOW-04 GTM page still shows an empty "Written by GTM agent" box, and the Channels table has no inset
- Page: GTM. P3, visual. Observed (`gtm2.png`); carried from iteration 16 FLOW-05. The code already hides the box when the page loaded empty (`Gtm.tsx:216-223`), so the box probably stays because the page content is not an empty string (suspected; not checked in the API).
- Happened: a bordered box holding only the caption, and a Channels table whose header and rows touch the card's left edge with "Channels" against the top border.
- Fix: hide the box when the trimmed content is empty (including whitespace-only text), and give the Channels table the cell padding the Legal table uses.

### FLOW-05 Finance chart still ends in a stray hollow mark
- Page: Finance. P3, visual. Observed (`p-finance.png`, small circle under "Oct*" near x=1328, y=430, next to the "Financing, Oct $250,000" call-out). Carried from iterations 15 and 16. Probably the partial current-month point (`FinanceBurn.tsx:110`, `partial`), suspected.
- Fix: draw the partial month as a dashed line to the last day with a value, or drop the lone marker when the month has no spend yet.

### FLOW-06 The space name sits in a different place on Inbox than on every other page
- Page: Inbox, Finance, Legal, Investors, Data room. P3, visual. Observed: Inbox shows "Northwind Robotics" at the far right of the toolbar, with no chevron (`p-inbox.png`); Finance, Legal, Investors and Data room show it next to the page title (`p-finance.png`, `p-legal.png`, `n-Investors.png`).
- Code: `apps/web/src/pages/Inbox.tsx:1357-1360`.
- Fix: move it next to the "Inbox" title like the other pages.

### FLOW-07 The cold load of a page can take over ten seconds and then offers only "Try again"
- Page: any page opened by URL. P2, perf. Observed, with a caveat. Opening `/app/gtm` showed "Opening Praci..." and then "Still opening... Try again" after about 12 s (`p-gtm.png`); `/app/inbox` showed a skeleton for 3 s or more and Finance loaded in under 3 s. Six other walkers were using the same stack, so I cannot separate app cost from load. Not re-measured with the stack idle.
- Expected: a first paint of the sidebar and the page title within a second or two, and a retry that does not need a click.
- Fix: measure `/app/gtm` cold with the demo stack idle; if it is still slow, find which request holds the shell back (the page agent is created on open, `Shell.tsx:3385`).

### FLOW-08 Three money-related agents answer overlapping questions
- Page: sidebar "Page agents" and Integrations. P3, flow. Observed (the Page agents list shows Inbox, Finance, Carta, Legal, Data room, Investors and Mercury agents, `pa.png` and the page text read). Suspected, not a P0/P1; Investors is owned by another session, and integration agents were decided earlier, so this is a note, not a request.
- Happened: a cap-table question could go to the Carta agent, the Investors agent or Chief, and a cash question to the Finance agent or the Mercury agent. The roster does not say which one a page's "Ask" opens.
- Fix: name the page's Ask target in the agent header ("Investors agent, uses the Carta agent for cap table reads"), or fold per-vendor agents under their page agent.

## Fixed since iteration 16 (observed)
- GTM is in the "Show in sidebar" menu and in Cmd+K's Pages list (`pageopts.png`, `cmdk.png`). Closes iteration 16 FLOW-01.
- The GTM agent is no longer a loose top-level chat; it sits under "Page agents". Closes iteration 16 FLOW-02.
- The "how much have I raised" answers now agree: Finance "Financing Oct $250,000", Legal lists the SAFE, Investors "Equity raised $250,000 / $50,000 committed", Fundraising lists Quill Capital Funded and Harbor Angels Sent (`p-finance.png`, `p-legal.png`, `n-Investors.png`, `p-fundraising.png`). Closes iteration 16 FLOW-03.
- The Data room sidebar row opens All items; the red badge is separate.

## Journey scorecard (this pass)
| Journey | Actual / ideal | Verdict |
|---|---|---|
| Daily: inbox triage | Inbox 1 click (the app opens on Chief, not Inbox); To do card then "Needs reply" with five rows and "Show 14 more" visible without scrolling | minimal |
| Money: runway check | Finance 1 click; Runway "24.2 mo" in the third tile of the first row | minimal |
| Raise: Legal, data room, cap table | Each page 1 click; Legal has two scan buttons (FLOW-01) | good, one gap |
| First run | not re-measured (iteration 14: 8 actions) | n/a |
| Agents: create, skill, approval | Create menu is New bot / New group / New space (`create.png`); not exercised, it creates data | unchanged |
| Settings | General, Privacy and approvals, Models, Advanced; time zone, notifications and theme only in General; consent in one switch plus "Per model and documents" | minimal |

## Not re-raised (decided)
Integrations in the sidebar footer and the account menu (`acct.png`); the four Settings sections; five "Needs reply" rows with "Show N more"; the GTM and Investors pages as redesigned by others.

## Praise (observed)
- Finance first screen: five tiles, "Mercury, Brex - syncing", burn chart, Upcoming 30 days with a total (`p-finance.png`).
- Investors: Equity raised "$250,000" with "$50,000 committed" under it answers the question in one glance (`n-Investors.png`).
- Settings is short and has no duplicate controls (`set1.png`, `set-priv.png`, `set-models.png`).
- Integrations: Connected group first, with "Open Inbox/Finance/Investors" and "Used by" avatars.
