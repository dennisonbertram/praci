# UX walk, round 9: Investors and Fundraising mockup

Target: `docs/fundraising/mockup.html` (59 views, invented data). Session `ux-walker-fundraising-r9` (agent-browser), 1400 px and 390 px, full-page screenshots, 118 files in `docs/fundraising/ux-walker/round-9/<journey>/<view>-<d|p>-<theme>.png` (59 at 1400 px wide, 59 at 390 px wide, pixel widths checked). Light: monthly update (20 views), portal (6), audit (2). Dark: cap table (10), send SAFE (11), round (10). Report only; nothing edited, committed or filed.

Method: geometry audit (`geometry-audit.js`) on all 118 states, plus a scan of every visible card (`.card`) against the 16 to 374 px rule at 390 px, a tap-target scan, and text extraction for every state. I opened by eye all 22 send SAFE and 20 round captures at both widths (every send SAFE and round view, including `safe-email`, `fund-unmenu`, `fund-mercmenu`, `fund-waitmenu`, `safe-assign`), plus cap table `investors` (both widths), `inv-native` (both), `inv-notsaved` (phone), `empty` (phone); monthly update `editor` (desktop), `ed-unknown` and `inv-partly` (phone); portal home and email (phone); audit show-done (phone). The remaining files were checked by measurement and text only. Desktop captures stop at the 900 px viewport because the app scrolls inside its own container.

## Result

Round-8 items not actually fixed: none. W8-1 is fixed as claimed (see below).
New findings: 0 blocker, 0 must-fix, 0 should-fix, 1 nice.

## Round 8 resolution check

| Item | Result | Evidence |
|---|---|---|
| W8-1: Send SAFE asks for a missing email, shown in a view | Confirmed | `send-safe/safe-email-d-dark.png` and `-p-dark.png`: dialog "Send SAFE . Ravi Mehta", one field "Investor email" (placeholder "Used to match the SAFE"), Cancel and one filled Send SAFE. Fits at 390 px, buttons share one row. |
| Add prospect Email hint | Confirmed | `round/fund-prospect-d-dark.png`, `-p-dark.png`: Email placeholder reads "Used to match the SAFE" (no longer "Optional"). |
| "Assign to contact" everywhere, no "Assign to prospect" | Confirmed | Case-sensitive grep: "Assign to prospect" appears 0 times in `mockup.html` and 0 times in `README.md`. In the rendered text of all 118 states the only variant found is "Assign to contact" (`safe-assign` dialog title and SAFE row link, `fund-unmenu` row link and menu item). |
| New views `fund-unmenu`, `fund-mercmenu` | Confirmed | `fund-unmenu`: unassigned D. Whitfield row, menu Open, Assign to contact, Not from pipeline. `fund-mercmenu`: attached Lakeside row, menu Open, Change contact, Unassign. Both match README lines 111 to 114 and 591. |
| `fund-waitmenu` menu | Confirmed, matches plan | Open Mercury, Not sent, Passed, then Edit prospect after a divider; README line 1109 says the same. (Round 8 listed "Move to"; the plan and mockup now agree on Passed.) |

## Numbers and labels (all 59 views)

Round bar, read from the rendered legend with a delay after each hash change:
- Mercury views (`fundraising`, `fund-roundmenu`, `fund-editround`, `fund-stage`, `fund-prospect`, `fund-safemenu`, `fund-mark`, `fund-mercmenu`, `safe-email`, `fund-waitmenu`, `fund-close`, `safe-mercury`, `fund-sync`): Funded $450k, Signed $50k, Pending $150k, Target $1M.
- `safe-assign` and `fund-unmenu` (unmatched $100k Mercury SAFE present): Pending $250k, the documented double count (Dana's $100k check size plus the unmatched SAFE). `fund-mercmenu` is correctly back at $150k because that row is attached.
- No-Mercury views (`fund-nomercury`, `safe-dialog`, `safe-terms`, `safe-cover`): Pending $150k (Ravi 50 plus Dana Draft 100). `fund-noround`, `fund-start`, `fund-closed` draw no bar.
- Prospect counts: 8 in every Mercury view with a round (including `safe-mercury`, `safe-email`, `fund-unmenu`, `fund-mercmenu`, `fund-sync`, `fund-closed`); 7 in `safe-dialog`, `safe-terms`, `fund-nomercury`, `fund-noround`, `fund-start`; 6 in `safe-cover`. Consistent with round 8.
- Send SAFE views agree on $50,000, Oct 20, $10M post-money cap, MFN, Delaware; each has one filled primary.
- Cap table: 33.0 + 28.0 + 14.0 + 6.0 + 11.0 + 8.0 = 100%; SAFEs 2.5 + 2.0 + 0.5 = 5.0%; fully diluted 10,000,000; equity raised $1.0M; tabs Investors 6, Board 3, Auditors 1 in all views that draw them.
- Monthly update: Elena, Tom, Sam, Priya ticked; Marcus "no email" and Nate "revoked" greyed; unknown-outcome wording consistent with round 7.

## Cards at 390 px

All 220 visible card instances across the 59 phone states sit inside the 16 px side gutters and are 16 to 374 px wide; none was flagged. No horizontal page overflow in any of the 118 states (`scrollWidth` equals the viewport). The round-8 V8-1 overflow in `inv-partly` is gone (`inv-partly-p-light.png`, cards inside the gutters).

## Geometry and tap targets

Geometry hits are the same benign types judged in rounds 6 to 8: `div.tabs`, `div.legend`, `div.cols` uneven widths by design; `button.ib "..."`, Open, Retry, Send SAFE, Mark funded flagged as wrapped on phone but one line in the screenshots (checked in `ed-unknown-p-light.png`, `fundraising-p-dark.png`); `span.meta`/`span.rel` spill on `fund-sync`, `inv-failed`, `inv-menu`, `inv-native-menu` at 1400 px (the hidden alternate source chip, not visible in the captures). Controls under 44 px on phone are the 18 px checkboxes inside rows already measured at 44 px, as before.

## New findings

| Id | Severity | View / evidence | Finding |
|---|---|---|---|
| W9-1 | nice | `send-safe/fund-unmenu-p-dark.png`, `safe-assign-p-dark.png` | On the phone SAFE card, the inline link "Assign to contact" starts about 5 px right of the date above it (x about 35 vs 30), and the row grows to three lines. Cosmetic only; the same link is also in the row menu. |

Considered and not raised:
- `fund-unmenu-p`, `fund-safemenu-p` and the round menu on the last SAFE row show only "Open" because the absolutely placed menu runs past the end of the mockup page (menu bottom 1678 px against a 1594 px page). This is ux-visual round 8 N8-1, skipped as a mockup-only clip, and the skip reason still holds; the new menu items "Assign to contact" and "Not from pipeline" are readable at 1400 px.
- Pending $250k in `safe-assign` and `fund-unmenu` is the recorded round-7 decision.
- Harbor Angels "awaiting deposit" after Close round: decided in earlier rounds.

## Round 9 verdict

Zero blocker, zero must-fix, zero new should-fix, one nice (W9-1). By the stop rule the round is clean.

## Round 9 resolution

| Id | Resolution |
|----|------------|
| W9-1 | Fixed in `mockup.html` (phone only): the "Assign to contact" link has no left padding and sits on its own line at the same x as the date (both 29 px). Re-rendered `fund-unmenu` and `safe-assign` phone, light and dark. |
| `fund-mercmenu` menu (noted as Open, Change contact, Unassign) | Now Open and Unassign (flow N9-1). |
