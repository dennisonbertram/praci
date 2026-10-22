# UX flow critique, iteration 8

Method: /ux-flow re-measure on the current main (HEAD 374a06f77) against the mock demo stack (web :5381), session uxl8-FLOW (fresh users) and uxl8-FLOWm (mock founder), 1440x900. Screenshots are in `/tmp/uxloop8/flow/`. I read code in `apps/web/src`. No touch emulation was run, so no touch-target findings are made.

State I created: two fresh sign-ups (`walker-8f` and `walker-8g@northwind.example.test`, random passwords, never written down) and one "New Bot" on the founder account, which I deleted. The mock founder password was read into a shell variable and not printed or written. Partway through, the demo stack stopped answering for about 4 minutes and came back with a reset database, so my first fresh user and the founder session were gone; I signed in again. That outage is an environment event, not an app finding.

Severity: P0 blocks or misleads, P1 a human stumbles, P2 visibly below excellent, P3 polish. "Observed" means seen on screen; "suspected" means read from code only.

## Friction scorecard

| Journey | Actual / ideal | Verdict |
|---|---|---|
| First run: sign-up to first answer | Sign-up 4 actions, lands in Chief with the question "What do you want me on first?"; 1 click answers; Chief replies with Gmail and Calendar Connect cards; tour stop 1 appears; Skip tour 1 click, "Ask Chief" chip stays. 6 actions. | minimal |
| First run: connect apps | Chief cards, Integrations row, account menu, palette. OAuth: BLOCKED, not tried. | not measured |
| Daily: inbox triage | Inbox 1 click, list starts at y=133 when To do is absent. Open 1, Archive 1. Row hover shows Archive, Mark read, Mark important, Mark noise. | good |
| Daily: email agent | Open row, Ask agent (spinner shows, panel in about 4 s), "Draft a reply" chip, wait, Reply with draft, Send = 5 vs ideal 3. In my run the draft had not arrived after 2 m 40 s ("Bots are working"), likely model contention on the shared demo; I did not see Reply with draft. | better than iteration 7 (was 6) |
| Money: runway check | 1 click, Runway is the third tile. Empty Finance now has Ask. | minimal |
| Raise: Investors, Fundraising, Data room, Contacts | Four pages hold overlapping investor and SAFE data, and the numbers disagree (FLOW-01, 02, 03). | longest remaining journey |
| Agents: create a bot | + then New bot = 2 clicks, name field already focused and selected, bot greets with a question. Settings: Name, Description, Notifications, Audience, Skills, Advanced. | excellent |
| Agents: approval | Ask Chief to email someone, the approval is in a different chat (FLOW-05): 3 actions after asking vs ideal 1. | longer than ideal |
| Agents: skill | Not re-run (creates data); form unchanged since iteration 7. | n/a |

## Praise (observed)

- Fixed since iteration 7: Investors, Fundraising and Contacts empty pages are clean; empty Finance has Ask; Legal no longer repeats its Allow sentence; the Integrations catalog is ready in about 1 s (was 6 s) and has a Developer filter (`int1.png`); Ask agent shows a spinner and the panel offers a "Draft a reply" chip (`ask1.png`, `ask6.png`); "Flag unexpected actions" is gone (`set-Priv.png`); Settings no longer scrolls inside a short window.
- New bot is the best flow in the app: two clicks, name selected, a one-question greeting (`cr4.png`). Delete asks once with a plain sentence (`del2.png`).
- Cmd+K lists Legal, Fundraising and Integrations (`k1.png`, `k3.png`).
- Approval card in chat is a recipient, subject, body and Send / Discard / Edit (`ap7.png`).
- Connected Integrations tiles say "Open Inbox / Open Investors / Open Finance" and "Used by" (`int1.png`).
- Empty Data room is one drop zone with Choose files and Import (`e3-dr.png`).

## Findings

### FLOW-01 Raising money is spread over Investors, Fundraising, Contacts and Legal, and the SAFE numbers disagree
- Page: Investors, Fundraising, Legal. Stories: STORY-CAP-001 to 107, Fundraising stories. Severity P2, category flow, observed.
- Happened: for the mock founder the Investors cap table lists four SAFE holders (Priya $250,000, Lee $50,000, Sora $25,000, Tomas $25,000) while the "Equity raised" tile shows "—". The Fundraising page for the same user shows "No prospects yet" and a SAFEs card that says "No SAFEs yet". Legal lists "MOCK SAFE - Quill Capital $250,000" as a contract. Maya asks "how much have I raised on SAFEs?" and gets three different answers on three pages. Fundraising's header Ask opens the Investors agent, so the two pages already share one bot.
- Expected: one page owns SAFEs. Investors keeps ownership (shares, options); Fundraising owns SAFEs and the round and says where its data comes from when it is empty.
- Evidence: `/tmp/uxloop8/flow/m-Investors.png`, `m-Inv3.png`, `m-Fundraising.png`, `p-Legal.png`.
- Code: `apps/web/src/pages/Fundraising.tsx:241-262` (SAFEs card reads `overview.safes`), `apps/web/src/pages/Investors.tsx` (SafeRows from the cap table snapshot).
- Fix: drop the SAFE rows from the Investors cap table, link "SAFEs" there to Fundraising, and make the Fundraising empty state say which record it reads.

### FLOW-02 The Investors page shows the same investors twice, one screen apart
- Page: Investors. Stories: STORY-CAP-101 to 107. Severity P2, category flow, observed. The inner tab name "SAFEs and funds" is an owner decision and is not re-raised here.
- Happened: the cap table card ends with four SAFE rows; below the Updates section, the "SAFEs and funds" list repeats Priya, Lee, Sora and Tomas and adds Dana Fakename and Jamie Placeholder, who hold no SAFE. Every row has a "—" in its amount column. The tab is named for SAFEs but lists investor contacts.
- Expected: a person appears once per page, with an amount when there is one.
- Evidence: `/tmp/uxloop8/flow/m-Inv3.png`.
- Code: `apps/web/src/pages/Investors.tsx:894-897` (tab names), contact list render near `:1290`.
- Fix: show the list only for contacts not already in the cap table, or fill the amount column from the SAFE and hide the SAFE rows above.

### FLOW-03 Empty Investors offers six ways to add something and never says "cap table"
- Page: Investors (fresh user). Stories: STORY-CAP-001, 013. Severity P2, category flow/copy, observed.
- Happened: header "Add contact" and "Ask"; chips "Connect Carta", "Use a Google Sheet", "Type it in"; an "Updates" section with "New update"; an empty "SAFEs and funds" tab with "Add investor". Maya wants her cap table, but nothing names it. "Type it in" does not say what is typed. "Add contact" and "Add investor" open the same kind of form.
- Expected: one prompt, "Where is your cap table?", with the three source chips; Updates, the tabs and Add contact appear once a table exists.
- Evidence: `/tmp/uxloop8/flow/inv.png`.
- Code: `apps/web/src/pages/Investors.tsx:1035-1040` (Add contact), `:1180-1210` (source chips).
- Fix: hide Updates, the tab strip and Add contact until a cap table source is chosen, and label the chips with a one-line heading.

### FLOW-04 Empty Fundraising is three empty boxes and two "Add prospect" buttons
- Page: Fundraising (fresh user). Severity P3, category visual/flow, observed.
- Happened: a bordered card with only a "Start a round" button and no title, a "Pipeline" heading with "No prospects yet" and a second "Add prospect" (the header already has one), and a "SAFEs" card that says "No SAFEs yet". Fundraising is also not a stop in the first-run tour (the tour keeps nine stops by decision, so this is only noted).
- Expected: one empty state with Start a round as the main action.
- Evidence: `/tmp/uxloop8/flow/fund.png`.
- Code: `apps/web/src/pages/Fundraising.tsx:158-165,222-228`, `apps/web/src/components/fundraising/RoundCard.tsx:169-185`.
- Fix: when there is no round and no prospect, render one centered "Start a round" empty state and hide the SAFEs card and the in-page Add prospect.

### FLOW-05 An approval Maya asked Chief for sits in another chat and the toast is gone in about ten seconds
- Page: Chief, Inbox agent. Stories: STORY-APP-157, 158, 172 to 174. Severity P2, category flow, observed.
- Happened: Chief answers "I've asked the Inbox agent to email Sam that the Q3 deck is ready. Open Inbox agent". A toast "Inbox agent needs approval, Review before sending email to ..." showed for a few seconds and was gone when I went to click it. The Send / Discard card is only in the Inbox agent chat. Ask, read the reply, Open Inbox agent, Send = 3 actions after asking; ideal is the card inline in Chief's thread (1).
- Evidence: `/tmp/uxloop8/flow/ap1.png` (toast), `ap4.png` (Chief reply), `ap7.png` (card in the other chat).
- Fix: show the held-action card in the thread that asked for it, or keep the toast until it is acted on and make it open the card.

### FLOW-06 Legal and Data room ask the same consent separately, and Settings shows it off
- Page: Legal, Data room, Settings > Privacy and approvals, Chief. Stories: STORY-APP-185, 208, STORY-LEG-020. Severity P2, category flow/copy, observed for the cards; same underlying grant suspected.
- Happened: the founder sees "Let Praci read your documents" (Allow / Not now) on Data room and "Let Praci read your contracts" (Allow) on Legal. Both say the Data room text goes to the AI model. In the same session Chief's chat showed "Allow your mail to be sent to OpenRouter?" as "Allowed", while Settings > Allow AI models was off. Four prompts, three wordings, for one model. The "one switch per area" and the "master switch is on only when every model is allowed" decisions are kept; this is about the two document prompts and the off switch next to an "Allowed" card.
- Evidence: `/tmp/uxloop8/flow/p-Dataroom.png`, `p-Legal.png`, `set-Priv.png`, `ap4.png`.
- Code: `apps/web/src/components/legal/ConsentPrompt.tsx:19`, `apps/web/src/components/data-room/ConsentPrompt.tsx:83` (both use `ConsentCard` and `DataRoomConsentStatus`).
- Fix: let one Allow cover both pages (hide the second card when either is granted) and use one heading.

### FLOW-07 Inbox To do card repeats threads from the list and can push the list down after it loads
- Page: Inbox. Stories: STORY-INB-021, 022. Severity P3, category visual/flow, observed once; cause suspected.
- Happened: To do shows "Reply to Morgan about section 9 and signing" and "Send Sam the robot MAC addresses"; the same two threads are the first rows under "Needs reply". In one load the first row was at y=180 without To do and at y=426 once To do arrived (`m-inbox.png`, then `menu.png`); in a later load the card was present from the first paint (`ib3.png`). The code waits for To do before painting rows (`Inbox.tsx:615-618`), so the first case may be a refetch.
- Expected: a thread appears once; the list does not jump.
- Fix: mark threads that have a to-do with a small check on their row instead of a second list, or keep the card collapsed to one line.

### FLOW-08 Settings has two things called "Advanced"
- Page: Settings > General. Severity P3, category copy, observed.
- Happened: the left list has "Advanced" which opens one child, "Memory" (an owner decision, kept). The General page also has an "Advanced" card with Stream replies, Show tool activity and Load web images automatically. Maya sees the word twice and expects one place.
- Evidence: `/tmp/uxloop8/flow/set-adv3.png`.
- Fix: rename the General card to "Chat display" (or fold its three switches into Appearance) and leave "Advanced" for Memory.

### FLOW-09 A solo founder sees "Personal" and "New space"
- Page: Finance and Legal headers, "+" menu. Severity P3, category flow, observed.
- Happened: fresh-user pages show a "Personal" tag beside the title ("Finance  Personal") and the + menu offers New bot, New group, New space. Spaces matter once there is more than one person.
- Evidence: `/tmp/uxloop8/flow/e2-Finance.png`, `cr1.png`.
- Code: `apps/web/src/pages/shell/bot-picker.tsx:86`, `apps/web/src/pages/shell/dialogs.tsx:70`.
- Fix: hide the space tag and "New space" until the account has a second member or space.

### FLOW-10 Two doors to Integrations sit side by side
- Page: sidebar, account menu. Severity P3, category flow, observed. The pass-6 decision "Integrations stays in the account menu" is respected; this asks only whether the always-visible sidebar row should remain next to it.
- Happened: the sidebar has an "Integrations" row at the bottom and the account menu one row above has "Integrations" too. Cmd+K, Chief's Gmail and Calendar cards and in-page buttons are four more doors.
- Evidence: `/tmp/uxloop8/flow/menu.png`, `int1.png`.
- Fix: keep the sidebar row and remove the account-menu item, or the reverse; owner to confirm which the pass-6 decision meant.

### FLOW-11 A new bot exists before it has a purpose
- Page: "+" > New bot. Severity P3, category flow, observed.
- Happened: the bot is created and appears in the sidebar the moment New bot is chosen, named "New Bot". If Maya closes the panel she keeps an empty bot. I had to delete mine through the row menu (Delete, confirm).
- Evidence: `/tmp/uxloop8/flow/cr4.png`, `del1.png`.
- Fix: leave the bot out of the sidebar until it is renamed or receives its first message, or delete an untouched "New Bot" when the panel closes.

## Redundancy checks from the catalog (re-measured)

- Hidden pages and search: Legal and Fundraising are now in Cmd+K; fixed.
- Time zone and notifications: Settings > General holds language, time zone and Browser notifications together (`set1.png`); the per-bot Notifications switch remains in bot settings (`cr5.png`). Routine time zone and desktop "Runs on" were not re-measured.
- Run location: the per-bot "Computer: Team / Private" control in Advanced (`cr8.png`) is the only run control on web; the desktop first-run choice was not reachable.
- Model sign-in: Settings > Models says "They already have one" and lists OpenRouter as connected (`set-Mode.png`); onboarding never showed a model step on this stack.
- Two Ask doors on a mail thread: page-header "Ask" (Inbox agent) and the email's "Ask agent" (email chat) both remain; the email one now has a starter chip, so I leave them.

## Not re-measured

- Gmail, Calendar, Carta, Mercury, Brex connect steps and the connect popup closing via /integrations/connected: OAuth, BLOCKED.
- Held "Share with {name}?" cards and the Provide secret dialog: not seeded in the demo. The iteration-7 note on the Single line / Multi line choice stands as an owner decision.
- Skill creation, routine editor, phone width and touch targets.
- The email draft result: not delivered within 2 m 40 s in my run.
