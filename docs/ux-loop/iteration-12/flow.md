# UX flow critique, iteration 12

Method: /ux-flow re-measure on the mock demo stack (web :5381), 1440x900, no touch emulation. Sessions: `uxl12-FLOW` (mock founder, read-only except opening panels) and `uxl12-FLOWf` (one fresh invented sign-up with a random password, not recorded). Screenshots: `/tmp/uxloop12/flow/`. The demo is shared with other walkers, so the Mercury approval toast, "New Bot", "MOCK J2 Ops Bot", extra spaces and badge counts that changed while I worked are not mine. OAuth connect steps are BLOCKED and not tried. Phone width, touch targets and sending/approving were not measured. Investors and Fundraising are owned by another session; no P0/P1 found there.

"Observed" means seen on screen; "suspected" means read from code only.

## Friction scorecard

| Journey | Actual / ideal | Verdict |
|---|---|---|
| First run: sign-up to first ask | Name, email, password, Create account, then one click on "Run my company" = 5 actions. Chief answers with Gmail and Calendar Connect cards (`f1.png`, `f2.png`). | minimal |
| First run: tour | Stop 1/9 on the first page click, Skip is one click (`f3.png`). | good, one overlap (FLOW-06) |
| Daily: inbox triage | Inbox 1 click, "To do" card plus "Needs reply", row opens in 1 click, Reply / Archive / Ask agent visible in the open mail (`inbox4.png`, `mail.png`). | good, long group (FLOW-01) |
| Daily: answer an agent question | Sidebar "Needs your answer" row, 1 click, two one-tap options (`ir.png`). | minimal |
| Money: runway check | Finance 1 click, "Runway 24.2 mo, Until October 2028" in the first row of tiles (`p-Finance.png`). | minimal |
| Raise: data room, cap table, contacts, legal | Each page 1 click or Cmd+K; consent cards now share one component with Allow / Not now (`p-Legal.png`). | good |
| Agents: bot settings, skill | Row menu, Bot settings (2 clicks), Add skill, New skill, then a 3-field form (`botset.png`, `newskill.png`). Creating a bot was not done (it would add demo data). | acceptable, two small redundancies (FLOW-04, FLOW-05) |
| Agents: approval | Toast and Activity row seen from another walker's request; I did not approve (`activity.png`). | label mismatch (FLOW-03) |

## Fixed since iteration 11 (observed or read in code)

- Legal and Data room consent now use one shared `DocumentsConsentCard`, both with Allow and Not now (`p-Legal.png`; `legal/ConsentPrompt.tsx`, `data-room/ConsentPrompt.tsx`). Closes old FLOW-03. The Data room card now also re-reads consent on window focus (closes old FLOW-01 in code; I did not time the refresh in the browser).
- The email agent is a visible "Ask agent" button next to Reply and Archive, with a "Draft a reply" chip in the panel (`askagent.png`).
- Cmd+K finds Settings, Integrations, chats and documents by text; the empty palette lists the eight pages (`cmdk.png`, `cmdk2.png`).
- Inbox To do card no longer repeats the same reply sentence as a "Needs reply" row (`inbox4.png`). Closes old FLOW-02.

## Findings

### FLOW-01 "Needs reply" holds 17 rows and pushes today's "Needs attention" mail below the fold
- Page: Inbox, Important tab. Severity P2, category flow, observed.
- Happened: the group "Needs reply" lists 17 messages going back to Oct 10, including low-stakes ones (demo day slots, team offsite dates). The two newest mails, "Q3 investor update: draft for your review" and "Re: Redlines on the Master Services Agreement", sit in a second group called "Other mail today" with a "Needs attention" chip, after all 17 (`inbox4.png`, `inb-s1.png`). Count measured from the page text between the two headings.
- Expected: the first screen holds what Maya should act on today. Two similar labels ("Needs reply", "Needs attention") in two groups make her scroll to learn which is which.
- Code: `apps/web/src/pages/Inbox.tsx:1759-1795` (groups `needsReply`, then `today`, then `earlier`); the label at `apps/web/src/components/inbox/InboxRow.tsx:227`.
- Fix: show at most five "Needs reply" rows with "Show N more", or order each group by recency so today's "Needs attention" mail appears first.

### FLOW-02 Approval toast covers the right-hand bot panel and the skill form
- Page: bot settings panel, Add skill form. Severity P2, category visual, observed.
- Happened: the persistent bottom-right toast ("Mercury agent needs approval") sits on top of the panel's lower half. While adding a skill it hides the instructions field, so Maya types without seeing it (`newskill.png`, `botset.png`). The toast came from another walker's thread and returned when the panel changed.
- Expected: owner decisions keep toasts persistent and bottom-right; this is only about overlap with the open panel. Maya can still dismiss it, but she must find the cross first.
- Code (suspected): toast host position in the shell, not offset when the right panel is open.
- Fix: when a right-hand panel is open, move the toast stack left of the panel (or into the chat column).

### FLOW-03 The same held action is "needs approval" in the toast and "Needs your answer" in Activity and the sidebar
- Page: Activity panel, sidebar rows, approval toast. Severity P3, category copy, observed.
- Happened: the toast reads "Mercury agent needs approval"; the Activity row for the same agent reads "Needs your answer" (`activity.png`, `irmenu.png` area). The comment in code says one name is intended for answers and approvals.
- Expected: an approval to send $250 should use one word everywhere; "answer" fits a question card, "approval" fits a held payment.
- Code: `apps/web/src/lib/roster-status.ts:12-16` (`needsAnswerLabel`); toast copy in the approval toast components.
- Fix: use "Needs approval" in rows and Activity when the held item is an approval card, keep "Needs your answer" for questions.

### FLOW-04 "Clear conversation" is in two places for the same bot
- Page: bot row menu and bot settings panel. Severity P3, category flow, observed.
- Happened: the row "Actions" menu lists Pin, Move to, Mark as unread, Bot settings, Routines, Duplicate, Clear conversation, Archive, Delete (`irmenu.png`); the settings panel footer also has Export and a red Clear conversation (`botset.png`, `chief.png`).
- Expected: one place for a destructive action; the row menu is for navigation and organizing.
- Code: `apps/web/src/pages/BotContextMenu.tsx:152`, `apps/web/src/pages/shell/bot-panel.tsx:844`.
- Fix: remove Clear conversation from the row menu and keep it in the panel footer.

### FLOW-05 "Add skill" asks for a method before the founder has a skill
- Page: bot settings, Skills. Severity P3, category flow, observed.
- Happened: Add skill opens a three-item menu: New skill, Upload a skill file, From URL (`botadv.png`). The common case is New skill.
- Expected: one click opens the New skill form; importing is an option inside it.
- Code: `apps/web/src/pages/shell/BotSkillsSection.tsx:326-345`.
- Fix: make Add skill open the form directly and move "Upload file" and "From URL" into a small link in the form.

### FLOW-06 Tour stop 1 covers the page title
- Page: first-run tour, Inbox. Severity P3, category visual, observed.
- Happened: the popover under the Search box lies over the "Inbox" heading, so the page name is half hidden on the first page Maya opens (`f3.png`).
- Expected: the popover sits beside the search box and leaves the heading visible.
- Code (suspected): `apps/web/src/components/tour/TourPopover.tsx` (sidebar targets use a card placed under the target).
- Fix: place the card to the right of the sidebar column or lower, below the heading.

### FLOW-07 First-ask choices B and D lead to nearly the same setup
- Page: Chief first-run card. Severity P3, category copy, observed.
- Happened: "Day-to-day work" (Slack, calendar and email) and "A bit of everything" (Email, Slack and docs) share Slack and Gmail and differ by one app each (`f1.png`; `apps/api/src/onboarding.ts:44-68`). Maya cannot tell which to pick, and neither names a founder task.
- Expected: three clearly different choices, or two plus the text box.
- Fix: merge B and D into one choice (Gmail, Slack, Calendar, Docs) and keep "Run my company" and "Research & writing".

### FLOW-08 Settings General: "Notifications" card contains one switch with the same name
- Page: Settings, General. Severity P3, category copy, observed.
- Happened: a card titled "Notifications" holds one switch labelled "Browser notifications" (`set1.png`; `apps/web/src/components/NotificationSettings.tsx:58,79`).
- Expected: the heading and label should not repeat; one row is enough.
- Fix: drop the card heading and put the switch in the "Language and time zone" card, renamed "Language, time zone and notifications", or remove the heading only.

### FLOW-09 Cmd+K chat results show raw markdown links
- Page: Cmd+K palette. Severity P3, category copy, observed.
- Happened: searching "Open Settings" lists the Investors agent chat with the snippet "...d a reply. [Open Settings](/app?settings=privacy)" (`cmdk3.png`).
- Expected: the link text without the URL syntax.
- Code: `apps/web/src/pages/shell/command-palette.tsx:31` (`plainSnippet` removes `**`, `__` and backticks only).
- Fix: also replace `[text](url)` with `text` in `plainSnippet`.

## Redundancy checks (re-measured)

- Consent: Inbox card, Legal and Data room cards (now one component), Settings switch. Each area asks once and Settings shows the same state. Fine.
- Time zone and notifications: General holds language, time zone and Browser notifications; the bot panel has a per-bot Notifications switch (decided). Fine apart from FLOW-08.
- Integrations doors: sidebar row, account menu, Chief cards, Finance Accounts, Inbox Connect mail. Decided; not re-raised. The Integrations page is clear: Connected, Popular, "Open Inbox / Open Finance" and "Used by" avatars (`integ2.png`). The All / Finance / Social / Tools tabs over 15 cards add little (P3, not filed).
- Model sign-in: Settings > Models only ("Your bots use OpenAI: GPT-6 Luna" and "Use my own model", `set3.png`). Fine.
- Hidden pages in search: all eight pages, Settings and Integrations appear in Cmd+K. "Take the tour" is only in the account menu. Fine.
- SAFEs appear in Investors, Fundraising and Legal (contracts); the other session owns those pages, so not filed.
- Settings "Advanced" holds only Memory (`set5.png`); decided in pass 7, not re-raised.

## Praise (observed)

- First run is five actions with no model, Space or sign-in step (`f1.png`, `f2.png`).
- The agent question card has two one-tap answers and stays in the chat (`ir.png`).
- Finance shows cash, burn, runway and treasury yield in the first row (`p-Finance.png`).
- The Integrations page shows what is connected, which bot uses it, and where to open it (`integ2.png`).
- Privacy and approvals is one master switch plus two confirmations (`set2.png`).
- The open email shows Reply, Archive and Ask agent in one row (`mail.png`).

## Not measured

- Creating a new bot, sending, approving or paying, the held "Share with {name}?" card, the secret request card and Provide secret dialog (not in the demo data).
- Phone width and touch targets.
- Gmail, Calendar, Carta, Mercury, Brex connect steps: OAuth, BLOCKED.
