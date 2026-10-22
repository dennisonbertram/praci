# UX walk, round 10: Investors and Fundraising mockup

Target: `docs/fundraising/mockup.html` (59 views, invented data). Session `ux-walker-fundraising-r10` (agent-browser), 1400 px and 390 px, full-page screenshots, 118 files in `docs/fundraising/ux-walker/round-10/<journey>/<view>-<d|p>-<theme>.png` (59 at 1400 px wide, 59 at 390 px wide, pixel widths checked). Dark: monthly update (20 views), portal (6), audit (2). Light: cap table (10), send SAFE (12), round (11). Report only; nothing edited, committed or filed.

Method: geometry audit (`geometry-audit.js`) on all 118 states, a scan of every visible `.card` against the 16 px side gutters at 390 px, page overflow check, and text extraction for every state. I opened by eye every send SAFE view (12) and every round view (11) at both widths (46 captures), plus `link-dead` at both widths. The other journeys were checked by measurement and text only (cap table, monthly update, portal and audit were opened by eye in rounds 8 and 9 and their views did not change).

## Result

Round-9 items not actually fixed: none.
New findings: 0 blocker, 0 must-fix, 0 should-fix, 0 nice.

## Round 9 resolution check

| Item | Result | Evidence |
|---|---|---|
| W9-1: "Assign to contact" link indented on the phone SAFE card | Confirmed | `send-safe/fund-unmenu-p-light.png` and `safe-assign-p-light.png`: the link sits on its own line at the same left edge as the date above it (x about 29 for both). |
| `fund-mercmenu` menu is Open and Unassign (no "Change contact") | Confirmed | `send-safe/fund-mercmenu-d-light.png` and `-p-light.png` show exactly Open and Unassign. `grep -c "Change contact"` returns 0 for `mockup.html` and 0 for `README.md`; the string is also absent from the rendered text of all 118 states. README lines 113, 595 and 1113 describe the same menu (Open, Unassign; fix a wrong match with Unassign then Assign to contact). |
| `fund-unmenu` menu (Open, Assign to contact, Not from pipeline) | Confirmed | `send-safe/fund-unmenu-d-light.png`. On the phone capture the menu runs past the end of the mockup page and only "Open" shows (the known ux-visual N8-1 mockup-only clip; skip reason still holds). |
| "Assign to contact" is the only variant | Confirmed | 126 occurrences in rendered text, 0 of "Assign to prospect". |

## Numbers and labels (all 59 views)

- Round bar in every view that draws one: Funded $450k, Signed $50k, Target $1M. Pending is $150k everywhere except `safe-assign` and `fund-unmenu`, which show $250k (the recorded round-7 decision: unmatched $100k Mercury SAFE plus Dana's $100k check size). `fund-mercmenu` is back at $150k because that row is attached. `fund-noround`, `fund-start`, `fund-closed` draw no bar; `fund-closed` says "Closed Oct 20 . funded $450k", matching Lakeside $250k plus Priya $200k.
- Prospect counts: 8 in Mercury views with a round, 7 in `safe-dialog`, `safe-terms`, `fund-nomercury`, `fund-noround`, `fund-start`, 6 in `safe-cover`. Same as round 9.
- Send SAFE views agree on $50,000, Oct 20, $10M post-money cap, MFN, Delaware, and each has one filled primary button (Send SAFE, Mark sent, Assign, or Save as appropriate). The email dialog (`safe-email`) has the single field "Investor email" with placeholder "Used to match the SAFE", also used in Add prospect.
- Cap table (all views that draw it): 33.0 + 28.0 + 14.0 + 6.0 + 11.0 + 8.0 = 100%; founders 61.0%; SAFEs 2.5 + 2.0 + 0.5 = 5.0%; 10,000,000 fully diluted; $1.0M raised; tabs Investors 6, Board 3, Auditors 1.
- Monthly update, portal and audit text matches round 9 (Cash $1.13M for the October draft, $1.21M for the September portal update; Elena, Tom, Sam recipients; "Unknown - check" wording unchanged).

## Cards, overflow, geometry

- 0 cards outside the 16 to 374 px gutters at 390 px; `scrollWidth` equals the viewport in all 118 states (no horizontal overflow).
- Geometry hits are the same benign types judged in rounds 6 to 9: tab, legend and column rows with uneven widths by design; 12 short controls (Mark funded, Send SAFE, "..." buttons, "Find in Finance", the Mercury chip) flagged as wrapped on phone but on one line in every screenshot I opened; `span.meta`/`span.rel` spill on `fund-sync` and the cap-table source menus at 1400 px (hidden alternate source chip, not visible in the captures).
- Phone captures of dialogs show the dimmed backdrop ending at 844 px, because the mockup overlay is viewport-high and the capture is full-page; a screenshot artifact, not a design defect.

## Considered and not raised

- `fund-safemenu-p` and `fund-unmenu-p` menus clipped at the bottom of the mockup page: N8-1, skipped.
- `fund-mercmenu-d` menu overlays the amounts of the rows beneath it: expected for a popover.
- Harbor Angels staying in Attention after Close round and the Pending $250k double count: decided in earlier rounds.
- Send SAFE is filled in Mercury rounds and outlined in `fund-noround` and `fund-closed`, where Start a round is the primary: consistent with one primary per screen.

## Round 10 verdict

Zero blocker, zero must-fix, zero new should-fix, zero nice. By the stop rule the round is clean.
