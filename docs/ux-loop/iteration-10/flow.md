# UX flow critique, iteration 10

Method: /ux-flow re-measure on the mock demo stack (web :5381), 1440x900, no touch emulation (no touch-target findings). Sessions: `uxl10-FLOW` (mock founder) and `uxl10-FLOWf` (one fresh invented sign-up, random password not recorded). Screenshots: `/tmp/uxloop10/flow/`. Code read in `apps/web/src`. The demo is shared with other critics running at the same time, so some chat messages and the agent list changed under me; I did not send any message myself. Created data: one fresh demo user; I sent, archived and approved nothing. OAuth connect steps are BLOCKED and were not tried.

"Observed" means seen on screen; "suspected" means read from code only. Investors and Fundraising are owned by another session, so only P0/P1 problems are reported there (none found).

## Friction scorecard

| Journey | Actual / ideal | Verdict |
|---|---|---|
| First run: sign-up to first answer | Name, email, password, Create account (4 actions), then one click on "Run my company" (5 total). Chief answers with Gmail and Calendar Connect cards. No model step, no space heading for a solo user (`f1.png`, `f2.png`). | minimal |
| First run: tour | The 1/9 card now sits at the bottom left of the sidebar and no longer covers the page title (`n-inbox.png`). It did not show in Chief, only after the first page click. | good |
| Daily: inbox triage | Inbox 1 click, open 1, Archive 1. Revisiting the Inbox after a space switch showed grey rows and "First sync can take a minute" for about 25 s although mail was already synced (FLOW-04). | good, one wait |
| Daily: approve a held reply | Inbox agent chat shows the Mail card with From, To, Cc, body, Send / Discard / Edit (`ib.png`). 1 click from the chat. | minimal |
| Money: runway check | Finance 1 click, Runway tile "24.2 mo, Until October 2028" (`finance.png`). | minimal |
| Raise: Investors, Fundraising, Contacts, Legal, Data room | Five pages; Legal now asks for consent before there is anything to read (FLOW-03) and disagrees with Settings (FLOW-01). | longest remaining |
| Agents: create a bot | Not re-run. The + menu shows New bot, New group, New space for the founder (`plus.png`), and New bot, New group only for a solo user. | fine |

## Praise (observed)

- The Models tab is now one line, "Your bots use OpenAI: GPT-6 Luna.", and one button, "Use my own model" (`set3.png`). Voice is gone from Settings. Fixed since iteration 9.
- A solo user sees Pages, Chief and Integrations with no "Personal" header (`f1.png`). Fixed since iteration 9.
- The "Integration sign-in" operator card is gone from General (`set1.png`).
- Cmd+K lists all eight pages including Legal and Artifacts (`k1.png`).
- Empty Inbox, Finance and Data room each give one sentence and one action ("Connect mail", "Add account", "Drop files here") (`n-inbox.png`, `n-fin.png`, `n-dr.png`).
- Integrations tiles say "Open Inbox / Open Investors / Open Finance" and show which bots use each app (`integ.png`).
- The held reply card is complete and one click from sending (`ib.png`).

## Findings

### FLOW-01 Settings says AI is allowed, but Inbox, Legal and the Investors agent say it is not
- Page: Settings > Privacy and approvals, Inbox, Legal, Investors agent chat. Severity P1, category flow, observed (cause suspected).
- Happened: "Allow AI models" is switched on (`set2.png`). At the same time the founder's Inbox shows "Let Praci sort your mail" with Allow / Not now and no sorting (`inbox.png`), Legal's banner reads "Legal needs your permission to read your documents" (`legal.png`), and the Investors agent replied "AI access to mail hasn't been permitted ... Open Integrations" (`ia.png`). The switch is the only place Maya is told to look, and it is already on. The agent's link goes to Integrations, which is not where consent lives.
- Expected: one state. If the switch is on, nothing asks again; if something is not allowed, the switch reads off and the "not allowed" message links to it.
- Evidence: `/tmp/uxloop10/flow/set2.png`, `inbox.png`, `legal.png`, `ia.png`.
- Code (suspected): the switch counts only recipients with `use === "model"` (`apps/web/src/components/AiDataSharing.tsx`, `AiDataSharingSection`), while Inbox asks for the recipient the server reports in `triageBlocked` (`apps/web/src/pages/Inbox.tsx:949-955`). A recipient outside that filter is blocked yet invisible in Settings. On the demo this may be seed data; the contradiction on screen is real either way.
- Fix: derive the switch from the same recipient list the Inbox, Legal and agents check, and point the "not permitted" agent message at Settings > Privacy and approvals instead of Integrations.

### FLOW-02 Legal keeps a red "Last scan failed: needs your permission" banner after the permission problem is gone
- Page: Legal (founder). Stories: Legal scan. Severity P2, category copy/flow, observed.
- Happened: the header says "Last scan 3h ago. Scans daily." and the page lists ten contracts, yet a red banner says "Last scan failed: Legal needs your permission to read your documents before it can run." It has only a close X, no Allow and no retry (`legal.png`). No consent card is shown, so the banner is the only message and it offers no way to act on it.
- Expected: a banner that names a problem also gives its fix, or it clears once the cause is gone.
- Code: `apps/web/src/pages/Legal.tsx:272-290` (shows any failed `lastRun`; only a rejected key gets an action). Message text from `packages/contracts/src/legal.ts:25`.
- Fix: do not show a failed run whose error is the consent message while consent is not missing; otherwise show "Allow" in the banner.

### FLOW-03 A new user is asked to Allow Legal before there is any document to read, and the empty table gives no instruction
- Page: Legal (fresh user). Stories: STORY-LEG first visit. Severity P2, category flow, observed.
- Happened: "Let Praci read your documents / The text is sent to the AI model that runs your bots / Allow", then tabs "Contracts 0 / Deadlines 0 / Graph" and a column header row over nothing (`n-legal.png`). Maya has no files, so the consent has no object, and the page does not say that Legal reads the Data room.
- Expected: with no documents, one sentence and one action: "Legal reads contracts you add to the Data room" with an "Add files" link. The consent card appears when the first file arrives.
- Evidence: `/tmp/uxloop10/flow/n-legal.png` against the better empty state in `n-dr.png`.
- Code: `apps/web/src/pages/Legal.tsx:240-265` (consent card) and `:317-335` (instruction shown only after Allow).
- Fix: hide the consent card and the tab row until the Data room has a document; show the Data room empty-state pattern instead.

### FLOW-04 Inbox showed grey rows and "First sync can take a minute" for about 25 seconds on a mailbox that was already synced
- Page: Inbox (founder, after switching space and back). Stories: STORY-INB-021. Severity P2, category perf/flow, observed once; the cause may be load from other critics on the shared demo.
- Happened: the sidebar badge said 14 unread while the page showed five empty grey bars and the sentence "First sync can take a minute" (`em.png`, `em2.png`, still the same after 9 s). The list appeared after about 25 s (page text read by script).
- Expected: a revisit shows the last known rows at once and refreshes quietly; "First sync" wording is only for a first sync.
- Evidence: `/tmp/uxloop10/flow/em.png`, `em2.png`.
- Code (suspected): the list does not keep the previous rows when the space changes; look at the loading branch in `apps/web/src/pages/Inbox.tsx` near the `first sync` text.
- Fix: keep and show cached rows while the sync runs; show the "First sync" sentence only when the account has never synced.

### FLOW-05 The same waiting-for-Maya state has two names: "Needs your answer" and "Needs approval"
- Page: sidebar and chat cards. Severity P3, category copy, observed.
- Happened: the sidebar row for the Inbox agent reads "Needs your answer" in yellow, while the card inside the chat reads "Mail Needs approval" (`ib.png`). The toast group, by decision, says "N need approval".
- Expected: one phrase.
- Code: the sidebar row preview string in `apps/web/src/pages/Shell.tsx` (search "Needs your answer") against the card label in the mail approval card.
- Fix: use "Needs approval" for held actions in the sidebar; keep "Needs your answer" only for questions.

### FLOW-06 Settings General holds four cosmetic cards, and Advanced is a group with one item
- Page: Settings > General, settings nav. Severity P3, category flow, observed.
- Happened: General shows Appearance (theme plus Sidebar density), Avatars, Chat display, Language and time zone, Usage, Notifications and Account (`set1.png`). Theme, density, avatars and chat display are one kind of choice in three cards. The left nav has "Advanced" which opens to a single entry, Memory (`set4.png`). The Usage card says "Model spend uses your provider keys", which is untrue for the demo user on the system model (`set3.png` says the bots use the system model).
- Expected: one "Appearance" card for theme, density, avatars and chat display; Memory as a top-level entry; Usage text only when the user has their own key.
- Code: `apps/web/src/pages/AccountSettingsOverlay.tsx` (card layout and nav group).
- Fix: merge the four cosmetic cards into Appearance, promote Memory to the nav, and hide the provider-key sentence when the system model is in use.

### FLOW-07 Opening a page quietly creates its page agent in the sidebar
- Page: sidebar (fresh user). Severity P3, category flow, observed.
- Happened: after opening Data room the fresh user's sidebar gained "Page agents 1"; after Investors and Legal it showed two (Investors agent, Legal agent) (`b1.png`). Inbox and Finance did not add one. Maya never asked for these chats, and every page already has an Ask button that opens its agent.
- Expected: a page agent shows in the sidebar after Maya has used it (sent a message or received a result).
- Code (suspected): page agent creation on first page visit in the Shell page-agent hook.
- Fix: create or list the page agent only when Ask is used or the agent has posted something.

## Redundancy checks (re-measured)

- Consent: Inbox card, Legal card, Settings switch, and an agent message pointing at Integrations. By decision each area asks once, but they disagree with each other (FLOW-01) and Legal asks too early (FLOW-03).
- Time zone and notifications: General holds language, time zone and Browser notifications together; the per-bot Notifications switch stays in bot settings. Fine.
- Integrations doors: sidebar row, account menu, Chief cards, Finance Add account, Inbox Connect mail. Decided; not re-raised.
- Model sign-in: Settings > Models only, now one line. Fine.
- Hidden pages: Cmd+K lists all eight pages. Fine.

## Still open from iteration 9 (other session owns these, P2 so not re-filed)

- Fundraising still shows grey skeleton bars under Round, Pipeline and SAFEs, including group headings "Meeting" and "Intro" with no names (`fund2.png`).
- Investors still has SAFE rows inside the cap table and "Equity raised" shows "—" (`inv.png`).

## Not measured

- Gmail, Calendar, Carta, Mercury, Brex connect steps and the connect popup closing via /integrations/connected: OAuth, BLOCKED.
- Held "Share with {name}?" cards, secret request card and Provide secret dialog: not in the demo data.
- Skill creation, create-bot, phone width, touch targets.
- The sidebar section "Reconnect needed" is a demo fixture space (`packages/testkit/src/cli/demo/data.ts:35`); clicking it reloaded the app (about 5 s of "Opening Praci…") and opened a new Chief with the first-run question. Not judged as a product finding.
