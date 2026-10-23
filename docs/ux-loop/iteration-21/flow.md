# Iteration 21 - FLOW critic

Target: mock demo (web :5381), session uxl21-FLOW, 1440x900, the existing mock founder account. Screenshots (file names only) are in the walker's scratch folder. The demo was shared with other walkers, so state changed while I walked (AI was allowed by someone else, a "J3 phone bot" appeared, an approval toast stayed up). Not exercised: first-run sign-up (I did not create a user; iteration 14 measured 8 actions), new bot, skills, approvals and payments, phone width. OAuth steps are BLOCKED.

## Findings

### FLOW-01 Expanding "Page agents" in the sidebar shows nothing
- Page: sidebar. P2, flow. Observed: clicking "Page agents" (6 agents) changed only the foot hint from "+7 more" to "+13 more"; the new rows are below the fold of the chat list and nothing scrolls them into view (`pa.png`). The person has to notice the hint and click it as well.
- Expected: opening a group shows its rows.
- Code (suspected): the "+N more" button only scrolls the list by 80% of its height (`apps/web/src/pages/Shell.tsx:5758-5768`); nothing scrolls on group expand.
- Fix: scroll the expanded group's header to the top of the chat list when it opens.

### FLOW-02 Hitting /app/settings shows "Page not found"
- Page: Settings. P3, flow. Observed: `/app/settings` renders "Page not found - This link is wrong or the page is no longer available" (`set.png`, first capture). Settings is a dialog with no URL, although Cmd+K lists it as a page (pass-16 decision) and the account menu opens it. A reload or shared link cannot reach it.
- Fix: make `/app/settings` open the dialog over the last page instead of a 404.

### FLOW-03 Inbox "To do" card still restates what "Needs reply" shows
- Page: Inbox. P3, flow. Observed: the card (two of four tasks visible, "2 more") sits above the list and pushes the first mail row from about y=232 to y=369 at 1440x900. The Morgan Pretend row below already carries a "To do - Today" chip (`inbox2.png`). Iteration 14 FLOW-01 added the chip, so the link between the two is clear now, but the same action is still written twice within 250 px.
- Fix: when a Needs reply row carries the To do chip, leave that task out of the card, or collapse the card to one line ("4 to do") that expands on click.

### FLOW-04 Cmd+K lists six page agents beside the pages they belong to
- Page: Cmd+K. P3, flow. Observed: with an empty query the palette shows nine pages, Integrations and Settings, then Chief and Inbox, Finance, Carta, Legal, Data room and Investors agents with shortcuts Cmd+1 to Cmd+9 (snapshot, `cmdk.png`). Each page already has an Ask button for its agent, and the sidebar has a Page agents group, so there are three doors to the same chat. Carta agent ("keeps your cap table and contacts current") and Investors agent ("answers questions about your investors, SAFEs and finances") both serve the Investors page and read as one thing to a new founder.
- Expected: one entry per page agent, reached from its page; palette shows agents only when the query matches.
- Fix: hide page agents from the empty-query palette (keep them searchable), and decide whether the Carta agent needs its own row.

### FLOW-05 "New group" and "New space" are hard to tell apart in the Create menu
- Page: sidebar Create menu. P3, copy. Observed: New bot, New group, New space with a people icon and a lock icon (`create.png`). A group is a chat with several bots (for example "Leadership sync"); a space is a separate workspace. Neither label says which. "New space" is already hidden for one-space accounts (pass-20), so this shows only to people with several spaces.
- Fix: rename "New group" to "New group chat".

### FLOW-06 Legal table clips its most important column at 1440 px
- Page: Legal. P3, visual. Observed: "Next deadline" and its dates are cut at the right edge (`p-legal.png`); measured scrollWidth 1150 vs clientWidth 1124 on the table container, so it scrolls 26 px sideways with no visible cue (`legal2.png`).
- Fix: narrow Parties or Term by about 30 px so all columns fit at 1440, or move Next deadline ahead of Value.

### FLOW-07 Hard navigation shows skeletons for 5 to 9 seconds on the demo
- Page: all. P2, perf, suspected. Observed: opening a page by URL showed "Opening Praci..." or grey rows at 5 s (Data room, Settings) and 8 s (Contacts, Artifacts) before content (`q-data-room.png`, `r-contacts.png`, `r-artifacts.png`); Integrations still showed tiles at 3 s (`p-integrations.png`) and was ready at 6 s (`integ.png`). Other walkers were using the same demo, so I cannot separate app cost from load. Pass-15 accepts a brief skeleton; 8 s is not brief.
- Fix: re-time on an idle demo; if it persists, start the page's queries before the sidebar finishes.

## Not findings (checked this pass)
- "Reconnect needed" (iteration 20 FLOW-02) is a seeded demo space named in the demo seed (`packages/testkit/src/cli/demo/data.ts:35`), not an app status group. Opening it does not need a fix beyond the pass-20 decision.
- Iteration 20 FLOW-01 (three Mercury states): Finance header reads "Mercury, Brex - synced just now", Fundraising "Mercury - 2m ago", Integrations lists Mercury under Connected (`p-finance.png`, `q-fundraising.png`, `integ.png`). No split seen.
- Iteration 20 FLOW-06: the Usage card now reads "19 tasks done by your bots" (`set.png`).
- Equity raised is $250,000 with "$50,000 committed" and matches the two SAFEs on Fundraising (Funded / Sent) (`q-investors.png`, `q-fundraising.png`).
- Investors, Fundraising and Contacts each have an add-person button; Investors and Fundraising are owned by another session, so I report nothing below P1.

## Journey scorecard
| Journey | Actual / ideal | Verdict |
|---|---|---|
| First run | not re-measured (iteration 14: 8 actions) | n/a |
| Daily: inbox triage | Inbox 1 click; To do card, then Needs reply (5 rows, "Show 14 more"), Other mail today, Earlier | good; FLOW-03 |
| Money: runway check | Finance 1 click; Runway "24.2 mo, Until October 2028" in the first tile row; Chief gives the same figures | minimal |
| Raise: Legal, Data room, Investors, Fundraising | each page 1 click; Data room failed file reads "This file isn't a readable PDF." inline | good; FLOW-04 for agent doors |
| Agents: create bot, skill, approval | Create menu 1 click to New bot; rest not exercised | n/a; FLOW-05 |
| Integrations | 1 click; Connected first, Finance and Investors cards link to their page | good |
| Settings | 2 clicks (account menu, Settings); four items plus Advanced | good; FLOW-02 |

## Praise (observed)
- Settings is small and plain: General, Privacy and approvals (one AI switch, two confirmations), Models (one sentence, one button) (`set.png`, `s-Privacy_and_approvals.png`, `s-Models.png`).
- Finance first screen: five tiles, one burn chart with the financing marker, Breakdown and Upcoming 30 days (`p-finance.png`).
- Integrations: Connected group first, each card says what it reads and links to the page that uses it (`integ.png`).
- Data room: folder tree, filters and one Add files button; unreadable file shown inline in red with its reason (`r-data-room.png`).
