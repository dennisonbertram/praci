# UX flow critique, iteration 4

Method: /ux-flow re-measure on the current main (HEAD 6f27035a3) against the mock demo stack (web :5381), session uxl4-FLOW, 1440x900. Screenshots are in `/tmp/uxloop4/flow/`. I read the code in `apps/web/src`. The demo login still shows the 9-stop tour on sign-in, so first-run tour findings are observed. I walked Inbox, Finance, Legal, Devin, Cap table, Data room, Apps, Cmd+K, Settings and bot creation. I clicked "New bot" once, which created a bot at once; I deleted it again, so the stack is as I found it. Other critics share this stack, so some chat content (for example Chief's "What is our runway?") may come from them.

Severity: P0 blocks or misleads, P1 a human stumbles, P2 visibly below excellent, P3 polish.

## Friction scorecard (re-measured)

| Journey | Steps actual / ideal | Verdict |
|---|---|---|
| First run: model, apps, bot, tour, first ask | 3 onboarding steps (model, apps, bot auto-created, `Onboarding.tsx:130`); tour 9 stops / 3; the last tour button fills "What should I do first this week?" into the composer | tour still too long |
| Daily: inbox triage | first email row at about 290 px (was 200) because the consent card now sits above the list; two tab rows remain | slightly worse |
| Money: runway check | 1 click, Runway in the first KPI row, one sync chip | minimal |
| Raise: data room + cap table | Cap table holder table now starts at about 480 px (was 730); Data room shows one failure three times | acceptable |
| Agents: bot, skill, approval | bot is 1 click (created instantly); Skills and Notifications are on the same panel | acceptable |

## Fixed since iteration 3 (verified live)

- All eight pages fit in the sidebar without scrolling (`01-home.png`). The page-agent chats are collapsed under one "Page agents 5" row.
- Cmd+K lists Inbox, Finance, Legal, Devin, Cap table, Contacts, Data room, Artifacts, Task board and Apps in sidebar order (`11-cmdk.png`).
- The Cap table donut is now about 240 px tall and the holder table is visible at 900 px (`05-cap.png`).
- Data room: Import is gone; one "Add files" menu (`06-data.png`).
- Onboarding is three steps and creates the first bot without asking for a name.

## Praise

- Finance is minimal: Cash, Burn, Runway first, one sync chip, one Ask button (`04-finance.png`).
- The Apps page splits Connected from Find an app, with an "Open Finance / Open Inbox" shortcut on each connected card (`12-apps.png`).
- The tour's final button drops a real question into the composer.

## Findings

### FLOW-01 The first-run tour is still nine stops
- Story: STORY-APP-318
- Severity P2, category flow, observed (stops 1/9 to 8/9 read live); reopens iteration 3 FLOW-01
- Happened: search, create, inbox, finance, legal, files, chat, apps, then "Ask a question". Five stops repeat a sidebar label that is already readable. The tour also does not mention Devin or Cap table by name as a page.
- Expected: three stops (Chief, Pages, Apps) ending in the composer.
- Evidence: `/tmp/uxloop4/flow/01-home.png`
- Code: `apps/web/src/components/tour/FirstRunTour.tsx:24-63`
- Fix: delete the search, create, inbox, finance, legal and files stops and fold their text into one "Pages" stop.

### FLOW-02 Devin is a top-level page for every founder, fourth in the list, and empty until connected
- Page: sidebar, Devin
- Severity P2, category flow, observed
- Happened: Devin sits between Legal and Cap table in the sidebar, Cmd+K and the page options. Unconnected, it is a blank page with "Connect Devin to see its sessions here" and one button. It has no Ask, no space name and is not in the tour. Maya is raising money and does not use a coding agent. The page splits "connect an app" from the Apps page, which is now the fifth door to connecting something.
- Expected: Devin appears as a page only after Devin is connected; before that it is an Apps card.
- Evidence: `/tmp/uxloop4/flow/16-devin.png`
- Code: `apps/web/src/pages/Shell.tsx:2071-2075` (`appPages` adds Devin unconditionally; Task board right below it is gated on `ticketBoardEnabled`).
- Fix: gate the Devin page entry on a connected Devin key, the way Task board is gated.

### FLOW-03 One AI consent is asked four times, and two switches look identical
- Story: STORY-APP-185, 208, 347
- Severity P2, category flow/copy, observed
- Happened: Inbox shows "Let Praci sort your mail / Allow / Not now" (`03-inbox.png`), Legal shows "Let Praci read your contracts / Allow" above a fully populated table with "Scan now" disabled and no reason (`15-legal.png`), the Data room has its own prompt (code), and Settings has two switches both titled "Bots, mail, files and contracts", separated only by "GPT-6 Luna" and "Muse Spark 1.2" below (`09-priv.png`). All four answer the same question ("may the model read my content?"). All were off for the demo user, yet the Legal table is full.
- Expected: one decision, asked once (the first time a feature needs it), shown once in Settings as one switch for the model in use.
- Code: `apps/web/src/components/AiDataSharing.tsx` (`ConsentCard`, `InboxConsentPrompt`), `components/legal/ConsentPrompt.tsx`, `components/data-room/ConsentPrompt.tsx`, `pages/Legal.tsx:243`, `pages/Inbox.tsx:1391`.
- Fix: grant consent per space for all content types in the first card Maya sees, hide the other cards when it is granted, and put the backup model's switch under "Advanced".

### FLOW-04 The Inbox consent card pushes the first email down to about 290 px
- Story: STORY-INB-021, 022
- Severity P2, category visual/flow, observed; regresses iteration 3 FLOW-11 (200 px)
- Happened: header, tab row one (Important, Updates, Newsletters), tab row two (All, Founder mail, Sales mail), the 60 px consent card, then "Today 3". The first sender is at y about 290. The two tab rows still filter different things.
- Evidence: `/tmp/uxloop4/flow/03-inbox.png`
- Fix: move the consent card into the empty tab row slot as a one-line banner, or let FLOW-03 remove it; fold All/Founder/Sales into the Filter menu and show a chip only when one account is chosen.

### FLOW-05 Data room still reports the same failed file three times
- Story: STORY-DRM-002, 107, 119
- Severity P2, category flow, observed; reopens iteration 3 FLOW-06
- Happened: the banner says "Processing 1 file . Reading MOCK Board Minutes - October.pdf . 1 couldn't be read", the row says "Failed - This file isn't a readable PDF" with Try again, and the sidebar shows a "1" badge. Maya preparing a raise sees three signals and no list of what a data room should contain.
- Evidence: `/tmp/uxloop4/flow/06-data.png`
- Code: `apps/web/src/pages/DataRoom.tsx` (processing banner).
- Fix: remove "1 couldn't be read" from the banner; the row already says it and has the retry.

### FLOW-06 A new bot is created on the first click and then asks for its definition twice
- Story: agents journey, STORY-APP creating a bot
- Severity P2, category flow, observed
- Happened: "New bot" in the "+" picker creates a bot named "New Bot" immediately (a persistent row in the sidebar) and opens a right panel with Name, Title, Description, Notifications, Skills (11 built in), Advanced, Export, Clear conversation, next to a chat where the bot says "I'm a blank slate right now, so you get to decide what I become. What's the main thing you'd want me handling for you?" Maya can answer the bot or fill the Description; both define the bot. Backing out leaves a "New Bot" behind. I had to delete it by hand.
- Evidence: `/tmp/uxloop4/flow/14-newbot.png`
- Fix: open the panel with only Name focused and collapse Title, Description, Skills and Advanced until the bot has replied once; or delete a bot that has never been used when the panel is closed.

### FLOW-07 The "+" picker is headed for creation but lists nine existing chats
- Story: agents journey
- Severity P3, category copy/flow, observed; reopens iteration 3 FLOW-08
- Happened: first row "New bot", then Chief, Inbox agent, Finance agent, Carta agent, Legal agent, Investor Relations, Finance helper and more. The sidebar already lists these, and selecting one opens it. The tour calls the button "create an agent or a group chat".
- Evidence: `/tmp/uxloop4/flow/13-create.png`
- Fix: drop existing chats from the picker (Cmd+K finds chats) and keep New bot and New group.

### FLOW-08 Settings splits related controls across Privacy, General and the bot panel
- Page: Settings, bot settings
- Severity P3, category flow, observed; reopens iteration 3 FLOW-07
- Happened: "Add email attachments to the Data room" is a card in "Privacy and approvals". A "Notifications / Browser" switch also sits there, while every bot panel has its own Notifications switch. Time zone is in General under "Language and time zone". The three "Action confirmations" switches (external email, purchases, unexpected actions) are all off for this user, although Chief told Maya earlier "I asked for your approval first because it is a payment".
- Evidence: `/tmp/uxloop4/flow/09-priv.png`, `/tmp/uxloop4/flow/08-settings.png`
- Fix: move the attachment switch to the Data room Add files menu, keep one Notifications section (global, with bots inheriting it), and say in "Ask before purchases" whether payments ask anyway (suspected: the default is enforced server side; not verified).

### FLOW-09 Settings > Models states the active model three times and offers sign-in beside Replace key
- Page: Settings > Models, onboarding model step
- Severity P3, category flow/copy, observed
- Happened: "ACTIVE MODEL OpenAI: GPT-6 Luna . OpenRouter . Thinking: Medium" at the top, then "Connected . OpenRouter", then a Model dropdown with the same model. When already connected, "Sign in with OpenRouter" sits above "Replace API key", so there are two ways to reconnect. Also "Data room search model" and "Backup models" are separate folds. This is the second place Maya picks a model after onboarding.
- Evidence: `/tmp/uxloop4/flow/10-models.png`
- Fix: remove the "ACTIVE MODEL" line (the dropdown shows it), and when connected show only "Replace key" and "Disconnect".

### FLOW-10 A runway question to Chief detours through the Finance agent and ends in an error
- Story: STORY-AGT chat, runway check
- Severity P2, category flow, observed (the mock model may cause the error; the detour is the app's)
- Happened: after "What is our runway?" Chief shows "Messaged Finance agent / Message from Finance agent", then the red banner "The tools finished, but the model did not write a final answer. Rephrase the request and try again." The sidebar shows "Waiting for the computer..." on Chief. The answer is already on Finance (24.2 months) in one click. The composer also still holds the tour's sample question unsent.
- Evidence: `/tmp/uxloop4/flow/18-chiefsettings.png`
- Fix: give Chief read tools for the Finance summary so a runway question needs no second agent, and make the failure message offer "Try again" instead of "Rephrase".

### FLOW-11 Sidebar shows five spaces and two Inbox-agent rows for a founder with one company
- Page: sidebar
- Severity P3, category visual, observed (likely demo data: "Reconnect needed", "Empty space", "Mail needs reconnect", "Mail rate-limited")
- Happened: opening Inbox auto-expands "Page agents", so the chat list gains a clipped "Inbox agent" row at the bottom and the Apps row sits tight below it (`03-inbox.png`). Collapsed spaces still take a row each and a lock icon.
- Fix: do not auto-expand "Page agents" when navigating to a page (the page's Ask button reaches the agent); suspected: seed data only for the extra spaces, so no change there.

### FLOW-12 Cap table opens its Carta agent chat by default at a third of the width
- Story: STORY-CAP-001
- Severity P3, category visual, observed; reopens earlier iterations
- Happened: the right panel starts mid-history with a "3 new messages" pill, and compresses the holder table (Name, Kind, Shares, Ownership) into 685 px so a row for Casey Advisor wraps its subtitle and email.
- Evidence: `/tmp/uxloop4/flow/05-cap.png`
- Fix: start the agent panel closed (Inbox already does) and keep "Ask" in the header.
