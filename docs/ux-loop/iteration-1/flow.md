# UX flow critique, iteration 1

Method: /ux-flow. Evidence: the mock demo stack (web :5381) walked read-only at 1440x900 in session uxl1-FLOW, plus code reads in `apps/web/src`. Screenshots are in `/tmp/uxloop1/flow/`. Onboarding and the tour could not be seen live (the demo user has finished both and I did not create data), so findings about them are marked suspected and come from code. Decisions in `docs/ux-flow/report.md` (Inbox pass) are not re-opened. The demo is shared with other walkers, so some chats seen (for example a Google Drive agent and a Carta contact message) were created by others.

Severity: P0 blocks or misleads, P1 a human stumbles, P2 visibly below excellent, P3 polish.

## Friction scorecard (core journeys)

| Journey | Steps actual / ideal | Verdict |
|---|---|---|
| First run: sign-up, model, connect apps, tour, first ask | about 5 screens plus a 9-stop tour, ideal 3 (suspected, from code) | convoluted |
| Daily: inbox triage | already reviewed in `docs/ux-flow/report.md` | not re-run |
| Money: runway check | 1 click (Finance), answer visible without scrolling / 1 | minimal |
| Raise: data room prep + cap table | several doors per task, see FLOW-06, FLOW-07 | acceptable |
| Agents: create bot, skill, approval | bot via a "To:" picker, skills 4 doors, approval rules live in Settings (suspected) | convoluted |

## Findings

### FLOW-01 Legal is missing from sidebar search; hidden pages stay searchable
- Story/page: STORY-APP-322, 119, 120; sidebar search
- Severity P1, category flow, observed
- Happened: typing "legal" lists Documents, Mail and Chats but no Pages result. Typing "finance" lists the Finance page first. Legal is a sidebar page (1 unread badge). Hiding a page with Page options removes it from the sidebar, but search still lists it (code: the list ignores `hiddenPages`).
- Expected: the same seven pages are found by search as are shown in the sidebar, and a hidden page stays hidden.
- Evidence: `/tmp/uxloop1/flow/02b.png`, `/tmp/uxloop1/flow/03-search-finance.png`
- Code: `apps/web/src/pages/Shell.tsx:1948-1966` (`appPages` has no `legal`, has `integrations` and `settings`, and `searchPages` at 1969 does not filter by `hiddenPages` from 1910).
- Fix: add Legal to `appPages` and drop entries in `hiddenPages` from `searchPages` and Cmd+K.

### FLOW-02 "Search mail for ..." is offered on every sidebar search
- Page: sidebar search
- Severity P3, category flow, observed
- Happened: a search for "finance" or "legal" always ends the results with a MAIL row "Search mail for ...". Chats, Documents and Pages already cover most queries, and Inbox has its own Search mail field, so this row is a third mail search (sidebar, Inbox field, Inbox agent).
- Fix: show the mail row only when the query is not a page name, or only after the user presses Enter.
- Code: `apps/web/src/pages/SpaceSearch.tsx:148`.

### FLOW-03 Model sign-in exists twice with different labels and depth
- Story: STORY-APP-301, 306, 308, 020
- Severity P2, category flow, observed (Settings) and suspected (onboarding, code)
- Happened: onboarding "Connect a model" has two buttons ("Sign in with ChatGPT", "Sign in with OpenRouter"), an API key disclosure with provider, server URL, Advanced, Thinking. Settings > Models shows the same actions beside 36 providers. The Settings page text already says "They already have one, so change this only to use another AI company", which implies the first-run step is only needed when the server has no default.
- Expected: a first-time founder with no technical background is not asked to choose an AI company before seeing the product. If the server has a default, skip the step (it already does); when it does not, show one button and move Advanced and Thinking to Settings only.
- Code: `apps/web/src/pages/Onboarding.tsx:592-1085` (the model step also holds model, Thinking and Advanced fields that Settings repeats); `apps/web/src/pages/ModelSettingsOverlay.tsx`.
- Fix: in onboarding show only the two sign-in buttons and "Use an API key instead" with provider and key; leave Thinking, Advanced and context limits to Settings.
- Evidence: `/tmp/uxloop1/flow/s3-models.png`

### FLOW-04 "Add email attachments to the Data room" is a Data room setting inside Models
- Page: Settings > Models
- Severity P2, category flow, observed
- Happened: under ACTIVE MODEL sit a "Data room search model" disclosure and a checkbox "Add email attachments to the Data room". Neither concerns which AI the bots use. A founder looking for the attachment behavior would look in Data room or Inbox.
- Fix: move the checkbox to the Data room page (its Import menu or a settings row) and keep only the search model beside the models.
- Code: `apps/web/src/pages/ModelSettingsOverlay.tsx:1721`.
- Evidence: `/tmp/uxloop1/flow/s3-models.png`

### FLOW-05 Four doors to Integrations, and the sidebar control changes name
- Story: STORY-APP-312, 377-379, 207
- Severity P2, category flow/copy, observed
- Happened: the sidebar bottom row reads "Connect apps" with three logos on most pages, and "Integrations" (no logos) on the Integrations page and on a first paint of Cap table. The page title is "Integrations" and the onboarding step is "Connect your apps". Settings > General also has "Server integrations" for the deployment owner, and Inbox, Finance and Cap table have their own Connect buttons. Chief, Carta and Finance agent cards say "Connect".
- Expected: one name. The Integrations page lists "Open Inbox", "Open Finance" and "Open Cap table" on each card, so the page-level connect prompts are accelerators and can stay; the name should not change.
- Fix: name the sidebar row and page "Apps" (or "Integrations") consistently; move "Server integrations" next to Settings > Models as a clearly owner-only block.
- Code: `apps/web/src/components/ConnectAppsButton.tsx` (pill vs plain row), `apps/web/src/pages/AccountSettingsOverlay.tsx:261-270`.
- Evidence: `/tmp/uxloop1/flow/t1-integrations.png`, `/tmp/uxloop1/flow/q-cap-table.png`

### FLOW-06 Hide amounts has six entry points
- Story: STORY-APP-128, 201, 202
- Severity P2, category flow, observed
- Happened: the same toggle is an eye icon in the Inbox, Finance, Cap table, Data room and Legal page headers, and a menu item (with explanatory text) in the user menu. It is partial and per browser (catalog), so it asks for several controls to protect something it does not fully protect. An eye icon in an Inbox or Data room header looks like "view" not "hide money".
- Fix: keep the user-menu item only, or keep one eye in the sidebar footer; remove the five page-header copies.
- Code: `apps/web/src/components/HideAmountsToggle.tsx`; used in `pages/Inbox.tsx:58`, `pages/CapTable.tsx:48`, `pages/DataRoom.tsx:51`, `pages/Legal.tsx:15`, `components/finance/ui.tsx:51`, `pages/Shell.tsx:148`.
- Evidence: `/tmp/uxloop1/flow/r-inbox.png`, `/tmp/uxloop1/flow/s1-usermenu.png`

### FLOW-07 Cap table repeats the Data room's file controls
- Story: STORY-DRM-119, 120, CAP-013
- Severity P2, category flow, observed
- Happened: the Cap table header shows eye, refresh, Import, Add files and Add contact (five controls) above KPI cards. Import and Add files are the Data room's controls. Maya preparing a raise sees file import on three pages (Cap table, Data room, an email attachment chip). The header "Northwind ..." is truncated and the "Updated 27m ago" text wraps into three lines when the Carta agent panel is open.
- Fix: keep only "Add contact" and refresh in the Cap table header; open the Data room from a "Documents" link in the Documents list. Show "Updated 27m ago" as a single tooltip on refresh.
- Code: `apps/web/src/pages/CapTable.tsx`.
- Evidence: `/tmp/uxloop1/flow/q-cap-table.png`

### FLOW-08 Settings and the user menu both offer Usage
- Severity P3, category flow, observed
- Happened: the user menu lists Task board, Settings, Hide amounts, Take the tour, Usage and Log out. Settings has a Usage tab. Usage is the only Settings tab that also has a menu shortcut.
- Fix: remove the menu item, or add a compact usage meter in the menu and drop the tab.
- Code: `apps/web/src/pages/Shell.tsx:4863-4876`.
- Evidence: `/tmp/uxloop1/flow/s1-usermenu.png`

### FLOW-09 Settings > General has 11 sections and three of them are not about the account
- Severity P2, category flow, observed
- Happened: General lists Account, Password, AI data sharing, Notifications, Export my data, Appearance, Language, Time zone, Avatars, Server integrations, Action confirmations. Approval rules ("Action confirmations") and AI data sharing are trust decisions that Maya meets in chat as a consent card or approval card; Notifications and time zone appear again per bot and per routine (catalog Redundancy Candidates).
- Fix: split into General (Account, Password, Appearance, Language, Time zone, Export) and a "Privacy and approvals" section (AI data sharing, Action confirmations, Notifications), and remove the routine editor's separate zone selector when it equals the account zone.
- Code: `apps/web/src/pages/AccountSettingsOverlay.tsx`, `components/ApprovalRulesSettings.tsx:113`, `components/NotificationSettings.tsx:57`.

### FLOW-10 Consent is asked in up to four places with four wordings
- Story: STORY-APP-185, 347, 208
- Severity P1, category copy/flow, observed (Inbox card) and suspected (others, code and catalog)
- Happened: the Inbox card reads "Let Praci sort your mail. Senders, recipients, subjects and short previews go to the AI service that runs your bots (OpenRouter). Allow / Not now". Data room, Legal, the chat consent card and Settings > AI data sharing each ask in their own words and store their own answer. The Inbox card exposes the vendor name and sits between the tabs and the first email, pushing the first row down about 100 px.
- Fix: ask once at the first connection or first ask ("Let your bots read your mail, files and contracts?") with a per-area switch in Settings; keep the Inbox card only if the answer is still "not asked".
- Code: `apps/web/src/components/AiDataSharing.tsx:86`, `components/AskCard.tsx` (consent variant).
- Evidence: `/tmp/uxloop1/flow/r-inbox.png`

### FLOW-11 Three mail agents plus an Inbox agent, and an "Ask" on every page, for one user
- Story: STORY-INB-112, 117, 019, STORY-APP-209, 210
- Severity P2, category flow, observed
- Happened: the sidebar chat list for Maya begins Chief, Founder mail agent, Sales mail agent, Inbox agent, Finance agent, Carta agent, Legal agent, then three mock chats. Four are for mail or mail-adjacent work. Each page also has an Ask button, so each agent has three doors (page Ask, sidebar row, "+" picker). At 900 px height the Pages list scrolls out of view behind this list (the Inbox screenshots start at "Artifacts"), so the primary navigation is lost.
- Fix: group integration agents under one collapsed "Agents" folder, and show only Chief by default; keep Pages pinned and let only the chat list scroll.
- Code: `apps/web/src/pages/Shell.tsx:3956-3990` (Pages group sits inside the same scroll area as chats, see the comment "Inside the scroll area").
- Evidence: `/tmp/uxloop1/flow/r-inbox.png`, `/tmp/uxloop1/flow/q-finance.png`

### FLOW-12 "+" opens a "To:" message picker and creating a bot is its first row
- Story: first-run, agents journey
- Severity P2, category flow/copy, observed
- Happened: "+" next to Search opens a popover headed "To:" with a search box, "New bot" first and then every chat. The tour describes it as "Create your own agent, group or space", but the picker offers new message to someone, not a creation menu. I did not complete the bot creation flow (it would create data).
- Fix: label the control "New chat" and split "New bot" into a plain "Create a bot" action in the same menu, or rename the tour copy to match.
- Code: `apps/web/src/pages/Shell.tsx` (create menu, `data-tour="create-menu"`), `components/tour/FirstRunTour.tsx:24-27`.
- Evidence: `/tmp/uxloop1/flow/u1-plus.png`

### FLOW-13 The 9-stop tour describes the sidebar instead of getting to a first ask
- Story: STORY-APP-318, first-run
- Severity P2, category flow, suspected (code, not seen live)
- Happened: the tour has nine popovers (Chief, create, Inbox, Finance, Legal and Cap table, files, apps, search, account), shown at once the first time the user has a bot. The content repeats what the sidebar labels already say. It ends at the account menu and does not suggest a first question, so the first ask is left to the empty chat.
- Expected: 3 stops (chat with Chief and an example question, Pages, Connect apps) that end focused on the composer with one example the user can send.
- Code: `apps/web/src/components/tour/FirstRunTour.tsx:21-62`.

### FLOW-14 Run location, notifications and time zone are set in several places
- Story: STORY-APP-332, 336, 337, 348, 349, 351, 375, 127
- Severity P3, category flow, suspected (code and catalog; desktop-only parts cannot be seen in a browser)
- Happened: "Runs on" per bot (`pages/shell/bot-panel.tsx:508`), "Bots run on" default (`components/RunsOnPicker.tsx:76`) and a desktop first-run choice all set run location. Time zone is in Settings plus the routine editor. Notifications are in Settings, per bot and in the browser prompt.
- Fix: keep one account default and one per-bot override that shows "Default" until changed; hide the per-routine zone unless it differs.

### FLOW-15 Vendor names shown as app metadata
- Page: Integrations
- Severity P3, category copy, observed
- Happened: each app card shows "via Composio" or "via Pipedream". A founder cannot act on the provider and AGENTS.md puts vendor translation in adapters.
- Fix: remove the label; show it only inside a card's detail or an advanced "Other ways to connect" panel.
- Code: `apps/web/src/components/integrations/parts.tsx:138`.
- Evidence: `/tmp/uxloop1/flow/t1-integrations.png`

### FLOW-16 Data room header and sidebar carry many controls before the files
- Story: STORY-DRM-002, 107, 119
- Severity P2, category visual/flow, observed
- Happened: the Data room header has eye, list, grid, stats, Import, Add files and Ask (seven controls), then a search box, Type, Party, Document date filters and Sort, then a left folder tree with "New folder" and "Auto-sort", and an Imported/Processing banner above the table. The mock data is 30 files named `note-NN.txt`, so the table gives no signal about what is in the room. A founder preparing for a raise needs "what is missing" before "what is here".
- Fix: keep Add files and Ask in the header; move the view toggles to the table toolbar; put Import in the Add files menu (one door for adding).
- Code: `apps/web/src/pages/DataRoom.tsx`.
- Evidence: `/tmp/uxloop1/flow/p-data-room.png`

### FLOW-17 Inbox stacks three rows of chrome above the first message
- Story: STORY-INB-021, 022
- Severity P3, category visual, observed (the Inbox triage journey was already reviewed; this one is new)
- Happened: header with Search mail and five unlabeled icons, then tabs (Important, Updates, Newsletters), then accounts (All, Founder mail, Sales mail), then the consent card, then "Today 5". The first email starts about 330 px from the top.
- Fix: put the account choice in the header menu when only two accounts exist, and give the five icons text labels on hover (title attributes) at minimum.
- Evidence: `/tmp/uxloop1/flow/r-inbox.png`

### FLOW-18 Two runway numbers in the same demo
- Page: Chief chat and Finance
- Severity P2, category bug (demo data), observed
- Happened: Chief's seeded answer says "About 8.9 months, from $412,000 cash and $46,000 monthly net burn". Finance shows Cash $1,633,221, burn $67,621, Runway 24.2 mo, and the Finance agent says 24.2 months. A walker comparing screens will think the product is wrong.
- Fix: reseed Chief's chat from the same fixture numbers, or label it stale.
- Evidence: `/tmp/uxloop1/flow/02b.png`, `/tmp/uxloop1/flow/q-finance.png`

### FLOW-19 Finance shows two burn numbers close together
- Severity P3, category copy, observed
- Happened: the "Monthly burn $67,621 (3-mo avg, after revenue)" card and "$20,484 Spent Oct 1-20" strip sit a few pixels apart. Both are labeled, but Maya must work out why they differ.
- Fix: label the strip "Spent so far this month" and keep "Monthly burn" as the only run-rate.
- Evidence: `/tmp/uxloop1/flow/q-finance.png`

### FLOW-20 Slow first paint of a direct page load
- Severity P3, category perf, observed once
- Happened: opening `/app/inbox` directly showed "Opening your Space..." for over 7 seconds the first time and loaded in under 4 seconds on a repeat. Other walkers were using the same stack, so I do not treat this as a measured defect. Re-measure on a quiet stack.
- Evidence: `/tmp/uxloop1/flow/q-inbox.png`, `/tmp/uxloop1/flow/r-inbox.png`

## Already minimal or excellent

- Runway check: one click on Finance puts Cash, Monthly burn, Runway "24.2 mo" and "Until October 2028" in the first row, and the sidebar badge repeats "24 mo". It needs no change.
- Integrations page: connected apps lead, each card has "Open <page>" and "Used by" avatars, and the Settings > Models opener ("They already have one, so change this only to ...") explains itself in one sentence.
- Cap table first screen: four KPI cards, one donut and a holder table, with a Carta agent whose two starter questions are concrete.
- Page options menu: a plain checklist of the seven pages, with each page's toggle in one place.

## Ranked recommendations (removals and merges)

1. FLOW-01 search lists the same pages the sidebar shows (small, fixes a wrong guess).
2. FLOW-06 remove five Hide amounts eyes, FLOW-07 remove Import/Add files from Cap table, FLOW-08 remove menu Usage (removals, all small).
3. FLOW-10 merge four consent asks into one first-ask prompt plus Settings switches.
4. FLOW-13 shrink the tour to three stops ending on a sample question; FLOW-03 trim the onboarding model step to sign-in buttons.
5. FLOW-11 fold integration agents into one folder and pin Pages.
