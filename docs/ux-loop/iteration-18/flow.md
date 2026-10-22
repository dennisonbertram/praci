# Iteration 18 - FLOW critic

Target: mock demo (web :5381), session uxl18-FLOW, 1440x900, the existing mock founder account, read-only. Screenshots are in /tmp/uxloop18/flow/. Not re-measured: first-run sign-up, model, tour (it would create an account; iteration 14 measured 8 actions), bot creation, skills, approvals (they create data), mail consent (it changes a setting, so the Needs reply list was not seen), phone width, OAuth (BLOCKED). The demo account is shared with parallel walkers, so extra chats ("J3 walker"), approval toasts and changing badge counts are theirs and are not findings. The "Reconnect needed" space is a known demo fixture (iteration 11).

## Findings

### FLOW-01 Legal shows a banner row that cannot be acted on, and it may never clear
- Page: Legal. P2, flow. Observed: the row "1 Data room document not yet checked by Legal" sits under the tabs with a border like a notice but has no button, no link, and does not name the file (`p-legal.png`). Suspected: the unchecked file is one of the two "Failed - This file isn't a readable PDF" files in the Data room (`p-data-room.png`), so "Scan now" cannot clear it. Not confirmed, because I did not run a scan.
- Expected: a notice either names the file and links to it, or does not exist.
- Code: `apps/web/src/pages/Legal.tsx:300-314` (a `justify-between` container with one child; the action that used to sit there is gone).
- Fix: make the line a link to the Data room filtered to the unchecked or failed files, or drop it into the header meta ("Last scan 3h ago. 1 file not checked").

### FLOW-02 Investors, Fundraising and Contacts hold three separate investor lists with three "add a person" buttons
- Page: Investors, Fundraising, Contacts. P3 (the owner limited these two pages to P0/P1, so this is a note, not a request). Observed in Northwind: Contacts lists six people of kind Investor (`contacts.png`) while Fundraising "Pipeline" says "No prospects yet" (`fund2.png`). Investors has "Add contact", Fundraising has "Add prospect", Contacts has "Add contact". In an empty space Investors also shows a "Contacts" section with "No contacts yet" next to a sidebar page also named Contacts (`inv.png`).
- Expected: Maya adds an investor once and sees them in every place that mentions investors.
- Fix: seed the Fundraising pipeline from Contacts of kind Investor (or have "Add prospect" pick an existing contact), and rename the Investors section "Contacts" to "SAFEs and funds".

### FLOW-03 Two burn numbers on the first Finance screen look like they disagree
- Page: Finance. P3, copy. Observed: tile "Monthly burn $67,621 - 3-mo avg, after revenue" and the strip "$20,484 Out so far this month, Oct 1-22, up 0.5% vs Sep 1-22" (`p-finance.png`). The second is gross spend for part of a month and the first is average net burn, so a smaller number sits beside a larger one without a reason. The chart footnote "* So far" explains only the chart.
- Suspected cause: the +0.5% compares equal partial periods but the label does not say it.
- Fix: label the strip figure "Out Oct 1-22 (month not over)" and keep the tile as the single burn number.

### FLOW-04 Sidebar footer hides "Archived" and any empty section behind the scroll when chats grow
- Page: sidebar. P3, visual. Observed: with five chats plus "Page agents 6" and "Email chats 1", the second space header, "Reconnect needed" and "Archived" are below the fold and the list fades under Integrations (`inv2.png`, `fund2.png`). The same issue was raised in iteration 14 FLOW-07 and was fixed for fewer chats; it returns whenever walkers add chats.
- Fix: cap the chats shown per space at four plus "Show N more", as the Inbox does for Needs reply.

### FLOW-05 Settings > General still carries three cosmetic choices ahead of the account actions
- Page: Settings. P3, flow. Observed: Theme, Sidebar density and Avatars (Organic or Robot) occupy the first card, and "Chat display" is a separate row with a chevron (`set.png`). Five display choices spread over two places; none is needed for Maya's first day.
- Fix: move Sidebar density and Avatars under the "Chat display" row so General opens with Theme, Language and time zone, Notifications.

## Not re-raised or not a finding
- The app opens on Chief rather than Inbox; page agents under one group; Integrations in the footer and account menu; consent in one switch; five Settings sections (decided).
- The sidebar badge counts (Inbox 14 then 12, Data room 1 then 2) changed while other walkers worked; I did not treat them as a defect.
- The tour card sits at a fixed bottom-left spot, names the item ("Search finds any page, chat or email") and has Skip tour: matches the decision.

## Journey scorecard (this pass)
| Journey | Actual / ideal | Verdict |
|---|---|---|
| Daily: inbox triage | Inbox 1 click; before consent a one-row "Let Praci sort your mail - Allow / Not now" sits above the list, which stays usable; Needs reply not seen | good |
| Money: runway check | Finance 1 click; Runway "24.2 mo" in the first row; Cmd+K lists Inbox, Finance, Legal, GTM, Investors, Fundraising, Contacts, Data room (`cmdk.png`) | minimal |
| Raise: Legal, data room, cap table | Each page 1 click; Fundraising SAFEs show Funded $250,000 and Sent $50,000 with "Assign to contact" and "Deposit in Finance" | good, FLOW-01 and FLOW-02 |
| First run | not re-measured; a new space's Chief asks "What should I work on first?" with three choices, one tap each (`reconnect.png`) | unchanged |
| Agents: create, skill, approval | not exercised; the approval toast "[MOCK] Notice of Stockholder Action needs approval - Review before sending email to Sam Ortiz" is bottom-right and names the recipient (`fund2.png`) | good |
| Settings | four sections plus Advanced; time zone, notifications and theme in General only | good, FLOW-05 |

## Praise (observed)
- Finance first screen: five tiles, "Mercury, Brex - synced just now", burn chart, Breakdown and Upcoming 30 days with a total (`p-finance.png`).
- Legal has a single "Scan now"; Fundraising SAFE rows read Funded and Sent with the right next action (`p-legal.png`, `fund2.png`).
- Sidebar chat rows say "Needs your answer" and "Working..." in plain words (`home2.png`).
- A new empty space shows direct actions (Connect Carta, Use a Google Sheet, Type it in; Start a round) instead of blank pages (`inv.png`, `fund.png`).
