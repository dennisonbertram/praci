# UX visual review, round 6

Scope: all 55 mockup views at 1400px and 390px in light mode (110 captures), plus the 18 views changed in round 5 at both widths in dark mode (36 captures): fundraising, fund-roundmenu, fund-editround, fund-stage, fund-prospect, fund-safemenu, fund-mark, fund-close, fund-sync, safe-link, safe-mercury, safe-cover, safe-dialog, ed-nogmail, ed-unticked, link-sent, inv-native, inv-auditdone. Screenshots are in `docs/fundraising/ux-visual/round-6/screens/` (`<width>-<view>.png`, `<width>-dark-<view>.png`). Raw `layout-audit.js` output for each of the 146 captures is in `round-6/audit/` (`<width>-<view>.json`), and tap-target measurements per capture are in `round-6/audit/tg-<width>-<view>.txt`. Browser: agent-browser session `ux-visual-fundraising-r6`, theme set through `data-theme`. At 1400 the audit ran at 1400x900 and the screenshots were taken at 1400x1700 (scrim, dialog and toast sit at viewport position in those tall captures; that is a capture effect).

Coverage: I opened every screenshot of the 18 changed views (light and dark, both widths, 72 images) and every other view at 390px light (37 images). I did not open the 1400px light captures of the 37 unchanged views individually; their audits are in `round-6/audit/`. Very tall phone captures (Investors, typed-in) are downscaled by the image reader, so small text there was checked by the geometry measurements instead of by eye.

Audit totals over all 146 captures: horizontal page scroll is 0 in all; `offscreenPrimary` is empty in all; reported overlaps are only hidden popovers behind open dialogs and menus (same as round 5); the only fixed overlays are the sticky editor footer, dialog scrims and toasts. Contrast hits in light mode are only the known `--warning` and `--success` items (3.49 to 4.35:1), not re-raised. Dark mode has no contrast hits.

## Part 1. Round 5 items

Counts: 5 of 5 confirmed fixed.

| Id | Status | Evidence |
|---|---|---|
| N-07 / W-01 (44px phone targets on `.lnk.b`) | Confirmed. "Show done", "Hide done", "Find in Finance", "Link to Mercury SAFE" and "Different terms" no longer appear in any 390px target list. The only phone elements under 44px are the mockup's own view selector (234x27, mockup chrome, not product UI), the 18px native checkbox inside a 44px high label row (measured: every `label.rc` and `label.chk` is 324 or 358 wide and 44 high), and the link inside the mock email body in `portal-email` (email content, same as round 5). Desktop: no link under 24px except that same email link (16px). | `round-6/audit/tg-390-*.txt`, `tg-1400-*.txt` |
| V4-04 (`link-sent` left aligned) | Confirmed. Text is left aligned with "Check spam." as the second wrapped line, light and dark. | `390-link-sent.png`, `390-dark-link-sent.png` |
| V5-01 (long holder names) | Confirmed in the capture. Holder is a field in the typed-in rows and no input in any view reports clipped content (no CLIP line in any target file). I did not retype a 40 character name in this round; round 5 measured that. | `390-inv-native.png`, `tg-390-inv-native.txt` |
| V5-02 (Fundraising scroll at 1400x900) | Confirmed. `1400-fundraising.json` has no scroll container. Only `fund-stage` scrolls (859 to 909) and that view has the Passed list expanded with a menu open. | `round-6/audit/1400-fundraising.json`, `1400-fund-stage.json` |
| V5-03 (one-candidate `safe-link`) | Confirmed. One candidate reads as text ("D. Whitfield $100,000 · Oct 19") with Cancel and Link; no radio. | `390-safe-link.png`, `1400-safe-link.png`, dark pair |

## Part 2. New findings

Counts: 0 blocker, 0 must-fix, 0 new should-fix, 2 nice.

### Nice

- **V6-01. In dark mode an unticked, enabled recipient checkbox is a filled grey square, while the disabled ones are empty outlines.** `390-dark-ed-unticked.png` and `1400-dark-ed-unticked.png`: Sam Lind (unticked, enabled) is drawn as a solid dark grey box; Marcus Webb and Nate Cho (disabled) are empty outlines. The usual cue is the reverse, and the filled box can read as "checked but dimmed". Observed in the screenshot; I did not inspect the CSS. Fix: draw the unchecked state as an outline in dark, as in light.
- **V6-02. Read-only cap table rows are uneven in height at 1400.** `1400-inv-auditdone.png`: "Options granted" and "Option pool (unallocated)" rows are about 28px apart (y 790 and 818) while every other holder row is about 41px (y 632, 673, 714, 755), so the two rows look cramped against their neighbors. Measured from the capture, not from the DOM. Fix: give these two rows the same padding as the other rows.

## What is excellent as is

- Dark mode: zero contrast hits across 36 captures; dialogs, menus, scrim, the sync-failed warning pill and status tags match light.
- Every Mercury-connected Fundraising dialog (edit round, add prospect, mark funded, close round, link, cover) fits 390px with Cancel and the primary button on one row, and has a single primary action.
- The new link text (V5-03) removes a control without losing the decision; Link is the only action.
- Editor footer: one filled button per state in all 8 editor views, all 44px high on a phone.
- Portal on a phone: one primary action per view, no product element under 44px.

## Counts for the loop

Round-5 items not actually fixed: 0. New: 0 blocker, 0 must-fix, 0 new should-fix, 2 nice. The stop rule is met for this lens.

## Round 6 resolution

| Id | Resolution |
|----|------------|
| V6-01 | Fixed. Checkboxes are drawn by CSS: unticked is an outline, ticked is filled with a check, disabled is a dimmed outline. Verified in `mock-ed-unticked-dark` (desktop). |
| V6-02 | Fixed. Empty action cells in cap table rows reserve the same height as rows with a menu button, so Options granted and Option pool rows match their neighbours (`mock-inv-partly-dark`). |
