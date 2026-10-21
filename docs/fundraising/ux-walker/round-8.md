# UX walk, round 8: Investors and Fundraising mockup

Target: `docs/fundraising/mockup.html` (56 views, invented data). Session `ux-walker-fundraising-r8` (agent-browser), 1400 px and 390 px, full-page screenshots, 112 files in `docs/fundraising/ux-walker/round-8/<journey>/<view>-<d|p>-<theme>.png` (I checked each file's pixel width: 56 at 1400, 56 at 390). Dark: monthly-update (20 views), portal (6), audit (2). Light: cap-table (10), send-safe (8), round (10). Report only; nothing edited, committed or filed.

Method: geometry audit (`geometry-audit.js`), a tap-target scan (every visible a, button, select, input, textarea under 44 px) and text extraction for all 112 states. I opened by eye every Send SAFE and round view at both widths (18 send-safe files, 20 round files) plus cap-table: investors (both), typed-in (both), not-saved, first-read-failed, changed-elsewhere and empty (phone); monthly update: editor (desktop), unknown outcome (phone); portal home and email (phone); audit show-done (phone). The other files were checked by measurement and text only. Desktop captures stop at the 900 px viewport because the app scrolls inside its own container.

## Result

Round-7 items not actually fixed: none open (round 7 had no findings; its change, the Waiting for Mercury hand-off, is confirmed in place, see below).
New findings: 0 blocker, 0 must-fix, 0 should-fix, 1 nice.

## Round 7 resolution check

| Item | Result | Evidence |
|---|---|---|
| Send SAFE with Mercury shows "Waiting for Mercury" on the prospect, no Draft or held-out row | Confirmed | `send-safe/safe-mercury-d-light.png`: Ravi Mehta "Waiting for Mercury . Oct 20", no Send SAFE button, SAFEs list has only Lakeside, Priya, Harbor. Prospect row wraps to three lines at 390 px but does not clip. |
| Waiting row menu offers Not sent | Confirmed | `send-safe/fund-waitmenu-d-light.png` and `-p-`: Not sent first, then Move to, Edit prospect. |
| Unmatched Mercury SAFE offers Assign to prospect | Confirmed | `send-safe/safe-assign-d-light.png`, `-p-`: row "D. Whitfield, Oct 19 . Assign to prospect", dialog with picker defaulting to "Dana Whitfield . Waiting for Mercury", Cancel and one filled Assign. Fits at 390 px. |
| Pending $150k in `safe-mercury` vs $250k in `safe-assign` | Confirmed and arithmetic checks | `safe-mercury`: Ravi 50 + Dana 100 = $150k (both waiting, no Mercury SAFE yet). `safe-assign`: Ravi 50 + Dana 100 (waiting) + unmatched Mercury SAFE 100 (Sent) = $250k. The bar segment widens to match (45% / 5% / 25% in the markup). |
| Plan explains the difference | Confirmed | `README.md` Glossary, "SAFE counting rule": "The one way to count the same money twice is an email mismatch: the prospect's check size counts and so does the unmatched Mercury SAFE ... assigning fixes it." Section 2 "Round" and the slice-10 test line repeat the same rule. |
| Prospect counts 8 with Mercury / 7 without | Confirmed | Every Mercury-connected round view reads "8 prospects" with Committed 2 (Ravi, Dana); `fund-nomercury`, `safe-dialog`, `safe-terms` and `fund-noround` / `fund-start` read 7 with Committed 1; `safe-cover` reads 6 after Ravi leaves. `fund-closed` reads 8. |
| No leftover "Link to Mercury SAFE", "Not counted until linked", "Draft for Mercury" | Confirmed | Case-insensitive grep over `mockup.html`, `README.md` and the text of all 112 captured states returns nothing. Remaining "Draft" text is the native (no Mercury) Draft SAFE chip and the Draft update chip, both intended. |

## Numbers and labels (all 56 views)

- Round bar "Funded $450k, Signed $50k, Pending $150k, Target $1M" is identical in every Mercury-connected and no-Mercury view that draws it, except `safe-assign` (Pending $250k, explained above). Funded 450 = Lakeside 250 + Priya 200.
- No-Mercury views: Pending $150k = Ravi 50 + Dana Draft 100 (`fund-nomercury`, `safe-dialog`, `safe-terms`); after Mark sent (`safe-cover`) Ravi becomes a Draft and Pending stays $150k with 6 prospects. The prospect hand-off never counts Ravi twice.
- Send SAFE views agree on $50,000, Oct 20, $10M post-money cap, MFN, Delaware. Each has one filled primary (Send SAFE, Mark sent, Assign); Cancel and primary share one row at 390 px.
- Cap table: 33.0 + 28.0 + 14.0 + 6.0 + 11.0 + 8.0 = 100%; SAFEs 2.5 + 2.0 + 0.5 = 5.0%; fully diluted 10,000,000; equity raised $1.0M; tabs Investors 6, Board 3, Auditors 1 in every view that draws them.
- Monthly update: recipients Elena, Tom, Sam, Priya ticked (4); Marcus "no email" and Nate "revoked" greyed; Unknown row and footer wording consistent with round 7.

## Tap targets and geometry

- 390 px: 46 of 56 phone states have no control under 44 px outside the mock view switcher. The other 10 (editor, share and similar dialogs) list only 18 px checkboxes inside label rows already measured at 44 px, as in round 7.
- No horizontal page overflow in any of the 112 states (scrollWidth equals viewport).
- Remaining geometry hits are the same benign types judged in rounds 6 and 7: `div.tabs`, `div.legend`, `div.cols`, `span.meta`/`span.rel`, and the "..." and Open buttons that the script flags as wrapped on phone but are one line in the screenshots.

## New findings

| Id | Severity | View / evidence | Finding |
|---|---|---|---|
| W8-1 | nice | `README.md` "Send SAFE" (line ~589: "requires the prospect's email (asked for when missing)"); `round/fund-prospect-d-light.png` (Email field is "Optional"); no mockup view | The plan says Send SAFE asks for a missing email because the email drives the Mercury match, but no view shows that prompt, and Add prospect gives no hint that email matters for matching. Plan could say the ask reuses the Edit prospect dialog with Email focused. A spec gap only; the journey is not blocked and the Edit prospect path exists. |

Considered and not raised:
- `safe-assign` shows Pending jump to $250k with no on-screen note that $100k is counted twice. The plan states it, the SAFE row carries the "Assign to prospect" cue, and this was a deliberate founder decision recorded in round 7. Not re-raised because its skip reason still holds.
- Closed round keeps Send SAFE and Pipeline (decided in round 2 and 4); Harbor Angels still shows "awaiting deposit" after Close round, which the close dialog warns about beforehand.

## Round 8 verdict

Zero blocker, zero must-fix, zero new should-fix, one nice (W8-1). By the stop rule the round is clean.

## Round 8 resolution

| Item | Resolution |
|------|------------|
| W8-1 | Fixed. New view `safe-email` ("Send SAFE · Ravi Mehta", Investor email field, Cancel and Send SAFE). Add prospect's Email field now reads "Used to match the SAFE" instead of "Optional". Plan Send SAFE paragraph updated. Re-rendered `mock-safe-email`, `mock-fund-prospect` (light, dark, 1400, 390). |
