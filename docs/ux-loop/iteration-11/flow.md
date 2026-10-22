# UX flow critique, iteration 11

Method: /ux-flow re-measure on the mock demo stack (web :5381), 1440x900, no touch emulation (no touch-target findings). Sessions: `uxl11-FLOW` (mock founder) and `uxl11-FLOWf` (one fresh invented sign-up, random password not recorded). Screenshots: `/tmp/uxloop11/flow/`. The demo is shared with other critics running at the same time (inbox unread count and page-agent counts changed while I worked), so state changes I did not make are noted as such. I sent, archived, approved and created nothing except the one fresh user. OAuth connect steps are BLOCKED and were not tried. I did not walk bot creation, skill creation or phone width.

"Observed" means seen on screen; "suspected" means read from code only. Investors and Fundraising are owned by another session, so only P0/P1 problems are reported there (none found).

## Friction scorecard

| Journey | Actual / ideal | Verdict |
|---|---|---|
| First run: sign-up to first ask | Name, email, password, Create account (4 actions), then one click on "Run my company" (5). Chief answers with Gmail and Calendar Connect cards. No model step, no Space heading, sidebar shows only the eight pages and Chief (`f1.png`, `f2.png`). | minimal |
| First run: tour | Stop 1/9 appears on the first page click ("Type here to find any page, chat or email") and Skip works in one click (`f3.png`). | good |
| Daily: inbox triage | Inbox 1 click, rows grouped into "To do", "Needs reply" etc., 1 click to open (`inbox3.png`). | minimal |
| Daily: answer an agent question | Sidebar row "Needs your answer" opens a question card with two one-tap options (`ir.png`). | minimal |
| Money: runway check | Finance 1 click, Runway tile "24.2 mo, Until October 2028" (`fin.png`). | minimal |
| Raise: Investors, Fundraising, Contacts, Legal, Data room | Five sidebar pages, each reachable in 1 click or Cmd+K (`k.png`). Fresh-user empty states are one sentence and one action (`f4.png`, `f5.png`). | acceptable |
| Agents: create bot, skill, approval | Not walked. A question card was seen (`ir.png`); no approval card was in the demo data. | not measured |

## Fixed since iteration 10 (observed)

- Legal for a fresh user is now one sentence and "Add files": "Add contracts to your Data room and Legal reads them." No consent card, no empty tab row (`f4.png`). Closes old FLOW-03.
- A fresh user's sidebar shows only Chief; no page agents are created by opening pages (`f4.png`, `f5.png`). Closes old FLOW-07 for new users.
- Settings General is shorter: Appearance now holds theme, density and avatars; Chat display is a single row; Usage is one line with no false provider-key sentence (`set1.png`). Closes old FLOW-06 for the cards (the nav "Advanced" group still exists; not re-measured).
- The Investors agent's "not permitted" reply now links to Settings (privacy), not Integrations (`k2.png` snippet: "Open Settings ... to review the sharing pe..."). Closes old FLOW-01 for the agent text.
- Settings Privacy is one master switch with an "Advanced" disclosure that shows "GPT-6 Luna" and "Documents" (`set2c.png`).
- Cmd+K lists all eight pages and finds Settings and chats by text (`k.png`, `k2.png`).
- After consent, the Inbox is excellent: a "To do" card plus "Needs reply" group, with clear dates (`inbox3.png`).

## Findings

### FLOW-01 Consent cards stayed on screen after consent was already on
- Page: Inbox, Legal, Data room (founder). Severity P2, category flow, observed; cause suspected.
- Happened: on first load, Inbox showed "Let Praci sort your mail" (Allow / Not now), Legal and Data room showed "Let Praci read your documents" (Allow) (`inbox.png`, `legal.png`, `dr.png`). A minute later Settings > Privacy showed Allow AI models, GPT-6 Luna and Documents all on (`set2.png`, `set2c.png`). I then clicked back to Inbox and Legal without reloading page data and the cards were gone, with the Inbox now sorted (`inbox3.png`). I never pressed Allow. Another critic on the shared demo probably did, so my open page was out of date.
- Expected: when consent changes in another tab or session, the open page catches up soon, or at least when the page is opened again.
- Evidence: `/tmp/uxloop11/flow/inbox.png` then `inbox3.png`; Legal and Data room checks by page text after navigating.
- Code (suspected): consent state is read once and cached per page, `apps/web/src/components/AiDataSharing.tsx` (heading at line 103), `apps/web/src/components/legal/ConsentPrompt.tsx:21`, `apps/web/src/components/data-room/ConsentPrompt.tsx:85`.
- Fix: refetch consent on page open and window focus so the card disappears as soon as consent is on.

### FLOW-02 Inbox "To do" card repeats mail that is also listed below
- Page: Inbox, Important tab. Severity P3, category flow, observed.
- Happened: "Reply to Morgan about section 9 and signing" sits in the To do card, and the same thread from Morgan Pretend is the first row of "Needs reply" directly below (`inbox3.png`). The same applies to the trademark action. Maya sees one fact twice within 200 px.
- Expected: either the To do card lists tasks that are not an email reply, or a row that already has a to-do shows a small "To do" mark instead of repeating the sentence.
- Code (suspected): `apps/web/src/pages/Inbox.tsx` around lines 673-690 (the To do card renders independently of the grouped rows).
- Fix: drop reply-type to-dos from the card when their thread is in "Needs reply", or mark the row and keep the card for non-mail tasks.

### FLOW-03 The same "Allow" prompt with identical text exists as two separate components
- Page: Legal, Data room. Severity P3, category copy/flow, observed (text) and suspected (code).
- Happened: both pages show the card "Let Praci read your documents / The text is sent to the AI model that runs your bots / Allow" (`legal.png`, `dr.png`). One Allow is meant to cover both (owner decision), but Data room offers "Allow / Not now" and Legal offers only "Allow", so the same decision looks different on each page.
- Expected: one component, one set of buttons.
- Code: `apps/web/src/components/legal/ConsentPrompt.tsx:21` and `apps/web/src/components/data-room/ConsentPrompt.tsx:85`.
- Fix: use one shared ConsentPrompt for both pages (with "Not now" on both, or neither).

### FLOW-04 A user with nothing connected sees eight pages, five of them empty
- Page: sidebar (fresh user). Severity P3, category flow, observed; a judgment call.
- Happened: with no mail, bank or documents, the sidebar lists Inbox, Finance, Legal, Investors, Fundraising, Contacts, Data room and Artifacts (`f1.png`). Each opens to a correct one-line empty state, but Maya must visit them to learn they are empty. The tour has nine stops over the same pages.
- Expected: pages that cannot show anything yet are reachable but quiet. The app already hides the Devin page and Task board until they apply.
- Code (suspected): the page list in `apps/web/src/pages/Shell.tsx`.
- Fix: for a user with no connections and no files, show Inbox, Finance, Data room and Artifacts, and add Legal, Investors, Fundraising and Contacts once there is data. Keep them in Cmd+K from the start. Raise only if the owner wants fewer first-run rows; the current behavior is acceptable.

## Redundancy checks (re-measured)

- Consent: Inbox card, Data room and Legal card, Settings master switch and Advanced. Each area asks once and Settings now shows the same state; the only gap is staleness (FLOW-01) and duplicated components (FLOW-03).
- Time zone and notifications: General holds language, time zone and Browser notifications together; bot Notifications stay in bot settings. Fine.
- Integrations doors: sidebar row, account menu, Chief cards, Finance Accounts, Inbox Connect mail. Decided; not re-raised. The Integrations page itself is clear: Connected first, then a search and "Popular", with "Open Inbox / Open Finance" and "Used by" avatars (`integ.png`).
- Model sign-in: Settings > Models only, one line plus "Use my own model" (`set3.png` equivalent). Fine.
- Hidden pages in search: Cmd+K lists all eight pages and Settings. Fine.
- Naming: "Needs your answer" (a question) and "Needs approval" (a held action) are now used for different things, as decided.

## Praise (observed)

- First run is five actions with no model or space step (`f1.png`, `f2.png`).
- Empty Legal, Data room and Inbox each give one sentence and one action (`f4.png`, `f5.png`, `f3.png`).
- Finance answers the runway question in one click, no scrolling (`fin.png`).
- The agent question card has two clear one-tap answers (`ir.png`).
- Settings is down to General, Privacy and approvals, Models, plus Advanced; Privacy is one switch plus two confirmations (`set2.png`).

## Not measured

- Gmail, Calendar, Carta, Mercury, Brex connect steps and the connect popup closing: OAuth, BLOCKED.
- Held "Share with {name}?" cards, secret request card and Provide secret dialog, approval toasts: not present in the demo data.
- Bot creation, skill creation, email agent panel, phone width, touch targets.
- The sidebar "Reconnect needed" section is a demo fixture.
