# UX Flow Critique, Round 10: Investors and Fundraising (planned) — 2026-10-21

Evidence: `docs/fundraising/README.md` (Glossary lines 95 to 131, Fundraising items 3 and 4 lines 570 to 600, Send SAFE
lines 603 to 615, slice 10 tests lines 1110 to 1113), `mockup.html` lines 558 and 699, and light screenshots in
`docs/fundraising/ux-flow/screens/` (opened: `mock-fund-mercmenu`, `mock-fund-mercmenu-phone`, `mock-fundraising`).
Nothing is built or run.

## Round-9 verification

- N9-1 confirmed. `grep -i "change contact"` finds nothing in `README.md` or `mockup.html`. The attached Mercury row
  menu is Open and Unassign in the plan (Glossary line 113, Fundraising item 4 line 595) and in the mockup (line 558).
  `mock-fund-mercmenu` (1400 px) and `mock-fund-mercmenu-phone` (390 px) show exactly those two items. The wrong-match
  route is written the same way in each place: Unassign, then Assign to contact.
- N9-2 left as is with a reason; the reason holds.

No round-9 item is unfixed.

## New findings

Counts: 0 blocker, 0 must-fix, 0 should-fix, 0 nice.

Checked and found consistent:

- Round bar arithmetic on `mock-fundraising`: Funded $450k (Lakeside $250k plus Priya $200k), Signed $50k (Harbor
  Angels), Pending $150k (Ravi $50k plus Dana $100k, the two Committed rows, Dana Waiting for Mercury), target $1M.
  Pipeline "8 prospects" matches seven visible rows plus Passed 1.
- Names are the same across plan, mockup and menus: Waiting for Mercury, Open Mercury, Not sent, Assign to contact,
  Unassign, Not from pipeline.
- On a phone the attached-row menu stays inside the viewport and shows two items only.

## Friction scorecard

| Journey | Steps (planned / ideal) | Needless decisions | Re-entry | Dead ends | Verdict |
|---------|-------------------------|--------------------|----------|-----------|---------|
| Type the cap table in | same as round 9 | 0 | 0 | 0 | minimal |
| Monthly update | same as round 9 | 0 | 0 | 0 | acceptable / minimal |
| Investor opens portal on phone | same as round 9 | 0 | 0 | 0 | acceptable |
| Audit request | same as round 9 | 0 | 0 | 0 | minimal |
| Send SAFE from a committed prospect | same as round 9 | 0 | 0 | 0 | minimal |
| Six-week round end to end | same as round 9 | 0 | 0 | 0 | acceptable |

Redundancy and IA: no duplicate path, duplicate fact or overlapping feature found beyond items already resolved or
deliberately skipped in earlier rounds.

## Verdict

Zero blocker, zero must-fix, zero new should-fix. The loop can stop on this report.
