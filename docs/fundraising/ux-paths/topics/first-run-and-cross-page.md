# Topic: First run, navigation, contacts, and journeys across both pages and the agent

Round 4. Updated against the plan after round 3 and the mockup (sidebar with Investors, Fundraising, Data room and Bots "Investors agent", "Finance agent"; views `#empty`, `#fund-noround`, `#inv-contactmenu`, `#inv-addcontact`). Who to ask: the Investors agent (new, both pages, reads Data room, Finance, contacts and `fundraising_read`), the Carta agent (a connector only; never reads the Data room), the Finance agent (Finance page), Mercury (sync is code; the Investors agent has no Mercury tools). Planned feature; all names and figures are invented. Gap tags: `PG-nn` round-1 gap still open; `NG-nn` gap from round 2, 3 or 4 that is still open (see `../catalog.md`, "Plan gaps (round 4)").

## STORY-601: Brand-new founder opens Investors, then Fundraising, with nothing connected
**Type**: medium
**Topic**: First run and cross-page
**Persona**: Rina Okoye, solo founder of Tallow Labs, onboarding done, a model set up, nothing else connected
**Goal**: Find out what to do first and get one useful thing on screen in five minutes
**Preconditions**: Fresh space; no contacts; no snapshot; no round.
**Ideal path**: 5 (Investors, Type it in, add two founders, Fundraising, Add prospect)
**Alternate paths**: Use a Google Sheet; open Fundraising first; Ask.
### Steps
1. Click Investors in the sidebar → the Empty view (`#empty`): header with title and an outline Ask, and three equal buttons "Connect Carta", "Use a Google Sheet", "Type it in". The first visit creates the Investors agent; "Investors agent" appears under Bots.
2. Click "Type it in" → the editable table with one blank row (STORY-104); type Rina 6,000,000 and Ben Haas 4,000,000 as Common.
3. Read the figures → Fully diluted 10,000,000; Equity raised shows no money. [plan silent: the zero-money presentation (PG-18)]
4. Click Fundraising → the page shows "Start a round" and a header Add prospect; the header button reads "Connect Mercury" (`#fund-noround`).
5. Click Add prospect, enter "Fjord Ventures", Stage Target, Save → the prospect appears in Pipeline, which always shows, with or without a round.
6. Click Ask → the Investors agent panel opens, the same agent as on Investors. [plan silent: suggestion chips (PG-10)]
### Variations
- No model set up: Ask shows the needs-model state as today.
- Phone width: the Ask panel starts collapsed.
### Edge Cases
- Clicking Connect Carta then closing the dialog returns to the three-choice Empty view.
- Nothing is shown for Finance, Gmail or Mercury until the page needs them.

## STORY-602: Existing Carta user after the rename
**Type**: medium
**Topic**: First run and cross-page
**Persona**: Maya Chen, Carta connected for months, with a Carta agent that has chat history, a bookmark on `/app/cap-table`
**Goal**: After the release, find the cap table and know which agent to talk to
**Preconditions**: Migration run; the snapshot's source reads as carta; a second user, Jonah, had hidden Cap Table.
**Ideal path**: 3 (open the bookmark, land on Investors, click Ask)
**Alternate paths**: Keep talking to the Carta agent from Bots.
### Steps
1. Open the bookmark → redirected to `/app/investors`, query kept.
2. Read the sidebar → "Investors" in the same position, "Fundraising" below it.
3. Read the page → "Carta · as of Sep 30", the same data; SAFEs from Fundraising appear in the group "SAFEs, if converted at cap".
4. Click Ask → the Investors agent panel opens, not the Carta agent's; the first visit creates the Investors agent and its monthly routine.
5. Open Bots → "Carta agent" is still listed with its history; the Investors page never links to it.
6. In the Carta agent's chat write "draft this month's investor update" → it replies with one line telling her to ask the Investors agent.
7. Jonah signs in → his row "Investors" stays hidden (migrated key); "Fundraising" is visible. [plan silent: whether Fundraising should default hidden for him (PG-04)]
### Variations
- Open the Carta agent full screen. [plan silent: its Carta-only intro and its "Back to" target (PG-03)]
### Edge Cases
- A teammate's old deep link `/app/cap-table/anything` redirects.
- A Carta sync notification lands on the Investors row.

## STORY-603: Ask on Investors and on Fundraising open the same agent
**Type**: short
**Topic**: First run and cross-page
**Persona**: Tomas Reyes, Alder Bikes, Carta not connected, Mercury connected
**Goal**: Ask a pipeline question on Fundraising and a cap table question on Investors, in one conversation
**Preconditions**: Investors agent exists; one open round.
**Ideal path**: 4 (Ask, switch page, same panel, second question)
**Alternate paths**: Collapse the panel on one page.
### Steps
1. On Fundraising click Ask → the Investors agent panel opens.
2. Ask "Who is committed but has no SAFE yet?" → the agent answers from `fundraising_read` (the open round, prospects with stage and check size, SAFEs with derived status).
3. Click Investors in the sidebar → the same panel and thread; the collapsed preference is one setting for both pages.
4. Ask "What would a $100k SAFE at a $10M cap do to ownership?" → the post-money answer uses the snapshot's fully diluted count.
### Variations
- Collapse the panel on Fundraising; on Investors the Ask button is back.
- Open the agent from Bots: full screen.
### Edge Cases
- Asked to change a stage or add a SAFE, the agent says it cannot and points to the row.

## STORY-604: A six-week $750k SAFE round, end to end
**Type**: long
**Topic**: First run and cross-page
**Persona**: Rina Okoye, Tallow Labs; Gmail, Mercury and Finance connected; no Carta; target $750,000; post-money cap $8M
**Goal**: Close the round, show SAFEs on the cap table, send the first investor update with portal links, and be ready for the next audit
**Preconditions**: Typed-in cap table with two founders and a 1,000,000 option pool; Investors agent exists.
**Ideal path**: about 30 steps over six weeks
**Alternate paths**: No Mercury (all native, marks by hand); Carta connected.
### Steps
1. Week 1, Fundraising: Start a round → name "Seed SAFE round", Target $750,000, Post-money cap $8,000,000, MFN on; the card shows "Post-money cap $8M · MFN" and an empty bar.
2. Add six prospects through Add prospect with check sizes → Pipeline: Target 2, Intro 2, Meeting 2.
3. Week 2: move two prospects to Diligence and Harbor Angels ($50,000) to Committed through "Move to" → counts update; the Committed row shows the filled Send SAFE; the bar's Pending segment is $50k. The sidebar has no badge.
4. Click Send SAFE on Harbor Angels → Mercury's SAFE page opens in a tab; no SAFE row is created. Harbor stays in Committed as "Waiting for Mercury · <date>" and keeps counting at $50,000 in Pending.
5. Create and send the SAFE in Mercury with Harbor's email; reopen Fundraising → the sync attaches the Mercury SAFE to Harbor's contact by email (trimmed, any case), Harbor leaves Pipeline and the SAFE shows Sent at Mercury's amount. If the email differs, the SAFE shows "Assign to contact" and both rows count until Rina assigns it (STORY-516); a wrong choice is undone with Unassign, then Assign to contact.
6. Week 3: Harbor signs → chip Signed; the contact becomes an investor; the Attention card shows "Harbor Angels · $50,000, Signed Oct 12 · awaiting deposit · Find in Finance".
7. The wire arrives; the finance sync classifies it financing; reopen Fundraising → Funded, the Attention row is gone.
8. Weeks 3 to 5: Lakeside Capital $250,000, Priya Raman $200,000, Ravi Mehta $50,000 and Oakline Partners $200,000 follow; the bar shows Funded $750k of Target $750k.
9. Open Investors → Cap table shows holdings at 100.0 and the group "SAFEs, if converted at cap" with each SAFE as amount over $8M; "Equity raised" does not include SAFE money.
10. Week 6, the routine saved a draft on the 1st and notified "October update ready" → Open from Action items; click Draft with agent if needed; edit; Send → a background job sends one email per investor from her Gmail, each with their own link; the toast reads "Sent to 6" and the page returns to Investors. No per-update share exists: every investor contact with a link sees it on the portal.
11. Open Contacts, Investors tab → the Portal column reads "Invited Oct 20"; later "Opened Oct 21" for those who tapped Open.
12. Back on Fundraising choose Close round from the Round card's menu → no confirm if nothing is signed and unpaid; the card becomes "Closed Oct 25 · funded $750k" with a Reopen menu and "Start a round", and Pipeline, SAFEs and Attention stay below it.
13. Months later an audit confirmation arrives → intake files the PDF, the agent drafts, the row "Draft ready" appears and a notification arrives; Open draft; send from Gmail; the row closes on the next sync.
### Variations
- Close below target with a signed unpaid SAFE: the close dialog names it.
- No Mercury: Rina marks Sent, Signed and Funded by hand; Attention still works.
### Edge Cases
- Investor wires $49,950 after fees: no match; Rina chooses Mark funded.
- Mercury is removed mid-round: rows stay, source becomes native, totals unchanged.

## STORY-605: Hiding Fundraising after the round closes
**Type**: short
**Topic**: First run and cross-page
**Persona**: Rina Okoye, round closed, four SAFEs Funded
**Goal**: Remove the Fundraising row from the sidebar and keep the SAFEs on the cap table
**Preconditions**: Round closed.
**Ideal path**: 2 (Pages menu, toggle Fundraising)
**Alternate paths**: Leave it visible and start a bridge round.
### Steps
1. Open the sidebar Pages menu → Investors, Fundraising and the other pages are listed; toggle Fundraising off (hidden key `fundraising`).
2. Open Investors → the group row "SAFEs, if converted at cap ›" still links to `/app/fundraising`, which opens by URL and cross-link even though the sidebar row is hidden.
3. Ask the Investors agent "show me my SAFEs" → answered in chat.
### Variations
- Hide Investors but keep Fundraising.
### Edge Cases
- Palette results for a hidden page. [plan silent: whether hidden pages stay in the palette (PG-04)]
- Mercury SAFE changes never notify and Fundraising has no badge.

## STORY-606: Command palette and sidebar search reach both pages
**Type**: short
**Topic**: First run and cross-page
**Persona**: Ben Haas, co-founder, keyboard-first
**Goal**: Jump to the right page by typing what he wants
**Preconditions**: Both pages visible.
**Ideal path**: 2 (open palette, type, Enter)
**Alternate paths**: The sidebar search box lists pages with chats.
### Steps
1. Type "cap table", "equity", "ownership" or "Carta" → Investors.
2. Type "safe", "round" or "raise" → Fundraising.
3. Type "Investors agent" → the bot, full screen.
### Variations
- "portal" matches nothing public: the portal route is not an app page.
### Edge Cases
- "investors" matches the page, the bot and a contact named "Investors Circle".

## STORY-607: What the Investors badge means
**Type**: medium
**Topic**: First run and cross-page
**Persona**: Maya Chen, Carta, Gmail and Mercury connected
**Goal**: Know from the sidebar alone whether to open Investors
**Preconditions**: Pending: an audit draft, a signed SAFE awaiting deposit, an October update draft.
**Ideal path**: 2 (see the dot, open Investors)
**Alternate paths**: Rely on the agent's notification on the phone.
### Steps
1. Look at the sidebar → the Investors row has a dot (`1 unseen notification`); it counts unseen notifications from the Investors agent, not open action items.
2. The agent notifies exactly twice: "October update ready" when the routine saved a draft, and "Audit request from <fund>" when an audit draft is ready.
3. Open Investors → Action items lists the audit row and the update; the dot clears once seen, the action items stay.
4. The Mercury sync marks Harbor's SAFE Signed → no notification and no badge; the Fundraising Attention card is the only signal.
5. On a collapsed sidebar rail the dot shows as a dot.
### Variations
- Hide Investors: pending counts are invisible except in chat.
### Edge Cases
- A Carta agent sync notification lands on the same row.

## STORY-608: Which agent to ask about a SAFE deposit
**Type**: medium
**Topic**: First run and cross-page
**Persona**: Tomas Reyes, Alder Bikes, Mercury, Gmail and Carta connected
**Goal**: Find out whether Harbor Angels' $50,000 SAFE was paid and whether it is on the cap table
**Preconditions**: SAFE signed; the Attention row shows awaiting deposit; Carta's snapshot is older.
**Ideal path**: 2 (ask the Investors agent, read the answer)
**Alternate paths**: Finance agent; Carta agent.
### Steps
1. On Fundraising click Ask and ask "Did Harbor's $50,000 arrive?" → the Investors agent answers from `fundraising_read`: the SAFE's derived status and its deposit match; it has no Mercury tools.
2. Ask the Finance agent on the Finance page the same → it answers from transactions only; the two answers can differ when the match missed. [plan silent: nothing reconciles them and hops through `message_bot` are not shown (PG-08)]
3. Ask the Carta agent "is Harbor on the cap table?" → it answers from Carta; the SAFE is not there.
4. Ask the Investors agent "add Harbor to the cap table" → it cannot write SAFEs; the SAFE shows on Investors by itself from its row.
### Variations
- Typed-in source: a SAFE row never appears as a typed row, only from Fundraising.
### Edge Cases
- Asked to send a receipt: it has `mail_draft` and no `mail_send`.

## STORY-609: Contacts on Investors, add, tabs, change kind
**Type**: medium
**Topic**: First run and cross-page
**Persona**: Maya Chen
**Goal**: Keep the people list right
**Preconditions**: Contacts Elena Ruiz, Tom Okafor, Sam Lind, Priya Raman, Marcus Webb (investors); three board members; one auditor.
**Ideal path**: 4 (Add contact, fill, Save, check tab)
**Alternate paths**: The agent's `contacts_add`.
### Steps
1. Click Add contact in the header (or "+" on a phone) → the dialog (`#inv-addcontact`) asks Name, Email, Organization and Kind (Investor, Board, Auditor, Other; defaulting to the active tab; prospects are added on Fundraising).
2. Save an investor "Nadia Cole" → she appears on the Investors tab; the tab count rises.
3. Read the tabs → Investors 5, Board 3, Auditors 1, Other; prospects show only on Fundraising until their kind changes. The active tab uses the sidebar accent fill.
4. Open a row's "…" (`#inv-contactmenu`) → Resend link (any investor contact with an email), Revoke (any contact with portal access), Unblock when revoked (`#inv-unblock`), and Edit and Delete for every contact. Delete asks to confirm and removes the contact's shares, tokens and sessions; sent updates keep their delivery records, and audit and SAFE rows keep their text with no contact link.
5. Change a contact's kind from investor to other → the row moves tabs.
### Variations
- Adding an email that already exists: the dialog opens that contact instead of adding one; a prospect opens on Fundraising (round-4 plan).
### Edge Cases
- Contact without an email: greyed in update recipient lists.

## STORY-610: A person with two contact kinds
**Type**: short
**Topic**: First run and cross-page
**Persona**: Maya Chen
**Goal**: Message Elena Ruiz as both investor and board member
**Preconditions**: Elena invested through Northwind and sits on the board.
**Ideal path**: 2
**Alternate paths**: Two contacts with two emails.
### Steps
1. Elena is one contact with one kind (investor) → she is on the Investors tab only, so a board update does not include her.
2. Change her kind to board with Edit → she leaves the investor audience and the portal Opened date stays. A contact has one kind and the email is unique, so she cannot be in both audiences.
### Variations
- A SAFE signed by a board member leaves the contact a board member; only a prospect flips to investor (STORY-509; resolved in round 3).
### Edge Cases
- None.

## STORY-611: Carta contacts merge with hand-added ones
**Type**: medium
**Topic**: First run and cross-page
**Persona**: Maya Chen
**Goal**: Not end up with two Elena Ruiz contacts after connecting Carta
**Preconditions**: Elena was added by hand as kind other; Carta connects and its agent adds holders through `contacts_add`.
**Ideal path**: 2
**Alternate paths**: none found
### Steps
1. Carta connects; the Carta agent syncs and calls `contacts_add` for Elena with the same email.
2. Open Contacts → one Elena: `contacts_add` returns the existing contact, fills only its empty fields and never changes its kind, so she stays kind other.
### Variations
- Carta adds a holder with a different email for the same person: two contacts.
### Edge Cases
- Carta disconnects: the contacts stay.

## STORY-612: Questions to the agent about the round and pipeline
**Type**: short
**Topic**: First run and cross-page
**Persona**: Rina Okoye on the phone app
**Goal**: Check the round from her phone
**Preconditions**: Open round; mobile app; no Fundraising screen.
**Ideal path**: 2 (open the chat, ask)
**Alternate paths**: Ask on web.
### Steps
1. Open the Investors agent in the mobile app.
2. Ask "How much have we raised and who is committed?" → the agent answers from `fundraising_read` and `cap_table_read`: funded and signed amounts, committed prospects with check sizes, and equity raised.
3. Ask "Which SAFEs are unpaid?" → it lists signed SAFEs awaiting deposit.
### Variations
- Ask it to move a prospect: it says it cannot change a stage.
### Edge Cases
- None.

## STORY-613: Two members in one space
**Type**: medium
**Topic**: First run and cross-page
**Persona**: Aisha (CEO) and Dev (CFO), both members of one space
**Goal**: Both work from Investors and Fundraising
**Preconditions**: Aisha has a snapshot, a round, contacts and updates.
**Ideal path**: not reachable as one shared company record
**Alternate paths**: Share the work by logging in as one person.
### Steps
1. Dev opens Investors → the Empty view: the snapshot, SAFEs, round, contacts and updates are per space and user.
2. Dev's first visit creates his own Investors agent and monthly routine; both members get a draft and a notification on the 1st.
3. Dev adds an investor contact with Elena's email → his own contact; Elena then gets two links (one per contact) in a request email.
### Variations
- Dev connects Mercury himself.
### Edge Cases
- The plan keeps this per space and user as today; sharing one company record is a separate decision. [carried: PG-20]

## STORY-614: Narrow web, switching pages
**Type**: short
**Topic**: First run and cross-page
**Persona**: Rina on a 390 px browser
**Goal**: Move between Investors and Fundraising
**Preconditions**: A phone-width browser.
**Ideal path**: 2 (menu button, row)
**Alternate paths**: The group row link on Investors.
### Steps
1. Tap the menu button in the header → the sidebar opens over the page. (The shell's narrow behavior is to be confirmed in slice 1; if the shell has none, slice 1 adds it.)
2. Tap Fundraising → the page opens and the sidebar closes.
### Variations
- Tap "SAFEs, if converted at cap ›" on Investors to reach Fundraising.
### Edge Cases
- None.

## Gaps found
Open after round 5. Resolved in round 3 and no longer listed: PG-37 (only a prospect flips).
- PG-03: the Carta agent's full-screen intro and Back target.
- PG-04: Fundraising's default visibility for a user who hid Cap Table; palette and hidden pages.
- PG-08: reconciling the Finance and Investors answers; `message_bot` hops hidden.
- PG-10: suggestion chips.
- PG-18: zero-money table.
- PG-20: two members in one space (plan open question, skipped with a reason).
