# UX flow critique, iteration 9

Method: /ux-flow re-measure on the current main (HEAD 60e1f6076) against the mock demo stack (web :5381), 1440x900, no touch emulation (so no touch-target findings). Sessions: `uxl9-FLOW` (mock founder) and `uxl9-FLOWf` (one fresh sign-up, invented user, random password never written down). Screenshots are in `/tmp/uxloop9/flow/`. I read code in `apps/web/src`. The founder password was read into a shell variable only.

State created: one fresh demo user. I opened one email (marks it read) and clicked one approval toast; I sent, archived and created nothing. OAuth connect steps are BLOCKED and were not tried.

Severity: P0 blocks or misleads, P1 a human stumbles, P2 visibly below excellent, P3 polish. "Observed" means seen on screen; "suspected" means read from code only.

## Friction scorecard

| Journey | Actual / ideal | Verdict |
|---|---|---|
| First run: sign-up to first answer | Sign-up form is 3 fields + 1 click and lands in Chief with "What do you want me on first?"; 1 click on "Run my company"; Chief replies with Gmail and Calendar Connect cards. 5 actions. No model step (decision). The tour card showed 1/9 on the first page I opened, not in Chief. | minimal |
| First run: connect apps | Chief cards, Integrations row, account menu, Cmd+K (decided). OAuth BLOCKED. | not measured |
| Daily: inbox triage | Inbox 1 click, open 1, Archive 1 in the open email (and per-row hover Archive). The list moves while it loads (FLOW-05). | good, one jump |
| Daily: approve a held reply | Toast "needs approval" stayed on screen over a minute; clicking it opens the email chat with the draft and Send / Discard / Edit = 1 click (was 3 in iteration 8). | minimal |
| Money: runway check | Finance 1 click, Runway is the third tile, "24.2 mo, until October 2028" (`p-Finance.png`). | minimal |
| Raise: Investors, Fundraising, Contacts, Legal, Data room | Five pages hold investors and SAFEs; the figures disagree (FLOW-01, 02). | longest remaining journey |
| Agents: create a bot | Not re-run (creates data). The + menu is now New bot and New group for a solo user (`fp.png`); bot settings are Name, Description, Notifications, Audience, Skills, Advanced (`b2.png`). | excellent |

## Praise (observed)

- Fixed since iteration 8: the "New space" entry is gone for a solo user (`fp.png`); the Settings card is now "Chat display" and only Memory sits under "Advanced" (`s1.png`); the approval toast stays and opens the draft in one click (`t2.png`); Legal is in Cmd+K; Integrations tiles say "Open Inbox / Open Investors / Open Finance".
- Settings > Privacy and approvals is one switch ("Allow AI models") and two confirmation switches (`s-priv.png`). It is short and clear.
- Finance for the founder answers the money question in one glance: five tiles, a burn chart, upcoming bills (`p-Finance.png`).
- Bot settings is a short panel with the Audience choice and collapsed built-in skills (`b2.png`).
- Empty Inbox and empty Finance each have one sentence and one button (`n-Inbox.png`, `n-Finance.png`).
- Legal is one table with a "1 overdue" cue on the Deadlines tab (`p-Legal.png`).

## Findings

### FLOW-01 The same SAFEs appear four times on Investors and Fundraising, with different holders and totals
- Page: Investors, Fundraising, Legal. Stories: STORY-CAP-101 to 107, Fundraising stories. Severity P2, category flow, observed.
- Happened: the Investors cap table has four SAFE rows (Priya Placeholder $250,000, Lee Notarealperson $50,000, Sora Angel $25,000, Tomas Operator $25,000, total $350,000). Directly below, "SAFEs, if converted at cap 2.5%" lists Harbor Angels $50,000 and Quill Capital $250,000 (total $300,000). The "Equity raised" tile above shows "—". Fundraising lists the Harbor and Quill SAFEs again (from Mercury), and Legal lists "MOCK SAFE - Quill Capital $250,000". Maya asks "how much did I raise on SAFEs?" and gets "—", $350,000 and $300,000. Holders differ too: Priya (a contact at Quill Capital) is one list's holder and Quill Capital the other's.
- Expected: one SAFE list. Fundraising owns SAFEs (it already has "Assign to contact"); the cap table shows only the converted percentage and links to it.
- Evidence: `/tmp/uxloop9/flow/p-Investors.png`, `i4.png`, `f2.png`, `p-Legal.png`; page text read with a script.
- Code: `apps/web/src/pages/Investors.tsx` (cap table SAFE rows and the converted-at-cap block), `apps/web/src/pages/Fundraising.tsx:241-282`.
- Fix: remove the SAFE rows from the Investors table, fill "Equity raised" from the same SAFE source as Fundraising, and make the converted-at-cap block a one-line link to Fundraising.

### FLOW-02 Investors repeats its investors in a Contacts list, and Contacts is its own page
- Page: Investors, Contacts. Severity P2, category flow, observed.
- Happened: the bottom of Investors has a "Contacts" card with tabs "SAFEs and funds" and "Board", a search box and six rows (Dana, Jamie, Lee, Priya, Sora, Tomas), each with an amount column showing "—" and a row menu. Four of them are the same people as the SAFE rows above. The Contacts page (`p-Contacts.png`) has the same people with a Kind filter and its own Add contact; Investors also has "Add contact" in its header. The tab names follow an owner decision and are not re-raised.
- Expected: Investors shows the cap table and Updates; investors as people live on Contacts.
- Evidence: `/tmp/uxloop9/flow/i4.png`, `p-Contacts.png`.
- Code: `apps/web/src/pages/Investors.tsx` (contact list near the end of the page, row placeholders at `:1368`).
- Fix: replace the Contacts card on Investors with a link "Investors in Contacts" and remove the second Add contact; keep one if Maya needs to add an investor from here.

### FLOW-03 Empty sections show grey skeleton bars next to real data, and an empty page looks like it is still loading
- Page: Fundraising, Investors (Updates, cap table of a fresh user). Severity P2, category visual/flow, observed. The code comment says the skeletons are deliberately static so they "read as nothing here yet"; on screen they read as loading.
- Happened: for the founder, Fundraising shows grey bars under Round and Pipeline and a real SAFEs card with two SAFEs (`f2.png`); Investors shows two grey Updates rows under real data (`i4.png`). For a fresh user, Fundraising is three sections of grey bars with only "Start a round" and "Add prospect" as text (`n-Fundraising.png`), and Investors is source chips above a grey table (`n-Investors.png`). Nothing says what is empty. Iteration 8 asked for one empty state with one main action; the page now has more shapes and no words.
- Expected: an empty section is a single plain line and one action, or is absent.
- Evidence: `/tmp/uxloop9/flow/f2.png`, `i4.png`, `n-Fundraising.png`, `n-Investors.png`.
- Code: `apps/web/src/components/fundraising/Placeholders.tsx`, `apps/web/src/components/investors/Placeholders.tsx`; used at `Fundraising.tsx:281`, `Investors.tsx:386,1147,1263,1368`.
- Fix: drop the placeholders; with no round and no prospect show one "Start a round" empty state, and hide Updates until there is an update. Another session owns these pages, so treat this as input for them.

### FLOW-04 The first tour card covers the page title on every page
- Page: all pages during tour step 1/9. Severity P3, category visual, observed.
- Happened: the card anchored to the Search box sits at the top-left of the content area and hides the page title and, on Investors, the first heading (`n-Finance.png`, `n-Investors.png`, `n-Inbox.png`). Maya cannot read which page she is on until she skips. Also, in Chief the card was absent after the first answer and appeared only after I clicked a page; for the mock founder it was already on Chief (`m-home.png`).
- Expected: the card does not hide the thing the user just opened.
- Code: `apps/web/src/components/tour/TourPopover.tsx:150-160` (placement).
- Fix: place step 1 below the Search ring inside the sidebar column, or lower on the page, so the header stays readable.

### FLOW-05 The Inbox list moves down about 150 px while Maya is about to click, and a click can land on the wrong row
- Page: Inbox. Stories: STORY-INB-021, 022. Severity P2, category flow, observed.
- Happened: the first paint shows "Sorting your mail…" and an "Earlier 13 unread" group with the first row at y=232 (`p-Inbox.png`). Within about a minute the list re-sorts: a To do card with five tasks appears, the group becomes "Needs reply 8 unread" and the first row moves to y=381 (`e1.png`). The Inbox badge went 14, 12, 10 over that time without me reading mail. My click on "Morgan Pretend" at the old position did not open the thread. Iteration 8 saw the same jump (FLOW-07 there).
- Expected: the list does not move after it is visible, or the sort finishes before the rows show.
- Evidence: `/tmp/uxloop9/flow/p-Inbox.png`, `e1.png`.
- Code: `apps/web/src/pages/Inbox.tsx:615-618` (rows wait for To do on first load but not on later sort passes; suspected).
- Fix: keep the "Sorting your mail…" state until the first sort finishes, and let later sort results apply only to rows the user is not hovering, or show them as a "New order" chip.

### FLOW-06 A solo founder still sees a "PERSONAL" space header with a collapse arrow and a ... menu
- Page: sidebar (fresh user). Severity P3, category flow, observed for the sidebar. The page-title tag was hidden by the tour card so I did not confirm it.
- Happened: below Pages the sidebar has "PERSONAL" with a chevron and a "..." button, then Chief and a "Page agents 1" fold (`f2.png`, `n-Investors.png`). With one space there is nothing to switch, collapse or rename. "New space" is gone from the + menu (praise), but the heading that exists to separate spaces is still there. Page agents appears (one row) just from opening Investors.
- Expected: no space heading until a second space or member exists (owner decision).
- Code: `apps/web/src/pages/Shell.tsx:4713` (`group.title || hasSpaceActions` shows the header), `:3483`.
- Fix: render the group header and its menu only when the account has more than one space or member.

### FLOW-07 General settings carries an admin card, "Integration sign-in", that a solo founder does not need
- Page: Settings > General. Severity P3, category copy/flow, observed.
- Happened: the right column has "Integration sign-in: How Integrations connect for everyone on this server" with an Open button (`s1.png`). On the demo the founder is the deployment owner, so this is a fourth surface about connecting apps (Chief cards, Integrations page, account menu, this). "Everyone on this server" is operator language. The owner-only "Runs on" section sits above it in code.
- Expected: operator setup is out of the founder's way.
- Code: `apps/web/src/pages/AccountSettingsOverlay.tsx:249-265`.
- Fix: move it into the Integrations page overflow menu, or show it only after a connect attempt fails because no OAuth app is configured.

### FLOW-08 Models shows a provider catalog although a model already works
- Page: Settings > Models. Severity P3, category flow, observed.
- Happened: the page says "They already have one, so change this only to use another AI company or your own key", then lists OpenRouter (connected) and six more providers with a search box and "More", a "Data room search model" disclosure, "Your bots already use OpenRouter", a "Use your own key" disclosure, and "Backup models: Connect a provider to add backups." (`s-mod.png`). Maya needs none of it.
- Expected: one line saying the system model is in use and one "Use my own model" action that opens the catalog.
- Code: Settings Models panel (component behind `ModelSettingsOverlay.tsx`).
- Fix: collapse the provider list, backup models and search model under one "Use my own model" disclosure.

### FLOW-09 Voice is a settings page that is only an API-key form
- Page: Settings > Voice. Severity P3, category flow, observed.
- Happened: four providers (ElevenLabs, OpenAI, Cartesia, Fish Audio) with one key field and a disabled Connect button, and no explanation of what voice does here (`s-voice.png`). It is a top-level settings entry beside General, Privacy and Models for something most founders never configure. Elio (the mic and "Call Elio" button) works without it.
- Expected: voice keys live with the other model keys.
- Fix: fold Voice into Models as a "Voice" section under the same "Use my own" disclosure, leaving General, Privacy and approvals, Models, Advanced.

## Redundancy checks (re-measured)

- Time zone and notifications: Settings > General holds language, time zone and Browser notifications together (`s1.png`); the per-bot Notifications switch stays in bot settings (`b2.png`). Fine.
- Consent: one "Allow AI models" switch in Privacy and approvals (`s-priv.png`). The Data room page for the founder showed no separate consent card this time (`p-Data_room.png`), because it was already allowed. I did not see the fresh-user card.
- Integrations doors: sidebar row and account menu both remain by decision.
- Model sign-in: Settings > Models is the only place; onboarding has no model step.
- Hidden pages: Cmd+K lists Inbox, Finance, Legal, Investors, Fundraising, Contacts, Data room (`k1.png`; the list is cut at seven rows, so I did not see Artifacts).

## Not measured

- Gmail, Calendar, Carta, Mercury, Brex connect steps and the connect popup closing via /integrations/connected: OAuth, BLOCKED.
- Held "Share with {name}?" cards, the secret request card and Provide secret dialog: not present in the demo data.
- Skill creation, create-bot (creates data), routine editor, phone width, touch targets.
- The investor-update answer from Investor Relations (mock): it replied that it could not search the Data room; that is model and demo wiring, not judged.
