# Iteration 23 - FLOW critic

Target: mock demo (web :5381), session uxl23-FLOW at 1440x900, mock founder account. Read-only use: no data created, no consent given (the account still has AI not allowed, so the Inbox sorted piles and the "To do" card were not on screen). Other walkers were active (extra page agents and email chats in the sidebar are theirs). Screenshots are in the critic's scratch folder (file names only below). Not exercised: sign-up (would create an account), Connect OAuth (BLOCKED), approvals and payments, skills, phone width.

## Iteration 22 flow findings, re-checked

| Iteration 22 | Result now |
|---|---|
| FLOW-01 Legal has two scan buttons | Fixed. Only "Scan now" remains in `Legal.tsx`; "Check now" is gone (code read). With AI not allowed the page shows one Allow / Not now card (`legal.png`). |
| FLOW-02 Investors $350,000 vs Funded $250,000 | Fixed. Investors "Equity raised $250,000, $50,000 committed"; Fundraising Funded $250,000 / Sent $50,000; Finance financing marker $250,000 (`investors.png`, `fundraising.png`, `finance.png`). |
| FLOW-03 Failed icon plus "Starting up..." | Not seen. Rows read "Needs your answer" and "Working..." and match their chats' state (`finance.png`). |
| FLOW-04 Investors blank for 11 s | Mostly fixed. Content in under 5 s on a hard load (not timed to the second). |
| FLOW-05 Payment reply links to the hub | Decided in pass 22 (link stops at the integration detail view); not re-tested. |
| FLOW-06 Landing click before sign-up | Decided: landing Sign up opens the sign-up form; not re-walked. |
| FLOW-07 Tour card covers the roster | NOT fixed, see FLOW-01 below. |

## Findings

### FLOW-01 The first-run tour card still covers the chat roster
- Page: sidebar on Chief at first sign-in. P3, visual/flow. Observed again: at stop 1/9 the card sits over the lower roster, "Leadership sync (mock)" is cut off mid-row and Page agents and Archived are hidden (`s1.png`). Iteration 22 reported the same and it was not changed. Skip tour is one click, so the cost is small, but the first screen a new founder sees has a clipped row.
- Code (observed): `apps/web/src/components/tour/TourPopover.tsx:258-265` places the card at a fixed bottom spot; nothing reserves that height in the roster list.
- Fix: add bottom padding equal to the card height to the roster scroller while the tour is active.

### FLOW-02 Investors "Invested" column is a dash on every row
- Page: Investors. P2, visual/flow. Observed: nine holder rows, and the Invested column shows a dash on all nine, about 90 px of width and a header that promise data the page does not have (`investors.png`). The money that was raised is already in the "Equity raised" tile.
- Code (observed): `apps/web/src/components/cap-table/HoldingsTable.tsx:61`.
- Fix: render the Invested column only when at least one holder has an amount.

### FLOW-03 The same two SAFEs appear on four pages, and neither list links to the matching contact
- Page: Investors, Fundraising, Legal, Contacts. P2, flow (duplicated information). Observed: Quill Capital $250,000 and Harbor Angels $50,000 are listed in Investors ("SAFEs, if converted at cap"), in Fundraising SAFEs, and Quill again as a Legal contract (MOCK SAFE - Quill Capital). Both Fundraising rows show "Assign to contact" even though Investors lists a contact "Priya Placeholder" at "Quill Capital (Mock)" (page text read; `fundraising.png`). A founder is asked to do by hand a match the page could show.
- Code (suspected): `apps/web/src/components/fundraising/SafeList.tsx:259,311` offers the action whenever no contact is stored; no name match is tried.
- Fix: when exactly one contact's organization equals the SAFE holder's name, pre-link it and show the contact name instead of "Assign to contact"; keep the manual action for everything else.
- Note: Investors and Fundraising follow another session's redesign, so treat as a suggestion.

### FLOW-04 Fundraising puts two empty cards above the only card with content
- Page: Fundraising. P3, flow/visual. Observed: "Round - Start a round" and "Pipeline - No prospects yet" fill the first 240 px; the SAFEs card, the only one with data, begins at y=255 (`fundraising.png`). On a laptop height the founder sees two empty states first.
- Fix: when there are no prospects and no round, collapse Round and Pipeline into one line with "Start a round" and "Add prospect", and show SAFEs first.

### FLOW-05 Connected integration cards place "Used by" and the page button in different orders
- Page: Integrations. P3, visual. Observed: Gmail and Carta show "Used by" above the page button; Mercury, Brex and Blockscout show the button ("Open Finance") above "Used by" (`integrations2.png`). Iteration 22 C22 asked for one order; the Connected group still mixes both. Coinbase, Blockscout also have a "..." menu while Mercury and Brex do not.
- Fix: one order on every card (Used by, then button) and the "..." menu on every connected card or none.

### FLOW-06 Four cards in Connected say "Open Finance", and iMessage has two near-identical tiles
- Page: Integrations. P3, flow/copy. Observed: Mercury, Brex, Blockscout and Coinbase each carry the same "Open Finance" button to the same page (`integrations2.png`). Under Chat, "iMessage - Send and receive iMessages" and "iMessage on your Mac - Through BlueBubbles on your Mac" differ only in transport. The Integrations page hard-loaded to "Loading integrations..." for more than 4 s (accepted: no cross-visit cache, pass 15).
- Fix: show the page button on the page's own card group (one "Open Finance" per group) or only on hover; merge the two iMessage tiles into one with the transport chosen in its detail view.

### FLOW-07 Finance shows two money-out figures with different bases in the first screen
- Page: Finance. P3, copy/flow. Observed: "Monthly burn $67,621, 3-mo avg, after revenue" in the first tile row, and one row below "$20,484 Spent so far this month - Oct 1 - 23 - up 0.5% vs Sep 1 - 23" (`finance.png`). Both are correct but a first-time founder asking "what do we spend" meets two numbers within 120 px; the period row looks like a section title, not a filter for the chart and lists below.
- Fix: label the period row as the filter it is (put Week/Month/Quarter/Year at the right of the Burn chart header) and keep the "Spent so far" figure inside the chart card.

## Not findings (checked this pass)
- Settings: General, Privacy and approvals, Models, Advanced; time zone and notifications only in General; AI sharing is one "Allow AI models" switch plus "Per model and documents" (`set-e108.png`, `settings.png`). Models reads "Your bots use ..." with one "Use my own model" button.
- Empty Cmd+K lists only the nine pages, Integrations and Settings; typing "invest" returns the page, bots and chats, each with a tag (`cmdk.png`, `cmdk-q.png`).
- Create menu: New bot, New group chat, New space (`create.png`); this account has more than one space, so New space is expected (pass 20).
- Integrations keeps its sidebar row and account menu entry: recorded decision.
- Consent cards on Inbox (mail) and Legal/Data room (documents) are separate by area: recorded decision (passes 8, 12).

## Journey scorecard
| Journey | Actual / ideal | Verdict |
|---|---|---|
| First run: sign-up, first ask | Not re-walked (needs a new account); landing and sign-up form decided in pass 22 | n/a |
| First run: tour | Appears on first page; nine stops, Skip is one click | good; FLOW-01 |
| Daily: inbox triage | Inbox 1 click; one "Let Praci sort your mail" card; sorted state not seen (AI not allowed) | n/a for sorted state |
| Money: runway check | Finance 1 click; Runway 24.2 mo "Until October 2028" in the first row; Chief gives the same cash and burn | minimal; FLOW-07 |
| Raise: Legal, Data room, Investors, Fundraising | 1 click each; Investors, Fundraising and Finance now agree on $250,000 | FLOW-02, FLOW-03, FLOW-04 |
| Agents: create bot | + then New bot is 2 clicks; approvals not exercised | good |
| Integrations / Settings | 1 click from the sidebar; Settings 2 clicks | FLOW-05, FLOW-06 |

## Praise (observed)
- Finance first screen is five tiles, one burn chart with the financing marker, Breakdown and Upcoming; nothing extra (`finance.png`).
- The Investors, Fundraising and Finance figures now tie out: $250,000 funded, $50,000 committed.
- Data room shows the unreadable NDA inline with its reason and a "Replace file" action (`data-room.png`).
- Legal is a plain contract list that fits at 1440 px, and one consent card replaces the old buttons (`legal.png`).
- Settings stays at four short sections with no repeated controls.
