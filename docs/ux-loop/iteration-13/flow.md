# UX flow critique, iteration 13

Method: /ux-flow re-measure on the mock demo stack (web :5381), 1440x900, no touch emulation. Sessions: `uxl13-FLOW` (mock founder, read-only apart from opening panels) and `uxl13-FLOWf` (one fresh invented sign-up with a random password that was not recorded). Screenshots: `/tmp/uxloop13/flow/`. The demo is shared: the approval toast, "Cash Watcher J2", "New Bot", extra spaces ("Reconnect needed", "Empty space"), badge counts and the Inbox consent state changed while I worked and are other walkers' data, not findings. OAuth connect steps are BLOCKED and were not tried. Phone width, touch targets, sending and approving were not measured. Investors and Fundraising are owned by another session; I found no P0/P1 there.

"Observed" means seen on screen; "suspected" means read from code or inferred.

## Friction scorecard

| Journey | Actual / ideal | Verdict |
|---|---|---|
| First run: sign-up to first real answer | Name, email, password, Create account, "Run my company", type question, Enter, Allow = 8 actions. Answer arrives with an "Open Finance" link (`f1.png`, `ask1.png`, `ask2.png`). The only extra step is the AI consent card, which is decided. | minimal |
| First run: choices | Three first-ask choices now (B and D merged) (`f1.png`). | fixed |
| First run: tour | Stop 1/9 appears on the first page opened; Skip is one click. Popover sits at the foot of the screen, far from the ringed Search box (FLOW-01). | good, one placement issue |
| Daily: inbox triage | Inbox 1 click. To do card, "Needs reply" capped at five rows with "Show 14 more", row opens in 1 click (`inbox3.png`). | good |
| Money: runway check | Finance 1 click, "Runway 24.2 mo, Until October 2028" in the first row (`p-Finance.png`). | minimal |
| Raise: data room, cap table, contacts, legal | Each page 1 click or Cmd+K. Data room offers List, Grid, Stats, Upload / From email / From Box (`dr2.png`). | good |
| Agents: bot, skill | "+" menu, New bot (2 clicks, name focused). Bot settings 2 clicks, Add skill opens the form directly (`skill.png`). Creating a bot was not done (it adds demo data). | good |
| Agents: approval | Toast with persistent close, now left of the open bot panel (`botpanel.png`). I did not approve. | good |

## Fixed since iteration 12 (observed)

- First-ask choices B and D are one choice; three remain (`f1.png`). Closes old FLOW-07.
- "Needs reply" shows five rows plus "Show 14 more", so today's mail is no longer below 17 rows (`inbox3.png`). Closes old FLOW-01.
- Approval toast sits left of the right-hand bot panel instead of covering it (`botpanel.png`). Closes old FLOW-02 in this layout.
- "Clear conversation" is gone from the row menu (menu reads Pin, Move to, Mark as unread, Bot settings, Routines, Duplicate, Archive, Delete) and stays in the panel footer. Closes old FLOW-04.
- Add skill opens the New skill form directly, with "Upload file" and "From URL" as links in the form (`skill.png`). Closes old FLOW-05.
- Settings General: the separate "Notifications" card heading is gone; "Browser notifications" is a single switch (`set1.png`). Closes old FLOW-08.
- Tour stop 1 no longer covers the Inbox heading (but see FLOW-01).

## Findings

### FLOW-01 Tour stop 1 sits at the bottom-left, far from the Search box it describes
- Page: first-run tour. Severity P3, category visual, observed.
- Happened: the ring is on the Search box at the top of the sidebar, but the card "Type here to find any page, chat or email." sits at the foot of the screen, about 700 px lower, partly outside the sidebar and over the page edge (`inbox.png`, `n-Inbox.png`). On Investors it overlaps the Contacts section (`n-Investors.png`). Maya has to look for the explanation of the ringed element.
- Expected: the card is next to the thing it points to, or its text starts with the target name.
- Code: `apps/web/src/components/tour/TourPopover.tsx:171-186` (sidebar targets are placed at the foot of the column on purpose, to fix old FLOW-06).
- Fix: place the sidebar-target card directly beside the target, to the right of the sidebar, at the target's own height; the old overlap was with the heading, which sits lower than the Search box.

### FLOW-02 Settings has a Models tab that holds one sentence and one button
- Page: Settings > Models. Severity P3, category flow, observed.
- Happened: the whole tab is "Your bots use OpenAI: GPT-6 Luna." and "Use my own model" (`set3.png`). Privacy and approvals (AI data sharing, confirmations) holds the other AI choices and is mostly empty below two cards (`set2.png`).
- Expected: one place for "which AI, and what it may see".
- Code: Settings dialog tab list (`apps/web/src/components/settings/`, suspected location).
- Fix: move the sentence and "Use my own model" into the AI data sharing card on Privacy and approvals, and remove the Models tab.

### FLOW-03 General splits display options across a card, a collapsed row and a three-way choice
- Page: Settings > General. Severity P3, category flow, observed.
- Happened: Appearance holds Theme, Sidebar density and Avatars; "Chat display" (Stream replies, Show tool activity, Load web images automatically) is a separate collapsed card on the right (`set1.png`, `set1b.png`). "Load web images automatically" is a privacy choice sitting under display.
- Expected: display options in one card; the image switch next to AI data sharing or in the Inbox.
- Fix: fold Chat display into Appearance as a second group, and drop the Avatars choice unless a founder asked for it (take-away test: no journey uses it).

### FLOW-04 Finance: Upcoming and Subscriptions list the same recurring vendors, and Breakdown is half empty
- Page: Finance. Severity P3, category visual, observed.
- Happened: Brightsign Ads, Penwright Office Supply, Shieldwell Insurance and Cursor Seats show in both "Upcoming 30 days" (marked "recurring") and "Subscriptions" (`fin2.png`). The Breakdown card stretches to the height of those two cards and is blank below row 7 (about 450 px).
- Expected: each recurring charge appears once as a charge; the left card fits its content.
- Code (suspected): Finance page grid, equal-height row of Breakdown and the right column.
- Fix: let Breakdown end at its content (or place Subscriptions under it) and drop the "recurring" chip from Upcoming rows, since Subscriptions already explains them.

### FLOW-05 "Needs reply" group and "Needs attention" chips are two labels for close ideas
- Page: Inbox, Important tab. Severity P3, category copy, observed.
- Happened: the group "Needs reply" (19 mail) sits above "Other mail today" and "Earlier", whose rows carry a "Needs attention" chip (`inbox3.png`, `inbox4.png`). Maya cannot tell why a mail she must act on is not in the reply group.
- Expected: one label for "you must act".
- Code: `apps/web/src/components/inbox/InboxRow.tsx` (chip) and the group order in `apps/web/src/pages/Inbox.tsx`.
- Fix: use one word ("Needs reply") in both places, or drop the chip when the mail is already in the Needs reply group's reason (e.g. show the reason text instead).

### FLOW-06 Cmd+K shows "Carta agent" and "Investors agent" with near-identical descriptions
- Page: Cmd+K palette, connected-Carta demo. Severity P3, category copy, observed (palette text) / suspected (cause).
- Happened: "Carta agent: Keeps your cap table and investor contacts" and "Investors agent: Answers questions about your cap table, investors and finances" are both listed under Bots, while Chief lists its last chat message as its description and the others list a role sentence. Maya cannot tell which one to ask about the cap table.
- Expected: one role sentence per agent and a visible difference ("reads Carta" vs "page assistant").
- Fix: show the same kind of description for every bot, and word the two so the difference is the data source. The Carta-only decision stays.

### FLOW-07 Fresh Legal page is plain text with no heading or icon
- Page: Legal, no contracts. Severity P3, category visual, observed.
- Happened: "Add contracts to your Data room and Legal reads them. [Add files]" floats at the top with no icon and title, while Inbox ("No mail connected") and Finance ("No accounts yet") have both (`n-Legal.png` vs `n-Inbox.png`, `n-Finance.png`).
- Expected: one empty-state pattern across pages.
- Fix: reuse the Inbox/Finance empty-state component on Legal with the title "No contracts yet".

### FLOW-08 Gmail, Google Calendar and Google Drive are three separate Connect buttons
- Page: Integrations and Chief first-run cards. Severity P3, category flow, suspected (OAuth is BLOCKED, not tried).
- Happened: Chief shows separate Gmail and Calendar Connect cards after "Run my company" (`f2.png`); Integrations lists Gmail as Connected while Calendar and Drive sit under Popular with their own Connect (`integ.png`). The code has a native Google connector (`packages/core/src/app-directory.ts:82-93`), so one sign-in may be able to cover all three.
- Expected: one Google sign-in for the Google apps Maya wants.
- Fix: check whether one Google consent can cover Gmail, Calendar and Drive, and if so show one "Connect Google" card in Chief and mark the other two Connected after it.

## Redundancy checks (re-measured)

- Consent: Inbox card, Legal and Data room cards (one Allow covers Data room and Legal, decided), chat consent card, Settings switch. Each area asks once; the first model call in Chief asks once (`ask1.png`). Fine.
- Time zone and notifications: General holds language, time zone and Browser notifications; the bot panel has a per-bot Notifications switch (decided). Fine.
- Integrations doors: sidebar row, account menu, Chief cards, Finance Accounts, Inbox Connect mail. Decided; not re-raised. The page itself is clear (Connected / Popular, "Used by", "Open Inbox / Finance") (`integ.png`).
- Model sign-in: Settings > Models only (see FLOW-02 for folding it).
- Hidden pages in search: all eight pages, Integrations and Settings are in Cmd+K; "Take the tour" is only in the account menu (menu: Settings, Integrations, Hide amounts, Take the tour, Log out).
- Page agents: sidebar "Page agents" group plus the Ask button on each page plus Cmd+K bots are three doors to the same agent. Not re-raised (earlier passes decided the sidebar shape).

## Praise (observed)

- First run is 8 actions to a real answer with a link to the next place to act (`ask2.png`).
- The first-ask card is three clear choices and collapses to a one-line record after the pick (`f2.png`).
- Inbox first screen is To do, five "Needs reply" rows and "Show 14 more" (`inbox3.png`).
- Finance gives cash, burn, runway, crypto and yield in one row (`p-Finance.png`).
- Add skill goes straight to the form (`skill.png`).
- Privacy and approvals is one master switch plus two confirmations (`set2.png`).

## Not measured

- Creating a bot, sending, approving or paying, the held "Share with {name}?" card, the secret request card and Provide secret dialog (not in the demo data).
- Phone width and touch targets.
- Gmail, Calendar, Carta, Mercury, Brex connect steps: OAuth, BLOCKED.
