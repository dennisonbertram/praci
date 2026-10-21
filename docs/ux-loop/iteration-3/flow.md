# UX flow critique, iteration 3

Method: /ux-flow re-measure on the current main (HEAD 80c70f036) against the mock demo stack (web :5381), session uxl3-FLOW, 1440x900. Screenshots are in `/tmp/uxloop3/flow/`. I read the code in `apps/web/src`. The demo user has already finished onboarding and the tour, so first-run findings are marked suspected (code only). I did not create data. Other critics share this stack, so the Inbox agent messages I saw (see FLOW-10) may come from them.

Severity: P0 blocks or misleads, P1 a human stumbles, P2 visibly below excellent, P3 polish.

## Friction scorecard (re-measured)

| Journey | Steps actual / ideal | Verdict |
|---|---|---|
| First run: sign-up, model, apps, tour, first ask | model step is now two sign-in buttons plus a collapsed "Use an API key instead"; apps step; first bot is created and the chat opens with a greeting. Tour still 9 stops (suspected) / ideal 3 | better, tour still long |
| Daily: inbox triage | first email at about 200 px from the top (was 245); two tab rows and four unlabeled header icons remain | acceptable |
| Money: runway check | 1 click, Cash, Burn, Runway in the first row; header says "Mercury, Brex . synced just now" as one chip | minimal |
| Raise: data room prep + cap table | Cap table holder table still starts at about 730 px; Data room still shows a failure three times | acceptable |
| Agents: create bot, skill, approval | bot is 2 clicks; the "+" menu is headed "New" but lists existing chats; skills and approvals not re-walked | acceptable |

## Fixed since iteration 2 (verified live unless noted)

- Cmd+K lists the same pages in the same order as the sidebar, including Legal and Artifacts, and also finds Apps and Settings (`15-cmdk.png`, `17-cmdk-app.png`, `19-cmdk-set.png`).
- Pages are no longer inside the chat scroll area (code: `Shell.tsx:4037`). The remaining clipping is FLOW-02.
- Finance header chips are folded into one "Mercury, Brex . synced just now" chip with a refresh icon (`03-finance.png`).
- Contacts shows the workspace name; Legal agent has starter questions (`PageAgentIntro.tsx:5-16`, code).
- Settings "AI data sharing" now reads "Bots, mail, files and contracts" on both rows, with the model id below (`11-privacy.png`). Still see FLOW-05.
- The first-run model step is trimmed (code, `Onboarding.tsx:700-720`).

## Findings

### FLOW-01 The first-run tour is still nine stops that describe the sidebar
- Story: STORY-APP-318, first run
- Severity P2, category flow, suspected (code, not seen live); reopens iteration 2 FLOW-02
- Happened: nine stops: search, create, inbox, finance, legal, files, chat, apps, account. Each repeats a label that is already on screen. The only action is the final "Ask a question" button, which comes after the account-menu stop.
- Expected: three stops (Chief with one example question, Pages, Apps), ending in the composer.
- Code: `apps/web/src/components/tour/FirstRunTour.tsx:24-63`.
- Fix: delete the search, create, inbox, finance, legal, files and account stops; keep chat, pages (one line naming Inbox, Finance, Legal, Cap table, Data room) and apps.

### FLOW-02 The Pages list is cut off at 900 px and loses its header when scrolled
- Page: sidebar
- Severity P2, category visual/flow, observed
- Happened: Pages sit in a box capped at 40% of the window height. Each row is about 50 px, so at 900 px the seventh page, Artifacts, is cut in half at the bottom of the box (`01-home.png`). Scrolling the box to reach it pushes the "PAGES" header off the top (`21-artifacts.png`). Apps is a separate row below, so the sidebar has two page-navigation areas.
- Expected: all seven pages visible without scrolling at 900 px.
- Evidence: `/tmp/uxloop3/flow/01-home.png`, `/tmp/uxloop3/flow/21-artifacts.png`
- Code: `apps/web/src/pages/Shell.tsx:4037` (`max-h-[40vh] ... overflow-y-auto`).
- Fix: raise the cap so seven rows fit (about 50vh) or reduce the page row height to 40 px; let only the chat list scroll.

### FLOW-03 Seven of eleven chat rows are page or integration agents that each page already opens with "Ask"
- Page: sidebar chat list, "+" picker
- Severity P2, category flow, observed
- Happened: the list has Chief, Founder mail agent, Sales mail agent, Inbox agent, Finance agent, Carta agent, Legal agent, Data room agent, Investor Relations, Finance helper and Leadership sync. Eight are system agents that every page opens with its own "Ask" button. One question about mail can involve three threads (see FLOW-10). The same list is repeated in the "+" picker.
- Expected: Chief plus the founder's own bots in the list; system agents under one collapsed "Page agents" row (iteration 2 FLOW-01 already proposed this).
- Evidence: `/tmp/uxloop3/flow/01-home.png`, `/tmp/uxloop3/flow/07-plus.png`
- Code: chat list build in `apps/web/src/pages/Shell.tsx` (the list rendered under the space header, near line 4191).
- Fix: group `pageAgentKind(...)` bots and integration agents into one collapsed row that shows an unread dot when any of them has an unanswered approval.

### FLOW-04 Cap table: the donut card still pushes the holder table below the fold
- Story: STORY-CAP-001, CAP-013
- Severity P2, category visual/flow, observed; reopens iteration 2 FLOW-04
- Happened: the donut card is about 490 px tall for a ring and two legend rows (Common 84%, Option pool 16%). The table of who owns what starts at about 730 px, with only the tab row visible at 900 px. The Carta agent panel is open by default and takes a third of the width. The card says option pool 1,600,000 while the KPI above says 600,000 available; both are correct (granted plus available) but nothing says so.
- Evidence: `/tmp/uxloop3/flow/04-cap.png`
- Code: `apps/web/src/pages/CapTable.tsx` (donut card).
- Fix: put the donut and legend in a row about 200 px tall so the holder table starts under the KPI cards; label the pool row "Option pool (600,000 available)".

### FLOW-05 Consent: two identical switches, and Legal asks while already showing contracts
- Story: STORY-APP-185, 208, 347
- Severity P2, category flow/copy, observed
- Happened: Settings > Privacy and approvals has two switches both titled "Bots, mail, files and contracts" that differ only by the model id below (`gpt-6-luna` on, `muse-spark-1.2` off). A founder cannot tell what turning the second one on does. On Legal the card "Let Praci read your contracts / Allow" sits above a fully populated table (10 contracts, 13 deadlines), and "Scan now" is disabled without a reason.
- Evidence: `/tmp/uxloop3/flow/11-privacy.png`, `/tmp/uxloop3/flow/06-legal.png`
- Code: `apps/web/src/components/AiDataSharing.tsx` (switch list, card).
- Fix: show one switch for the model in use (list the backup model only inside an "Advanced" fold); on Legal hide the card once any model is allowed, and show a reason beside a disabled "Scan now".

### FLOW-06 Data room reports one failed file three times and keeps Import beside Add files
- Story: STORY-DRM-002, 107, 119
- Severity P2, category flow, observed; reopens iteration 2 FLOW-05
- Happened: the banner says "Processing 1 file / Reading MOCK Board Minutes . 1 couldn't be read", the row says "Failed - This file isn't a readable PDF" with Try again, and the sidebar badge shows "1". The header still has three view icons, Import, Add files and Ask. A founder preparing for diligence sees three red or numeric signals and no answer to "what is missing".
- Evidence: `/tmp/uxloop3/flow/05-data.png`
- Code: `apps/web/src/pages/DataRoom.tsx`.
- Fix: drop "1 couldn't be read" from the banner (the row carries it), and merge Import into the Add files menu.

### FLOW-07 "Add email attachments to the Data room" is still in Privacy and approvals
- Page: Settings > Privacy and approvals
- Severity P3, category flow, observed; reopens iteration 2 FLOW-03
- Happened: it is a standalone card between AI data sharing and Action confirmations. It controls a Data room behavior, not privacy.
- Evidence: `/tmp/uxloop3/flow/11-privacy.png`
- Code: `apps/web/src/components/AutoFileEmailSetting.tsx`.
- Fix: move it into the Data room Import menu as a checked item.

### FLOW-08 The "+" menu is headed "New" but lists existing chats under "New bot"
- Story: agents journey
- Severity P3, category copy/flow, observed
- Happened: the picker has a "New" label next to its search field. The first row is "New bot", then every existing chat (Chief, Founder mail agent and so on). Picking a chat opens it; it does not create anything. The tour step calls it "create an agent or a group chat".
- Evidence: `/tmp/uxloop3/flow/07-plus.png`; tour text in `FirstRunTour.tsx:30-33`.
- Fix: put "New bot" in its own row above a "Chats" label, or drop the existing chats from the picker, since the sidebar already lists them.

### FLOW-09 Task board is reachable only from the account menu and is missing from Cmd+K
- Story: STORY-APP-322, 119
- Severity P3, category flow, observed; reopens iteration 2 FLOW-08
- Happened: the account menu has Task board, Settings, Hide amounts, Take the tour, Log out. Cmd+K finds Settings and Apps but "task" returns "No results" (`18-cmdk-task.png`). The sidebar has no row for it.
- Code: `apps/web/src/pages/Shell.tsx:2007-2032` (`appPages` has no task board entry), `Shell.tsx:4943`.
- Fix: add "Task board" to `appPages` so Cmd+K finds it; keep the account-menu item.

### FLOW-10 One mail question fans out to three agents and ends with "I don't have the complete list yet"
- Story: STORY-INB-112, 117, 019
- Severity P2, category flow, observed (the trigger may be another critic using the shared stack; the shape is the app's)
- Happened: the Inbox agent thread shows "What needs my reply today?", then "Messaged Sales mail agent", "Messaged Founder mail agent", then two answers that they cannot access the inbox overview, and a reply saying "I'm waiting on the reply-needed lists". Three threads show "Working..." in the sidebar at once, and a toast "Inbox agent finished" appeared while I was on Artifacts (`22-pageopts.png`, `23-inboxagent.png`). The sort result Maya wants is on the Inbox page's Important tab.
- Expected: for a question about mail, one agent answers from the Inbox data it already has.
- Evidence: `/tmp/uxloop3/flow/23-inboxagent.png`
- Code: delegation to per-account mail agents (suspected in the Inbox agent tools; not traced).
- Fix: let the Inbox agent read all connected mailboxes directly, and keep per-account mail agents for per-account actions only.

### FLOW-11 Inbox still stacks two tab rows and four unlabeled icons above the mail
- Story: STORY-INB-021, 022
- Severity P3, category visual, observed
- Happened: the header has "Search mail" and four icon buttons (checklist, filter, compose, Ask) with no text except Ask. Below are Important/Updates/Newsletters, then All/Founder mail/Sales mail, then "Sorting your mail...", then "Today 1". The first email is about 200 px down, an improvement from 245 px. The two tab rows differ only in what they filter.
- Evidence: `/tmp/uxloop3/flow/02-inbox.png`
- Fix: fold the account choice (All, Founder, Sales) into the Filter menu and show it as a chip only when one account is chosen.

### FLOW-12 Contacts has no Ask and files six of fourteen contacts under "Other"
- Page: Contacts
- Severity P3, category flow, observed; reopens iteration 2 FLOW-11
- Happened: Contacts has the workspace name now, but no Ask button like every other page. Kind shows "Other" for a customer (Robin Prospect, Sam Samplesworth), counsel (Dana Counselor) and a bookkeeper (Riley Testwell).
- Evidence: `/tmp/uxloop3/flow/20-contacts.png`
- Fix: add Customer and Advisor kinds, or hide the Kind column until a contact has a kind other than "Other".

### FLOW-13 Settings > Models shows "Sign in with OpenRouter" while already connected; General carries a self-host section
- Page: Settings
- Severity P3, category flow, observed
- Happened: with OpenRouter connected the pane shows the model, Advanced, Thinking, then "Sign in with OpenRouter", "Replace API key" with Test and Replace buttons, then Backup models. Three ways to change the same credential. In General, deployment owners also see "Server apps - Open server apps", which is a second door to the Apps setup (`/app/integrations/setup`).
- Evidence: `/tmp/uxloop3/flow/12-models.png`; `apps/web/src/pages/AccountSettingsOverlay.tsx:252-270`.
- Fix: when connected, show only "Disconnect" and a "Replace key" fold; move "Server apps" to the Apps page footer.

### FLOW-14 Time zone and notifications are still set in several places
- Story: STORY-APP-348, 349, 351, 375
- Severity P3, category flow, observed for Settings and suspected for the rest
- Happened: General has "Language and time zone" (New York, UTC-4). Privacy and approvals has Notifications with only "Browser" (off). A new bot's panel and the routine editor have their own switches and zone (not re-opened this pass).
- Evidence: `/tmp/uxloop3/flow/10-settings.png`, `/tmp/uxloop3/flow/11-privacy.png`
- Fix: show bot and routine rows as "Default (account setting)" until changed.

## Already minimal or excellent

- Runway check: Finance in one click, Cash $1,633,221, Burn $67,621, Runway 24.2 mo in the first row, and the sidebar badge repeats "24 mo". The header has one sync chip.
- Apps page: connected apps first, each with "Open <page>" and a "Used by" avatar, and one sentence saying "You choose which bots get access to each one".
- Cmd+K and sidebar order match, so a founder finds Legal either way.
- Settings split into General and Privacy and approvals; the Models intro "They already have one, so change this only to use another AI company or your own key" is clear.
- Legal page: three KPI cards, Overdue 1 in red, Contracts/Deadlines/Graph tabs; the first screen answers "what is due".

## Ranked recommendations (removals and merges)

1. FLOW-01 cut the tour to three stops.
2. FLOW-02 and FLOW-03 give the sidebar room: all seven pages visible, system agents in one collapsed group.
3. FLOW-04 shorten the donut card; FLOW-06 drop the duplicate failed-file text and merge Import into Add files.
4. FLOW-05 one AI-sharing switch; hide the Legal consent card once consent exists.
5. FLOW-10 one agent answers mail questions.
6. FLOW-09, FLOW-07, FLOW-08 small merges: Task board in Cmd+K, attachments toggle into the Data room, "+" picker without existing chats.
