# Topic: Fundraising and SAFEs

> **Superseded after the Astra plan review (see README, Review record):** there is no Not from pipeline action; an unassigned Mercury SAFE counts normally and keeps Assign to contact. Removing Mercury changes no row (no conversion to native, no clearing of Waiting for Mercury, no Delete or manual Mark on Mercury rows). Native SAFEs are the YC post-money cap form only: no discount and no MFN field. A Committed prospect counts in Pending only for the round it was committed in. Stories below that describe the older behavior no longer apply.

Round 9. Updated for round 8 (Assign to contact for prospects and investors, Unassign, Not from pipeline (Change contact removed in round 9), attach clears `mercurySentAt`, Send SAFE allowed when every SAFE is Canceled, Mercury removal keeps `externalId`, the Waiting menu, the Send SAFE email prompt; views `#fund-unmenu`, `#fund-mercmenu`, `#safe-email`). Earlier, round 7: updated for the founder decision of 2026-10-21 (Mercury is the only record of a Mercury SAFE: Send SAFE marks the prospect "Waiting for Mercury", the Mercury SAFE attaches by email on sync, "Assign to contact" for an unmatched SAFE; no hand-off Draft). Earlier: round 4 text updated for the round-4 plan changes (every SAFE counts once). Earlier: updated against the plan after round 3 (sections "Fundraising", "Send SAFE", "SAFE math and documents", "Mercury SAFEs", slices 8 to 10) and the mockup views `#fundraising`, `#fund-roundmenu`, `#fund-editround`, `#fund-stage`, `#fund-prospect`, `#fund-safemenu`, `#fund-mark`, `#safe-assign`, `#fund-waitmenu`, `#fund-close`, `#safe-dialog`, `#safe-terms`, `#safe-mercury`, `#safe-cover`, `#fund-nomercury`, `#fund-sync`, `#fund-noround`, `#fund-start`, `#fund-closed`. Mockup data: round "Bridge SAFE round", post-money cap $10M, MFN, target $1M; bar Funded $450k, Signed $50k, Pending $150k (Ravi Mehta's $50k and Dana Whitfield's $100k, both Committed prospects; Dana is Waiting for Mercury; with no Mercury, Dana's $100k is a native Draft SAFE). On the round bar, Committed is a pipeline stage only; money promised and not yet signed is Pending (committed prospects with no SAFE, including those Waiting for Mercury, plus Draft and Sent SAFEs). Route `/app/fundraising`. Planned feature; all figures are invented. Gap tags: `PG-nn` round-1 gap still open; `NG-nn` gap from round 2, 3 or 4 that is still open (see `../catalog.md`, "Plan gaps (round 4)").

## STORY-501: Start a round and add the first prospects
**Type**: medium
**Topic**: Fundraising and SAFEs
**Persona**: Rina Okoye, pre-seed founder with no lawyer or CFO
**Goal**: Open a SAFE round and list the people to approach
**Preconditions**: Investors page exists; no round; no prospects; no Mercury.
**Ideal path**: 5 (open the page, Start a round, fill the dialog, Add prospect, Save)
**Alternate paths**: Add prospect first (the header button is always there).
### Steps
1. Click Fundraising in the sidebar (below Investors) → with no round the page shows the filled "Start a round" alone (`#fund-noround`); the header has "Connect Mercury" (plain), Hide amounts, Add prospect and an outline Ask.
2. Click Start a round → the dialog (`#fund-start`): Name "Seed SAFE round", Target $2,000,000, Post-money cap $15,000,000, MFN checked by default → Start.
3. Read the page → the Round card shows the name, "Post-money cap $15M · MFN" under it, a "…" menu, and an empty bar with the legend Funded $0, Signed $0, Pending $0, Target $2M; the Pipeline and SAFEs cards are present and empty.
4. Click Add prospect → the dialog (`#fund-prospect`): Name, Email (Optional), Stage (Target, Intro, Meeting, Diligence, Committed, Passed), Check size ($). Enter "Fjord Ventures", Stage Target → Save.
5. Read Pipeline → the heading "Target 1" with the row "Fjord Ventures", sub-line "No contact yet", amount "—", and the row "…" menu.
### Variations
- Add prospect before any round exists: it works; Pipeline and SAFEs always show, with or without a round.
- An email that already belongs to a contact: the dialog opens that contact instead of failing.
### Edge Cases
- Starting a second round while one is open is not offered: the round exists, so the page shows it.
- A prospect with no check size shows "—" and adds nothing to the bar; when the total passes the target the bar scales to the larger of the two, and a zero target shows no Target figure.

## STORY-502: Move a prospect through the stages and log contact
**Type**: medium
**Topic**: Fundraising and SAFEs
**Persona**: Rina, running seven prospects
**Goal**: Keep the pipeline current after each conversation
**Preconditions**: Round open; prospects as in the mockup (Ravi Mehta Committed, Clearwater Fund Diligence, Oakline Partners Meeting, Summit Seed and Mira Santos Intro, Fjord Ventures Target, Hollis Fund Passed).
**Ideal path**: 3 (row menu, Move to, done)
**Alternate paths**: Edit prospect in the same menu; Ask the Investors agent (it cannot change a stage and says so).
### Steps
1. Read Pipeline → prospects grouped under stage headings with counts (Committed 1, Diligence 1, Meeting 1, Intro 2, Target 1) and a collapsed button "Passed 1 ›". Each row shows the name, a sub-line with last contact and next step ("Meeting Oct 24"), a right-aligned check size ("$200,000", or "—"), and the row menu inline. There is no chip per row.
2. Open Oakline Partners' "…" (`#fund-stage`) → "Move to" with Target, Intro, Diligence, Committed, Passed, then Edit prospect.
3. Choose Diligence → the row moves under Diligence; counts update (Meeting 0, Diligence 2).
4. Choose Edit prospect → the same dialog as Add prospect with next step and last contact (typed by hand) editable; Save.
5. Click "Passed 1 ›" → it turns to "Passed 1 ⌄" and expands in place with Hollis Fund, "Passed Oct 5", $150,000.
6. Move Hollis Fund back to Intro → stages move in any direction.
### Variations
- Move Ravi Mehta to Committed → the row shows the filled "Send SAFE" and the Pending segment of the round bar grows by his check size.
- Ask the agent "move Oakline to Diligence" → it says it cannot change a stage and points to the row.
### Edge Cases
- Last contact is never updated automatically.
- Stale prospects raise no alert (out of scope).

## STORY-503: Send SAFE without Mercury (native dialog, cover summary)
**Type**: long
**Topic**: Fundraising and SAFEs
**Persona**: Rina, no Mercury SAFE flow
**Goal**: Record a SAFE for Ravi Mehta and prepare the paperwork
**Preconditions**: Ravi Mehta is Committed with a $50,000 check size; the round cap is $10M post-money with MFN; Mercury is not connected ("Connect Mercury" in the header).
**Ideal path**: 4 (Send SAFE, Save, read the summary, Print)
**Alternate paths**: none (there is no separate New SAFE button).
### Steps
1. Find Ravi's row in Committed → the filled button "Send SAFE" is the one filled control on the page (Ask is outline).
2. Click Send SAFE → the dialog "Send SAFE · Ravi Mehta" (`#safe-dialog`): Amount $50,000, Date Oct 20, and a Terms line "Post-money cap $10M · MFN · Different terms", all prefilled from the round and the prospect.
3. Click Different terms → cap, discount, MFN, pro rata and governing state open (`#safe-terms`); cap and discount cannot both be set.
4. Click Save → the cover summary opens (`#safe-cover`): Amount, Date, Post-money cap, Discount, MFN, Pro rata, Governing state, a link "YC documents ›", and Close and Print.
5. Click Print → the browser print of the summary; Rina fills the official YC form outside Rakazo and sends it for signature herself.
6. Read the page → Ravi left Pipeline (6 prospects); SAFEs lists "Ravi Mehta · Oct 20", $50,000 muted, chip "Draft"; the Pending segment of the round bar is unchanged, because the Draft counts at its amount in place of the prospect's check size. Investors shows nothing new: a Draft is in no cap-table figure.
### Variations
- Discount SAFE: the Investors group row shows "—" for it later.
- Cap differs from the round cap: the row shows its own cap because it differs.
### Edge Cases
- The Send SAFE button is gone for Ravi once a SAFE exists.
- A native SAFE never Marked Sent or Signed stays Draft.

## STORY-504: Mark a native SAFE Sent, Signed, Funded
**Type**: medium
**Topic**: Fundraising and SAFEs
**Persona**: Rina, tracking a native SAFE by hand
**Goal**: Keep the status chip true as the SAFE progresses
**Preconditions**: A native Draft SAFE for Dana Whitfield, $100,000.
**Ideal path**: 3 menu uses over time
**Alternate paths**: Mark funded from Draft.
### Steps
1. Open the row "…" on the Draft → Open and only the next valid mark, Mark sent; Cancel SAFE; then Delete (`#fund-safemenu` draws the same menu on Harbor Angels' Signed row: Open, Mark funded, Cancel SAFE, Delete). After each mark the menu offers the next one (Sent: Mark signed; Signed: Mark funded; Funded: none).
2. Choose Mark sent → a small dialog asks for a date (today by default, as in `#fund-mark` for Mark funded); the chip becomes Sent, the bar's Pending segment still counts it, and Undo is offered. A SAFE sent and unsigned for 14 days appears in Attention. (From the cover summary, Mark sent asks for no date and records today.)
3. Choose Mark signed → the chip is Signed; Dana's contact kind flips from prospect to investor (stage is kept); the Round bar's Signed segment grows; the Attention strip lists "Dana Whitfield · $100,000, Signed Oct 18 · awaiting deposit · Find in Finance"; the Investors group "SAFEs, if converted at cap" now includes her.
4. Choose Mark funded → Funded; the Attention row leaves; the Funded segment grows.
5. Choose Cancel SAFE on a Sent row that the investor withdrew → the chip reads Canceled; if it was the prospect's last non-canceled SAFE, the prospect returns to Pipeline at its old stage. Choose Delete on a Draft row → a confirm; native rows only.
### Variations
- Mark a Mercury row funded when Mercury has not set the field: allowed with a date.
- Undo a wrong mark right after.
### Edge Cases
- Dates and marks the founder set are never cleared by a later Mercury sync, and a manual date wins over Mercury's.

## STORY-505: Mercury connected, SAFEs appear with a derived status
**Type**: medium
**Topic**: Fundraising and SAFEs
**Persona**: A founder who created SAFEs in Mercury
**Goal**: See them on Fundraising without retyping
**Preconditions**: Mercury connected from Finance; three SAFE requests in Mercury.
**Ideal path**: 1 (open the page; the sync runs)
**Alternate paths**: Refresh in the Mercury menu.
### Steps
1. Open Fundraising → the header button reads "Mercury · 5 min ago"; the sync ran with the 15-minute throttle.
2. Read SAFEs → Lakeside Capital $250,000 Funded, Priya Raman $200,000 Funded, Harbor Angels $50,000 Signed; each row shows the date; cap and source appear only when they differ from the round or the page source.
3. Open the Mercury menu → Refresh forces a sync past the throttle.
4. Open a Mercury row's menu → Open shows the Mercury document; Mark sent, signed, funded apply only to fields Mercury has not set.
### Variations
- A row Mercury returned that cannot be read: the header line reads "2 SAFEs could not be read"; nothing is written for those.
- New Mercury SAFEs while a round is open get the round's id.
### Edge Cases
- The same SAFE also shows as an unconverted row on Investors (by design).
- A Mercury row with no contact counts by its Mercury status (Funded $450k, Signed $50k stay on the round bar and the Investors group row) and offers "Assign to contact" (STORY-516). The counting rule is in the plan Glossary.

## STORY-506: Send SAFE with Mercury, the prospect waits and the SAFE attaches
**Type**: long
**Topic**: Fundraising and SAFEs
**Persona**: Rina, Mercury connected
**Goal**: Send the SAFE through Mercury and end with one count
**Preconditions**: Ravi Mehta is Committed ($50,000); Mercury connected; Ravi's email is on his contact (Send SAFE with Mercury asks for it when missing).
**Ideal path**: 3 (Send SAFE, create it in Mercury, reopen Fundraising)
**Alternate paths**: Mercury's own site first, then Assign to contact if the email differs (STORY-516).
### Steps
1. Click Send SAFE on Ravi's row → Mercury's SAFE page opens in a browser tab (Mercury's API cannot create a SAFE). Rakazo creates no SAFE row; Ravi's row stays in Committed, the button is replaced by "Waiting for Mercury · Oct 20", and the bar still reads Pending $150k (`#safe-mercury`, 8 prospects).
2. In Mercury create the SAFE for Ravi Mehta, $50,000, with his email, and send it.
3. Return to Rakazo and reopen Fundraising (or choose Refresh) → the sync finds the new Mercury SAFE whose investor email equals Ravi's (trimmed, any case) and attaches it to his contact. Ravi leaves Pipeline, his check size stops counting, and the SAFE counts by its Mercury status (the amounts may differ; Mercury's amount applies).
4. Read SAFEs → one row "Ravi Mehta", chip Sent (derived from Mercury timestamps), no link under it.
5. Open the row → the Mercury document; the cover summary remains reachable from Open.
6. Check Investors → Ravi appears in the group row only after the SAFE is Signed.
### Variations
- No SAFE matches yet: Ravi keeps showing "Waiting for Mercury" and counting at $50,000, with no deadline.
- Two prospects share Ravi's email: the one Waiting for Mercury gets the SAFE.
- The email differs in the Mercury form: the SAFE counts by status and offers Assign to contact while Ravi's check size still counts (the one possible double count; see STORY-516).
### Edge Cases
- The Mercury server is removed later → the SAFE rows keep their data, `source` becomes native, `documentUrl` is cleared and `externalId` is kept (the rows read "from Mercury"), totals do not change, and any prospect still Waiting for Mercury returns to the normal row.
- A waiting prospect has no Send SAFE button; "Open Mercury" in the row menu reopens the SAFE page. Send SAFE on a prospect with a non-canceled SAFE is refused.
- Ravi has no email on file: Send SAFE first asks "Investor email" (`#safe-email`), needed to match the SAFE; Add prospect hints "Used to match the SAFE".
- Rina cancels the SAFE in Mercury to fix a wrong cap: the SAFE counts zero and Ravi returns to Pipeline as a normal row (attaching cleared `mercurySentAt`, so he does not read Waiting again). Every SAFE on his contact is Canceled, so Send SAFE works again and she creates the right one (NG-70, resolved round 8).
- Mercury is removed and added again: the rows stay as native "from Mercury" rows and keep their `externalId`; connecting Mercury again re-attaches them by `externalId`, so each SAFE counts once (NG-71, resolved round 8).

## STORY-507: Awaiting deposit, matched or not
**Type**: medium
**Topic**: Fundraising and SAFEs
**Persona**: Rina, waiting on Harbor Angels' wire
**Goal**: Know whether a signed SAFE has been paid
**Preconditions**: Mercury connected; Finance synced; Harbor Angels' $50,000 SAFE is Signed.
**Ideal path**: 2 (read Attention, Open)
**Alternate paths**: Ask the Investors agent "did Harbor's wire arrive?" (answered from `fundraising_read`).
### Steps
1. Open Fundraising → the Attention card shows "Harbor Angels · $50,000" with "Signed Oct 12 · awaiting deposit · Find in Finance" and a filled Open. The SAFE row below shows the date and the chip Signed only; "awaiting deposit" appears nowhere else.
2. Click "Find in Finance" → the Finance page.
3. The wire arrives; the next sync sets `paidAt`, and a `FinanceTransaction` of the same amount within five days classified financing is linked → the chip becomes Funded, the Attention row goes, the Funded segment grows.
4. If Mercury sets `paidAt` but no transaction matches → the row still reads Funded; a miss is normal.
5. If the wire was $49,950 after fees and Mercury never sets `paidAt` → Rina chooses Mark funded on the Mercury row.
### Variations
- Two SAFEs of the same amount within five days: the match is best effort.
### Edge Cases
- A manual date versus a later Mercury date differ: the manual date wins.

## STORY-508: Close the round
**Type**: short
**Topic**: Fundraising and SAFEs
**Persona**: Rina, finishing the round
**Goal**: End the round and keep the SAFEs
**Preconditions**: Open round "Bridge SAFE round" with Harbor Angels' $50,000 SAFE signed and unpaid.
**Ideal path**: 3 (menu, Close round, confirm)
**Alternate paths**: Cancel.
### Steps
1. Open the Round card's "…" (`Round actions`, `#fund-roundmenu`) → Edit round, Close round. There is no Close round button on the page.
2. Choose Close round → the alert dialog "Close this round?" with "Harbor Angels' $50,000 SAFE is signed and unpaid." (`#fund-close`). With no signed unpaid SAFE there is no dialog.
3. Click Close round → the card collapses to one line, "Bridge SAFE round · Closed Oct 20 · funded $450k", with a menu (Reopen) and the filled "Start a round" button (`#fund-closed`). Pipeline, SAFEs and Attention stay on the page below it, and the signed-unpaid SAFE keeps its Mark funded row. The SAFEs keep their round.
### Variations
- Cancel: nothing changes.
- Reopen from the card menu → the round is open again, allowed only when no other round is open.
### Edge Cases
- Add prospect and Send SAFE keep working after the close; a SAFE created then has no round.

## STORY-509: A signing prospect becomes an investor
**Type**: long
**Topic**: Fundraising and SAFEs
**Persona**: Rina; Harbor Angels' principal Tom Okafor just signed
**Goal**: See Harbor Angels as an investor on Investors, with the SAFE in the cap table group
**Preconditions**: Tom Okafor is a prospect contact (stage Committed) with a $50,000 SAFE row Sent.
**Ideal path**: 2 (Mark signed, open Investors)
**Alternate paths**: Mercury sets the signed date by itself.
### Steps
1. Choose Mark signed on the SAFE row (or let Mercury sync it) → the SAFE derives to Signed; because Tom is a prospect, his contact's kind flips to investor automatically; stage is kept. Nothing tells Rina.
2. Open Fundraising → the prospect left Pipeline when the SAFE was created; the SAFE row shows the chip Signed; Attention lists it as awaiting deposit.
3. Open Investors → Contacts, Investors tab: Tom Okafor appears; Portal "—" until he has a share.
4. Read the cap table → the group row "SAFEs, if converted at cap" includes Harbor Angels at 0.5% of a $10M cap.
5. Open a new update → Tom is a ticked recipient because his kind is now investor.
### Variations
- A Mercury SAFE with an unmatched email creates a row with an investor name only; no contact.
- A board or auditor contact who signs a SAFE keeps their kind (resolved in round 3: only a prospect flips); the SAFE still shows on Investors.
### Edge Cases
- Passed after a SAFE exists.
- Two contacts with the same email cannot exist (unique by email).

## STORY-510: Mercury not connected
**Type**: short
**Topic**: Fundraising and SAFEs
**Persona**: A founder who banks elsewhere
**Goal**: Use Fundraising without Mercury and see how to connect it
**Preconditions**: No Mercury server.
**Ideal path**: 1 (open the page)
**Alternate paths**: Click Connect Mercury.
### Steps
1. Open Fundraising → the header shows the plain button "Connect Mercury" (`#fund-nomercury`); native SAFEs work; Send SAFE opens the native dialog.
2. Click Connect Mercury → Integrations (finance); after connecting, return and the button reads "Mercury · 5 min ago".
### Variations
- Without Mercury, Send SAFE opens the native dialog and a Draft row; Waiting for Mercury and Assign to contact never appear.
### Edge Cases
- None.

## STORY-511: Mercury sign-in expired, or the sync failed
**Type**: short
**Topic**: Fundraising and SAFEs
**Persona**: A founder returning after weeks
**Goal**: Understand stale data and fix it
**Preconditions**: Mercury needs a new sign-in, or a sync failed.
**Ideal path**: 2 (read the header, Refresh or Reconnect)
**Alternate paths**: Work natively.
### Steps
1. Open Fundraising after a failed sync or an expired sign-in → the header button reads "Sync failed" in the warning style (`#fund-sync`); SAFE rows keep their last data.
2. Open its menu → Refresh and Reconnect.
3. Choose Reconnect → Integrations; after reconnecting the sync runs. Or choose Refresh to retry at once.
### Variations
- A malformed row: the header line reads "N SAFEs could not be read".
### Edge Cases
- Stale Signed chips until the sync succeeds.

## STORY-512: Send SAFE with Mercury, the hand-off is abandoned
**Type**: short
**Topic**: Fundraising and SAFEs
**Persona**: Rina
**Goal**: Recover when she opened Mercury and did not finish
**Preconditions**: Mercury connected; Ravi Mehta Committed ($50,000).
**Ideal path**: 3 (Send SAFE, close Mercury, choose Not sent)
**Alternate paths**: Finish in Mercury (STORY-506).
### Steps
1. Click Send SAFE → Mercury's SAFE page opens in a tab; Ravi's row shows "Waiting for Mercury · Oct 20" and still counts in Pending (`#safe-mercury`).
2. Rina closes the Mercury tab without sending.
3. Back on Fundraising the row keeps its waiting state; nothing expires.
4. Open the row's "…" menu (`#fund-waitmenu` draws it on Dana's row: Open Mercury, Not sent, Passed, Edit prospect; no Move to) and choose Not sent → the row is a normal Committed prospect again with its Send SAFE button; nothing was deleted because no SAFE row ever existed.
### Variations
- She finishes later: the next sync attaches the new Mercury SAFE if the emails match.
### Edge Cases
- Rina edits Ravi's check size while waiting: the Pending figure follows it.

## STORY-513: Close a round, then start the next
**Type**: medium
**Topic**: Fundraising and SAFEs
**Persona**: Rina, a bridge round after the seed round
**Goal**: Start another round without losing the first round's SAFEs
**Preconditions**: A closed round (`#fund-closed`); three SAFEs belong to it.
**Ideal path**: 2 (Start a round, fill the dialog)
**Alternate paths**: Reopen the closed round if no other round is open.
### Steps
1. Read the page → one line "Bridge SAFE round · Closed Oct 20 · funded $450k" with its menu and the filled "Start a round"; Pipeline and the three SAFEs are still below.
2. Click Start a round → the dialog with name (no default), target, post-money cap, MFN checked; enter "Series Seed SAFE round", $3,000,000, $20,000,000 → Start.
3. Read the new Round card → an empty bar (Funded $0), because the earlier SAFEs belong to the closed round.
4. Check Investors → the group row still includes the first round's SAFEs.
5. New SAFEs created or synced from now on get the new round's id. The closed round can no longer be reopened while the new one is open.
### Variations
- A SAFE created with no open round has no round id.
### Edge Cases
- None.

## STORY-514: Expired and canceled SAFEs
**Type**: medium
**Topic**: Fundraising and SAFEs
**Persona**: Rina
**Goal**: See what happens when a SAFE lapses or is withdrawn
**Preconditions**: A Mercury SAFE past its `expiresAt` and unsigned; another canceled in Mercury; a native Sent SAFE she wants to withdraw.
**Ideal path**: 3 (read chips, Cancel SAFE, read Investors)
**Alternate paths**: none found
### Steps
1. Open Fundraising → the first row's chip reads Expired (only Mercury sets it), the second Canceled, with muted amounts.
2. Check the round bar → neither counts as Funded, Signed or Pending.
3. Open the native Sent SAFE's menu (`#fund-safemenu`) → Open, Mark signed (the next valid mark only), Cancel SAFE, Delete; choose Cancel SAFE → the chip reads Canceled and the row stays in the list.
4. Open Investors → the group row counts only Sent, Signed and Funded SAFEs, so all three left it.
### Variations
- Delete on a native Draft or Sent row removes it.
### Edge Cases
- The prospect's contact keeps its stage and kind; if the canceled SAFE was the only one, the prospect returns to Pipeline.

## STORY-515: Edit the round
**Type**: short
**Topic**: Fundraising and SAFEs
**Persona**: Rina, who raised the cap from $10M to $12M after a strong week
**Goal**: Change the round terms
**Preconditions**: Round with the $10M cap; two Draft SAFEs and one Funded SAFE exist.
**Ideal path**: 2 (menu, Edit round)
**Alternate paths**: none found
### Steps
1. Open the Round card's "…" → Edit round (`#fund-editround`): the same dialog as Start a round, with a Save button.
2. Change the cap to $12M and press Save.
3. Read SAFEs → existing SAFEs keep the terms they were created with, so their rows now show their own $10M cap because it differs from the round's; a new Send SAFE is prefilled with $12M.
### Variations
- Change the target only: the bar rescales.
### Edge Cases
- None.

## STORY-516: Assign to contact, change it, unassign it
**Type**: short
**Topic**: Fundraising and SAFEs
**Persona**: Rina
**Goal**: Attach a Mercury SAFE the sync could not match by email
**Preconditions**: Mercury connected; Dana Whitfield is Committed and Waiting for Mercury; Mercury has a SAFE "D. Whitfield · $100,000" with a different email.
**Ideal path**: 3 (Assign to contact, pick, Assign)
**Alternate paths**: Unassign, then Assign to contact, if the choice was wrong; Not from pipeline if the SAFE belongs to no prospect.
### Steps
1. Read SAFEs → the unmatched row "D. Whitfield", $100,000, chip Sent, counts by its status and shows "Assign to contact" under its date; Dana's pipeline row says "Waiting for Mercury" and still counts. Both count, so the bar reads Pending $250k (`#safe-assign`).
2. Click "Assign to contact" → the dialog "Assign to contact · D. Whitfield" with a Contact picker (Dana Whitfield first, then the other prospects and the investors); buttons Cancel and Assign.
3. Choose Dana and click Assign → the SAFE attaches to her contact, `mercurySentAt` clears, her check size leaves Pending (back to $150k), and she leaves Pipeline.
4. Rina picked Ravi by mistake. She opens the attached row's menu (`#fund-mercmenu`: Open, Unassign) and chooses Unassign, then Assign to contact → Dana; the SAFE moves to Dana and counts once; Ravi is a Committed prospect again with his check size back in Pending (a normal row, not Waiting, because attaching cleared `mercurySentAt`).
5. Alternatively Unassign → the SAFE has no contact again (Assign to contact returns on the row), the contact returns to its previous kind and stage, and its check size counts again if it is still a Committed prospect. The SAFE and the prospect then both count by design (neither is paired).
### Variations
- Assign to a prospect who was not waiting: same result. Assign to an investor contact: the SAFE attaches, no check size changes.
- Cancel: nothing changes; the double count remains and both rows keep saying why.
- Assign to contact for someone who already has a SAFE: allowed; each SAFE row counts once by its own status, and the contact is not duplicated in Pipeline or the Investors group (one row per SAFE).
### Edge Cases
- A Signed SAFE had flipped the wrong contact to investor: Unassign flips the contact back unless another active SAFE exists (NG-69, resolved round 8). A contact that was already an investor (no stage) is not flipped back.
- The SAFE belongs to nobody in Pipeline (an existing investor's): the row menu (`#fund-unmenu`: Open, Assign to contact, Not from pipeline) has Not from pipeline → the assign prompt disappears and the SAFE counts normally; the same menu reverses it (NG-72, resolved round 8). A later prospect with the same email does not attach to it; the SAFE row shows Assign to contact again and Rina uses it (NG-75, resolved round 9).
- The attached contact was deleted later: the SAFE keeps its text with no contact link (plan, Investors Contacts "Delete"), so the row is unassigned again and offers Assign to contact; Unassign is not offered because there is nothing to detach. It counts once by its status.
- A Mercury SAFE with no investor email never matches by itself and waits for Assign to contact.
- Mercury is removed: the rows turn native ("from Mercury") and the menu keeps the native actions and also Assign to contact, Unassign and Not from pipeline, as ordinary SAFE rows with a contact link (NG-73, resolved round 9).
- Mercury is connected again after Rina edited a converted row: dates she set stay, the contact link stays, a row she Deleted is inserted again as a new unassigned Mercury row (the Delete confirm says "Comes back if Mercury is reconnected"), and Mercury's status wins for rows still present in Mercury (NG-74, resolved round 9).

## STORY-517: Fundraising on a phone
**Type**: medium
**Topic**: Fundraising and SAFEs
**Persona**: Rina on a 390 px browser
**Goal**: Check the round and move a prospect
**Preconditions**: Round open with the mockup data.
**Ideal path**: 3 (open, read, move a stage)
**Alternate paths**: Ask the agent.
### Steps
1. Open Fundraising at 390 px → the header is one row (menu button, title, "+" Add prospect, icon-only Ask); the Mercury line and Hide amounts sit under it.
2. Read the Round card → the cap and MFN sit under the name; the legend is two columns.
3. Read Pipeline → each row keeps its "…" menu inline; check sizes right-aligned; stage headings.
4. Open Oakline's menu → Move to list; choose Diligence.
5. Read SAFEs → the card is as tall as its rows.
### Variations
- Send SAFE on a Committed row stays the filled button.
### Edge Cases
- Native mobile app: no screen; the agent answers.

## Gaps found
Open after round 6. Resolved in round 3 and no longer listed: PG-37 (only a prospect flips), NG-33 (merge needs an email and an amount; the manual link is drawn).
NG-44 and NG-54 are resolved in the round-5 plan, and NG-59 in the round-6 plan (superseded in round 7: NG-62 to NG-64 are resolved by the 2026-10-21 decision; the rule is in the Glossary; drawn in `#safe-mercury` and `#safe-assign`).
- NG-59 and NG-62 to NG-64 resolved by the decision (no hand-off Draft, no hold-out, no window). Open: NG-69 (Assign cannot be undone), NG-70 (cancel then Send SAFE), NG-71 (remove and re-add Mercury), NG-72 (Assign link on SAFEs that have no prospect).
