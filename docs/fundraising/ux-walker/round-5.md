# UX walk, round 5: Investors and Fundraising mockup

Target: `docs/fundraising/mockup.html` (55 views, invented data). Browser session `ux-walker-fundraising-r5` (agent-browser), 1400 px and 390 px, full-page screenshots. Report only: the mockup and plan were not edited, nothing was committed or filed.

Screenshots: `docs/fundraising/ux-walker/round-5/<journey>/NN-<view>-<d|p>-<theme>.png`, 110 files (55 views at both widths). Light for `monthly-update` (19 views), `portal` (6), `audit` (2); dark for `cap-table` (10), `send-safe` (6), `round` (12). Geometry audit for all 110 states: `docs/fundraising/ux-walker/round-5/geometry.txt`; extracted text of every view: `docs/fundraising/ux-walker/round-5/text.txt`. I opened 13 screenshots by eye (fundraising, safe-mercury, safe-cover phone, typed-in phone, editor phone, unticked phone, unknown outcome desktop and phone, posted phone, audit show-done phone, portal home phone, portal email phone). The rest I checked through geometry output and text extraction.

## Result

Round-4 items not actually fixed: one, the 44 px phone tap rule for text links (N-07 / W-01 in `ux-visual/round-4.md`), see R5-1.
New findings: 0 blocker, 0 must-fix, 1 should-fix (R5-1, a round-4 fix that did not hold), 1 nice (R5-2).

## Round 4 resolution check

| Id | Result | Evidence |
|---|---|---|
| R4-1 (To list without Gmail, unticked line) | Confirmed | `ed-unticked` shows "Unticked investors still see this on the portal." only there; `ed-boardnog` shows no To list and only "Connect Gmail to send". |
| R4-2 / NG-42 (Post to portal) | Confirmed | `inv-posted`: Updates row "October update, Investors . Oct 20, Posted"; toast "Posted . 4 notified"; Sam Lind and Priya Raman show "Invited Oct 20". |
| NG-44 (every SAFE counts once) | Confirmed | See the numbers section. |
| NG-45 (unknown outcome) | Confirmed | `ed-unknown`: "Unknown . check Sent mail" with Retry, then "May already be delivered. Send again?" with Cancel and Send again (`monthly-update/07-ed-unknown-d-light.png`, `-p-`). |
| NG-46 / N-01 (Sending row) | Confirmed | `inv-sending` Updates row reads Sending. |
| NG-41, 43, 47, 48, 51, 52, PG-23 | Confirmed from text | `inv-reading` shows "Reading sheet..." in the header and "Reading Cap table 2026..." in the body. |
| V4-02 to V4-05, W-02 | Confirmed | Phone editor back button is an arrow (`01-editor-p-light.png`); typed-in rows stack as label/value pairs, nothing clipped (`cap-table/07-inv-native-p-dark.png`). |
| N-07 / W-01 (44 px text links on a phone) | Not fixed | R5-1. |

## Geometry audit

- No horizontal page overflow in any of the 110 states.
- Every hit is a type already judged benign: `div.legend`, `div.tabs`, `div.cols` (content-sized chips, two unequal cards), `div.btns.end` (Cancel narrower than the primary), `span.meta` / `span.rel` spills when the source and Mercury menus open over the header, and phone "wrapped" buttons that are one line in the screenshots. Nothing new.
- Dim overlay and toast on phone full-page captures stop at the first 840 px (`send-safe/04-safe-cover-p-dark.png`, `monthly-update/18-inv-posted-p-light.png`). This is a capture artifact of fixed elements, not a layout defect; I do not count it.

## Numbers and labels across all 55 views

- Cap table: holders 33.0 + 28.0 + 14.0 + 6.0 + 11.0 + 8.0 = 100.0%; legend 61.0 / 20.0 / 11.0 / 8.0; SAFEs 2.5 + 2.0 + 0.5 = 5.0%; Equity raised $1.0M. Identical in every Investors view, typed-in views included.
- Round bar: "Funded $450k, Signed $50k, Pending $150k, Target $1M" is identical in all 14 views that show a bar (`fundraising`, `fund-roundmenu`, `fund-editround`, `fund-stage`, `fund-prospect`, `fund-safemenu`, `fund-mark`, `fund-close`, `fund-sync`, `safe-link`, `safe-dialog`, `safe-terms`, `safe-mercury`, `safe-cover`, `fund-nomercury`). Pending stays $150k through the Mercury hand-off (`safe-mercury`, 6 prospects, Ravi's $50k now a Draft) and sync failure (`fund-sync`). No bar in `fund-noround`, `fund-start`; `fund-closed` reads "Closed Oct 20 . funded $450k".
- No SAFE counted twice: Pending $150k = Ravi $50k + Dana Whitfield $100k Draft. The Mercury row "D. Whitfield Oct 21 $100,000 Sent" is listed but held out of the bar; before the hand-off Ravi is a pipeline prospect, after it a Draft SAFE, never both. Prospects: 7 everywhere except 6 in `safe-mercury` and `safe-cover` (Ravi moved to SAFEs).
- Mercury chip: connected in the round, stage, edit, mark funded, close, closed and `safe-mercury`/`safe-link` views; "Connect Mercury" in `fund-nomercury`, `safe-dialog`, `safe-terms`, `safe-cover`, `fund-noround`, `fund-start`; "Sync failed" in `fund-sync`. "Link to Mercury SAFE" appears only with Mercury connected.
- Updates: October $1.13M / $89k / 13 mo / $21.1k +15% in all editor views; September $1.21M / $86k / 14 mo / $18.4k +22% in the portal, email and Updates list (Oct 2). Statuses Draft, Sending, Sent, Partly sent, Posted all now have an Updates row.

## New findings

### Should-fix

- **R5-1 should-fix. Text links with class `lnk b` stay 24 px tall on a phone, so the 44 px rule is not met.** The phone rule `.lnk{min-height:44px}` (mockup line 228) loses to `.lnk.b{min-height:24px}` (line 117) on specificity. Measured at 390 px: "Show done" 24 px (`investors`, `fund-prospect`), "Find in Finance" 24 px and each "Link to Mercury SAFE" 24 px (`fundraising`). Round 4 (`ux-visual/round-4.md`, N-07 / W-01) records "text links ... are 44 px" and the plan's Tap targets rule says the same. Two of the affected controls sit on core journeys: Link to Mercury SAFE in Send SAFE, and Show done in the audit request. Fix: raise `.lnk.b` to 44 px in the phone media query, or drop the 24 px min-height there.

### Nice

- **R5-2 nice. The Mercury SAFE row is dated Oct 21, a day after "today".** "D. Whitfield . Oct 21" (`fundraising`, `safe-mercury`, `safe-link`, and the match radio in the link dialog) while the closed round reads Oct 20, Ravi's new SAFE Oct 20, and the Posted update Oct 20. Invented-data slip only; change to Oct 19 or earlier.

## Journey notes

- Cap table typed in: every state (empty, source menu, reading, failed, first-read failed, typed in, not saved, changed elsewhere) exists and numbers agree. Blank first-use editor still undrawn (S-06, skipped in earlier rounds; not re-raised).
- Monthly update: draft, TBD, sending, partly sent, no Gmail, unticked, unknown outcome, board without Gmail, posted and sent are all drawn; Send is the single filled button in each state.
- Portal on a phone: home, nothing shared, email, landing, dead link, link sent fit 390 px with no overflow (`portal/01-portal-p-light.png`, `03-portal-email-p-light.png`).
- Audit: draft, show done and hide done render on desktop and phone (`audit/02-inv-auditdone-p-light.png`).
- Send SAFE from a committed prospect: dialog, different terms, Mercury hand-off and cover summary agree ($50,000, Oct 20, $10M post-money cap, MFN, Delaware).
- Six-week round: no round, start, add prospect, stage, menu, edit, SAFE menu, mark funded, close, closed, sync failed all exist and the bar numbers hold.

## Round 5 verdict

Zero blocker, zero must-fix. One should-fix (R5-1), and it is a round-4 fix that did not hold rather than a new design problem; one nice. By the stop rule the round is not clean until R5-1 is fixed (a one-line CSS change).

## Round 5 resolution

| Id | Resolution | Where |
|----|------------|-------|
| R5-1 | Fixed. `.lnk` and `.lnk.b` are 44px with padding, no negative margin, in the phone query. Measured at 390px on investors, inv-audit, fundraising, safe-dialog, safe-link and safe-mercury: Show done, Find in Finance, Link to Mercury SAFE, Different terms and SAFEs, if converted at cap are all 44px; no horizontal overflow. | `mockup.html` phone media query |
| R5-2 | Fixed. The Mercury row is dated Oct 19, including the link dialog. | `mockup.html` |
