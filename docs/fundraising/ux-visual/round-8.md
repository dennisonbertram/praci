# UX visual review, round 8

Scope: all 56 mockup views at 1400px and 390px in light mode (112 captures), plus the 22 views re-rendered in round 7 in dark mode at both widths (44 captures), 156 screenshots in total. The 22 are: fundraising, fund-roundmenu, fund-editround, fund-stage, fund-prospect, fund-safemenu, fund-mark, safe-assign, fund-waitmenu, fund-close, fund-sync, fund-closed, safe-mercury, editor, ed-tbd, ed-sending, ed-failed, ed-nogmail, ed-unticked, ed-unknown, ed-boardnog, inv-partly. Screenshots: `docs/fundraising/ux-visual/round-8/screens/` (`<width>-<view>.png`, `<width>-dark-<view>.png`; 1400 at 1400x1700, phone full page, scrims and toasts sit at viewport position in tall captures, a capture effect). Raw `layout-audit.js` output for all 156 captures is in `round-8/audit/` (`<width>[-dark]-<view>.json`), and a tap-target list per phone capture (every button, link, input, select and textarea under 44 in width or height) is in `round-8/audit/tg-390[-dark]-<view>.txt`. Browser: agent-browser session `ux-visual-fundraising-r8`, theme set through `data-theme`. Audit viewport 1400x900 and 390x844.

Coverage: I opened with Read all four variants (1400 and 390, light and dark) of each of the 22 views (88 images), plus the 390 light capture of the other 34 views. Nothing was checked by audit alone.

Audit totals: horizontal page scroll 0 in all 156; `offscreenPrimary` empty in all; contrast hits are only the recorded shared-token items (warning text 3.49 to 3.64:1, success 4.35:1, the "TBD" mark 3.64:1), not re-raised; dark has zero contrast hits. The `overlaps` entries are all a dialog or menu drawn over the page behind it (false positives of the script). Tap targets: after excluding the mockup's own "View" select, no product control is under 44 in width or height at 390 in any of the 156 captures (checkboxes are measured by their 44px-high label, the 18px box is inside it).

## Part 1. Round 7 items

Counts: 2 of 2 confirmed fixed, 0 not fixed.

| Id | Status | Evidence |
|---|---|---|
| N7-1 (arrow-only back button 38x44) | Confirmed. Measured 44x44 at 390 on `ed-unticked` and listed as 44x44 in every editor capture; it no longer appears in any `tg-390*` file. | `screens/390-editor.png`, `390-dark-editor.png` |
| N7-2 (disabled checkbox nearly invisible) | Confirmed. Disabled box is a dashed outline, visible next to the ticked and unticked boxes in light and dark. Computed style: border colour rgb(107,107,107) light and rgb(154,154,154) dark, opacity .7, dashed. The computed border width is 1px, not the 1.5px written in the round-7 resolution; the dashes still read clearly, so this is not a finding. | `screens/1400-ed-unticked.png`, `1400-dark-ed-unticked.png`, `390-ed-unticked.png` |

Round 7 re-renders checked in dark: the 13 Fundraising views, 8 editor views and inv-partly are consistent with light (filled primary buttons invert, tags and menus keep their contrast, the dashed disabled box shows in dark).

## Part 2. New findings

Counts: 0 blocker, 0 must-fix, 1 new should-fix, 1 nice.

### Should-fix

- **V8-1. At 390 the "partly sent" update row makes the Updates and Contacts cards 25px too wide and clips their right edge.** In `inv-partly` the row "Tom Okafor: delivery unknown" (`.warnl.nw`, no-wrap) pushes the shared two-column grid track wider than the screen. Measured with `getBoundingClientRect` at 390: the Updates and Contacts cards span x 16 to 399 (viewport 390, normal card span 16 to 374), so the cards lose their right gutter and their right border and padding are cut off by the viewport; every other card on the page and the same two cards in the 33 other Investors views stay at 16 to 374. Page scroll is 0 because the overflow is clipped, which is why the audit did not flag it. Seen in `screens/390-inv-partly.png` and `390-dark-inv-partly.png` (the Updates card has no visible right edge and the Retry and row-menu buttons sit against it). This is the state after a partly sent monthly update, a core journey, and round 7 said this row "fits at 390", which was true for the row but not for its card. Norm: L2/L6, reflow not overflow. Fix: let the warning line wrap on a phone (drop `nowrap` below the breakpoint) or give the grid column `min-width:0`. Re-measure all cards at 390 afterwards; the other 55 views have every card within 16 to 374.

### Nice

- **N8-1. The SAFE row menu on the last SAFE row is cut off at the bottom of the phone page.** In `390-fund-safemenu.png` the menu opens below the Harbor Angels row, but the page ends 41px below the menu top, so only "Open" shows and Mark funded, Cancel SAFE and Delete are not visible (menu bottom 1660 against page height 1506, measured). This is a mockup positioning effect (an absolutely placed menu with no room below); the real Base UI popover flips above or scrolls. Worth a note in the plan's phone section that row menus must flip, no copy or design change.

## What is excellent as is

- All 22 round-7 views render the same structure in light and dark; the dark primary buttons, struck and muted rows, and tags keep their meaning without relying on colour alone.
- Fundraising at 1400x900 has no page scroll or scroll container and the five dialogs (Edit round, Add prospect, Mark funded, Assign to prospect, Close round) each fit 390 with Cancel and one primary button on one row.
- Phone tap targets: zero product controls under 44 in width or height across 156 captures.
- Editor footer states (TBD prompt, sending, failed, unknown, no Gmail, board with no Gmail) each show one filled button and a one-line question, with the footer wrapping cleanly to two rows at 390.
- Portal pages at 390 (portal, nothing shared, update email, link landing, dead link) are single column, nothing clipped.

## Counts for the loop

Round-7 items not actually fixed: 0. New: 0 blocker, 0 must-fix, 1 should-fix (V8-1), 1 nice (N8-1). The stop rule is not met for this lens because of V8-1.

## Round 8 resolution

| Item | Resolution |
|------|------------|
| V8-1 | Fixed. `.cols` tracks are `minmax(0,1fr)` and the nowrap warning line wraps below 900 px. Measured at 390 on `inv-partly`, `investors`, `inv-sent`, `inv-posted`, `ed-unknown`, `fundraising` and `safe-assign`: every card spans 16 to 374. `mock-inv-partly-phone` re-rendered and opened. |
| N8-1 | Left. Mockup-only clipping of absolutely placed menus at the page bottom; the plan's tap-target section now says real row menus flip or scroll. |
