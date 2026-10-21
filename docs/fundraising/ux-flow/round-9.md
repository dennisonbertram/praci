# UX Flow Critique, Round 9: Investors and Fundraising (planned) — 2026-10-21

Evidence: `docs/fundraising/README.md` (Glossary SAFE counting rule lines 98 to 127, Fundraising items 3 and 4 lines
574 to 592, Send SAFE lines 595 to 614, slice 10 tests lines 1105 to 1109), `mockup.html` lines 557, 562, 572, 578, and
light screenshots in `docs/fundraising/ux-flow/screens/` (opened: `mock-fund-mercmenu`, `mock-fund-unmenu`,
`mock-fund-unmenu-phone`, `mock-fund-waitmenu`, `mock-safe-email`). Nothing is built or run.

## Round-8 verification

- N8-1 confirmed. `mock-fund-waitmenu` shows Open Mercury, Not sent, Passed and (below the cut) Edit prospect, with no
  Move to. Plan lines 118 to 122, 581 and 1109 agree.
- N8-2 confirmed. The sentence about pressing Send SAFE again is gone; plan lines 603 to 604 say Open Mercury is the
  way back.
- N8-3 left as is with a reason; the reason holds.

No round-8 item is unfixed.

## The round-8 additions, against what the journeys need

The journeys that touch these menus are Send SAFE from a committed prospect and the six-week round. In both, the normal
path is: click Send SAFE, finish in Mercury, the next sync attaches the SAFE by email, nothing else to do. Everything
below is for the exceptions.

| Item | Needed by a core journey? | Verdict |
|------|---------------------------|---------|
| Waiting menu (Open Mercury, Not sent, Passed, Edit prospect) | Open Mercury: yes, the only route back to Mercury. Not sent: yes, the only undo, since the row has no Send SAFE button. Passed and Edit prospect: same as every pipeline row. | Minimal. Nothing to merge or remove. |
| Assign to contact (sub-line link, and menu item) | Yes, the one fix for an email mismatch (`mock-fund-unmenu`). The link and the menu item run the same dialog; this is an accelerator, not drift. | Keep. |
| Unassign | Yes, undoes a wrong Assign. | Keep. |
| Change contact | No. It is Unassign followed by Assign to contact; the plan itself defines it that way ("the old one is restored as for Unassign", line 113). | Remove (N9-1). |
| Not from pipeline | Not on a journey. It serves a SAFE whose investor is not a contact. | Keep, but see N9-2. |
| Send SAFE email prompt | Yes, but only when the prospect has no email, and it is the only prompt on the path. One field, one button, Cancel. | Keep. |
| "Used to match the SAFE" | One phrase, in the placeholder of the two email fields (`mockup.html` lines 572 and 578). It is the only text that tells the founder why the field is asked for, and it is only seen when the field is empty. | Keep. It meets the copy rule: it removes a question the founder would otherwise ask, and it disappears once typed over. |

## New issues

Counts: 0 blocker, 0 must-fix, 1 should-fix, 1 nice.

### Should-fix

- **N9-1. Change contact duplicates Unassign plus Assign to contact.** `mock-fund-mercmenu` shows an attached Mercury
  row with Open, Change contact and Unassign. After Unassign the row has no contact and offers Assign to contact (link
  and menu item, `mock-fund-unmenu`), so the same result takes two short steps with menus that already exist. Change
  contact adds a menu item, a picker state ("pick a different contact"), a restore rule and a slice 10 test (plan lines
  112 to 114, 1106, 1109) for a case that only occurs after a mistaken Assign, which is itself the rare path. It is a
  second route to one goal (heuristic 13). Remove it: an attached Mercury row's menu becomes Open and Unassign, and the
  plan's "assign to the wrong contact, then Change contact moves it" test becomes "then Unassign and Assign again". Edit
  the Glossary lines 112 to 114, Fundraising item 4 (line 591), slice 10 tests, and `mockup.html` line 557.

### Nice

- **N9-2. Not from pipeline is only needed when the investor is not a contact.** Assign to contact already lists
  investors, and assigning an existing investor's SAFE to that investor also stops the prompt and counts normally
  (plan lines 107 to 111). The extra menu item matters only for a SAFE whose investor has no contact record. This is
  a small, reversible item that is only seen on an unassigned row, so keep it; revisit only if the cap table import
  makes every existing investor a contact, in which case it can go.

## Friction scorecard

| Journey | Steps (planned / ideal) | Needless decisions | Re-entry | Dead ends | Verdict |
|---------|-------------------------|--------------------|----------|-----------|---------|
| Type the cap table in | same as round 8 | 0 | 0 | 0 | minimal |
| Monthly update | same as round 8 | 0 | 0 | 0 | acceptable / minimal |
| Investor opens portal on phone | same as round 8 | 0 | 0 | 0 | acceptable |
| Audit request | same as round 8 | 0 | 0 | 0 | minimal |
| Send SAFE from a committed prospect (Mercury) | 1 click, Mercury, return; email prompt only when missing; Assign only on mismatch / same | 0 | 0 | 0 | minimal |
| Six-week round end to end | same as round 8 | 0 | 0 | 0 | acceptable |

Redundancy and IA: Waiting for Mercury, Not sent, Assign to contact, Unassign and Not from pipeline each appear once in
the Glossary and keep the same name in plan, mockup and tests. The only overlap found is N9-1.

## Already minimal

- The Waiting for Mercury row and its four-item menu.
- The Send SAFE email prompt and its one-phrase hint.
- Assign to contact and Unassign as the pair that handles every mismatch.

## Round 9 resolution

| Id | Resolution |
|----|------------|
| N9-1 | Fixed. Change contact removed from the Glossary rule, Fundraising item 4, slice 10 tests, `mockup.html` `fund-mercmenu` (menu is Open and Unassign) and the stories. A wrong match is fixed by Unassign then Assign to contact. Re-rendered `mock-fund-mercmenu` (light, dark, 1400, 390). |
| N9-2 | Left as is, as the report advised. |
