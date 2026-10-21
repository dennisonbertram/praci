# Fundraising mockup: visual critique, round 3 (report only)

Target: `docs/fundraising/mockup.html` (45 views). Session `ux-visual-fundraising-r3`. The mockup and plan were not edited, and nothing was committed or filed.

## Coverage

- Light mode, all 45 views, at 1400 and 390 (90 screenshots).
- Dark mode at 1400 and 390 for the main five (investors, inv-native, editor, fundraising, portal) and the 11 views new in round 2 (inv-native-menu, inv-nosnap, inv-notsaved, inv-auditdone, inv-reminder, inv-contactmenu, inv-unblock, inv-share, inv-partly, fund-editround, fund-mark): 32 screenshots.
- Extra: six 1400 screenshots with the `main` scroller moved to the bottom (`1400-scrolled-*.png`), because several menus and the Updates and Contacts cards sit below the fold at 1400; and `1024-editor.png`.
- 128 screenshots in `docs/fundraising/ux-visual/round-3/screens/`, all opened with Read. `layout-audit.js` ran on each of the 122 view screenshots; raw output is in `round-3/audit/` (one JSON per screenshot). `audit/targets-390.txt` lists every button, link and input under 44px high on ten phone views (my own measurement, since the audit only flags targets under 24px).
- Limits: the mockup is static, so hover, focus order and keyboard behavior were not tested. Full-page screenshots at 1400 only show the first 900px because the app scrolls inside `main`; the scrim stopping at 844px on phone dialogs is a capture artifact, not a defect.

## Part 1. Round-2 items marked fixed

Counts: 22 of 25 verified as fixed, 3 not (or only partly) fixed.

### Not actually fixed

| Id | Status | Evidence |
|---|---|---|
| N-07 (primary phone actions 44px) | Partly fixed | Send, Open draft, Send SAFE, Start a round and every dialog button are 44px. But the only actions on some views are still 36px: the three empty-state buttons (`390-empty.png`: Connect Carta, Use a Google Sheet, Type it in, each 260x36); Try again and Type it in on the first-read-failure view (`390-inv-nosnap.png`); Retry 52x36 in the failed-send row (`390-ed-failed.png`); Mark funded 94x36 in the Attention card on every Fundraising view; and Keep editing 102x36 beside a 44px Send anyway (`390-ed-tbd.png`). N-07's own evidence listed the empty-state buttons. Measured in `audit/targets-390.txt`. Severity: should-fix (these are the sole or recovery actions of their views). |
| N-12 (links 32px on phone) | Partly fixed | "Link to Mercury SAFE" is now 121x32, and chips and inputs are 36px. "Find in Finance" in the Attention card is still 85x15 on every Fundraising view, and "SAFEs, if converted at cap ›" is still 175x19 on every Investors view (`audit/390-fundraising.json`, `audit/390-investors.json`). "Find in Finance" is the hand-off for the awaiting-deposit item. Severity: should-fix. |
| N-16 (group percent aligned to column) | Not fixed | In `1400-investors.png` the SAFEs group "5.0%" ends at x 1351 while every other percent ends at x 1315; on phone (`390-investors.png`) it ends at x 321 against 285. The group row has no "…" slot, so its figure sits 36px to the right of the column. Severity: nice (as originally rated). |

N-15 stays "partly fixed" as recorded (shared `--warning` token); not re-raised.

### Confirmed fixed

N-01 (every dialog fits 390: `390-fund-prospect.png`, `390-safe-dialog.png`, `390-safe-terms.png`, `390-safe-cover.png`, `390-fund-close.png`, `390-fund-start.png`, `390-fund-editround.png`, `390-fund-mark.png`, `390-inv-share.png`), N-02 (failed send shows "Partly sent", "3 of 4 sent" and Done, `1400-ed-failed.png`), N-03 (row menus in typed-in mode, none on the pool row), N-04 (one filled button per Fundraising view; Start a round takes it when there is no round or a closed round), N-05 (amount column aligned at x 669 with and without Send SAFE), N-06 (button labels match titles), N-08 (Action rows stack on phone), N-09 (bordered source and Mercury buttons with caret), N-10 (right-aligned headers, labeled phone inputs), N-11 (18px accent checkboxes, themed selects), N-13 (toasts "Sent to 4", "Draft SAFE added"), N-14 and F-27 (Send at y 705 to 738 in a 768px viewport, `1024-editor.png`), N-17, N-18 (chip beside the title), N-19 ("Keep editing"), N-20, N-23, N-24 (closed round keeps pipeline and SAFEs), F-23 (reminder menu drawn, `1400-scrolled-inv-reminder.png`).

## Part 2. New findings

Counts: 0 blocker, 0 must-fix, 0 should-fix, 8 nice.

### Blocker, must-fix, should-fix

None. I checked every view at both widths and in both themes for overflow (page scroll X is 0 in all 122 audits), off-screen primary actions (`offscreenPrimary` empty everywhere), dialog fit, overlapping elements, type scale (4 to 6 distinct sizes per view, 22px and 14px only on Investors with a dialog open) and token use. Tokens match `docs/finance/mockup.html` for every shared color; the only additions are `--scrim` and an explicit dark-theme block, which are consistent.

### Nice

- **V3-01. First-read-failure view gives no explanation.** `1400-inv-nosnap.png` and `390-inv-nosnap.png` show two stacked outline buttons (Try again, Type it in) floating about 100px below the Action card with no sentence. The only cue is the amber source chip, which is cut off as "Last read failed · Sheet" and says "Last read" although this is the first read. Consider one line of text and an untruncated chip.
- **V3-02. Date and separator wrap on phone.** `390-inv-partly.png`: "Tom Okafor failed · Investors · Oct / 20" breaks the date across two lines. `390-fundraising.png`: "Oct 18 ·" ends a line and "Link to Mercury SAFE" starts the next, leaving a dangling separator. Pipeline sub-lines leave one-word orphans ("details", "Thu") at 390.
- **V3-03. Mixed alignment on the dead-link page.** `1400-link-dead.png` and `390-link-dead.png`: the message and button are centered, the label and field are left-aligned.
- **V3-04. Update email subject differs from the editor's.** `1400-portal-email.png` shows "Example Robotics: September update"; `1400-editor.png` defaults to "Example Robotics · October update". Use one format.
- **V3-05. Button heights inside one card.** `390-investors.png`: in the Action items card "Open draft" is 44px and "Open" (October update) is 36px; the Updates rows use 36px "Open" as well. Related to N-07 above.
- **V3-06. Weak dialog separation in dark mode.** `390-dark-fund-mark.png`, `1400-dark-fund-editround.png`, `1400-dark-inv-share.png`: the dialog fill (#171717) sits on a page only slightly darkened by the 35% scrim, so the dialog is separated mostly by its 1px border. Raise the dark scrim or give the dialog a lighter surface.
- **V3-07. Small success tag contrast.** `audit/1400-ed-failed.json`: "Sent" tag text (`--success` #2f855a on the tag background) measures 4.35:1 at 11px. This is the same shared-token question as the known `--warning` item (the value matches the Finance mockup); record it with that decision.
- **V3-08. Dark-mode avatar and disabled checkbox.** The Finance agent "F" avatar measures 4.4:1 in dark (`audit/1400-dark-investors.json`). Disabled recipient checkboxes in dark (`1400-dark-editor.png`) render as filled grey squares that look half-checked.

## What is excellent as is

- Portal views are clean in both themes: one clear action per state, 44px Open, Email me a link, Download and Sign out on phone, no sub-44px target on any portal view (`audit/targets-390.txt`).
- Typed-in cap table: right-aligned headers and values, labeled phone inputs, consistent "Preferred" legend, and a row menu that excludes the pool row.
- The fundraising round bar, SAFEs table and pipeline share one alignment grid; the single filled button per Fundraising view is consistently applied, including the no-round and closed-round states.
- Menus (source, round, stage, SAFE, contact, reminder) have the same width, item height and placement at 1400 and 390.
- Failed-send state now reports "Partly sent", keeps one primary (Done), and reserves the Retry slot.

## Round 3 resolution

| Id | Status | Change |
|----|--------|--------|
| N-07 | fixed | Every button and icon button is 44 px on a phone (empty-state buttons, Try again, Retry, Mark funded, Keep editing, row menus). |
| N-12 | fixed | "Find in Finance" and "SAFEs, if converted at cap" have 44 px tap areas on a phone and at least 24 px on desktop. |
| N-16 | fixed | The group percent sits in the Fully diluted column on desktop and phone, read-only and typed-in. |
| V3-01 | fixed | One sentence on `inv-nosnap`; the truncated chip is gone. |
| V3-02 | fixed | Dates do not wrap; the Link to Mercury SAFE separator hides on a phone and the link takes its own line; sub-lines use balanced wrapping. |
| V3-03 | fixed | The dead-link page is left aligned. |
| V3-04 | fixed | One subject format. |
| V3-05 | fixed | All card buttons are 44 px on a phone. |
| V3-06 | fixed | The dark scrim is 60%. |
| V3-07 | skipped | Shared `--success` token; recorded under Open questions in the README. |
| V3-08 | fixed | Dark `--ink2` raised so the Finance avatar passes 4.5:1; disabled checkboxes render as empty outlined boxes. |
| New | note | On a phone the Security select in typed-in rows still shortens "Seed Preferred". |
