# UX flow critique: import a list, make investors contacts

Scope: two journeys in `docs/crm-pipeline/PLAN.md` (shortened to PLAN) and the story
`apps/web/src/pages/CrmPipeline.stories.tsx` (shortened to the story; stories: Pipeline, Reconcile,
InvestorTimeline, PhoneRowSheet). Images: `crm-reconcile-card.png` (card), `crm-pipeline-desktop.png`
(desktop), `crm-pipeline-phone.png` (phone), `crm-referred-by-picker.png` (picker). Nothing is built, so
every step count is read from the plan and story: "measured" means counted in an image or the story code,
"suspected" means inferred from the plan's description of real lists (PLAN lines 51-55) with no data.
All names are invented. The existing "Start a round" dialog was read in
`apps/web/src/components/fundraising/RoundCard.tsx` (RoundDialog).

## Verdicts

| Journey | Verdict |
| --- | --- |
| 1. Hand over a spreadsheet, get a Pipeline, start the round | acceptable |
| 2. Reconcile: every investor a contact, referrer linked to a contact | convoluted for Referred by, minimal for the review card itself |

## Journey 1: spreadsheet to Pipeline

### Friction scorecard

| Step | Actual (from plan) | Ideal |
| --- | --- | --- |
| 1 | Attach the sheet in the Investors agent chat (PLAN 55, 129: a page upload is "later") | same |
| 2 | Agent parses and calls `pipeline_import_stage` once per 60 rows, no approval (PLAN 108, 263) | same, invisible to the owner |
| 3 | Agent calls `pipeline_import_review`; one card, one approval per import (PLAN 109-110, 264) | same |
| 4 | Answer ambiguous rows (zero to N) | answer only what is truly ambiguous |
| 5 | Press "Add 96" (card) | same |
| 6 | Land on the Pipeline | same, with a link in the result |
| 7 | Start the round: separate "Start a round" dialog with Name, Target, Post-money cap, all required (`RoundCard.tsx`) | not required before importing |

Actual is about 4 owner actions when nothing is ambiguous (attach, send, approve, look), plus the round.
That is close to ideal. Findings, each labeled:

1. **Approvals: once per import, not once per 60 rows.** (Measured, PLAN 108-110, 264.) Staging holds
   rows and needs no approval, so a 96-row sheet split into 60 + 36 produces one card ("Add 96 investors",
   card image). The plan does not say how the agent knows staging is finished or what happens if it calls
   review after the first 60 rows. Two review calls would give two cards, and the owner would approve
   twice. Suspected risk, not drawn. Fix: `pipeline_import_review` takes the import id and the whole
   staged set; a second review of the same import replaces the open card instead of adding one. Say so
   in the plan.
2. **Priority, intro path and contact path have no destination.** (Measured, PLAN 110: the fixed schema is
   firm, people, group, amount, next step, details.) The sheet has a priority column; the table has no
   column for it, so it can only go into Fund details text, which is a single truncated line
   (desktop image, "Fund details" column) already holding stage and check range. The owner's sort key
   from the sheet is lost for practical purposes. Decide: put priority in Fund details with source
   "From your list", or drop it. TBD by the owner; do not invent a column.
3. **The sheet's check range is not a number, by decision** (PLAN 100, 325), so Possible amount is blank
   for every imported row (desktop image shows blanks under Possible amount for "From your list" rows).
   The story also has no way to edit Possible amount: it is plain text in the table, absent from the
   phone sheet (`RowSheet`) and plain text on `InvestorPage`. Only an unexplained "Edit" button exists.
   Undrawn edit path.
4. **Wave maps to a filter, not a column** (PLAN 327; desktop image "Wave" pill). Good: the sheet's wave
   survives import with no extra step.
5. **Status.** The staged schema has no status, so all 96 rows start at the first status ("Not
   contacted"). A sheet with a "next step" column often implies progress, but guessing it would be wrong.
   Acceptable; no change.
6. **Dead end after "Add 96".** (Measured: the story has no result state.) The card ends at a button.
   PLAN 126 says a failed row is "reported", and PLAN 125 says a re-run adds nobody, but neither the
   success message nor the per-row failure list nor the "nothing changed" re-run result is drawn. Every
   terminal screen should offer the next action: "View in Pipeline".
7. **Starting the round is independent and can be deferred.** (Measured, `RoundCard.tsx`: prospects have
   `roundId: null` until committed; PLAN 277 backfill keeps that.) The story only draws a Pipeline with an
   open Seed round (desktop image) and never draws a Pipeline with no round or no records. The founder
   cannot tell from the mockup that import comes first. The round dialog asks three required fields
   (Name, Target, Post-money cap), none of which the sheet contains. The Investors agent has no
   round tool, so "include starting the round" means leaving chat for the page. Suspected hesitation: the
   founder pauses at Target and Cap. Fix: default Name to "Seed" is a guess, so prefer to keep the
   dialog but make the empty Pipeline say nothing about rounds; do not gate import on it.

### Take-away pass: Reconcile card (card image)

- Icon tile at top left: decoration; the title says the same. Remove (it is already hidden below the
  `@sm` width in the story).
- "Needs approval" beside the title: the disabled-then-enabled "Add 96" button already says that.
  Remove it, or keep it only on the chat surface that does not show the button.
- "23 already saved, nothing overwritten": useful once, because it tells the owner their data is safe.
  Keep. Move it to be the only line under the title and fold the other counts into the two disclosure
  rows ("71 new contacts", "23 already saved"), which repeat the same numbers (Once-and-only-once,
  heuristic 12). Three places say 71 and two say 23.
- "Cancel": needed.
- "1 left to choose": needed, and it explains the disabled button. Keep.
- Collapsed rows "71 new contacts" and "23 already saved": the expanded contents are not drawn. Their job
  is to let the owner check before pressing Add. Keep, but draw them.

### Clarity issues

- **Units mismatch.** "96 investors" counts firms (records), "71 new contacts" counts people, and a firm
  with no known person is saved as a contact of the firm (PLAN 86-87). A firm with three partners adds
  three contacts, so 71 + 23 cannot equal 96 in general. The card's arithmetic (71 + 23 + 2 = 96) holds
  only if every row has one person. Use one noun per number: "96 firms", "71 new people".
- **One concept, three names** (heuristic 14). The page button reads "Add prospect", the table column
  "Investor", the card "Add 96 investors", the search "Search investors" (desktop image, card image). The
  card's option detail also shows the contact kinds "Investor", "Prospect" and "Other" (card image), which
  are internal kinds the owner did not choose and cannot reconcile with "these are all investors".
- **The question on the card is unstated.** Each block is a name, a firm and four radios, with no
  sentence saying what is being asked (card image). A short legend such as "Which contact is this?"
  would help, but PLAN's string budget (PLAN lines 290-317) counts every word. Prefer relabeling the
  radio group's accessible name only, and show the first option's detail line, which already
  differentiates the candidates.

### Simpler version, numbered

1. The owner drops the sheet into the Investors chat. (Same.)
2. The agent stages rows as it parses them and posts one review card when the whole sheet is staged;
   re-review of the same import replaces the card. (Change: say it in PLAN.)
3. The card shows "96 firms · 71 new people · 23 already saved" once, then only questions.
4. The owner answers, presses "Add 96".
5. The result replaces the card text with "Added 96. View in Pipeline." and any failed rows.
6. The founder starts the round later, from the empty Round card, when ready.

## Journey 2: investors become contacts, Referred by links to a contact

The owner said: "Referred by should link to a contact, the investors should be contacts." The plan
satisfies the second half through the card and the first half through the picker (PLAN 98-99).

### Friction scorecard

| Step | Actual | Ideal |
| --- | --- | --- |
| Investors as contacts | Automatic on Add: every row's people, or the firm if no person is known, become contacts (PLAN 84-87, 122) | same |
| Ambiguous matches | One card, per question: pick one of N, "New contact" or "Skip this row"; Add disabled until all answered (PLAN 122-124; card image) | same, with fewer questions |
| Referrer, contact exists | Row, click "+ Add", type, pick (picker image): 3 actions per row | 1 decision per distinct referrer |
| Referrer, not a contact yet | Same popover, "Create 'Riley'" saves kind `other` immediately (PLAN 98-99) | same |
| Referrer on phone | Not available in the list row or in `RowSheet` (story: sheet has Interest, Status, Next step, Next call only; phone image) | available |
| Referrer on the investor page | Shown as a link when set; when empty the fact is blank with no control (story `InvestorPage`, `Fact label=Referred by`) | an "Add" control as in the table |

#### Review card

Mostly minimal. Findings:

1. **Zero-guess rule vs the story** (measured). PLAN 123-124 says Add stays disabled "so nothing is
   guessed". The story starts with the first block already answered ("A. Sample" selected,
   `useState({ a1: "2" })`, card image shows one selected radio and "1 left to choose"). Either this is a
   demo of a mid-state, or it is a default the plan does not allow. Decide which and make PLAN and
   story agree.
2. **How many questions on a real list** (suspected). The card example shows 2 of 96. PLAN 54-55 says few
   real rows match a saved contact exactly and partner cells list several people with rarely an email.
   Rules 3 and 4 in PLAN 117-119 ask whenever the name matches under another firm or a no-email person
   sits at a firm with other saved people. Unknown how many a real sheet triggers. If it is dozens, the
   card becomes a long chat message with four radios each (card image: about 110 px per question
   block, so 40 questions is over 4,000 px). Fix if it happens: a one-line select per question, with the
   most likely candidate first, and "Skip this row" moved under a single "Skip" button.
3. **Defaults.** The plan gives no default and each answer has a real cost: a wrong "New contact" creates
   a duplicate, and merging is out of scope (PLAN 211-212). So no default here is right. Keep the
   question. Do not add "apply to all".
4. **Skip this row** is the one option the owner can undo elsewhere: they could delete the record later.
   But it prevents junk contacts, so keep it.
5. The firm-only case (a row with no known person) is not drawn: the table draws an empty second line
   (story: `<div className="mt-1 h-6" />`) and the investor page "People" list would be empty with only
   "Add person". Draw one.

#### Referrer

The weakest part. Evidence:

1. **Per-row, not per-referrer** (measured counts from the desktop image: 5 of 10 visible rows show "+
   Add"; the list is 140 rows). The plan itself says the intro path is "often repeated across rows"
   (PLAN 54-55). A repeated referrer is one decision for many rows, but the only path is a popover per
   row, so about 3 actions times the number of rows with a referrer. Suspected total: tens of rows.
2. **The import drops the intro path** (PLAN 54-55, 110). The agent can already read a cell like "Via
   Sam Example" but the staged schema has no field for it, so the owner re-enters what is in their sheet.
   That is "asking for what the app knows" (heuristic 3). Fix: add an optional `referredBy` name to the
   staged row. In the card, show one line per distinct referrer, not per row: "Sam Example, 12 rows"
   with "Existing contact (picked)", "New contact" or "Skip" as the choices, using the same match rules.
   Leave anything the agent cannot read as a clear name in Fund details text.
3. **Create is offered first and highlighted** (measured, picker image). With the query "Riley" the
   top and highlighted item is `Create "Riley"` and the existing "Riley Placeholder" sits below it.
   Pressing Enter creates a duplicate. This also contradicts the plan's goal of linking to a contact.
   Fix: list matches first; show Create only when no contact's name matches the query.
4. **Phone and investor page have no referrer control** (story code as above, phone image: no Referred by
   at all). Either add "Referred by" to the row sheet and an "Add" to the empty fact on the investor
   page, or state that it is desktop only (AGENTS.md requires an explicit reason).
5. **A column of "+ Add".** (Measured, desktop image: it repeats in 5 rows.) PLAN 170-171 chose this on
   purpose for discoverability. Acceptable; with fix 2 most rows would have a value and the column
   would quiet down.

### Take-away pass: Pipeline row and picker

- "Referred by" quiet "Add" at rest: keep (see above).
- Popover input has a placeholder and an accessible name that repeat ("Search contacts"): code
  `placeholder` and `aria-label`; harmless, one is invisible.
- "No contact found" next to a Create item: when Create is shown, the empty line is redundant (the
  story renders both only when the list is empty).

### Simpler version, numbered

1. The import card states referrers once each, resolved with the same match rules as people.
2. The owner answers ambiguous people and referrers on one card.
3. The picker is for later single edits only: matches first, Create last.
4. The phone sheet and investor page offer the same picker.

## Does the story match the plan?

Plan behavior with no drawing (all measured against the story):

- Result of "Add" (success, failed rows, re-run with nothing to add) (PLAN 125-126).
- Expanded "71 new contacts" and "23 already saved" lists.
- A Pipeline with no round and no rows, and the first import into it.
- "Moved to Passed" and "Undo" toast (PLAN 161, 296): `chooseInterest` silently sets the status.
- Firm-only row (PLAN 86-87).
- Editing Possible amount (PLAN 100) and the meaning of the "Edit" button.
- Staging progress in chat across calls of 60 rows (PLAN 108).

Drawn behavior the plan does not state:

- The card opens with the first question already answered (see above).
- The investor page's empty Referred by shows nothing, and the phone sheet omits it; the plan lists
  "Add who referred {firm}" only as an accessible name on the row (PLAN 298).
- The page-level "Add prospect" button (desktop image) has no plan entry, although records now hold firm
  and people; it is unclear whether it creates a record, a contact, or both.
- "Edit" on the investor page.

## Top three changes

1. Add the intro path to the import and resolve referrers once per distinct name on the same card, so
   Referred by links to a contact without per-row picking (Journey 2, referrer finding 2).
2. Fix the picker: list matching contacts first and offer Create only when none match; add the same picker
   to the phone sheet and the empty Referred by on the investor page (referrer findings 3 and 4).
3. Make one import mean one card and one approval (state it in PLAN; a re-review replaces the card), give
   the card a result with "View in Pipeline", use one noun per count, and draw the missing states
   (Journey 1 findings 1, 6 and units mismatch).

Not found: nothing here is minimal by accident. The review card's structure (one card, only the rows that
need a person, Add disabled until answered) is already close to the ideal and needs no new decisions.
