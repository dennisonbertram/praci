# UX walk, round 4: Investors and Fundraising mockup

Target: `docs/fundraising/mockup.html` (50 views, invented data). Browser session `ux-walker-fundraising-r4` (agent-browser), 1400 px and 390 px. Report only: the mockup and plan were not edited, nothing was committed or filed.

Screenshots: `docs/fundraising/ux-walker/round-4/<journey>/NN-<view>-<d|p>-<theme>.png`, 100 files (50 views at both widths, scripted). Geometry audit output for all 100 states: `docs/fundraising/ux-walker/round-4/geometry.txt`. Themes: dark for `monthly-update` (14 views), `portal` (6), `audit` (2); light for `cap-table` (10), `send-safe` (6), `round` (12). I opened about 15 screenshots by eye (investors, typed-in, first-read-failed, fundraising, SAFE cover, failed-recipient editor, portal email, dead link, closed round, partly sent). The rest I checked through geometry output, extracted text of all 50 views and measured control sizes. Desktop captures came out at viewport height (900 px), so lower sections of long pages were checked through text extraction, not by eye.

## Result

Round-3 items not actually fixed: none (S-06 stays partly fixed, as round 3 recorded).
New findings: 0 blocker, 0 must-fix, 0 should-fix, 1 nice.

## Round 3 resolution check

| Id | Result | Evidence |
|---|---|---|
| S-01 | Confirmed | Dead-link input measures 300 x 44 and the button 120 x 44 at 390 px; left aligned (`portal/05-link-dead-p-dark.png`). |
| S-02 | Confirmed | `fund-closed` header reads "Mercury . 5 min ago"; Dana's Draft keeps "Link to Mercury SAFE" (`round/11-fund-closed-p-light.png`). |
| S-03 | Confirmed | Typed-in table shows "Seed Preferred" on both Seed rows and the legend keeps "Seed preferred 20.0%" (`cap-table/07-inv-native-d-light.png`). |
| S-04 | Confirmed | Editor subject "Example Robotics . October update"; email subject "Example Robotics . September update" (`monthly-update/04-ed-failed-p-dark.png`, `portal/03-portal-email-p-dark.png`). |
| S-05 | Confirmed (from view text) | `fund-prospect` form fields are "Name", "Optional", Target, "$": empty with placeholders. |
| S-06 | Partly fixed, as stated | `inv-nosnap` says "The sheet could not be read." with Try again and Type it in, no chip (`cap-table/06-inv-nosnap-d-light.png`). A blank first-use typed-in editor is still not drawn. Round 3 left it; I do not re-raise it. |

## Geometry audit

- No horizontal page overflow in any of the 100 states.
- No real defect. Every hit is one already judged benign in round 3: `legend`, `tabs`, `cols` (content-sized chips and two unequal cards); `div.btns` (Cancel narrower than the primary button); `span.meta` / `span.rel` spills in the source and Mercury menus (menus open over the header on purpose); "wrapped" controls on a phone (`Show done`, `Open draft`, row `...` buttons) are button padding, one line each in the screenshots.
- Phone sizes: portal controls are 44 px. Dialog inputs and cap-table editor inputs are 36 px on a phone; the plan's 44 px rule is about the portal, so I do not count these.

## Numbers and labels across all 50 views

All consistent:

- Cap table: holders 33.0 + 28.0 + 14.0 + 6.0 + 11.0 + 8.0 = 100.0%; legend 61.0 / 20.0 / 11.0 / 8.0; SAFEs 2.5 + 2.0 + 0.5 = 5.0% shown as a separate group; Equity raised $1.0M. Same in every Investors view (typed-in views included).
- Round bar: "Funded $450k, Signed $50k, Pending $150k, Target $1M" is identical in all 14 views that show a bar. Pending $150k = Ravi's $50k (Committed-stage prospect) + Dana's $100k Draft, which matches the plan glossary (README lines 88 to 90: "Committed" is a pipeline stage only; "Pending" is the bar word). The pipeline's "Committed 1 . $50,000" and the bar's "Pending $150k" do not clash: different words for different things, and the plan defines both.
- In `safe-mercury` and `safe-cover` Ravi's SAFE is a Draft: the pipeline reads "6 prospects", Ravi appears in the SAFE list at $50,000, and the bar still reads Pending $150k. All other views read 7 prospects.
- No-round views (`fund-noround`, `fund-start`) show no bar; `fund-closed` shows "Closed Oct 20 . funded $450k" and still lists the Harbor Angels Attention row, which matches the close dialog's warning ("signed and unpaid").
- Mercury chip: connected ("Mercury . 5 min ago") in the round, edit, stage, SAFE menu, mark funded, close and closed views; "Connect Mercury" only in the no-Mercury views and the no-round views (`fund-nomercury`, `safe-dialog`, `safe-terms`, `safe-cover`, `fund-noround`, `fund-start`); "Sync failed" in `fund-sync`. "Link to Mercury SAFE" appears only where Mercury is connected.
- Update statuses: Draft (editor, ed-tbd, ed-nogmail, and the Updates list), Sending (`ed-sending` header and button, recipients Sent / Sending), Partly sent (`ed-failed` header, "3 of 4 sent", Tom Failed + Retry; `inv-partly` list row "Tom Okafor failed" + Retry), Sent (`inv-sent` list row "Investors . Oct 20", toast "Sent to 4"). The September update (Oct 2) in the list matches the portal email's September text. Action items drops the October update row once sent or partly sent. All agree with the plan's status glossary (README line 91) except that two of its five words are never drawn as a list row (see N-01).
- October update numbers (cash $1.13M, burn $89k, runway 13 mo, MRR $21.1k +15%) are the same in editor, ed-tbd, ed-sending, ed-failed and ed-nogmail. September ($1.21M, $86k, 14 mo, $18.4k +22%) matches the portal and email.

## New findings

### Nice

- **N-01 nice. Updates list shows only Draft, Sent and Partly sent.** The plan lists five statuses (README line 91: Draft, Sending, Sent, Partly sent, Posted). No view draws an Updates row reading Sending, and none draws Posted (`ed-nogmail` ends at the "Post to portal" button). The Posted gap is already raised as R4-2 in `docs/fundraising/ux-flow/round-4.md` (same round), so I count only the Sending row as mine; it has no effect on numbers and Sending is visible in the editor header. Evidence: `monthly-update/03-ed-sending-d-dark.png` (editor only), text of `inv-sent` and `inv-partly`. Fix: draw one Updates row in Sending, or accept the editor header as its only representation.

## Journey notes

- Type the cap table in: empty, source menu, Type it in, editor (Saved and Not saved), changed elsewhere and menu all exist; numbers agree. Only the blank first-use editor is inferred (S-06, skipped).
- Monthly update: draft, TBD prompt, sending, partly sent with Retry, no Gmail, sent, reminder, contact and revoked-contact menus, share and copy link are all drawn; Send is the single filled button in each state.
- Investor on a phone: email, landing, home, nothing shared, dead link and link sent fit 390 px with no overflow; all controls 44 px.
- Audit: New, Draft ready, Show done and Hide done render in dark and on a phone; Northwind (Nov 15) above Birch (Nov 30).
- Send SAFE from a committed prospect: dialog, different terms, Mercury hand-off and cover summary agree ($50,000, Oct 20, $10M post-money cap, MFN, Delaware).
- Six-week round: no round, start, add prospect, stage, round menu, edit, SAFE menu, mark funded, close, closed, sync failed all exist; the bar numbers hold from start to close.

## Round 4 verdict

Zero blocker, zero must-fix, zero new should-fix, one nice. The stop condition (no must-fix and no new should-fix) is met from this walk's point of view.

## Round 4 resolution

| Id | Status | Change |
|----|--------|--------|
| N-01 | fixed | New view `inv-sending`: Updates row reads Sending, Open, disabled menu (no Delete while it runs). Posted row drawn in `inv-posted`. README "Updates" item 3. |
