# STORY-IF-2: Founder with Gmail and Granola sees both kinds of to-dos (round 3)

**Result: PASS**

Outdated or changed by the plan: Step 2: plan detail for a meeting to-do is '{title}, {date}'; mail rows keep their detail line. Step 4: each account tab lists that account's mail to-dos plus all meeting to-dos (plan S5).

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (commit 156dfe61b), dark theme, 1280x900, plus a 390x844 spot-check. Screenshots in `screenshots/`.

## Steps

- 1 'Mail connected' frame: All and one account tab, a To do card with three meeting to-dos and one mail to-do ('Reply to Dana about the discount tiers', 'Re: Q4 pricing, 9 Oct'), then mail rows. g-d-inbox-mail.png
- 2 Source is told by the detail line only; no icon or label (plan Deliberate choices). g-d-inbox-mail.png
- 4 Account tab: clicking it only changes the selected tab; with one account the list is identical, consistent with the plan rule. Two accounts are not drawn.

Geometry audit (geometry-audit.js, run once per distinct state at 1280x900 and 390x844, other screens hidden): pageOverflowX 0 in every state. wrappedControls: only the 'Get a key in Granola' link at 1280 px (false positive, one line in the screenshot; at 390 px it now sits on its own line above the field with its arrow intact), two-line option rows and the mobile glass back chevron (false positives). overflowSpills: citation Open popover on the desktop frames (popover sits at the frame edge, not clipped at 1280 px). Target sizes measured live: citation chips 32 px tall (were 21-24 px), web to-do checkbox target 32x32, mobile to-do checkbox button 44x44.

**390 px spot-check:** 390x844: card and mail rows fit. g-m-inbox-mail.png

## Flow Log

Ideal 1 action: open Inbox; one list shows mail and meeting to-dos. Actual 1.

## Round-2 findings

| Round-2 id | Status | Evidence |
|---|---|---|
| F2-IF-2-01 | fixed | The Mail connected frame mixes meeting and mail to-dos in one card (g-d-inbox-mail.png). |

## New findings (round 3)

- **F3-IF-2-01** (low, mockup): Only one account tab is drawn, so the plan rule 'each account tab lists that account's mail to-dos plus all meeting to-dos' cannot be seen working with two accounts. Fix: Add a second account tab to the 'Mail connected' frame, or state the rule in the mockup caption.
