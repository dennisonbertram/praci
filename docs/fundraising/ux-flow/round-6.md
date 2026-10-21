# UX Flow Critique, Round 6: Investors and Fundraising (planned) — 2026-10-20

Evidence: `docs/fundraising/README.md` (Glossary lines 82 to 100, Safe model lines 190 to 205, Updates and Update editor
lines 410 to 490, Round, SAFEs and Send SAFE lines 520 to 580, Mercury SAFEs lines 686 to 696), `mockup.html` rows
at lines 365, 439 to 460 and 544 to 566, and light screenshots in `docs/fundraising/ux-flow/screens/` (opened:
`mock-safe-mercury`, `mock-fundraising`, `mock-safe-link`, `mock-ed-nogmail`, `mock-ed-unknown`, `mock-ed-unticked`,
`mock-inv-partly`). Nothing is built or run.

## Round-5 verification

- R5-1 confirmed. In `mock-fundraising` only Dana Whitfield (Draft) carries "Link to Mercury SAFE"; the D. Whitfield
  Mercury row (Sent) has none. In `mock-safe-mercury` Ravi's fresh Draft shows no link. `mock-safe-link` states the single
  candidate as text with one Link button. Pending $150k = Ravi $50k + Dana $100k and the held-out $100k Sent row is not
  in it. The new rule creates two problems of its own (N6-1, N6-2).
- R5-2 confirmed in the plan (Unknown counts as resolved, Partly sent, Retry on the Updates row asks the resend
  question). `mock-ed-unknown` shows the chip "Partly sent", the row label "Unknown — check Sent mail", and the footer
  question with Cancel and "Send again". The Updates-row side is not specified (N6-3).
- R5-3 confirmed. `mock-ed-nogmail` footer reads "Notifies 4 investors" where "Saved" would be; four matches the
  investors with an email and portal access (Elena, Tom, Sam, Priya).
- R5-4 confirmed. In `mock-ed-unticked` the hint sits with a visible gap below the Nate Cho row.

## Friction scorecard

| Journey | Steps (planned / ideal) | Needless decisions | Re-entry | Dead ends | Verdict |
|---------|-------------------------|--------------------|----------|-----------|---------|
| Type the cap table in | 3 + 1 row per holder / same | 0 | 0 | 0 | minimal |
| Monthly update, Gmail | 5 / 4 | 0 | 0 | 0 | acceptable |
| Monthly update, no Gmail | 4 / 4 | 0 | 0 | 0 | minimal (footer now says what the button does) |
| Investor opens portal on phone | 2 taps / 1 | 0 | 0 | 0 | acceptable (decision 5) |
| Audit request | 3 to 4 / 3 | 0 | 0 | 0 | minimal |
| Send SAFE from a committed prospect (Mercury) | 1 click, Mercury, back, link only on a mismatch / same | 0 | 0 | 0 | acceptable, but see N6-1, N6-2 |
| Six-week round end to end | 2 clicks per stage move | 0 | 0 | 0 | acceptable |

## Your specific questions

- Would a founder understand that an unrelated Mercury SAFE is held out while a Draft awaits? No. `mock-fundraising`
  shows a Sent $100,000 row with a muted amount, a round bar that does not include it, and nothing that says why. The
  Draft's muted amount means "draft", but the Draft is counted, so muted means counted on one row and not counted on the
  other. The link on the Draft is the only cue and it names an action, not the cause (N6-2).
- Linking under the new rule: the clicks are right (one link, one confirm, one candidate stated as text). What is wrong
  is how the plan decides which Mercury rows are candidates (N6-1).
- "Notifies N investors": works. It is data in the existing slot and equals the toast. Only the empty and singular
  cases are unstated (nice).
- Unknown, Partly sent, Retry: right guard in the editor. Two gaps: the Updates row (N6-3) and no way to clear the state
  after the founder has checked Sent mail (N6-4).

## New issues

Counts: 0 blocker, 1 must-fix, 3 should-fix, 1 nice.

### Must-fix

- **N6-1. "Every unlinked Mercury row" has no definition that excludes Mercury SAFEs already on the page.**
  README line 93, line 201 and line 527 hold out "every unlinked Mercury row" from every total while any Draft awaits.
  In a space connected to Mercury, every Mercury SAFE that was not made by the hand-off is unlinked (it has no native
  Draft), including funded ones. Read literally, sending one new SAFE would remove an existing Funded $250,000 from
  the round bar's Funded figure until the Draft resolves, and the Link dialog (line 562, "lists those Mercury rows")
  would list every Mercury SAFE. The mockup draws it the other way (Lakeside and Priya count as Funded $450k, the
  dialog lists only D. Whitfield), so the plan and the mockup disagree and only the mockup is sensible. Define a
  candidate: a Mercury row first synced after the awaiting Draft was created, with no link and no native counterpart.
  Hold out and list only candidates; everything already synced counts by its Mercury status. Add a test: a Funded
  Mercury row present before the Draft keeps counting.

### Should-fix

- **N6-2. An unrelated candidate stays held out with no cue, and an abandoned Draft holds out every later Mercury SAFE
  indefinitely.** Even with N6-1 fixed, a new Mercury SAFE from a different investor (the founder sent it straight
  from Mercury) is muted and uncounted while any Draft awaits. The only exit is to link, cancel or delete a Draft the
  founder may have forgotten (the Draft is made on click, before anything is sent in Mercury, so closing the Mercury tab
  leaves it awaiting). Two small fixes, no new surface: (a) an awaiting Draft stops awaiting after a fixed number of
  days (the plan already uses 14 days for "sent and unsigned"), after which candidates count normally; (b) the held-out
  row's amount reads as not counted by using the pipeline's dash style rather than the Draft's muted style, or its
  sub-line carries the existing word "Draft" reference ("Waiting for Dana Whitfield's Draft") only on a held-out row.
  Choose one cue; the justification for any copy is that the number is otherwise unexplained.
- **N6-3. The Updates row for an Unknown recipient is unspecified.** Line 415 says a Partly sent row "names the failed
  recipient in its sub-line"; `mock-inv-partly` shows "Tom Okafor failed". For an Unknown recipient "failed" is false
  (the mail may have gone), and the Retry that the Updates row offers opens a question that is drawn only inside the
  editor (`mock-ed-unknown`). State the sub-line for Unknown (reuse the editor's word: "Tom Okafor unknown") and say
  whether the resend question appears as the same footer in the editor or inline on the row. When both Failed and
  Unknown exist, say which one the sub-line names or that it names the count.
- **N6-4. Partly sent has no way to end after the founder confirms delivery.** Unknown exists so the founder can check
  Sent mail, but after checking there is no action to record "it arrived". The chip stays Partly sent and its Retry stays
  on the Updates row and in Action items' neighbor lists indefinitely; the only actions are Retry (a possible duplicate
  email) or Duplicate and Delete. A founder who verified delivery is left with a permanent warning on the update they
  just sent. Cheapest fix: let Done in the Partly sent footer, when only Unknown recipients remain, record them as
  Sent, with no new button; or add "Mark as delivered" to the Unknown row's own menu.

### Nice

- **N6-5. Footer count edge cases.** README line 471 and `mock-ed-nogmail` define "Notifies 4 investors". Not stated:
  one investor ("Notifies 1 investors" if built from a template) and zero (the Post button would then notify nobody; the
  line should be absent, as the round-5 suggestion said). Add both to the slice 6 tests.

## Already minimal

- Type the cap table in, audit request, portal on a phone, and the no-Gmail editor (Subject, Body, footer line, Connect
  Gmail, one filled Post to portal): no removable element.
- Round-bar arithmetic and Pending/Committed vocabulary: unchanged and consistent once N6-1 defines the candidates.
- No new persistent element or view was added in round 5; every new view is a state of a control a journey already uses.

## Round 6 resolution

| Id | Resolution |
|----|------------|
| N6-1 | Fixed. README Glossary now holds the one SAFE counting rule: candidates are Mercury rows first synced after the awaiting Draft and not linked; earlier rows always count. Other sections refer to it. Slice 10 tests added (older funded SAFE keeps counting, no merge into an existing funded SAFE). |
| N6-2 | Fixed. Awaiting ends after 14 days (`awaitingUntil`); held-out rows show a struck-through amount and "Not counted until linked", distinct from the muted Draft amount (`mock-fundraising`). |
| N6-3 | Fixed. Updates row names "<name> unknown" (never "failed"); with several, a count, failed first. Retry asks the resend question for Unknown only (`mock-inv-partly`). |
| N6-4 | Fixed. "Mark delivered" in the row menu and the editor footer records Unknown recipients as Sent and clears Partly sent when nothing failed (`mock-ed-unknown`). |
| N6-5 | Fixed in plan. "Notifies 1 investor" / "Notifies N investors"; line absent at 0; slice 6 tests added. Not drawn. |
