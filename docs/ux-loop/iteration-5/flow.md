# UX flow critique, iteration 5

Method: /ux-flow re-measure on the current main (HEAD ae433a358) against the mock demo stack (web :5381), session uxl5-FLOW, 1440x900, signed in as the mock founder. Screenshots are in `/tmp/uxloop5/flow/`. I read code in `apps/web/src`. I created no data (no bot, file or message sent). The first-run tour had already been seen by this user, and I did not sign up a fresh user, so onboarding and tour are NOT re-measured this iteration; only the code was re-read (tour is still nine stops, an owner decision).

Severity: P0 blocks or misleads, P1 a human stumbles, P2 visibly below excellent, P3 polish.

## Fixed since iteration 4 (verified live)

- Devin is gone from the sidebar, Cmd+K and the page list until connected (`01-home.png`, `cmdk.png`).
- Cmd+K and sidebar search both list Legal (`cmdk.png`, `srch.png`).
- The "+" picker now lists only New bot, New group, New space (`plus.png`).
- Inbox has one tab row (Important, Updates, Newsletters); the first email row is at about 244 px (was 290) (`p-Inbox.png`).
- Cap table opens with its agent panel closed and the holder table starts at about 470 px (`p-Cap_table.png`).
- Data room no longer says "1 couldn't be read" in the banner; the failure shows once in the row with Try again (`p-Data_room.png`).
- Settings > Models no longer has an "Active model" line; connected state shows Disconnect with "Replace key" collapsed (`set3.png`).
- Opening Inbox no longer auto-expands "Page agents".

## Friction scorecard

| Journey | Steps actual / ideal | Verdict |
|---|---|---|
| First run | not re-measured (code only: 9 tour stops, owner decision) | n/a |
| Daily: inbox triage | list visible at 244 px; one consent card still above it | acceptable |
| Money: runway check | 1 click, Runway in first KPI row, one sync chip | minimal |
| Raise: data room + cap table | 2 pages, each loads at once; no link between them | acceptable |
| Agents: bot, skill, approval | not re-walked (would create data); picker is now 3 rows | acceptable |

## Praise

- Finance is minimal and answers the runway question in one click (`fin.png`): Cash, Burn, Runway, one sync chip, Ask.
- Integrations splits Connected from Find an app, and each connected card has a direct "Open Inbox / Open Cap table / Open Finance" shortcut (`p-Integrations.png`).
- The sidebar fits eight pages in sidebar order with no scroll, and Cmd+K matches it.

## Findings

### FLOW-01 One consent is still asked three times, and Settings shows two switches with the same title
- Page: Inbox, Legal, Settings > Privacy and approvals. Stories: STORY-APP-185, 208, 347.
- Severity P2, category flow/copy, observed; reopens iteration 4 FLOW-03.
- Happened: Inbox shows "Let Praci sort your mail" (Allow / Not now). Legal shows "Let Praci read your contracts" (Allow) above a full contracts table, with "Scan now" greyed and no reason. Settings has two switches both titled "Bots, mail, files and contracts", told apart only by the sub-line "GPT-6 Luna" and "Muse Spark 1.2". Data room has its own prompt in code. All ask whether the model may read Maya's content.
- Expected: ask once, when the first feature needs it; one Settings switch, with the backup model under Advanced.
- Evidence: `/tmp/uxloop5/flow/p-Inbox.png`, `p-Legal.png`, `set2.png`.
- Code: `components/AiDataSharing.tsx:177` (the repeated label), `pages/Inbox.tsx:1410`, `pages/Legal.tsx:276`, `pages/DataRoom.tsx:669`.
- Fix: grant consent per space for all content types from the first card shown, hide the other cards once granted, and show one switch (the model in use) in Settings.

### FLOW-02 The Legal page shows a consent card above a full table, and Scan now is disabled without a reason
- Page: Legal. Severity P2, category flow, observed.
- Happened: 10 contracts, 13 deadlines and 1 overdue are already shown, so the page looks usable, but the "Let Praci read your contracts" card takes a 60 px row and "Scan now" is dimmed with no hint that Allow unlocks it.
- Evidence: `/tmp/uxloop5/flow/p-Legal.png`.
- Code: `pages/Legal.tsx:250` (button), `:276` (card).
- Fix: when consent is missing, hide Scan now and let the card's Allow button be the single action; or fold into FLOW-01.

### FLOW-03 Notifications live in "Privacy and approvals", while time zone is in General
- Page: Settings. Stories: STORY-APP-127, 348, 375. Severity P3, category flow, observed; reopens iteration 4 FLOW-08.
- Happened: the "Notifications / Browser" switch sits under Privacy and approvals beside consent and action confirmations. Every bot panel also has a Notifications switch (code and iteration 4 walk). Time zone is in General under "Language and time zone".
- Evidence: `/tmp/uxloop5/flow/set2.png`, `set1.png`.
- Fix: move the Browser switch to General next to time zone and let bots inherit it (the bot switch only overrides).

### FLOW-04 "Server apps / Open" in Settings > General is a second door to integrations with a different name
- Page: Settings > General. Severity P3, category copy/flow, observed (what it opens was not clicked).
- Happened: the card reads "Server apps. Choose how apps connect for everyone on this server. Open". The product page is "Integrations" (owner decision), so Maya sees two names for connecting apps. For a single hosted founder "everyone on this server" is meaningless.
- Evidence: `/tmp/uxloop5/flow/set1.png`.
- Fix: show this card only to a self-hosting admin, or move it under Advanced.

### FLOW-05 Sidebar badges carry no meaning: Data room "1" is a failed file, Legal "1" is an overdue deadline, Inbox counts unread
- Page: sidebar. Severity P3, category flow/a11y, observed (meanings read from the pages).
- Happened: four badges ("14", "24 mo", "1", "1") share one style but mean count of unread, runway, failure and overdue. "1" next to Data room invites a click that leads to a red failed row, not to a task.
- Evidence: `/tmp/uxloop5/flow/01-home.png`, `p-Data_room.png`, `p-Legal.png`.
- Fix: show a badge only for things Maya must act on (unread mail, failed file, overdue) and give it a tooltip that names the reason; drop it when the number is not an action.

### FLOW-06 The Cap table donut legend clips its share counts at 1440 px
- Page: Cap table. Story: STORY-CAP-001. Severity P3, category visual, observed.
- Happened: legend rows read "84.00%  8,400,0" and "16.00% 1,600,0"; the last column is cut by the card edge. The same numbers are in the table below.
- Evidence: `/tmp/uxloop5/flow/p-Cap_table.png`.
- Code: `components/cap-table/OwnershipDonut.tsx` (legend, around line 297).
- Fix: drop the share count from the legend (the table has it) or let the legend wrap.

### FLOW-07 Cap table's primary button is "Add contact", the same action as the Contacts page
- Page: Cap table. Stories: STORY-CAP-013, 103. Severity P3, category flow, observed.
- Happened: Maya checks ownership; the filled button in the header adds a contact (it becomes "Add shareholder" and similar under a kind tab). The Contacts page in the sidebar opens the same dialog, so adding a person has two homes, and the Cap table one is easy to hit by mistake.
- Evidence: `/tmp/uxloop5/flow/p-Cap_table.png`; `pages/CapTable.tsx:568`.
- Fix: keep the action on Contacts and on each holder row only; make Ask the only header button on Cap table.

### FLOW-08 The sidebar's lower spaces are cut off behind the Integrations row
- Page: sidebar. Severity P3, category visual, observed at 1440x900 (demo seed adds "Reconnect needed" and "Empty space" rows, so a real user with one company may not see it).
- Happened: "EMPTY SPACE" is half hidden under the pinned Integrations row, with no scroll hint (`01-home.png`).
- Fix: add a bottom fade or scroll shadow to the list, or hide empty spaces until used (suspected, demo data only).

### FLOW-09 Data room shows "Processing 1 file / Reading MOCK Board Minutes" and the same "Reading" badge on the row
- Page: Data room. Stories: STORY-DRM-002, 107. Severity P3, category flow, observed.
- Happened: a banner row above the list repeats what the first row says (spinner, "Reading" badge). Failed files no longer repeat (fixed), but the banner is still a second signal for one state.
- Evidence: `/tmp/uxloop5/flow/p-Data_room.png`.
- Code: `pages/DataRoom.tsx` (processing banner).
- Fix: remove the banner and keep the row status; show the banner only when more than a few files are processing.

### FLOW-10 Settings > Models still has three folds for one decision
- Page: Settings > Models. Severity P3, category flow, observed.
- Happened: "Data room search model" (collapsed at the top), "Advanced", "Replace key" and a Backup models block with a disabled "Save backups" are on one panel, next to a provider list of seven. The model Maya chose in onboarding is the only choice most founders will ever make.
- Evidence: `/tmp/uxloop5/flow/set3.png`.
- Fix: show only the connected provider, model, Replace key and Disconnect by default; put "Data room search model" and "Backup models" under one "Advanced" fold.

## Not re-measured this iteration

- First run (sign-up, model, apps, tour, first ask) and creating a bot, skill or approval: needs a fresh user or creates data. Iteration 4 findings FLOW-01 (tour, owner decision to keep nine), FLOW-06 (bot asks for its definition twice) and FLOW-10 (Chief detour on a runway question) stay as recorded and were not re-checked.
- Two other items from the catalog are code-only and unobserved: the routine editor's separate time zone, and the three run-location controls ("Runs on", "Bots run on", desktop first run).
- Sidebar search for "Leg" listed three "Leg" messages from Chief and the Legal agent; I did not send them (I never pressed Enter), so they come from another session.
