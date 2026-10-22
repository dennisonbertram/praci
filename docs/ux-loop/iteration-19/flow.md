# Iteration 19 - FLOW critic

Target: mock demo (web :5381), session uxl19-FLOW, 1440x900, the existing mock founder account. Screenshots are in /tmp/uxloop19/flow/. Not re-measured: first-run sign-up, model, tour (it would create an account; iteration 14 measured 8 actions), skills, approvals and payments (they create data), phone width, OAuth (BLOCKED). One exception to read-only use: opening Create > New bot made one "New Bot" row in the mock account (a parallel walker made another; both are expected demo leftovers). Badge counts, "Page agents N", "J3 phone walker" and read/unread dots changed while other walkers worked and are not findings.

## Findings

### FLOW-01 Legal still shows a notice row that has no action and may never clear (repeat of iteration 18 FLOW-01)
- Page: Legal. P2, flow. Observed: "1 Data room document not yet checked by Legal" sits under the tabs; the header says "Last scan just now. Scans daily." and offers "Scan now" (`p-Legal.png`). The Data room has one failed file, "MOCK Signed NDA - Bolt Freight.pdf - This file isn't a readable PDF" (`p-Data-room.png`). Suspected, not confirmed (I did not scan): the unchecked document is that file, so a scan cannot clear the line.
- Expected: a notice names the file and links to it, or does not exist.
- Code: `apps/web/src/pages/Legal.tsx:301-315` (`uncheckedLine`, a plain `<p>` with no link).
- Fix: make the line a link to the Data room's failed files, or merge it into the header meta ("Last scan just now. 1 file not checked").

### FLOW-02 Bot settings show Notifications ON while the account's Browser notifications switch is OFF
- Page: bot settings (New Bot) and Settings > General. P2, flow. Observed: the bot panel says "Notifications - Get notified when this bot finishes or needs input" with the switch on (`botset.png`), while Settings > General has "Browser notifications" off (`set.png`). Maya sees a promise that nothing delivers. Suspected: the per-bot switch is inert until the account switch is on; I did not trigger a bot run to confirm.
- Expected: one place decides whether notifications arrive; the per-bot switch either hides until delivery is on, or turning it on offers the one-tap enable.
- Code: `apps/web/src/pages/shell/bot-panel.tsx:520-540`.
- Fix: hide the per-bot Notifications row until a delivery channel is on in Settings, or show "Off in Settings" beside the switch.

### FLOW-03 GTM's first view exposes channel policy internals before the founder has set a goal
- Page: GTM. P2, flow/copy. Observed: with no goal ("Give the GTM agent a goal") the page shows a "Connect Zernio - Needed to post approved text" banner and, right below, a Channels table that repeats the same fact as a row ("X, LinkedIn, Threads, Bluesky - Zernio - Approve every post - Not connected") plus "0 of 3 approvals before auto - 0 of 5 today", "Draft only", "Browser", then empty "Needs you 0" and "In progress 0" sections (`p-GTM.png`). A first-time founder reads rules for a process that has not started.
- Expected: goal first; channel rules appear once a goal exists or when a channel is connected.
- Code: `apps/web/src/pages/Gtm.tsx` (header meta at ~95-110, empty sections at ~242 and ~281).
- Fix: with no goal, show only the goal card and the one Connect Zernio row; reveal Channels, Needs you and In progress after the first goal is saved.

### FLOW-04 GTM empty states say "Up to date" three times, and the Email destination breaks mid-word
- Page: GTM. P3, copy/visual. Observed: "Up to date" appears in the header, under "Needs you 0" and (as "Nothing running") under "In progress 0" (`p-GTM.png`). In the Channels table the Email destination "mock-founder@northwind.exa / mple.test, sales@northwind.examp / le.test" wraps inside a narrow column.
- Code: `apps/web/src/pages/Gtm.tsx:107, 242, 281`.
- Fix: drop the two empty sections while both are empty (the header already says it) and let the destination column wrap at commas or truncate with the full value on hover.

### FLOW-05 The sidebar footer still clips the last rows, now even at the baseline chat count (repeat of iteration 18 FLOW-04, which was not fixed)
- Page: sidebar. P3, visual. Observed: with four chats the "Archived 1" row sits half under the fade line and "Reconnect needed" has a gap above it (`home.png`); with six chats "Page agents" is cut off by the fade and "Email chats", "Reconnect needed", "Archived" are below the fold (`cleanup.png`, `activity.png`). Opening Activity pushes the chat list down further, so Chief is partly hidden (`activity.png`).
- Expected: every group header is reachable without scrolling the sidebar in a normal setup, or the list says how many are hidden.
- Fix: show at most four chats per space plus "Show N more" (the Inbox already does this for Needs reply), and give the footer group fixed height.

### FLOW-06 Three investor lists and three "add a person" buttons remain (repeat of iteration 18 FLOW-02)
- Page: Contacts, Investors, Fundraising. P3 only (owner limits Investors and Fundraising to P0/P1, so this is a note). Observed: Contacts lists seven people of kind Investor (`p-Contacts.png`), Fundraising Pipeline says "No prospects yet" (`p-Fundraising.png`), and the three pages carry "Add contact", "Add prospect" and "Add contact" buttons.
- Fix: have "Add prospect" pick an existing Contact of kind Investor, and seed the Pipeline from them.

### FLOW-07 A permanently unreadable PDF offers "Try again"
- Page: Data room. P3, flow. Suspected from the code, observed on screen: the row reads "This file isn't a readable PDF. [Try again]" (`p-Data-room.png`). A retry cannot fix a file that is not a PDF; the next useful action is Replace or Remove. The error text is set in `packages/adapters/src/data-room-jobs.ts:362`; the button in `apps/web/src/components/data-room/ItemMenu.tsx:51` and the row.
- Fix: for the "not readable" error offer "Replace file" (and the row menu's Delete), and keep "Try again" for timeouts.

### FLOW-08 Fixture text disagrees with the SAFE totals (mock data only)
- Page: Investor Relations chat vs Fundraising. P3, copy (fixture). Observed: the bot says "a $2,000,000 target on top of the $350,000 in SAFEs" (`ir.png`); Fundraising lists $250,000 Funded plus $50,000 Sent = $300,000 (`p-Fundraising.png`). Not a product defect; fix the fixture so a walker is not misled.

## Not re-raised or not a finding
- Opens on Chief; page agents grouped; Integrations in the footer and account menu; five Settings sections (now four plus a collapsed Advanced); Cmd+K lists Settings and Integrations (decided).
- Finance: the strip now says "Out so far this month, not over - Oct 1-22 - up 0.5% vs Sep 1-22", which fixes iteration 18 FLOW-03.
- Settings > General now opens on Theme, Account, Chat display, Language and time zone, Browser notifications; Sidebar density and Avatars are under Chat display: iteration 18 FLOW-05 is fixed (`set.png`).
- Investors "Equity raised" showed a dash for about one second on first paint and then $250,000 with "$50,000 committed" (`inv-scroll.png`); a skeleton on revisit is expected (pass 15).
- Cleanup is an empty page with one line of explanation and "Open Newsletters" (decided).

## Journey scorecard (this pass)
| Journey | Actual / ideal | Verdict |
|---|---|---|
| Daily: inbox triage | Inbox 1 click; To do card, then "Needs reply" with five rows and "Show 19 more"; Filter holds the account choice (All, Founder mail, Sales mail) | good |
| Money: runway check | Finance 1 click; Runway "24.2 mo - Until October 2028" in the first row; Chief answers "About 24 months" from the same numbers | minimal |
| Raise: Legal, data room, cap table | Each page 1 click; Fundraising SAFEs show Funded/Sent with next actions; FLOW-01 and FLOW-06 | good |
| Agents: create a bot | + then New bot = 2 clicks; the bot opens with its name selected and asks "What's the main thing you'd want me handling for you?"; settings are Name, Description, Notifications, Audience, Skills, Advanced | minimal (FLOW-02) |
| Agents: approval | an inline question card with two one-tap answers in the Investor Relations chat (`ir.png`); a paid approval card was not exercised | good |
| First run | not re-measured (iteration 14: 8 actions) | n/a |
| Settings | four sections plus Advanced; time zone, theme and notifications only in General | good |
| GTM | goal not set: banner plus policy table plus two empty sections | FLOW-03 |

## Praise (observed)
- Creating a bot is two clicks and lands in a conversation, not a form (`newbot.png`).
- Settings is a small modal: General, Privacy and approvals (one AI switch, two confirmations), Models (one sentence and one button), Advanced (`set.png`, `set-priv.png`, `set-models.png`).
- Cmd+K lists all nine pages plus Integrations and Settings (`cmdk.png`).
- Finance first screen: five tiles, one burn chart, Breakdown and Upcoming 30 days with a total (`p-Finance.png`).
- Integrations: Connected group first, each card with an Open action and the bots that use it (`integ.png`).
