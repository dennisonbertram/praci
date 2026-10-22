# UX flow critique, iteration 7

Method: /ux-flow re-measure on the current main (HEAD ad11f395d) against the mock demo stack (web :5381), session uxl7-FLOW, 1440x900. Screenshots are in `/tmp/uxloop7/flow/`. I read code in `apps/web/src`. No touch emulation was run, so no touch-target findings are made.

State I created: one fresh user `walker-7f@northwind.example.test` (sign-up, one focus answer, Legal "Allow", pages opened), and one Ask agent chat on the "Redlines on the Master Services Agreement" email (my message was sent twice by my own keyboard and fill calls; that duplicate is my artifact, not an app defect). The mock founder password was read into a shell variable and not printed or written.

Severity: P0 blocks or misleads, P1 a human stumbles, P2 visibly below excellent, P3 polish. "Observed" means seen on screen; "suspected" means read from code only.

## Friction scorecard

| Journey | Actual / ideal | Verdict |
|---|---|---|
| First run: sign-up to first answer | Sign-up 4 actions, lands in Chief; 1 click answers "What do you want me on first?"; the reply names Finance, Investors and Data room as links and adds Gmail and Calendar Connect cards. Tour: Skip 1 click. Total 6 with Skip. | excellent |
| First run: connect apps | Connect cards in Chief, Inbox "Connect mail", Finance "Add account", Investors "Connect Carta", Integrations. Connect is OAuth: BLOCKED, not tried. | not measured |
| Daily: inbox triage | Inbox list starts at y=380 under a To do card; open 1, Archive 1. Row hover actions exist. | good |
| Daily: ask about one email, reply with a draft | Open row, Ask agent (now beside Reply), type, send, wait, Reply with draft, Send = 6 vs ideal 3. Was 7. | better, still long (FLOW-04) |
| Money: runway check | 1 click, Runway in the first tile row. | minimal |
| Raise: Data room + cap table | 1 click each. Palette now finds Data room files and "cap table" resolves to Investors. The page is named Investors but everything else calls it Cap table (FLOW-01). | good, with a naming split |
| Agents: create a bot | + then New bot, name. Not re-run (creates data). Settings now start with Name and Description, Audience explains itself in code. | minimal |
| Agents: skill | Add skill, New skill, 3 fields, Save = 6. | acceptable (FLOW-09) |
| Agents: approval | Two answer buttons in chat, 1 click. | minimal |

## Praise (observed unless noted)

- Fixed since iteration 6: Ask agent is a top-level button beside Reply and Archive (`m-mail.png`); the tour's first stop says "page, chat or email" and the palette finds Data room files (`m-cmdk.png`); empty Artifacts, Contacts, Data room and Inbox are clean with one action (`e-Artifacts.png`, `e-Contacts.png`, `e-Dataroom.png`, `inbox-fresh.png`); the user menu has no Task board; email chats fold into one "Email chats" row; bot settings have no Title field; the Legal agent lands in the Page agents group; "Ask before sending external email" and "Ask before purchases" start on (`set2.png`).
- Settings > General now holds Language, time zone and Notifications together, and "Integration sign-in" is behind a collapsed Advanced row (`set1.png`).
- Sidebar badges are exactly the decided three: unread mail, Legal due soon, Data room failed (`m-home.png`).
- Data room shows the failed file once with the reason and Delete (`m-dr2.png`).
- Approval questions in chat are plain: a sentence and two buttons (`m-ir.png`).
- Skill editor asks only for Name, "What it does and when to use it", and Instructions (`m-skill3.png`).

## Findings

### FLOW-01 The page is called Investors, but the tour, Chief and the Integrations catalog still call it Cap table
- Page: sidebar, tour stop 5, Chief greeting. Stories: STORY-APP-318, STORY-CAP-001. Severity P2, category copy, observed.
- Happened: the sidebar row, page title and palette say "Investors". Tour stop 5 says "see who owns what in Cap table", the first Chief message says "keep an eye on cash and the cap table", and the Integrations catalog says "Cap table, equity and investors". Maya is told to look for a page that is not in the sidebar. Inside the page there is also an "Investors" tab (a kind filter), so "Investors" means the page and one tab of it.
- Expected: one name for the page everywhere.
- Evidence: `/tmp/uxloop7/flow/s2.png`, `inv.png`, `m-inv.png`.
- Code: `apps/web/src/components/tour/FirstRunTour.tsx:50`, `apps/api/src/onboarding.ts` (greeting), `apps/web/src/components/integrations/IntegrationsHome.test.tsx:187` (catalog text).
- Fix: use "Investors" in the tour, greeting and catalog, or rename the page back to Cap table; pick one.

### FLOW-02 Contacts and Investors both list investors and advisors with different "kind" lists
- Page: Contacts, Investors. Stories: STORY-CAP-101 to 107, contacts stories. Severity P2, category flow, observed.
- Happened: Contacts has Kind = Advisor, Legal, Investor, Customer, Auditor, Vendor. The Investors page has tabs All, Shareholders, Investors, Options, Auditors, Other and a Kind column (Shareholder, Options, Advisor). "Auditors" and "Other" tabs on a cap table are contact kinds, not ownership kinds. Casey Advisor appears in both.
- Expected: Investors shows ownership only (shares, options, SAFEs); people come from Contacts.
- Evidence: `/tmp/uxloop7/flow/m-con.png`, `m-inv.png`.
- Code: `apps/web/src/pages/Investors.tsx:523` (kind labels).
- Fix: drop the Auditors and Other tabs from Investors, and link a row to its Contacts entry.

### FLOW-03 A new user's AI switch is off while bots already answer, and Legal asks again with the same sentence twice
- Page: Settings > Privacy and approvals, Legal. Stories: STORY-APP-185, 208, STORY-LEG-020 to 029. Severity P2, category flow/copy, observed; cause suspected.
- Happened: for the fresh user "Allow AI models, for bots, mail, files and contracts" is off, yet Chief answered the first question and the tour ran. Legal then shows "Let Praci read your contracts [Allow]" and, under it, "Allow access above to start. The Legal agent then reads your Data room for contracts and deadlines", which repeats the card. After Allow, the page says "Press Scan now..." on an empty Data room, so Maya clicks twice (Allow, Scan now) to reach a state that should be automatic. Pass-6 decision "one switch per area" is kept; this is about the off-but-working state and the repeated line.
- Expected: the switch state matches what works; one Allow; the first scan starts by itself after Allow.
- Evidence: `/tmp/uxloop7/flow/set2.png`, `s2.png`, `leg-fresh.png`, `leg2.png`.
- Code: `apps/web/src/pages/Legal.tsx:313,318`; `apps/web/src/components/AiDataSharing.tsx` (ConsentCard).
- Fix: delete the "Allow access above" sentence, scan once automatically after Allow, and show the bots switch on when Chief runs on the system model.

### FLOW-04 Asking the email agent for a reply is still six actions, the panel opens empty, and the first click gives no feedback
- Page: Inbox reader. Stories: STORY-INB-112, 117, 121. Severity P2, category flow, observed.
- Happened: open the row, Ask agent, type "Draft a reply", send, wait, Reply with draft, Send. After clicking Ask agent the button turned grey and nothing else changed for about 4 s before the panel appeared. The panel shows only an "Email thread, 4 messages" chip and an input "Ask about this email"; there is no suggestion. The Reply button next to Ask agent still opens an empty composer, so two reply routes remain. (The draft in my run came back as plain chat text, so I did not see "Reply with draft"; that button is in code at `EmailAgentPanel.tsx:179`.)
- Expected: one "Draft reply" action that opens the panel and sends the request itself.
- Evidence: `/tmp/uxloop7/flow/m-mail.png`, `m-askagent.png`, `m-reply2.png`.
- Code: `apps/web/src/components/inbox/EmailAgentPanel.tsx:179`.
- Fix: add one starter chip "Draft a reply" in the empty panel and keep the Ask agent button in its busy state with a spinner.

### FLOW-05 The Activity panel repeats the status lines the sidebar rows already show
- Page: sidebar Activity. Stories: STORY-APP-124 to 127, STORY-APP-016. Severity P3, category flow/copy, observed.
- Happened: the sidebar rows already say "Needs your answer" and "Working..." under Investor Relations and Finance helper. Activity re-lists the same two bots under "Needs you" and "Working", plus "Show 15 finished runs", and its text for the first is "Selected choice anonymous:..." (the answer text, not the question). While Activity is open it also stays open on every page and pushes the Chief and company list down.
- Expected: one place for "needs you"; if Activity stays, show the question.
- Evidence: `/tmp/uxloop7/flow/m-act.png`, `m-home.png`.
- Fix: show the pending question text in Activity, and close it when Maya opens a page.

### FLOW-06 Finance still has five KPI tiles and two spend numbers
- Page: Finance. Severity P3, category visual/flow, observed. Unchanged from iteration 6 FLOW-15 (a test, `Finance.test.tsx:359`, requires Treasury yield in the row, so this was a decision in code; re-raising only because the row is now wider).
- Happened: Cash, Monthly burn, Runway, Crypto, Treasury yield, then a second line "$20,484 Spent so far this month" beside the Week/Month/Quarter/Year switch. The chart's last annotation "Financing, Oct ↑ $250,(" is cut at the right edge. Runway is still easy to find.
- Evidence: `/tmp/uxloop7/flow/m-fin.png`.
- Fix: keep the first three tiles, move Crypto and Treasury yield into the Accounts view, and let the chart annotation wrap or flip left.

### FLOW-07 Integrations opens as grey boxes for several seconds and its finance list differs from Finance's Add account
- Page: Integrations, Finance > Add account. Stories: STORY-APP-312, 377 to 379. Severity P3, category perf/flow, observed.
- Happened: three seconds after clicking Integrations the page still showed six empty grey tiles; the catalog was ready at about six seconds. The Finance section lists Alchemy ("Optional faster balance reads") and Blockscout ("Ready", "Add wallet") that Finance's own Add account dialog does not offer; Add account has Upload statements and Wallet instead. Two lists for one job.
- Evidence: `/tmp/uxloop7/flow/int.png`, `int2.png`, `fin-add.png`.
- Fix: show the first cards (Gmail, Calendar) from a static list while the catalog loads, and hide Alchemy under a "Developer" filter.

### FLOW-08 "Flag unexpected actions" is an unexplained third switch
- Page: Settings > Privacy and approvals. Severity P3, category copy, observed.
- Happened: under Action confirmations, two switches are plain ("Ask before sending external email", "Ask before purchases", on), the third "Flag unexpected actions" is off with no line saying who decides what is unexpected or what flagging does.
- Evidence: `/tmp/uxloop7/flow/set2.png`, `m-priv.png`.
- Code: `apps/web/src/components/ApprovalRulesSettings.tsx:168`.
- Fix: add a short helper line, or remove the switch until it does something Maya can name.

### FLOW-09 The secret dialog asks Maya to choose Single or Multi line before she types a secret
- Page: chat secret request card, "Provide secret" dialog (new since pass 6). Stories: STORY-APP-157, 158. Severity P3, category flow, suspected (not in the demo data; read from code and the e2e spec).
- Happened: the dialog title and the card button both say "Provide secret", then a Single line / Multi line tab pair, then the field, then Submit. Most secrets are one token; a private key is the only multi-line case.
- Expected: one password field that becomes multi-line when the pasted value has a line break.
- Code: `apps/web/src/components/SecretRequestDialog.tsx:78`, `AskCard.tsx:274`.
- Fix: remove the tabs and switch the field to a textarea on paste of multi-line text.

### FLOW-10 Empty Finance has no Ask while the other empty pages do
- Page: Finance, Investors, Contacts empty states. Severity P3, category flow, observed.
- Happened: empty Investors, Contacts, Data room, Artifacts and Inbox show Ask in the header; empty Finance shows only the title and "Add account".
- Evidence: `/tmp/uxloop7/flow/e-Finance.png`, `inv.png`.
- Fix: show Ask on empty Finance (the runway question is the natural first ask).

### FLOW-11 Adding a skill is a hand-written form
- Page: bot settings > Skills. Stories: STORY-APP-157 area. Severity P3, category flow, observed for the form; the conversational route was not checked.
- Happened: Add skill, then New skill / Upload SKILL.md / From URL, then Name, "What it does and when to use it", Instructions, Save: 6 actions, and Maya must write the instructions herself.
- Expected: "Make this a skill" from a chat that went well.
- Evidence: `/tmp/uxloop7/flow/m-skill2.png`, `m-skill3.png`.
- Code: `apps/web/src/pages/shell/BotSkillsSection.tsx:326`.
- Fix: add "Save as skill" to a chat message's More menu that prefills the three fields.

### FLOW-12 Bot panel Audience segment can disagree with the header tag
- Page: bot settings. Severity P3, category bug, observed with a caveat (other walkers share this bot and may have been editing it at the time).
- Happened: the header briefly showed an "External" tag next to Investor Relations (mock) while the panel's segmented control still had Internal selected; the tag disappeared on a later poll. The panel keeps its own copy of the value (`useState(bot.audience)`) and only resets it after a failed save.
- Evidence: `/tmp/uxloop7/flow/m-botadv.png` (tag), `m-botset2.png` (no tag).
- Code: `apps/web/src/pages/shell/bot-panel.tsx:202,415`.
- Fix: re-sync the local audience when the bot's audience changes from the server.

## Not re-measured

- Gmail, Calendar, Carta, Mercury, Brex connect steps and the connect popup closing via /integrations/connected: OAuth, BLOCKED.
- Model sign-in in onboarding versus Settings: this stack gives every user a server model, so the step never shows (code only).
- Held "Share with {name}?" cards and the secret card: not seeded in the demo; only the code was read (`AskCard.tsx:57-60`, `SecretRequestDialog.tsx`).
- Runway answer from Chief for a user with no accounts (iteration 6 FLOW-12): not re-asked. The first Chief reply does now link Finance, Investors and Data room.
- Routine time zone, "Runs on" controls, phone width and touch targets.
