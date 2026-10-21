# UX flow critique, iteration 6

Method: /ux-flow re-measure on the current main (HEAD 834e7ddd3 plus later merges) against the mock demo stack (web :5381), session uxl6-FLOW, 1440x900. Screenshots are in `/tmp/uxloop6/flow/`. I read code in `apps/web/src` and `apps/api/src`. Touch targets were not measured (no touch emulation run).

State I created in the demo (other critics share it): one fresh user `walker-6f@northwind.example.test` (sign-up, one Chief question), one email opened (now marked read) with Ask agent opened on it (this added a "[MOCK] Quick question on the hiring plan" chat row), and one bot "New Bot" that I created and then deleted. The sign-in used the credentials file through a shell variable; the password was not printed or written.

Severity: P0 blocks or misleads, P1 a human stumbles, P2 visibly below excellent, P3 polish. "Observed" means seen on screen; "suspected" means read from code only.

## Friction scorecard

| Journey | Actual / ideal | Verdict |
|---|---|---|
| First run: sign-up, first answer | Sign-up 4 actions (name, email, password, button) lands in Chief; 1 click answers the focus question; tour 1 click (Skip) or 9 (Next); question typed and sent 2. Total 8 with Skip / 16 with the tour. No model step on this stack. | good; the tour is the only long part (nine stops, owner decision) |
| First run: connect apps | Gmail and Calendar cards appear in Chief at once. Clicking Connect is an OAuth step: BLOCKED, not tried. | not measured |
| First ask, no data ("What is my runway?") | Honest answer in about 10 s, but the fix ("Connect them in Finance") is plain text. 3 more steps to reach the Add account dialog. | acceptable (FLOW-12) |
| Daily: inbox triage | List visible at about 244 px; one consent card above it. Open an email 1, Archive 1. | good |
| Daily: ask about one email, reply with a draft | 7 actions (open, More, Ask agent, type, send, wait, Reply with draft, Send) vs ideal 3. | convoluted (FLOW-06) |
| Money: runway check | 1 click from the sidebar; Runway tile in first row. | minimal |
| Raise: Data room, Cap table | Each page is 1 click and loads at once; no link between them; palette cannot find a file by name. | acceptable (FLOW-02) |
| Agents: create a bot | Create, New bot, type a name: 3 actions, auto-saves. | minimal |
| Agents: approval | The bot's question arrives in chat as two buttons: 1 click. | minimal |
| Agents: skill | Not re-walked (creates data). Settings shows Add skill and Built-in skills (11) collapsed. | not measured |

## Praise (observed)

- Sign-up goes straight to Chief with a one-click focus question, then the tour, with no setup form (`s2.png`, `s3.png`).
- The approval flow in chat is excellent: a plain question and two answer buttons (`m-ir.png`).
- New bot is three actions and the settings panel starts with only Name and More settings (`m-newbot.png`).
- Finance answers the runway question in the first tile row (`m-fin.png`). The Cap table donut legend no longer clips (`m-cap.png`, was iteration 5 FLOW-06).
- Data room no longer repeats the processing state in a banner; the failed file shows once with Try again (`m-drm.png`).
- Cmd+K lists Legal and Integrations, and Devin is hidden (`m-cmdk.png`).
- Cap table header has only Ask (decided); Integrations splits Connected from Find an app with an "Open Finance / Open Inbox" shortcut on each card (`m-int.png`).

## Findings

### FLOW-01 Legal says it needs an OpenRouter key while Chief already works and Settings says the space has a model
- Page: Legal, Settings > Models. Stories: STORY-LEG-020 to 029, STORY-APP-301. Severity P1, category flow/copy, observed (fresh user); cause confirmed in code.
- Happened: a brand-new user chats with Chief at once, then opens Legal and gets a warning bar "Legal needs an OpenRouter key to read your contracts" with "Add your OpenRouter key". The button opens Settings > Models, which says "This space already uses OpenRouter" and "They already have one, so change this only to use another AI company or your own key". The two screens contradict each other, and the next thing shown is an empty API key form. Opening Legal also added an empty "Legal agent" row to Personal.
- Expected: Legal runs on the model the space already uses, or says plainly that it needs a different model and offers one click to switch.
- Evidence: `/tmp/uxloop6/flow/e-leg.png`, `leg-key.png`, `side.png`.
- Code: `apps/api/src/legal.ts:120` (`modelBlocker` is `own_key` whenever the preferred model is not the space default), `apps/web/src/pages/Legal.tsx:416`.
- Fix: let Legal use the space default model when the preferred one is not available, and drop the OpenRouter-key message.

### FLOW-02 The tour and search box promise "any chat, file or email", but the palette finds no file
- Page: Cmd+K, sidebar Search, tour stop 1. Stories: STORY-APP-119, STORY-DRM-114. Severity P2, category copy/flow, observed.
- Happened: the first tour stop says "Type here to find any chat, file or email". Searching "Board Minutes" (a file in the Data room) shows "No results". "board" lists the Task board page, bots and chats only. Mail is a "Search mail for ..." hand-off, which is not shown for the two-word query.
- Expected: the copy matches what the palette does, or the palette lists Data room files.
- Evidence: `/tmp/uxloop6/flow/m-cmdk-file.png`, `m-cmdk-board.png`.
- Code: `apps/web/src/components/tour/FirstRunTour.tsx:30`.
- Fix: reword to "Find a page, chat or email", or add Data room file names to the palette results (one search).

### FLOW-03 One email thread appears twice in search, as a bot and as a chat, and each one adds a permanent sidebar row
- Page: sidebar, Cmd+K. Stories: STORY-INB-112, 117. Severity P2, category flow, observed.
- Happened: searching "board" returns "[MOCK] Q3 board deck (PDF attached) / Handles one email thread" under Bots and again under Chats. The sidebar's company list holds three such email chats mixed with Chief and Maya's own bots, and pressing Ask agent on one email added a fourth. They push Page agents, spaces and Archived below the fold.
- Expected: an email's agent is opened from the email; it is not a bot Maya manages and appears once.
- Evidence: `/tmp/uxloop6/flow/m-cmdk-board.png`, `m-cap.png`, `m-ir.png`.
- Code: `apps/api/src/inbox-thread-agent.ts:118`.
- Fix: leave email-thread agents out of the sidebar list and the Bots group, and show one result in the palette.

### FLOW-04 The AI consent is now two switches named after models, and the Inbox card still asks
- Page: Settings > Privacy and approvals, Inbox. Stories: STORY-APP-185, 208, 347. Severity P2, category flow/copy, observed; reason suspected. Reopens iteration 5 FLOW-01.
- Happened: the Settings switches are "Allow GPT-6 Luna" (on) and "Allow Muse Spark 1.2" (off), both "For bots, mail, files and contracts". The Inbox still shows "Let Praci sort your mail" with Allow and Not now. Maya cannot tell which model matters or why she is asked again; model names mean nothing to her.
- Expected: one "Let Praci's AI read my content" choice, asked once; model names only under Advanced.
- Evidence: `/tmp/uxloop6/flow/m-set-priv2.png`, `m-inbox.png`.
- Code: `apps/web/src/components/AiDataSharing.tsx:160` (one switch per recipient).
- Fix: show one switch that sets all recipients, and hide the Inbox and Legal cards once it is on.

### FLOW-05 The tour tells Maya to turn on safety switches that are off
- Page: tour stop 7, Settings > Privacy and approvals. Severity P2, category flow, observed for the mock founder; not checked for a fresh user.
- Happened: stop 7 says "To approve emails and purchases before they happen, turn on Action confirmations in Settings". "Ask before sending external email", "Ask before purchases" and "Flag unexpected actions" are all off. A first-time founder gets a chore from the tour, and until she does it she has less protection than she was told about.
- Expected: external email and purchases ask by default, and the tour does not send her to Settings.
- Evidence: `/tmp/uxloop6/flow/m-set-priv2.png`; `FirstRunTour.tsx:60`.
- Fix: default those two switches on and delete the sentence from the tour.

### FLOW-06 Replying to an email with the agent takes seven actions, and the first one is hidden in "More"
- Page: Inbox reader. Stories: STORY-INB-112, 117, 121. Severity P2, category flow, observed.
- Happened: Maya's email asks "can you confirm two hires in Q4?". Path: open the row, More, Ask agent, type, send, wait, "Reply with draft" (appears only after a draft exists), Send. The Reply button next to it opens an empty composer instead, so there are two reply routes. The panel opens empty with only an "Email thread, 1 message" chip and no hint of what to ask.
- Expected: open, one "Draft reply" action, Send.
- Evidence: `/tmp/uxloop6/flow/m-mail.png`, `m-more.png`, `m-askagent.png`, `m-reply.png`.
- Code: `apps/web/src/components/inbox/EmailAgentPanel.tsx:179`.
- Fix: put "Reply with agent" beside Reply, which opens the panel and sends "Draft a reply" for her; keep free-form Ask agent in More.

### FLOW-07 Bot settings ask for the same identity twice and carry two unexplained two-way controls
- Page: bot settings. Stories: STORY-APP-353, 357, 364 (Audience). Severity P2, category copy/flow, observed.
- Happened: a new bot shows Name, Title and Description (the bot also asks in chat what it should handle). Audience has Internal / External with no sentence about what changes. Under Advanced, "Computer" has Team / Private, another unexplained two-way choice. The per-bot Notifications switch (on by default) is a third place for notifications.
- Expected: one definition field; one plain line appears only when External is picked, saying what changes.
- Evidence: `/tmp/uxloop6/flow/m-botset.png`, `m-botadv2.png`.
- Code: `apps/web/src/components/BotAudienceTag.tsx` (tag only); settings in `apps/web/src/pages/shell/bot-panel.tsx`.
- Fix: remove the Title field (Description covers it), and show a one-line explanation under Audience when External is chosen.

### FLOW-08 "Task board" is a ninth surface found only through the user menu and Cmd+K
- Page: Task board. Severity P2, category flow, observed.
- Happened: it is not among the seven pages in the sidebar, yet it is in the user menu and the palette. Opened empty it shows "No tickets yet" and a paragraph explaining tickets, which repeats the New ticket button. Bot settings also has an "Open work" list, so there are two places for tasks.
- Expected: not shown until a bot has made a ticket (same rule as Devin).
- Evidence: `/tmp/uxloop6/flow/m-task.png`, `usermenu.png`.
- Code: `apps/web/src/pages/Shell.tsx:2153`, `:5144`, `apps/web/src/pages/Board.tsx:128,151`.
- Fix: hide the user-menu item and palette entry while there are no tickets.

### FLOW-09 Integrations has a second door in the user menu, and Finance has its own app list
- Page: user menu, Finance > Add account. Stories: STORY-APP-312, 377 to 379, 207. Severity P3, category flow, observed.
- Happened: the sidebar has an always-visible Integrations row, and the user menu has the same entry. Finance's "Add account" dialog is a different list (Mercury, Brex, Upload statements, Wallet, Coinbase, Kraken), while Integrations lists Mercury, Brex, Coinbase and Blockscout under Connected. Palette, chat cards, Inbox and Cap table add more doors.
- Evidence: `/tmp/uxloop6/flow/usermenu.png`, `fin-add.png`, `m-int.png`.
- Fix: remove "Integrations" from the user menu (the sidebar row is always there); keep the in-page doors, which are task-specific.

### FLOW-10 Settings > General still shows server administration to a hosted founder
- Page: Settings > General. Severity P3, category copy, observed. Partly fixed from iteration 5 FLOW-04 (it was named "Server apps").
- Happened: the card "Integration sign-in. How Integrations connect for everyone on this server. Open" is now consistent in name, but "everyone on this server" is operator language, and the card sits in the first pane next to Appearance.
- Evidence: `/tmp/uxloop6/flow/m-set1.png`.
- Code: `apps/web/src/pages/AccountSettingsOverlay.tsx:254`.
- Fix: show it only to a server admin or self-hosted owner.

### FLOW-11 Notifications are still in two places with different defaults
- Page: Settings > Privacy and approvals, bot settings. Stories: STORY-APP-127, 375. Severity P3, category flow, observed. Unchanged from iteration 5 FLOW-03.
- Happened: the account switch sits under Privacy and approvals beside consent, and every bot has its own switch (on for a new bot). Time zone is in General.
- Evidence: `/tmp/uxloop6/flow/m-set-priv2.png`, `m-botset.png`.
- Fix: move the account switch to General, and let the bot switch only mute (override).

### FLOW-12 The first answer to "What is my runway?" ends in plain text
- Page: Chief. Stories: STORY-FIN-001, STORY-APP-176 to 182. Severity P3, category flow, observed.
- Happened: with no accounts connected Chief answers honestly ("I can't calculate your runway yet, your bank and card accounts aren't connected. Connect them in Finance") but "Finance" is not a link and there is no Connect card (Gmail and Calendar get cards). Maya has to find Finance, click Add account, then choose Mercury. A burn answer from Chief for the mock founder does carry an "Open Finance" link, so the pattern exists.
- Evidence: `/tmp/uxloop6/flow/ask.png`, `fin-empty.png`, `fin-add.png`; `m-chief2.png` (the link).
- Fix: have the no-accounts reply include the same "Open Finance" link.

### FLOW-13 Chief cannot make a payment and offers no next step
- Page: Chief. Severity P3, category flow, observed in text; the message was sent by another session, not me.
- Happened: asked to pay a $2,000 bill, Chief replied "The Mercury/Brex payment agent isn't available to me in this space, and I haven't submitted the payment." It says what failed but gives no link to the Mercury agent or to Integrations.
- Evidence: `/tmp/uxloop6/flow/m-chief2.png`.
- Fix: end that reply with "Open Mercury agent" or "Open Integrations".

### FLOW-14 Empty pages keep full toolbars
- Page: Artifacts, Contacts, Inbox (no mail). Severity P3, category flow, observed.
- Happened: empty Artifacts shows Filters, a list/grid toggle and Ask, and also an "Open chat" button that does the same as Ask. Empty Contacts shows Add contact and Ask. Inbox with no mail shows a search box that cannot search anything.
- Evidence: `/tmp/uxloop6/flow/e-art.png`, `e-con.png`, `e-inb.png`.
- Fix: hide Filters, view toggle and search until there are items, and drop "Open chat".

### FLOW-15 Finance now has five KPI tiles and two spend numbers
- Page: Finance. Severity P3, category visual/flow, observed. Iteration 5 praised Cash, Burn, Runway.
- Happened: Crypto and Treasury yield were added to the first row, and a second figure, "$20,484 spent so far this month", sits just under it next to "Monthly burn $67,621". Runway is still easy to find.
- Evidence: `/tmp/uxloop6/flow/m-fin.png`.
- Fix: keep three tiles in the first row and move Crypto and Treasury yield into the Accounts view.

### FLOW-16 The Legal agent appears in Personal after the page is opened
- Page: sidebar. Severity P3, category flow, observed; cause suspected.
- Happened: for the fresh user, only Chief was listed until Legal was opened; then an empty "Legal agent" row appeared under Personal (it did not go into the collapsed Page agents group the mock founder has).
- Evidence: `/tmp/uxloop6/flow/side.png`.
- Fix: create page agents lazily into the Page agents group, or only when Maya presses Ask.

## Not re-measured

- Gmail, Calendar, Carta, Mercury and Brex connect steps are OAuth or real provider steps: BLOCKED, not attempted.
- The model sign-in step: this stack gives every new user a server model, so sign-up goes directly to Chief. The model-in-onboarding versus Settings duplication was not observable (code only).
- Skill creation, routine time zone and the run-location controls ("Runs on", "Bots run on") were not exercised.
- Touch targets and phone width were not measured.
