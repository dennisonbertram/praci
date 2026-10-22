# Iteration 20 - FLOW critic

Target: mock demo (web :5381), session uxl20-FLOW, 1440x900, the existing mock founder account. Screenshots are in /tmp/uxloop20/flow/. The demo stack stopped answering (connection refused on :5381 and :3308) partway through, so the pass is shorter than planned: not re-measured are the new-bot flow, skills, approvals, payments, phone width, and the first-run sign-up (iteration 14 measured 8 actions). OAuth steps are BLOCKED. Side effect: one click created a Chief chat in the "Reconnect needed" sidebar group (FLOW-02).

## Findings

### FLOW-01 Mercury has three different states on three pages
- Page: Finance, Fundraising, Integrations. P2, bug/flow. Observed: Finance header reads "Mercury, Brex - syncing..." with a green dot (`p-Finance.png`); Fundraising header reads "Mercury - just now" and lists two SAFEs "from Mercury" (`p-Fund.png`); Integrations shows Mercury with a "Needs reconnect" badge and a Reconnect button, placed in the Finance group far below the page fold, while the Connected group at the top holds only Brex (`integ.png`).
- Expected: one status. A connection that needs reconnecting is the most urgent card on Integrations and should sit first, and Finance and Fundraising should say it too.
- Code: `apps/web/src/pages/Finance.tsx:399` and `:490` read `needs_reconnect`, but the header still showed the green sync line; `apps/web/src/components/integrations/FinanceSection.tsx:383-410` renders the badge only inside the Finance group. Suspected, not confirmed: the mock seeds Mercury as needs_reconnect while its data is still served; a real lapsed login may show the same split.
- Fix: derive one status per connection, show "Reconnect Mercury" in the Finance and Fundraising headers when it lapses, and list lapsed connections at the top of Integrations.

### FLOW-02 An empty sidebar group named "Reconnect needed" creates a chat when clicked
- Page: sidebar. P2, flow. Observed: below Northwind Robotics' chats there is a group header "RECONNECT NEEDED" with a lock icon and no rows. I clicked the header; Praci opened a brand-new Chief in that group ("Hi Maya, I'm Chief. I can sort your email, keep an eye on cash..." with the three first-ask choices, `reconn.png`). It also reordered the sidebar: the new group is now first and the Northwind chats moved to a flat list with "+7 more" instead of the collapsed "Page agents" row (`integ.png`). I could not tell whether this is a real space named "Reconnect needed" or a label for something else; the demo went down before I could check. The string is not in the sidebar code (`grep` finds it only in `GranolaMeetingsCard.tsx`), so I suspect it is a space name in the mock data.
- Expected: a group header never creates data on click, and a heading that reads like a status should not be a place to chat; the Chief's greeting offers email sorting in a space whose label says it is disconnected.
- Fix: if this is a real space, name it after the space and open it without creating a chat until the person writes; if it is a status group, show the rows that need reconnecting and nothing else.

### FLOW-03 "Not now" on the AI consent cards is remembered differently on each page
- Page: Inbox vs Legal and Data room. P3, flow. Observed: Inbox ("Let Praci sort your mail") and Legal ("Let Praci read your documents") both show an Allow / Not now card on the same account (`p-Inbox.png`, `p-Legal.png`); Data room shows none (`p-Data-room.png`). From the code: Inbox's Not now is React state only, so the card returns on every visit (`apps/web/src/pages/Inbox.tsx:336,1071`); Legal and Data room remember it in the browser until the request changes (`apps/web/src/components/AiDataSharing.tsx:86-135`).
- Expected: one rule for how long Not now lasts, and the same one-line "declined" state after it.
- Fix: give the Inbox card the same remembered dismissal and the same collapsed one-line state as the documents card.

### FLOW-04 With AI off, a bot's first visible words in the sidebar are an error
- Page: sidebar. P3, copy/flow. Observed: the Inbox agent row has an unread dot and the preview "Could not complete the delegated request: Chat is off until you allow AI models in Settings under Privacy and approvals." (`reconn.png`, snapshot). Settings > Privacy and approvals confirms "Allow AI models" is off (`set-priv.png`). The failure itself is per the pass-5 decision (badge, not toast); the point is the text: it is a long instruction in a preview line that cannot be clicked to Settings.
- Expected: a short preview such as "Waiting for AI to be allowed", and the open chat carries the one-tap Allow card.
- Fix: map this error to a short preview string; keep the long text in the chat.

### FLOW-05 GTM: the agent panel is open by default and the goal has two entry points
- Page: GTM. P3, flow/visual. Observed: the GTM page opens with its agent panel already docked on the right, while every other page opens full width with an "Ask" button (`p-GTM.png` vs `p-Finance.png`). The empty goal card has an "Edit" link and the panel offers the chip "Help me find our first 50 design partners": two ways to set a goal on one screen.
- Fix: open GTM with the panel closed and an Ask button like the other pages, or keep the panel and drop Edit until a goal exists (the card itself can be the button).

### FLOW-06 Settings > General shows "Usage: 0 tasks done by your bots"
- Page: Settings. P3, take-away test. Observed: the card reads "0 tasks done by your bots" (`set.png`) while two bots show "Working..." and replies exist. It does not help any journey and reads as wrong.
- Fix: remove the card, or show it only when the count is above zero.

## Not re-raised or not a finding (fixed since iteration 19)
- GTM first view is now the goal card plus one Connect Zernio row; the channel table and empty sections are gone (`p-GTM.png`). Iteration 19 FLOW-03 and FLOW-04 fixed.
- Data room: the unreadable PDF row now reads "This file isn't a readable PDF." with no "Try again" in the row (`p-Data-room.png`, snapshot). Iteration 19 FLOW-07 appears fixed (row menu not opened).
- Legal: no unchecked-document line is visible under the tabs (`p-Legal.png`); it may be hidden while the consent card shows. Iteration 19 FLOW-01 is not confirmed either way.
- Settings: four sections plus collapsed Advanced; time zone, theme and notifications only in General (`set.png`).
- Cmd+K lists nine pages plus Integrations and Settings; typing "contr" finds Legal, two chats and "Search mail" (`cmdk.png`, `cmdk-q.png`).
- Three investor lists and three add-person buttons (iteration 19 FLOW-06): Investors and Fundraising are owned by another session, so not re-raised.

## Journey scorecard (this pass)
| Journey | Actual / ideal | Verdict |
|---|---|---|
| First run | not re-measured; the first-ask card (Run my company / Day-to-day work / Research & writing) is one tap and names the apps it uses (`reconn.png`) | n/a |
| Daily: inbox triage | Inbox 1 click; sections Today (5 unread) and Earlier (8 unread), consent card above them | good, FLOW-03 |
| Money: runway check | Finance 1 click; Runway "24.2 mo - Until October 2028" in the first row of tiles; Chief answers the same number | minimal, but FLOW-01 |
| Raise: Legal, data room, cap table | each page 1 click; Fundraising SAFEs show Funded/Sent | good |
| Agents: create a bot, skill, approval | not exercised (stack went down); iteration 19 measured 2 clicks | n/a |
| Integrations / reconnect | Integrations 1 click, but the one broken connection is not at the top | FLOW-01 |
| Settings | 3 clicks to reach Models; no duplicated switches seen | good |

## Praise (observed)
- Finance first screen: five tiles, one burn chart with the financing marker, Breakdown and Upcoming 30 days (`p-Finance.png`).
- Settings is small and quiet: Privacy and approvals has one AI switch and two confirmations; Models is one sentence and one button (`set-priv.png`, `set-models.png`).
- Cmd+K is one search across pages, chats and mail (`cmdk-q.png`).
- Integrations: Connected group first, search plus four category chips (`integ.png`).
