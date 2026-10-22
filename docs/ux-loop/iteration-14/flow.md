# UX flow critique, iteration 14

Method: /ux-flow re-measure on the mock demo stack (web :5381), 1440x900, no touch emulation. Sessions: `uxl14-FLOW` (mock founder, read-only) and `uxl14-FLOWf` (one fresh invented sign-up with a random password that was not recorded). Screenshots: `/tmp/uxloop14/flow/`. The demo is shared: consent state, "New Bot" and its payment message, badge counts and the "Working..." bots changed while I worked and are other walkers' data, not findings. OAuth connect steps are BLOCKED and were not tried. Phone width, touch targets, sending and approving were not measured. Investors and Fundraising are owned by another session; I report no P0/P1 there.

"Observed" means seen on screen; "suspected" means read from code or inferred.

## Friction scorecard

| Journey | Actual / ideal | Verdict |
|---|---|---|
| First run: sign-up to first real answer | Name, email, password, Create account, "Run my company", type question, Enter, Allow = 8 actions. The answer says no bank is connected and links "Open Finance" (`f1.png`, `ask1.png`, `ask2.png`). | minimal |
| First run: tour | Stop 1/9 appears on the first page opened and stays at the foot of the sidebar, now starting "Search: Type here to find any page, chat or email." so it names the ringed item (`n-Inbox.png`). Skip is one click. | good |
| Daily: inbox triage | Inbox 1 click; To do card, five "Needs reply" rows, "Show 15 more"; row opens in 1 click (`r-Inbox.png`). | good, one repeat (FLOW-01) |
| Money: runway check | Finance 1 click, "Runway 24.2 mo, Until October 2028" in the first row (`p-Finance.png`). | minimal |
| Raise: data room, legal, cap table, contacts | Each page 1 click or Cmd+K. Legal and Data room consent are one Allow (decided) (`r-Legal.png`, `p-Dataroom.png`). | good |
| Agents: bot settings | Row menu, Bot settings: Name, Description, Notifications, Audience, Skills, Advanced, Export, Clear conversation, all in one panel (`bs.png`). Creating a bot and approving were not done (they add demo data). | good |

## Fixed since iteration 13 (observed)

- Legal with no contracts now has an icon, the title "No contracts yet" and an "Add files" button, like Inbox and Finance (`n-Legal.png`). Closes old FLOW-07.
- The tour card text starts with the item it explains ("Search: ...") (`n-Inbox.png`). Matches the pass-13 decision.
- Equity raised on Investors shows $250,000 with "$50,000 committed", matching the Funded SAFE on Fundraising (`inv2.png`, `fund.png`).

## Findings

### FLOW-01 Inbox "To do" card lists the same two mails that are the first rows of "Needs reply"
- Page: Inbox, Important tab. Severity P2, category flow, observed. This is a return of iteration-11 FLOW-02, which iteration 12 recorded as closed.
- Happened: To do shows "Reply whether section 9 works and confirm signing" (Morgan Pretend) and "Send Sam the MAC addresses" (Sam Samplesworth). Directly below, "Needs reply" lists the Morgan Pretend mail first and the Sam Samplesworth mail second (`r-Inbox.png`). Maya reads two sentences about one action within 200 px. The wording differs from the mail, so a plain text comparison does not catch it.
- Expected: one place per action. Either the To do card holds only tasks that do not already have a visible row, or the row carries a small "To do" mark.
- Code (suspected): `apps/web/src/pages/Inbox.tsx`, where the To do card renders from tasks independently of the grouped rows; match on the task's source thread id, not on text.
- Fix: skip any To do item whose source thread is already a visible row in the Needs reply group, and mark that row "To do".

### FLOW-02 "Needs reply" and the "Needs attention" chip are still two labels for close ideas
- Page: Inbox, Important tab. Severity P3, category copy, observed. Carried over from iteration-13 FLOW-05.
- Happened: Fictional Law Group and DocuSign rows under "Earlier" carry a "Needs attention" chip, but they are not in the "Needs reply" group above (`r-Inbox.png`).
- Expected: one word for "you must act", or the chip says why (for example "Deadline").
- Code: `apps/web/src/components/inbox/InboxRow.tsx` (chip) and the group order in `apps/web/src/pages/Inbox.tsx`.
- Fix: rename the chip to "Needs reply" when the reason is a reply, or show the reason text.

### FLOW-03 Settings: the Models tab is one sentence and one button, and display options are still split
- Page: Settings > Models and General. Severity P3, category flow, observed. Carried over from iteration-13 FLOW-02 and FLOW-03.
- Happened: Models reads "Your bots use OpenAI: GPT-6 Luna." plus "Use my own model" and the rest of the tab is empty (`set-Models.png`). Privacy and approvals holds "Allow AI models" and two confirmations and is half empty (`set-Privacy.png`). On General, Appearance, a collapsed "Chat display" card, and "Language and time zone" sit in two columns (`set1.png`).
- Expected: one place for "which AI, and what it may see"; one place for display options.
- Code (suspected): Settings dialog tab list under `apps/web/src/components/settings/`.
- Fix: move the model sentence and "Use my own model" into the AI data sharing card, remove the Models tab, and fold Chat display into Appearance.

### FLOW-04 Contacts with no contacts is a bare line of text
- Page: Contacts, fresh account. Severity P3, category visual, observed.
- Happened: only "No contacts yet" centered under the header, with no icon or next step; Inbox, Finance, Legal and Artifacts all have icon, title and a sentence (`n-Contacts.png` vs `n-Legal.png`, `n-Artifacts.png`). "Add contact" exists in the header.
- Expected: the same empty-state pattern as the other pages.
- Fix: reuse the Legal empty-state component with title "No contacts yet" and the sentence "Investors, advisors and customers you add or your bots find appear here."

### FLOW-05 The first-ask choices "Run my company" and "Day-to-day work" promise the same things
- Page: Chief first-run card. Severity P3, category copy, observed (text) / suspected (the difference after choosing B).
- Happened: A reads "Email, calendar and your company pages"; B reads "Slack, calendar and email" (`f1.png`). Both offer email and calendar, so Maya cannot tell what B changes.
- Expected: the second line names what is different (A: company pages, B: Slack).
- Fix: reword B to "Slack and your calendar" or merge the two if the follow-up cards are the same.

### FLOW-06 The AI consent card in chat is three lines of explanation
- Page: Chief, first question. Severity P3, category copy, observed.
- Happened: "Share your chats and mail with the AI model that runs your bots?" is followed by a three-line paragraph that repeats what Settings > Privacy and approvals says, then "Allow" and "Not now" (`ask1.png`). The Inbox consent card needs one line (`inbox.png`).
- Expected: the moment of asking is one sentence plus the two buttons; details live in Settings.
- Fix: cut the paragraph to one sentence and keep "stays on until you turn it off in Settings" only if it is not already in the title.

### FLOW-07 Sidebar "Page agents" expands itself per page and pushes Reconnect needed and Archived out of view
- Page: sidebar on Inbox, Finance, Legal, Data room. Severity P3, category visual, observed.
- Happened: when a page opens, the "Page agents" group expands and shows two or three agents, in an order that is not the current page's agent first (on Legal, Finance agent is first and Legal agent is below the fold) (`p-Legal.png`, `r-Legal.png`). The list then runs under the footer and "Reconnect needed" and "Archived" are no longer visible; on Contacts the group is collapsed and they show (`p-Contacts.png`).
- Expected: opening a page does not rearrange the sidebar, or it shows only that page's agent.
- Fix: when auto-expanding, list only the agent of the current page, or stop auto-expanding.

### FLOW-08 Integrations shows six empty grey tiles for the first seconds
- Page: Integrations. Severity P3, category perf, observed once (screenshot 3 s after the click), cause suspected.
- Happened: heading and six blank cards, no search box or filter chips yet (`integ.png`); a few seconds later the full page with Connected and Popular appeared behind the Cmd+K overlay (`cmdk-tour.png`).
- Expected: first paint shows search and filters, with placeholders only inside the cards.
- Fix: render the search box and category chips immediately and keep skeletons to the card grid.

### FLOW-09 Google Mail, Calendar and Drive are still three Connect buttons
- Page: Chief first-run cards and Integrations. Severity P3, category flow, suspected (OAuth is BLOCKED, not tried). Carried over from iteration-13 FLOW-08.
- Happened: Chief shows separate Gmail and Google Calendar Connect cards (`f2.png`); Integrations lists Calendar and Drive under Popular (`cmdk-set.png` background).
- Expected: one Google sign-in for the Google apps she wants.
- Fix: check whether one Google consent can cover Gmail and Calendar, and show one "Connect Google" card.

## Redundancy checks (re-measured)

- Consent: Inbox, Legal, Data room cards, chat card, Settings switch. Each area asks once; one Allow covers Data room and Legal (decided). The Settings master switch read "on" in the demo while another walker had allowed everything, consistent with the decision.
- Time zone and notifications: General holds language, time zone and Browser notifications; the bot panel has a per-bot Notifications switch (decided).
- Integrations doors: sidebar row, account menu, Chief cards, Finance Accounts, Inbox Connect mail. Decided, not re-raised.
- Model sign-in: Settings > Models only (see FLOW-03).
- Search: sidebar Search and Cmd+K are one palette; typing "settings" lists Settings, chats and a "Search mail for" row (`cmdk-set.png`). The empty palette lists the eight pages.
- Account menu: Settings, Integrations, Hide amounts, Take the tour, Log out (`acct.png`). "Create" menu: New bot, New group, New space (`create.png`).
- Not raised (other session owns them): Investors and Fundraising show permanent grey skeleton bars in the Round, Pipeline and fresh Cap table areas next to real empty states (`fund.png`, `n-Investors.png`), and "Equity raised" shows an em dash before data loads; I found no P0/P1 there.

## Praise (observed)

- First run is 8 actions to a real answer, and the answer links to the next place to act (`ask2.png`).
- The first-ask card collapses to a one-line record after the pick (`f2.png`).
- Finance gives cash, burn, runway, crypto and yield in one row (`p-Finance.png`).
- Inbox opens on To do and five "Needs reply" rows with "Show 15 more" (`r-Inbox.png`).
- Bot settings is one short panel with Audience, Skills and Advanced folded (`bs.png`).
- Legal and Data room empty and consent states are clear (`n-Legal.png`, `n-Dataroom.png`, `r-Legal.png`).

## Not measured

- Creating a bot, sending, approving or paying, the held "Share with {name}?" card, the secret request card and Provide secret dialog.
- Phone width and touch targets.
- Gmail, Calendar, Carta, Mercury, Brex connect steps: OAuth, BLOCKED.
