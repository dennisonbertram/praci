# UX flow critique, iteration 2

Method: /ux-flow re-measure on the current main (merge 159365cab) against the mock demo stack (web :5381), session uxl2-FLOW, 1440x900. Screenshots are in `/tmp/uxloop2/flow/`. I read the code in `apps/web/src`. First-run onboarding and the tour could not be seen live (the demo user has finished both), so those findings are marked suspected. While opening the "+" menu I clicked "New bot", which creates a bot at once; I deleted it (it had no data). The demo is shared, so some chats and workspaces in the sidebar were made by other walkers. Decisions in `docs/ux-flow/report.md` are not re-opened.

Severity: P0 blocks or misleads, P1 a human stumbles, P2 visibly below excellent, P3 polish.

## Friction scorecard (re-measured)

| Journey | Steps actual / ideal | Verdict |
|---|---|---|
| First run: sign-up, model, apps, tour, first ask | model step now trimmed; tour still 9 stops (suspected, code) / ideal 3 | still long |
| Daily: inbox triage | first email about 245 px from top (was 330); consent card still above it | better |
| Money: runway check | 1 click, Cash, Burn, Runway in the first row / 1 | minimal |
| Raise: data room prep + cap table | Cap table header now 2 controls; holder table starts at 745 px (below fold) | acceptable |
| Agents: create bot, skill, approval | bot 2 clicks and a named-later bot; skills and approvals not re-walked | acceptable |

## Fixed since iteration 1 (verified live)

- Legal is found by sidebar search and Cmd+K (`02-search-legal.png`, `21-cmdk.png`).
- The sidebar row and the page are both named "Apps"; "via Composio" is gone (`12-apps.png`).
- The five Hide amounts eyes are gone; only the account menu has it (`05-finance.png`, `08-usermenu.png`).
- The account menu no longer has Usage; Settings has a "Privacy and approvals" tab (`09-settings.png`, `10-privacy.png`).
- Cap table header is only refresh and "Add contact"; Import is gone from the Documents list (`06-cap.png`).
- Finance strip reads "Spent so far this month" (`05-finance.png`). Inbox consent card is one line without a vendor name (`04-inbox.png`).

## Findings

### FLOW-01 Pages scroll out of the sidebar when the chat list is long
- Page: sidebar (re-opens iteration 1 FLOW-11)
- Severity P1, category flow, observed
- Happened: Pages sit inside the same scroll area as the chats. After a bot was deleted the list scrolled to the bottom and the seven Pages vanished; the visible rows were Finance agent, Carta agent, Legal agent, Investor Relations, and so on. At rest the chat list shows six agent rows (Chief, two mail agents, Inbox, Finance, Carta) and a Legal agent below. The 900 px screen shows Pages plus about five chats.
- Expected: Pages stay visible; only chats scroll. Integration agents sit in one collapsed group.
- Evidence: `/tmp/uxloop2/flow/20-after.png` vs `/tmp/uxloop2/flow/01-home.png`
- Code: `apps/web/src/pages/Shell.tsx:3987-3996` (the comment "Inside the scroll area" is the cause).
- Fix: render the Pages group above the scrolling chat list so it never scrolls away.

### FLOW-02 The first-run tour is still nine stops that repeat the sidebar labels
- Story: STORY-APP-318, first run
- Severity P2, category flow, suspected (code, not seen live)
- Happened: nine steps (chat, create, inbox, finance, legal/cap table, files, search, account, apps) and the last one is the only action. None suggests a first question.
- Expected: three stops (Chief with one example question, Pages, Apps), ending in the composer.
- Code: `apps/web/src/components/tour/FirstRunTour.tsx:24-63`.
- Fix: cut the inbox, finance, legal, files, search and account stops; keep chat, pages and apps.

### FLOW-03 "Add email attachments to the Data room" is still not a privacy or model setting
- Page: Settings > Privacy and approvals (and Models)
- Severity P3, category flow, observed
- Happened: the checkbox moved from Models to Privacy and approvals, directly under AI data sharing. It is a Data room behavior. The "Data room search model" disclosure is still under Models.
- Evidence: `/tmp/uxloop2/flow/10-privacy.png`, `/tmp/uxloop2/flow/11-models.png`
- Code: `apps/web/src/components/AutoFileEmailSetting.tsx`, `pages/ModelSettingsOverlay.tsx`.
- Fix: put the checkbox in the Data room Import menu or a row at the top of the Data room, not in Settings.

### FLOW-04 Cap table: the donut panel hides the holder table
- Story: STORY-CAP-001, CAP-013
- Severity P2, category visual/flow, observed
- Happened: the donut card is about 490 px tall for a ring and two legend rows (Common 84%, Option pool 16%). The "who owns what" table starts at 745 px, below the fold at 900 px. The Carta agent panel is open by default and halves the width. Maya's raise question ("who owns what") is answered one scroll down.
- Evidence: `/tmp/uxloop2/flow/06-cap.png`
- Code: `apps/web/src/pages/CapTable.tsx` (the donut card height).
- Fix: shrink the donut card to its content height so the holder table starts under the KPI cards.

### FLOW-05 Data room reports one failed file three times and answers "what is missing" nowhere
- Story: STORY-DRM-002, 107, 119
- Severity P2, category flow, observed
- Happened: the banner says "Processing 1 file ... 1 couldn't be read", the row says "Failed" with a red reason and a Try again button, and the sidebar badge says "1" for the same room. Header still has three view icons (list, grid, stats) beside Import, Add files and Ask. Import and Add files are still two doors for adding (improved from seven header controls to six).
- Evidence: `/tmp/uxloop2/flow/07-data.png`
- Code: `apps/web/src/pages/DataRoom.tsx`.
- Fix: drop the banner's "couldn't be read" line when the row already shows it; put Import in the Add files menu.

### FLOW-06 Consent still asks per page and the Settings switches are per model id
- Story: STORY-APP-185, 208, 347
- Severity P2, category flow/copy, observed (cards, Settings) and suspected (that one Allow clears the other cards; not tried because it changes state)
- Happened: Inbox ("Let Praci sort your mail"), Legal ("Let Praci read your contracts") and the Data room each show the same card; wording is now consistent. Settings > AI data sharing lists two switches named `gpt-6-luna` and `muse-spark-1.2` with "OpenRouter" below each. A founder cannot tell which to turn on. On Legal the "Scan now" button is disabled while "Last scan 3h ago" is shown, so the page contradicts itself.
- Evidence: `/tmp/uxloop2/flow/13-legal.png`, `/tmp/uxloop2/flow/10-privacy.png`, `/tmp/uxloop2/flow/04-inbox.png`
- Code: `apps/web/src/components/AiDataSharing.tsx:12-60` (card), the recipient list in the same file.
- Fix: one switch "Let Praci's AI read my mail, files and contracts" in Settings, and ask once on the first page that needs it; hide "Last scan" until consent exists.

### FLOW-07 "New bot" creates a bot immediately; deleting an empty bot asks about memories
- Story: agents journey
- Severity P2, category flow, observed
- Happened: "+" opens a picker headed "To:" and its first row is "New bot". Clicking it creates a bot named "New Bot" at once, opens its settings panel, and the bot asks what it should handle. That is good: two clicks to a working bot with a clear first question. Two costs: a record exists before the user names it (I had to delete it), and Delete shows a "Keep memories / Delete memories too" choice for a bot with no memories.
- Evidence: `/tmp/uxloop2/flow/03-plus.png`, `/tmp/uxloop2/flow/17-newbot.png`, `/tmp/uxloop2/flow/19-del.png`
- Code: `apps/web/src/pages/Shell.tsx` (create menu), delete dialog in the bot actions.
- Fix: skip the memory question when the bot has no memories; rename the picker header or the tour copy so "+" reads as "New chat or bot".

### FLOW-08 Task board is reachable only from the account menu; Cmd+K lists a different page set
- Story: STORY-APP-322, 119
- Severity P3, category flow, observed
- Happened: Task board is a menu item next to Settings and Log out, with no sidebar row; opening it shows no active row. Cmd+K lists Inbox, Finance, Cap table, Contacts, Legal, Data room, Apps in an order that differs from the sidebar (Legal third there, fifth here) and omits Artifacts.
- Evidence: `/tmp/uxloop2/flow/16-taskboard.png`, `/tmp/uxloop2/flow/21-cmdk.png`
- Code: `apps/web/src/pages/Shell.tsx:~1990-2003` (`appPages`).
- Fix: build Cmd+K from the same ordered list as the sidebar, including Artifacts; make Task board an optional sidebar page like the others.

### FLOW-09 Inbox still stacks tabs, an account row, a consent card and then mail
- Story: STORY-INB-021, 022
- Severity P3, category visual, observed
- Happened: header (search and four unlabeled icons), tabs (Important, Updates, Newsletters), account row (All, Founder mail, Sales mail), then the consent card whose top edge touches the account row, then "Today 5". The first email starts about 245 px down (was about 330). The two tab rows differ only by what they filter.
- Evidence: `/tmp/uxloop2/flow/04-inbox.png`
- Fix: merge the account choice into the header search field's menu; add a few px of space above the consent card.

### FLOW-10 Data and connection chips repeat the Apps page
- Page: Finance header
- Severity P3, category flow, observed
- Happened: the Finance header shows "Updated just now", "1 non-USD not counted", green Mercury and Brex chips, and an Accounts button. The Apps page shows the same connections. The "Connected" chips do not lead anywhere else.
- Evidence: `/tmp/uxloop2/flow/05-finance.png`
- Fix: fold the chips into the Accounts button (one count) and keep "not counted" as a tooltip.

### FLOW-11 Contacts has no workspace name or Ask and files customers under "Other"
- Page: Contacts
- Severity P3, category flow, observed
- Happened: every other page header shows the workspace name and an Ask button; Contacts shows neither. Kind is Investor, Auditor or Other, so a prospect (Robin, Bolt Freight) and counsel are both "Other". Cap table has its own "Add contact", so there are two doors to the same dialog.
- Evidence: `/tmp/uxloop2/flow/14-contacts.png`
- Fix: add Customer and Counsel kinds, or hide the Kind column until a kind is set.

### FLOW-12 Time zone and notifications still live in several places
- Story: STORY-APP-348, 349, 351, 375
- Severity P3, category flow, suspected (code and catalog; the routine editor and desktop parts not opened)
- Happened: Settings has "Language and time zone" and a Notifications block with only Browser; a new bot's panel has its own Notifications switch (on by default); the routine editor has a zone (the zone change merged as `ux1/routines-timezone`, not re-checked).
- Fix: show the bot switch as "Default" until changed, and keep one account switch.

### FLOW-13 Legal agent has no starter questions
- Page: Legal agent chat
- Severity P3, category flow, suspected (code)
- Happened: `PageAgentKind` has inbox, finance, carta and data-room but not legal, so the Legal agent opens without the intro and example questions the other page agents have.
- Code: `apps/web/src/components/PageAgentIntro.tsx:5`.
- Fix: add a legal kind with three starter questions (for example "What is due this month?").

## Already minimal or excellent

- Runway check: one click on Finance, Cash $1,633,221, Burn $67,621, Runway 24.2 mo in the first row, and the sidebar badge repeats "24 mo".
- Sidebar search now returns Pages, Documents and Chats with Legal first for "legal".
- Apps page: connected apps lead, each card has "Open <page>" and a "Used by" avatar, with the sentence "You choose which bots get access to each one".
- Cap table header is two controls; Settings split into General and "Privacy and approvals" reads clearly.
- New bot: two clicks, and the bot opens by asking what it should do.

## Ranked recommendations (removals and merges)

1. FLOW-01 pin Pages above the scrolling list.
2. FLOW-04 shorten the donut card; FLOW-05 drop the duplicate failed-file banner and merge Import into Add files.
3. FLOW-06 one AI-sharing switch and one ask; hide "Last scan" without consent.
4. FLOW-02 cut the tour to three stops.
5. FLOW-08 build Cmd+K from the sidebar page list; FLOW-03 move the attachment checkbox to the Data room.
