# UX visual review, round 5

Scope: all 55 mockup views at 1400px and 390px in light mode (110 captures), plus 25 views at both widths in dark mode (50 captures): the 14 views new or changed in round 4 (ed-unticked, ed-unknown, ed-boardnog, inv-sending, inv-posted, inv-reading, inv-native, inv-partly, ed-failed, ed-nogmail, link-sent, safe-link, safe-terms, safe-cover) and every Fundraising view with Mercury connected (the mockup's `merc` group: fundraising, fund-roundmenu, fund-editround, fund-stage, fund-prospect, fund-safemenu, fund-mark, safe-link, fund-close, safe-mercury, fund-sync, fund-closed). Screenshots are in `docs/fundraising/ux-visual/round-5/screens/` (`<width>-<view>.png` and `<width>-dark-<view>.png`). Raw `layout-audit.js` output for each capture is in `round-5/audit/` (160 JSON files). Tap-target measurements are in `round-5/audit/targets-390.txt`, `targets-1400.txt` and the two `-dark` variants (every phone element under 44px high, every desktop link under 24px high, plus any text input whose content is wider than its box).

Method notes. At 1400 the app shell scrolls inside `main`, so the audit ran at 1400x900 and the screenshots were retaken at 1400x1700 so that the whole page is visible. In those tall captures the dialog scrim, the dialog and the toast sit at viewport position rather than page position; that is a capture effect, not a defect. Browser: agent-browser session `ux-visual-fundraising-r5`, light and dark set through `data-theme`.

Honest coverage: I opened with the image reader every Investors, editor, Fundraising and Portal view that changed since round 3 at both widths and in both themes, plus the typed-in views, all portal views and the main dialogs. I did not open the light 1400px captures of several unchanged menu and dialog views one by one (inv-audit, inv-auditdone, inv-reminder, inv-contactmenu, inv-unblock, inv-updmenu, inv-sent, editor, ed-tbd, ed-sending, and the light Fundraising menus and dialogs). Those views share components with views I did open, and their audits are clean (below).

Audit totals across all 160 captures: page scroll X is 0 in all of them; `offscreenPrimary` is empty in all of them; the only overlaps reported are hidden popovers and dialogs. Contrast hits in light mode are only the known `--warning` and `--success` items (3.49 to 4.35:1), not re-raised. Dark mode has no contrast hits at all.

## Part 1. Round 4 items

Counts: 5 of 7 confirmed fixed, 1 partly fixed, 1 not fixed.

### Not fixed

| Id | Status | Evidence |
|---|---|---|
| N-07 / W-01 (every tappable element 44px on a phone) | Partly fixed. Popover items, source buttons, "Passed 1 ›", "YC documents ›", chips, inputs and buttons are now 44px or more (no longer in `targets-390.txt`). Four small text links are still 24px high. | `targets-390.txt`: "Show done" 63x24 on 21 Investors views and "Hide done" 58x24 on `inv-auditdone`; "Find in Finance" 85x24 on 18 Fundraising views; "Link to Mercury SAFE" 121x24 on 11 Mercury-connected Fundraising views; "Different terms" 91x24 on `safe-dialog` (`390-safe-dialog.png`). Cause, read from `mockup.html`: `.lnk.b{min-height:24px}` (line 117, specificity 0,2,0) beats the phone rule `.lnk{min-height:44px}` (line 228, specificity 0,1,0), so the phone rule never applies to `.lnk.b`; the `margin:-12px 0` there only shifts layout and does not enlarge the hit area. The README states that text links are 44px on a phone, so the plan and the mockup disagree. These links gate real steps: Show done (audit request list), Find in Finance and Link to Mercury SAFE (the SAFE funding journey). Desktop is fine: no desktop link is under 24px except the link inside the mock email body, which is email content (`targets-1400.txt`). |
| V4-04 (`link-sent` left aligned like `link-dead`) | Not fixed | `1400-link-sent.png` and `390-link-sent.png` (and the dark pair) still center the text, so on a phone "Check spam." sits alone on a centered second line. The resolution table says it is left aligned. Cause: the `link-sent` section is `class="portal landing"` and lacks the `left` modifier that `link-dead` has (`mockup.html` lines 657 and 665). |

### Confirmed fixed

- W-02 (typed-in rows stack on a phone): in `390-inv-native.png`, `390-dark-inv-native.png`, `390-inv-changed.png`, `390-inv-notsaved.png` every holder is a label and value stack; Security, Shares and Invested inputs are 240px wide and 44px high; no input has clipped content (no CLIP line in any targets file). "3,300,000" and "1,400,000" show in full in both themes.
- V4-01 (unselected radio outline): the radio CSS now draws a 1.5px outline unselected and a ring with a dot when selected (`mockup.html` lines 68 and 69). The only radio in the mockup is the checked one in `safe-link`, which is clearly the selected one in light and dark (`390-dark-safe-link.png`); the unselected look cannot be seen in any view, so this is confirmed from the CSS, not from a screenshot.
- V4-02: `390-ed-failed.png`, `390-dark-ed-failed.png`, `390-ed-unknown.png`: the back button is an arrow only and "Partly sent" stays on the title row.
- V4-03: `390-inv-partly.png`: "Tom Okafor failed" is on its own line, no trailing separator.
- V4-05: `1400-inv-native.png`: "Invested" header ends at x 1211 and "Fully diluted" starts at x 1251, so they no longer touch.

Round-4 views checked specifically in dark: the typed-in cap table, editor states (unticked, unknown outcome, failed recipient, no Gmail, board with no Gmail), Update sending, posted and partly sent rows, SAFE dialogs (terms, cover summary, Mercury link) and every Mercury-connected Fundraising view. Layouts match the light versions. Disabled recipient checkboxes are visible empty outlines, the sticky editor footer keeps Send, Send again and Done in view on a phone, and dialogs fit 390px with Cancel and the primary button on one row.

## Part 2. New findings

Counts: 0 blocker, 0 must-fix, 0 new should-fix, 3 nice.

### Nice

- **V5-01. Long holder names clip in the typed-in cap table on a phone.** The Holder input is 208px wide at 390 (`inv-native`); a 40 character name ("Northwind Ventures Fund III Co-Invest LP") has `scrollWidth` 277 against `clientWidth` 206, so the end is cut. The mock names are short enough to hide it. Measured by setting the value in the page. Fix: let the Holder input take the full row width and move the percentage and actions to the label row, or wrap the name.
- **V5-02. Fundraising scrolls 20px at 1400x900.** `1400-fundraising.json`: `main` clientH 859, scrollH 879. A dashboard that is one screen of content scrolls for a small strip below the Pipeline card. Trim the vertical gap under the round card or the Pipeline card padding so it fits 900px.
- **V5-03. `safe-link` shows a one-option radio list.** `390-safe-link.png`, `1400-safe-link.png`: a single radio is a choice with nothing to choose. When there is exactly one candidate the dialog could state it as text and keep Link as the action, which removes a control. Only matters when a single Sent SAFE is unlinked, the common case for this dialog.

## What is excellent as is

- Dark mode: zero contrast hits across 50 captures; typed-in rows, status tags, scrim and dialogs are consistent with light.
- Editor states: one filled button per state (Send, Send again, Done, Connect Gmail to send), all 44px high on a phone, footer sticky.
- Portal on a phone: one primary action per view, Open and Download at 44px, no sub-44 target on any portal view.
- Popover menus on a phone (source, row, stage, round) are all 44px items now.
- Typed-in rows on a phone in both themes: clear label and value pairs, right-aligned numbers, Security select shows "Seed Preferred" in full.

## Counts for the loop

Round-4 items not actually fixed: 2 (N-07/W-01 for four `.lnk.b` links, V4-04). Both are one-line CSS or markup fixes. New: 0 blocker, 0 must-fix, 0 new should-fix, 3 nice. The loop stop rule is not met only because W-01 (should-fix in round 4) is still open on four links.

## Round 5 resolution

| Id | Resolution | Where |
|----|------------|-------|
| N-07 / W-01 | Fixed, measured 44px at 390px for all four links. | `mockup.html` phone query |
| V4-04 | Fixed. `link-sent` has the `left` modifier like `link-dead`; the text reads left aligned with "Check spam." on the second line as normal wrapping. | `mock-link-sent*.png` |
| V5-01 | Fixed. Holder is a field that wraps (a 40 character name wraps to two lines at 390px, 59px high, no clipping). Plan states it. | `mock-inv-native*.png`, README Typed-in table |
| V5-02 | Fixed. Fundraising has no vertical scroll at 1400x900 (main scrollHeight equals clientHeight; only the open stage menu overflows). | `mockup.html` main padding, `.cols` margin |
| V5-03 | Fixed. One candidate reads as text with Link as the action; a radio list only for more than one. | `mock-safe-link*.png`, README SAFEs |
