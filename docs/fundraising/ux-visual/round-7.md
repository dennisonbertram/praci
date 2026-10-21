# UX visual review, round 7

Scope: all 55 mockup views at 1400px and 390px in light mode (110 captures), plus the 35 views re-rendered in round 6 in dark mode at both widths (70 captures). The 35 are: ed-failed, ed-sending, ed-tbd, ed-unknown, ed-unticked, editor, fund-close, fund-closed, fund-editround, fund-mark, fund-prospect, fund-roundmenu, fund-safemenu, fund-stage, fund-sync, fundraising, inv-addcontact, inv-audit, inv-auditdone, inv-contactmenu, inv-copylink, inv-menu, inv-partly, inv-posted, inv-reminder, inv-sending, inv-sent, inv-share, inv-unblock, inv-updmenu, investors, portal-email, safe-dialog, safe-link, safe-terms. Screenshots: `docs/fundraising/ux-visual/round-7/screens/` (`<width>-<view>.png`, `<width>-dark-<view>.png`). Raw `layout-audit.js` output for all 180 captures and a tap-target list per capture are in `round-7/audit/` (`<width>[-dark]-<view>.json`, `tg-<width>[-dark]-<view>.txt`). Browser: agent-browser session `ux-visual-fundraising-r7`, theme set through `data-theme`. Audit ran at 1400x900 and 390x844; 1400 screenshots were taken at 1400x1700, phone screenshots are full page (scrims and toasts sit at viewport position in tall captures; a capture effect).

Coverage: I opened with Read the 1400 and 390 captures in light and dark of the views I could not skip for the round-6 changes (fundraising, investors, ed-unticked at 1400 both themes), all 35 changed views at 390 light except inv-audit, inv-contactmenu, inv-copylink, inv-menu, inv-posted, inv-reminder, inv-sending, inv-sent, inv-unblock (these share the Investors page body that I opened in 6 other states; their audits are clean), and all 20 unchanged views at 390 light. Dark was opened for fundraising (both widths), investors (1400), fund-stage (1400), fund-sync (1400), ed-unknown (390), inv-partly (390), safe-terms (390), ed-unticked (1400). The remaining dark captures were checked by audit only, not by eye. Very tall phone pages are downscaled by the reader.

Audit totals over 180 captures: horizontal page scroll 0 in all; `offscreenPrimary` empty in all; the only contrast hits are in light mode and are the recorded shared-token items (`--warning` 3.49 to 3.64:1, `--success` 4.35:1; "TBD" mark 3.64:1), not re-raised. Dark mode has zero contrast hits.

## Part 1. Round 6 items

Counts: 2 of 2 confirmed fixed.

| Id | Status | Evidence |
|---|---|---|
| V6-01 (dark unticked checkbox filled grey) | Confirmed. Unticked is an empty outline, ticked is a filled box with a check, disabled is a dim outline, in both themes. Measured on the live page: ticked fill 18.1:1 (light) and 16.4:1 (dark) against the background; unticked border 5.11:1 (light) and 6.81:1 (dark); all 18px. All three states are distinguishable by shape and fill, and the unticked border passes 3:1 in both themes. Disabled border is 1.11:1 light and 1.17:1 dark (opacity .6, 1px border), see N7-2. | `screens/1400-ed-unticked.png`, `1400-dark-ed-unticked.png`, `390-ed-unticked.png`, `390-dark-ed-unknown.png` |
| V6-02 (uneven cap-table rows) | Confirmed. At 1400 "Options granted" and "Option pool (unallocated)" rows are at y 698 and 739, the same 41px step as the holder rows above (y 534 to 657). The SAFE subtotal row is taller on purpose (45px band). | `screens/1400-investors.png`, `1400-inv-partly.png` |

Round 6 changes seen in the screens: the held-out SAFE row (D. Whitfield) reads as struck-through amount "$100,000", the "Sent" tag, and "Not counted until linked" under the date, clearly different from the muted Draft row below it, in light and dark and at both widths (`1400-fundraising.png`, `390-dark-fundraising.png`); the struck amount stays legible. The partly-sent update row ("Tom Okafor unknown", Partly sent chip, Retry, row menu with Mark delivered) fits at 390 without wrapping into the chip (`390-inv-partly.png`). The editor Unknown state has a clear footer: question, Mark delivered, Cancel, Send again, with one filled button (`390-ed-unknown.png`, dark pair).

## Part 2. New findings

Counts: 0 blocker, 0 must-fix, 0 new should-fix, 2 nice.

### Nice

- **N7-1. Phone editor back button is 38x44.** `tg-390-editor.txt` and the 13 other editor views list `BUTTON.btn "← Investors" 38x44`. It is the arrow-only back button (V4-02); height is 44 but width is 6px under the 44px touch minimum, and it sits next to the 38px-wide menu button. Round 6 said no product element was under 44px on a phone; that measurement missed this width. Norm I4. Fix: give the arrow-only variant `min-width:44px`.
- **N7-2. Disabled recipient checkboxes are nearly invisible.** Border 1.11:1 (light) and 1.17:1 (dark) against the background in Marcus Webb and Nate Cho rows (`390-ed-unticked.png`). Disabled controls are exempt from 3:1 and the name plus reason ("no email", "revoked") is readable, so this is not a failure, but the box is almost gone. Fix, optional: drop the extra opacity .6 on the disabled border.

## What is excellent as is

- Checkbox states in both themes: three clearly different states, unticked at 5:1 or better, hit area inside a 44px high label on a phone.
- The held-out row treatment: strike, tag and one short warning line, no new chrome.
- Dark mode: zero contrast hits across 70 captures; menus, dialogs, tags and the sync-failed pill match light.
- Every Fundraising dialog fits 390px with Cancel and one primary button on one row (`390-fund-editround.png`, `390-fund-close.png`, `390-safe-terms.png`).
- Fundraising at 1400x900 has no page scroll or scroll container in the audit.

## Counts for the loop

Round-6 items not actually fixed: 0. New: 0 blocker, 0 must-fix, 0 new should-fix, 2 nice. The stop rule is met for this lens.

## Round 7 resolution

| Id | Status | Resolution |
|---|---|---|
| N7-1 | Fixed | Arrow-only back button is 44x44 on a phone (measured 44 x 44 in the mockup); plan tap-target line updated. |
| N7-2 | Fixed | Disabled checkbox uses a 1.5px dashed border at opacity .7: about 2.8:1 (light) and 3.9:1 (dark) against the background, still distinct by dashes (`mock-ed-unticked`). |
