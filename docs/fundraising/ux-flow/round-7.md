# UX Flow Critique, Round 7: Investors and Fundraising (planned) — 2026-10-20

Evidence: `docs/fundraising/README.md` (Glossary line 103, Updates lines 431 to 438, editor lines 485 to 508, Fundraising
lines 565), `mockup.html` rows at lines 371, 452, 463 to 471, 554, and light screenshots in
`docs/fundraising/ux-flow/screens/` (opened: `mock-ed-unknown`, `mock-fundraising`, `mock-inv-partly`). Nothing is
built or run. `mock-inv-partly` shows the cap table only at 1400px; the Updates row is checked in the HTML (line 371).

## Round-6 verification

- N6-1 confirmed. In `mock-fundraising` Lakeside and Priya count as Funded $450k, and only the new D. Whitfield row is
  held out. Pending $150k is Ravi $50k plus Dana $100k, and the held-out $100k is not in it.
- N6-2 confirmed. D. Whitfield shows a struck-through $100,000 and "Not counted until linked" in amber, visibly different
  from Dana's muted Draft amount. The 14-day end of awaiting is in the plan (line 103).
- N6-3 confirmed in the plan and HTML (line 371 "Tom Okafor unknown"; Retry asks the resend question). The wording
  itself is a new finding, N7-1.
- N6-4 confirmed. `mock-ed-unknown` shows "Mark delivered" in the footer beside Cancel and Send again, and the row menu
  has it (HTML line 371). Plan line 438 defines the Failed-remaining case (stays Partly sent).
- N6-5 confirmed in the plan (lines 485 and 486); not drawn, which is acceptable.

No round-6 item is unfixed.

## Your specific questions

- "Not counted until linked" with a struck-through amount: understandable. The strike-through plus the amber sub-line
  reads as "this number is not in the totals", and the round bar visibly excludes it. Weak point: the row itself has
  no link (plan line 565, "A Mercury row has no link"), so "until linked" points to the Draft row two lines below. In
  the mockup the two rows are adjacent, so a founder finds it. With many SAFEs they may not (N7-3, nice).
- Mark delivered discoverable: yes for the path that matters. The primary row button is Retry, Retry opens the question,
  and the question carries Mark delivered. The row menu is a second route. Safe: it needs a deliberate click and is the
  honest outcome after the founder checks Sent mail. It cannot be undone, which is acceptable because Duplicate exists
  (N7-2, nice).
- Unknown wording on the Updates row: the editor's "Unknown — check Sent mail" is clear. The Updates row's
  "Tom Okafor unknown" is not (N7-1).
- Notify footer "Notifies 4 investors": clear and sits where Saved would be. No finding.

## Friction scorecard

| Journey | Steps (planned / ideal) | Needless decisions | Re-entry | Dead ends | Verdict |
|---------|-------------------------|--------------------|----------|-----------|---------|
| Type the cap table in | 3 + 1 row per holder / same | 0 | 0 | 0 | minimal |
| Monthly update, Gmail | 5 / 4 | 0 | 0 | 0 | acceptable |
| Monthly update, no Gmail | 4 / 4 | 0 | 0 | 0 | minimal |
| Investor opens portal on phone | 2 taps / 1 | 0 | 0 | 0 | acceptable (decision 5) |
| Audit request | 3 to 4 / 3 | 0 | 0 | 0 | minimal |
| Send SAFE from a committed prospect | 1 click, Mercury, back, link only on a mismatch / same | 0 | 0 | 0 | acceptable |
| Six-week round end to end | 2 clicks per stage move | 0 | 0 | 0 | acceptable |

Redundancy and IA: nothing new. No view was added; Mark delivered reuses an existing footer and row menu. Pipeline,
SAFEs table and round bar state each figure once.

## New issues

Counts: 0 blocker, 0 must-fix, 1 should-fix, 2 nice.

### Should-fix

- **N7-1. "Tom Okafor unknown" on the Updates row reads as an unknown person.** Plan line 431 and `mockup.html` line
  371 put the bare word "unknown" after a name, in amber, with no verb or noun. "failed" parses as a status; "unknown"
  parses as a description of Tom. The editor has the missing context ("Unknown — check Sent mail"); the row does not,
  and the founder who reads only the row cannot tell what to check. Change the row text to "Tom Okafor: delivery
  unknown" (count form: "2 deliveries unknown"). It adds two words and removes the misreading; update the plan line,
  the HTML row and the slice 6 test string.

### Nice

- **N7-2. Mark delivered sits beside Cancel in a question that asks "Send again?".** `mock-ed-unknown`: two buttons
  mean "do not send" (Mark delivered records Sent, Cancel leaves Partly sent) and the difference is not stated. It is
  usable because the founder chooses deliberately; the row menu also has it. If changed, the question could read "May
  already be delivered." with the buttons Mark delivered and Send again, and Cancel as the close.
- **N7-3. The held-out row names no cause.** "Not counted until linked" is on D. Whitfield; the link is on Dana
  Whitfield's Draft. A sub-line of "Not counted until linked to Dana Whitfield's Draft" would help only when several
  Drafts await; skip until that is seen.

## Already minimal

- Type the cap table in, audit request, portal on a phone, no-Gmail editor, and the Send SAFE hand-off: no removable
  element found.
- Round-bar arithmetic, Pending and Committed vocabulary, and the notify footer: consistent between plan, mockup and
  toast.

## Round 7 resolution

| Id | Status | Resolution |
|---|---|---|
| N7-1 | Fixed | Updates row reads "Tom Okafor: delivery unknown" / "<n> deliveries unknown" in plan and mockup (`mock-inv-partly`). |
| N7-2 | Fixed | The "Send again?" prompt has Mark delivered and Send again, plus a close icon; no Cancel (`mock-ed-unknown`). |
| N7-3 | Obsolete | The held-out row no longer exists (founder decision 2026-10-21). |
