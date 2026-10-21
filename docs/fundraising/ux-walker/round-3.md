# UX walk, round 3: Investors and Fundraising mockup

Target: `docs/fundraising/mockup.html` (45 views, invented data, today is Oct 20). Browser session `ux-walker-fundraising-r3` (agent-browser), 1400 px and 390 px. Report only: the mockup and plan were not edited, nothing was committed or filed.

Screenshots: `docs/fundraising/ux-walker/round-3/<journey>/NN-<view>-<d|p>-<theme>.png` (90 files, every one of the 45 views at both widths; desktop pages are captured 1500 px tall so the whole page shows). Geometry audit output for all 90 states: `docs/fundraising/ux-walker/round-3/geometry.txt`. I opened and looked at about 30 of the screenshots (every distinct page layout and every dialog or menu type, on both widths); the rest I checked through geometry output, extracted text and control sizes, not by eye.

Themes: the mockup's `data-theme` attribute was set to light for `monthly-update` (11 views), `portal` (6) and `audit` (2), and to dark for `cap-table` (9), `send-safe` (5) and `round` (12). Light mode renders correctly: backgrounds, text, chips (amber Draft ready and Failed, green Sent), the bar segments and the scrim all read well.

## Result

Round-2 items not actually fixed: none. New findings: 0 blocker, 0 must-fix, 1 should-fix, 5 nice.

## Geometry audit

- No horizontal page overflow on any of the 90 states.
- Real defect: none besides S-01 below. Hits that are not defects: `legend`, `tabs`, `cols` (content-sized chips and the two unequal cards); `span.meta`/`span.rel` spills (the source and Mercury menus intentionally open over the header); `div.btns` (Cancel narrower than the primary button); "wrapped" `Show done`, `Open draft`, `Send SAFE`, `Link to Mercury SAFE` on a phone (each is on one line in the screenshots; the script flags the button padding).
- Phone dialogs: every dialog is 324 px wide at 390 px, and every dialog primary button is 44 px tall (measured: Send SAFE, Start a round, Add prospect, Save, Mark funded, Close round, Share, Print, Mark sent).

## Numbers across all 45 views

Consistent in every view where they appear:

- Cap table: holder rows 33.0 + 28.0 + 14.0 + 6.0 + 11.0 + 8.0 = 100.0 and shares 3.3M + 2.8M + 1.4M + 0.6M + 1.1M + 0.8M = 10.0M; legend 61.0 / 20.0 / 11.0 / 8.0 = 100.0. Per the plan the SAFEs sit outside that 100%: 2.5 + 2.0 + 0.5 = 5.0% (amount / $10M cap), shown as a separate group row.
- Equity raised $1.0M = $700k + $300k (the holdings' Invested column; the SAFE amounts are excluded, as the plan says).
- Round bar: Funded $450k = $250k + $200k; Signed $50k (Harbor Angels, Oct 12); Committed $150k = Ravi Mehta $50k + Dana Whitfield's $100k Draft. The same $150k stays in `safe-mercury` and `safe-cover` after Ravi's SAFE becomes a Draft (Ravi $50k moves from prospect to Draft, total unchanged). Pipeline reads 7 prospects, and 6 in the two views where Ravi has a SAFE.
- Closed line: "Closed Oct 20 . funded $450k" matches the bar.
- October update: cash $1.13M, burn $89k, runway 13 mo (1.13M / 89k = 12.7), MRR $21.1k (+15% over $18.4k = +14.7%). September: $1.21M / $86k = 14.1 months, MRR $18.4k (+22%). The portal and email show the September text. Dates Oct 2, Oct 6, Sep 3, Oct 20 agree between the Updates list, portal and Contacts ("Invited Oct 20" after the send).
- Sent counts: "Sent to 4" toast, 4 ticked recipients, "3 of 4 sent" with Tom failed.

## Round 2 resolution check

All 22 new items and W-18 were checked against the screenshots or measurements.

| Id | Result | Evidence |
|---|---|---|
| N-01 | Confirmed | Dialogs 324 px wide on 390; no page overflow; all primary buttons visible (`send-safe/02-safe-terms-p-dark.png`, `round/09-fund-mark-p-dark.png`). |
| N-02 | Confirmed | `round/11-fund-closed-d-dark.png`, `round/01-fund-noround-d-dark.png`: Attention, Pipeline and SAFEs stay; Send SAFE works with no round. |
| N-03 | Confirmed | `portal/01-portal-email-p-light.png` has Highlights and Lowlights like the portal. |
| N-04 | Confirmed | `audit/01-inv-audit-d-light.png`: Northwind (Nov 15) above Birch (Nov 30). |
| N-05, W-18 | Confirmed | Portal Download measured 78 x 44 on a phone. |
| N-06 | Confirmed | `cap-table/07-inv-native-d-dark.png` shows the three SAFE rows. |
| N-07 | Confirmed | Row actions button on every editable holder row. |
| N-08 | Confirmed | Carta menu: Refresh, Change source. Typed-in menu (`inv-native-menu`): Change source, Undo. |
| N-09 | Confirmed | "Closed Oct 20 . funded $450k". |
| N-10 | Confirmed | `monthly-update/06-inv-sent-d-light.png`: Sam and Priya "Invited Oct 20". |
| N-11 | Confirmed | `cap-table/01-investors-p-dark.png`: action rows stack on a phone. |
| N-12 | Confirmed | `portal/05-link-dead-p-light.png`: no company name on the dead-link page. |
| N-13 | Confirmed | Landing page is company name plus Open (`portal/02-portal-open-p-light.png`). |
| N-15 | Confirmed | `monthly-update/04-ed-failed-d-light.png`: "Partly sent", "3 of 4 sent", Done. |
| N-16 | Confirmed | Views exist: reminder, contact menu, revoked contact menu, share, show done, mark funded, edit round. |
| N-17, N-18, N-20, N-21 | Confirmed | "Drafted Oct 1"; Start dialog name is a placeholder; `fund-sync` opens Refresh and Reconnect; SAFEs ordered by status then date. |
| N-22 | Confirmed (partly, as stated) | Caret is a caret; the Updates card is still shorter than Contacts (an empty block to its lower left on desktop). Left as a skip. |
| N-14, N-19, W-09 caveat | Skipped by design | Not re-raised. |

## New findings

### Should-fix

- **S-01 should-fix. The portal email field is 36 px tall on a phone.** The plan says every portal control, Download included, is at least 44 px tall on a phone. The "Email me a link" button is 44 px, but the Email address input on the dead-link page is 36 px (measured 300 x 36 at 390 px). It is the only field on the page and the one a locked-out investor has to tap and type in. Evidence: `portal/05-link-dead-p-light.png`; plan, Pages, Portal. Fix: make the input 44 px on a phone, or say in the plan that fields are exempt.

### Nice

- **S-02 nice. Closed round shows "Connect Mercury".** `fund-close` and `fundraising` show "Mercury . 5 min ago", but `fund-closed` (the next step in the round journey) shows "Connect Mercury" and Dana's Draft loses "Link to Mercury SAFE". Closing a round does not disconnect Mercury, so the view reads as if it did. Evidence: `round/11-fund-closed-d-dark.png`. Fix: draw the closed state with Mercury connected, or label it as a separate no-Mercury state.
- **S-03 nice. Typed-in table loses the series name.** The table copied from Carta says "Seed Preferred" and the legend "Seed preferred 20.0%"; after switching to Typed in, the security column says "Preferred" and the legend "Preferred 20.0%". The typed-in security list (Common, Preferred, Option, Other) cannot hold "Seed". Evidence: `cap-table/07-inv-native-d-dark.png` against `cap-table/01-investors-d-dark.png`. Fix: keep a free-text series, or accept and say so in the plan.
- **S-04 nice. The email subject format differs from the editor's.** The editor subject is "Example Robotics . October update"; the email the investor receives is "Example Robotics: September update". Evidence: `monthly-update/01-editor-d-light.png`, `portal/01-portal-email-p-light.png`. Fix: use one separator.
- **S-05 nice. "Add prospect" is shown prefilled with an existing prospect.** The dialog opens with "Fjord Ventures" and stage Target, who is already in the Pipeline behind it, so the view looks like a duplicate entry. Evidence: `round/04-fund-prospect-d-dark.png`. Fix: draw it empty with placeholders.
- **S-06 nice. First-read-failed view has no message in its body.** The only explanation is the small amber "Last read failed . Sheet" chip in the header; the middle of the page has two bare buttons (Try again, Type it in). The plan describes exactly this, so the mock matches it; a one-line heading or the page title is enough if the plan is revised. Also, no view shows a blank typed-in table reached from the empty state; the first-use step of the type-the-cap-table-in journey is inferred from the populated copy. Evidence: `cap-table/06-inv-nosnap-d-dark.png`, `cap-table/09-empty-d-dark.png`.

## Journey notes

- Type the cap table in: empty to Type it in to editor to menu is complete except the blank first-use editor (S-06). Saved and Not saved states exist.
- Monthly update: draft, TBD prompt, sending, partly sent with Retry, no Gmail, sent, and the reminder and contact menus are all drawn and agree. Send is the single filled button in each state.
- Investor on a phone: email, landing, home, nothing shared and dead-link pages fit 390 px with no overflow; only S-01 deviates from the 44 px rule.
- Audit: New, Draft ready, Show done and Hide done render in light and on a phone; due-date order is right.
- Send SAFE from a committed prospect: dialog, different terms, Mercury hand-off and cover summary agree on terms ($50,000, Oct 20, $10M post-money cap, MFN, Delaware).
- Six-week round: no round, start, add prospect, stage menu, SAFE menu, mark funded, edit, close, closed, sync failed all exist; numbers hold from start to close (S-02 only).

## Round 3 verdict

Zero blocker, zero must-fix, one new should-fix (S-01, a one-line CSS or plan change). The loop's stop condition is not met until S-01 is fixed or its exemption is written into the plan.

## Round 3 resolution

| Id | Status | Change |
|----|--------|--------|
| S-01 | fixed | The dead-link email input is 44 px on a phone; the page is left aligned. |
| S-02 | fixed | `fund-closed` shows Mercury connected, and Dana's Draft keeps Link to Mercury SAFE. |
| S-03 | fixed | Typed-in securities keep names copied from the previous table ("Seed Preferred"); the legend keeps "Seed preferred". |
| S-04 | fixed | The email subject is the editor's Subject, both "Example Robotics · <Period> update". |
| S-05 | fixed | Add prospect opens empty with a "Name" placeholder. |
| S-06 | partly fixed | `inv-nosnap` has one sentence, "The sheet could not be read.", and no chip. A blank first-use typed-in editor is not drawn: it is the populated editor with one empty row. |
