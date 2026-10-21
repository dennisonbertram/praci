# UX Flow Critique, Round 3: Investors and Fundraising (planned) — 2026-10-20

Evidence: `docs/fundraising/README.md` (glossary, Fundraising sections 2 to 4, Data model), the 45 views
in `docs/fundraising/mockup.html` (`VIEWS`), and screenshots in `docs/fundraising/ux-flow/screens/`
(opened: `mock-fundraising`, `mock-safe-mercury`, `mock-safe-cover`, `mock-fund-safemenu`,
`mock-investors`, `mock-inv-reminder`). Nothing is built or run.

## Round-2 verification

All 21 items marked fixed were checked against the plan or the screenshots where a screenshot exists.

- Confirmed: N1 (bar total is unchanged when Send SAFE creates a Draft: `mock-fundraising` shows
  Committed $150k = Ravi $50k + Dana's Draft $100k, and `mock-safe-mercury` shows $150k = Dana $100k +
  Ravi's new Draft $50k, with Ravi leaving the pipeline), N2, N3 ("Mark funded" beside the Finance link),
  N4, N5, N7, N8, N9, N10, N11, N12, N13, N14 (no Carta agent in the sidebar), N15 (`mock-safe-cover` has
  Print and Mark sent), N16 (one filled button per view), N17 to N21.
- N6 is confirmed with the gap the resolution already states: Duplicate and Delete on an Updates row are
  in the plan (README line 374) but not drawn. Nothing is hidden; it is a missing view of a two-item
  menu, so it stays "nice".
- No round-2 item is unfixed.

## Friction scorecard with verdicts

| Journey | Steps (planned / ideal) | Needless decisions | Re-entry | Dead ends | Verdict |
|---------|-------------------------|--------------------|----------|-----------|---------|
| Type the cap table in | 3 + 1 row per holder / same | 0 | 0 | 0 | minimal |
| Monthly update, review and send | 5 / 4 | 0 | 0 | 0 | acceptable (near minimal) |
| Investor opens portal on phone | 2 taps / 1 | 0 | 0 | 0 | acceptable (the extra tap is the decision 5 security cost) |
| Audit request | 3 to 4 / 3 | 0 | 0 | 0 | minimal |
| Send SAFE from a committed prospect | Mercury 1 click then Mercury; native 3 (Send SAFE, Mark sent, then Mark signed and Mark funded later) / 3 | 0 | 0 | 0 | minimal |
| Six-week round end to end | 2 clicks per stage move, no dead ends | 0 | 0 | 0 | acceptable |

Send SAFE moves from acceptable to minimal: the cover summary now carries Mark sent (`mock-safe-cover`), so
the founder no longer leaves the flow for the row menu. Verdicts: 3 minimal, 3 acceptable, 0 convoluted.

Surface check on the 8 views and menus added in round 2 (`inv-reminder`, `inv-contactmenu`, `inv-unblock`,
`inv-share`, `inv-native-menu`, `inv-notsaved`, `inv-auditdone`, `fund-closed` and similar): each is a
state or a menu of a control a journey already uses (Reminder for the monthly update, Resend, Revoke and
Unblock for portal access, Share for documents, Unshare). None adds a persistent element to a page; the
menus are all behind a "…". The pages themselves did not grow: `mock-investors` and `mock-fundraising` have
the same sections as round 2. No surface was added beyond what the journeys need.

## New issues

Counts: 0 blocker, 0 must-fix, 1 should-fix, 1 nice.

### Should-fix

- **R3-1. "Committed" means two different amounts on the Fundraising page.** In `mock-fundraising` the
  Pipeline heading "Committed 1" holds one row, Ravi Mehta $50,000, while the round-bar legend says
  "Committed $150k". The extra $100k is Dana Whitfield's Draft SAFE, which sits in the SAFEs card with a
  "Draft" chip and has no cue that it is also counted in Committed. A founder who adds the Committed rows
  gets $50k and sees $150k. The glossary rule (README line 84) fixes the arithmetic but not the
  recognition: the same word, one inch apart, differs by a Draft that is not promised money. Fix, either
  one: label the bar segment differently from the stage (for example "Pending $150k", with Committed kept
  as the stage name), or give the legend entry a tooltip or one-line sub-text naming what it holds. The
  first needs no new copy. This is not a re-raise of N1: N1 was about money vanishing; this is about the
  fix for N1 making one word carry two sums.

### Nice

- **R3-2. The SAFE row menu lists every status verb on every row.** `mock-fund-safemenu` (Dana's Draft row
  region) shows Open, Mark sent, Mark signed, Mark funded, Link to Mercury SAFE, Cancel SAFE, Delete. The
  plan (README lines 475 to 480) does not say that forward-only verbs are hidden or disabled by status, so
  a Funded row offers Mark sent. State the rule (show only later statuses; Link to Mercury SAFE only on
  rows without a link) so the menu is short on every row.

## Already minimal

- The Committed definition itself, apart from R3-1: Draft and Sent SAFEs staying in the bar means the bar
  total does not move when Send SAFE is clicked (verified by the two screenshots above). The cap table
  keeps Draft out of every figure, with the Draft chip as the explanation (README line 317). That split is
  correct; only the label collides.
- Type the cap table in, audit request, Send SAFE: no removable step or element found.
- Investors and Fundraising page structure: every added view in round 2 is a state or menu, not a section.
- One filled button per view; one status word per row; Attention holds the only "awaiting deposit".
- Mock numbers: Funded $450k + Signed $50k + Committed $150k = $650k against a $1M target; the SAFE group
  2.5% + 2.0% + 0.5% = 5.0% matches the SAFEs card ($250k, $200k, $50k at a $10M cap).

## Round 3 resolution

| Id | Status | Change |
|----|--------|--------|
| R3-1 | fixed | The round-bar segment is now "Pending" (committed-stage prospects without a SAFE plus Draft and Sent SAFEs). "Committed" is only the pipeline stage. Legend in `mockup.html`, README Glossary, Fundraising section, slices 8 and 9 agree. |
| R3-2 | fixed | The SAFE row menu shows only the next valid Mark action for its status, Link to Mercury SAFE only on an unlinked row, Cancel SAFE only on a native row that is not Funded. `fund-safemenu` redrawn for a Draft row. |
