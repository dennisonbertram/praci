# UX Flow Critique, Round 8: Investors and Fundraising (planned) — 2026-10-21

Evidence: `docs/fundraising/README.md` (Glossary lines 98 to 118, Updates 436 to 448, editor 509 to 521, Fundraising
530 to 601, slices 9 and 10), `mockup.html` lines 373, 462 to 476, 526 to 528, and light screenshots in
`docs/fundraising/ux-flow/screens/` (opened: `mock-fundraising`, `mock-safe-mercury`, `mock-safe-assign`,
`mock-fund-safemenu`, `mock-ed-unknown`, `mock-ed-unknown-phone`, `mock-inv-partly`, `mock-inv-partly-phone`). Nothing is
built or run.

## Round-7 verification

- N7-1 confirmed. The Updates row reads "Tom Okafor: delivery unknown" (`mockup.html` line 373, `mock-inv-partly-phone`);
  the plan (line 441) matches. No misreading as an unknown person remains.
- N7-2 confirmed. `mock-ed-unknown` and its phone version show "May already be delivered. Send again?" with Mark
  delivered, Send again and a close icon, and no Cancel. The plan (lines 515 and 518) says the same.
- N7-3 confirmed obsolete. `mock-fundraising` has no held-out row.

No round-7 item is unfixed.

## The Mercury model, compared with the removed Draft design

Simpler for the founder: yes. Send SAFE is one click that opens Mercury. There is no Draft SAFE row to find, mark sent
or reconcile with the Mercury SAFE, and the round bar does not change when the button is clicked (`mock-safe-mercury`:
Pending $150k before and after). The prospect row keeps its place and gains one sub-line. The only decision left is
"link by email, or Assign to prospect when the email differs", and that appears only on a mismatch.

Leftovers from the Draft design in the Mercury path: none found. "Draft" now exists only for native SAFEs without
Mercury (plan lines 94, 376, 547, 592 to 601), which is deliberate (founder decision 8 covers Mercury only). The slice 9
test line 1064 ("turns a committed prospect into a Draft") is the native path and is correctly scoped by slice 10.

`mock-safe-assign` shows the one double-count the plan accepts: Dana Waiting at $100k plus the unmatched D. Whitfield
$100k Sent row gives Pending $250k. The Assign link in the SAFE sub-line is the fix and the picker preselects
"Dana Whitfield · Waiting for Mercury". Clear.

## Friction scorecard

| Journey | Steps (planned / ideal) | Needless decisions | Re-entry | Dead ends | Verdict |
|---------|-------------------------|--------------------|----------|-----------|---------|
| Type the cap table in | same as round 7 | 0 | 0 | 0 | minimal |
| Monthly update, Gmail / no Gmail | 5 / 4, 4 / 4 | 0 | 0 | 0 | acceptable / minimal |
| Investor opens portal on phone | 2 taps / 1 | 0 | 0 | 0 | acceptable |
| Audit request | 3 to 4 / 3 | 0 | 0 | 0 | minimal |
| Send SAFE from a committed prospect (Mercury) | 1 click, Mercury, return; Assign only on mismatch / same | 0 | 0 | 0 to 1 (N8-2) | acceptable |
| Six-week round end to end | 2 clicks per stage move | 0 | 0 | 0 | acceptable (N8-1) |

Redundancy and IA: nothing new. Waiting for Mercury, Not sent and Assign to prospect each appear once in the Glossary and
are used with the same names in plan, mockup and slice 10 tests.

## New issues

Counts: 0 blocker, 0 must-fix, 1 should-fix, 2 nice.

### Should-fix

- **N8-1. A Waiting for Mercury prospect can be moved out of Committed, and the plan does not say what then counts.**
  `mockup.html` line 528 (view `fund-waitmenu`) gives the Waiting row the full "Move to" list (Target, Intro, Meeting,
  Diligence, Passed). Pending counts "Committed-stage prospects that have no SAFE (including those Waiting for Mercury)"
  (plan line 547). A founder who has sent the SAFE and then moves Dana to Diligence removes $100k from Pending while the
  row still reads Waiting for Mercury, and the SAFE is not yet synced, so the round bar under-counts a sent SAFE until
  attach. Either define it (a Waiting prospect counts at its check size in any stage, or the Waiting row's menu offers only
  Not sent, Passed and Edit prospect), or accept the under-count in writing. Simplest: remove Target, Intro, Meeting and
  Diligence from the Waiting row menu; Not sent already returns the row to normal, after which Move to works. Update the
  plan (Fundraising item 3 and Glossary), `mockup.html` line 528 and the slice 10 test.

### Nice

- **N8-2. Plan line 591 describes a control that does not exist.** "Pressing it again on a waiting prospect only
  refreshes `mercurySentAt`", but the Waiting row has no Send SAFE button (`mock-safe-mercury`, `mock-fund-waitmenu`).
  A founder who closed the Mercury tab has no way back to Mercury from the row; the only route is Not sent, then Send
  SAFE. That is two clicks and discoverable, so not a must-fix. Delete the sentence, or put an "Open Mercury" item in
  the Waiting row menu if the return trip matters.
- **N8-3. The filled button in the "Send again?" prompt is the risky one.** `mock-ed-unknown`: Send again is filled and
  Mark delivered is outline, while the plan's own reasoning (line 516) is that a duplicate email is worse than a click and
  the founder was told to check Sent mail first. Equal weight for both buttons would match the intent. Also, Retry is
  per recipient, but "Mark delivered" and "Send again" act on all Unknown recipients (plan lines 515 and 518); with two
  Unknown recipients the prompt does not name them. Only seen after a process restart, so rare; skip unless two Unknown
  recipients is seen in practice.

## Already minimal

- Mercury hand-off (one button, no draft row, bar unchanged), Assign to prospect dialog (one picker, preselected match),
  "delivery unknown" wording, and the Send again / Mark delivered prompt (clear text, no Cancel, close icon).
- Type the cap table in, audit request, portal on a phone: no removable element found.

## Round 8 resolution

| Item | Resolution |
|------|------------|
| N8-1 | Fixed. The Waiting for Mercury row menu is now Open Mercury, Not sent, Passed, Edit prospect (no Move to), so a waiting prospect never leaves Committed. README Glossary, Fundraising item 3, slice 10 test and `mockup.html` `fund-waitmenu` updated. |
| N8-2 | Fixed. The sentence about pressing Send SAFE again is removed; Open Mercury in the Waiting row menu is the way back. |
| N8-3 | Left as is. Both defaults carry a risk (duplicate email, or an investor who never got the update); Send again completes delivery. Reason added to the plan next to the prompt text. |
