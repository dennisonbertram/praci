# UX walk, round 6: Investors and Fundraising mockup

Target: `docs/fundraising/mockup.html` (55 views, invented data). Session `ux-walker-fundraising-r6` (agent-browser), 1400 px and 390 px, full-page screenshots, 110 files in `docs/fundraising/ux-walker/round-6/<journey>/<view>-<d|p>-<theme>.png`. Dark: monthly-update (19), portal (6), audit (2). Light: cap-table (10), send-safe (6), round (12). Report only; nothing edited, committed or filed.

Method: geometry audit (`geometry-audit.js`), a tap-target scan (every visible a, button, select, input, textarea under 44 px at 390 px), and text extraction of every view at both widths. I opened by eye every Send SAFE view at desktop and phone (12 screenshots), all 12 round views at desktop, and from the other journeys: editor, ed-unticked, ed-sending, ed-failed, ed-nogmail, ed-unknown, ed-boardnog, inv-posted (desktop), editor, ed-failed, ed-unknown, inv-posted, portal, portal-email, inv-auditdone, inv-native (phone), and inv-nosnap (desktop). Others were checked through measurements and text only.

## Result

Round-5 items not actually fixed: none. R5-1 and R5-2 are confirmed fixed.
New findings: 0 blocker, 0 must-fix, 1 should-fix (W6-1), 0 nice.

## Round 5 resolution check

| Id | Result | Evidence |
|---|---|---|
| R5-1 (44 px text links on phone) | Confirmed | Across all 55 views at 390 px, no a/button/select/input/textarea is under 44 px except the mock view switcher (not product) and W6-1 below. "Show done", "Find in Finance", "Link to Mercury SAFE", "Different terms" all pass. |
| R5-2 (Mercury row date) | Confirmed | "D. Whitfield . Oct 19" in `fundraising`, `safe-link` (row and link dialog), and the other round views; no Oct 21 left (`round/fundraising-d-light.png`). |

## Geometry

No horizontal page overflow in any of 110 states (scrollWidth 390 on every phone view). Hits are the benign types from earlier rounds: `div.legend`, `div.tabs`, `div.cols`, and `span.meta`/`span.rel` spills when the source or Mercury menu is open (`inv-menu`, `inv-failed`, `inv-native-menu`, `fund-sync`). The script's "wrapped" buttons on phone were one line in the screenshots. Dim overlays, dialogs and toasts on phone full-page captures stop at the first 840 px; capture artifact, not counted.

## Numbers and labels (55 views)

- Round bar: "Funded $450k, Signed $50k, Pending $150k, Target $1M" is identical in all 15 views that show a bar, including `safe-mercury` and `fund-sync`. Bar widths 45% / 5% / 15% match. No bar in `fund-noround`, `fund-start`; `fund-closed` reads "Closed Oct 20 . funded $450k".
- No SAFE counted twice: Pending $150k is Ravi $50k plus Dana Whitfield $100k. Before the hand-off Ravi is a prospect (7 prospects, `fundraising`); after it a Draft SAFE and 6 prospects (`safe-mercury`, `safe-cover`), never both. The Mercury row "D. Whitfield Oct 19 $100,000 Sent" shows only in the Mercury-connected views other than `safe-mercury`, and stays out of the bar. Prospects: 1+1+1+2+1 plus 1 passed = 7.
- Cap table in all 21 views that draw it: 33.0 + 28.0 + 14.0 + 6.0 + 11.0 + 8.0 = 100%; legend 61.0 / 20.0 / 11.0 / 8.0; SAFEs 2.5 + 2.0 + 0.5 = 5.0%; Equity raised $1.0M; fully diluted 10,000,000. `inv-reading`, `inv-nosnap` and `empty` draw no table by design. Contact tabs read Investors 6, Board 3, Auditors 1 everywhere; the editor To list shows the same 6 (4 ticked with email, Marcus Webb no email, Nate Cho revoked).
- Notify counts: "Notifies 4 investors" (`ed-nogmail`), "Sent to 4" (`inv-sent`), "Posted . 4 notified" toast and the Posted Updates row (`inv-posted`), "3 of 4 sent" (`ed-failed`), and the 4 ticked recipients in the editor all agree. Sam Lind and Priya Raman show "Invited Oct 20" after send or post and "Invited Oct 2" before; consistent.
- Mercury chip: connected in the round views and `safe-mercury`/`safe-link`; "Connect Mercury" in `fund-nomercury`, `safe-dialog`, `safe-terms`, `safe-cover`, `fund-noround`, `fund-start`; "Sync failed" in `fund-sync`. Updates: October $1.13M / $89k / 13 mo / $21.1k +15%; September $1.21M / $86k / 14 mo / $18.4k +22%.
- Each view has one filled primary button (Send, Send SAFE, Mark sent, Start a round, Open draft), including the dark editor states.

## New findings

### Should-fix

- **W6-1 should-fix. The only link in the update email, "View online and past updates", is 16 px tall on a phone.** Measured 178 x 16 px at 390 px in `portal-email` (`portal/portal-email-p-dark.png`); it is an inline anchor with inline style (mockup line 645, plan README line 603). It is the one way an investor gets from the email to the portal on a phone, and the plan's Tap targets rule (README line 363) says every tappable element on a phone is at least 44 px. Round 5 checked controls inside the app screens, not this email. Fix: make the link line a block with 44 px height (padding), or state in the plan that email-client links are exempt. If the maintainer treats email HTML as outside the app's phone rule, this drops to nice.

## Journey notes

- Cap table: all states exist and agree; first-read failure offers Try again and Type it in (`cap-table/inv-nosnap-d-light.png`); typed-in rows stack as label/value on phone without clipping (`inv-native-p-light.png`). Blank first-use editor remains the earlier-skipped S-06; not re-raised.
- Monthly update: draft, sending, partly sent, unknown outcome, unticked, no Gmail, board without Gmail, posted all read correctly in dark; phone Retry and Cancel/Send again stack cleanly (`ed-unknown-p-dark.png`).
- Portal on phone: home, email, landing, nothing shared, dead link, link sent fit 390 px (`portal-p-dark.png`).
- Audit: show done and hide done render on phone (`audit/inv-auditdone-p-dark.png`).
- Send SAFE: menu, link dialog, dialog, different terms, hand-off, cover summary agree on $50,000, Oct 20, $10M post-money cap, MFN, Delaware; Mark sent is the one filled button.
- Six-week round: all 12 views exist and the bar holds.

## Round 6 verdict

Zero blocker, zero must-fix, one new should-fix (W6-1), which is a one-line CSS or plan wording change. By the stop rule the round is not clean until W6-1 is fixed or declared out of scope.

## Round 6 resolution

| Id | Resolution |
|----|------------|
| W6-1 | Fixed. The update email's portal link is a button-style link at least 44 px tall (mockup `.pe`; README Portal section). Re-rendered `mock-portal-email` at 1400 and 390, light and dark. |
