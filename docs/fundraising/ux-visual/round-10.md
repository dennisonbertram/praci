# UX visual review, round 10

Scope: all 59 mockup views at 1400px and 390px in light mode (118 captures), plus the 4 views changed in round 9 (fund-mercmenu, fund-unmenu, safe-assign, link-dead) in dark mode at both widths (8 captures): 126 screenshots. Screenshots are in `docs/fundraising/ux-visual/round-10/screens/` (`<width>-<view>.png`, `<width>-dark-<view>.png`). 390 captures are full page; 1400 captures are 1400x900. Raw `layout-audit.js` output for every capture is in `round-10/audit/` (`<width>[-dark]-<view>.json`). Direct measurements per phone capture (`audit/m-390[-dark]-<view>.txt`): `.card` boxes outside 16 to 374, visible elements past the right edge, and buttons, links, inputs, selects and textareas under 44 in width or height. Browser: agent-browser session `ux-visual-fundraising-r10`, theme set through `data-theme`. The capture and measurement scripts are `round-10/run.sh` and `round-10/m.js`.

Coverage: I opened with Read all 16 captures of the 4 changed views (light and dark, 390 and 1400) and the 390 light capture of the other 55 views (all 59 at 390 light in total). The remaining 1400 light captures were measured by audit only.

## Measured results

- Cards: no `.card` is outside 16 to 374 in any of the 63 phone captures (light and dark). No visible element extends past the right edge. `pageScrollX` is 0 and `offscreenPrimary` is empty in all 126 audits.
- Tap targets: every phone control is at least 44 in width and height. The only items the script flagged are the 18px checkbox inputs on `editor`, `ed-*`, `fund-editround`, `fund-start`, `inv-share` and `safe-terms`; I measured their wrapping labels directly and each is 44px high (358 wide on the editor, 324 wide in dialogs), so they are not targets under 44. The `fund-unmenu` popover rows are 44px high. The mockup's own "View" select is excluded.
- Contrast: only the recorded shared-token items appear (warning text 3.49 to 3.64:1, "Sent" 4.35:1, the "TBD" mark 3.64:1). I did not re-raise them. No other element was flagged, and there are no hits in any dark capture.
- Scroll containers at 1400x900: the main column scrolls by 50px on the Fundraising views (859 high, content 909), unchanged since round 8 and 9.

## Part 1. Round 9 items

Counts: 1 of 1 fixed item confirmed, 0 not fixed.

| Id | Status | Evidence |
|---|---|---|
| V9-1 (dead-link email form narrower than the other portal pages) | Confirmed fixed. At 390 the email field and the "Email me a link" button both span x 32 to 358 and are 44px high, so the left and right gutters are both 32px, the same as `portal`, `portal-empty` and `portal-email`. The 1400 view is unchanged (300px field, content-width button). Dark is consistent: the field keeps its border, the button inverts to light. | `screens/390-link-dead.png`, `390-dark-link-dead.png`, `1400-link-dead.png`, `1400-dark-link-dead.png` |

The other three views changed in round 9 render correctly in both themes and widths:

- `safe-assign` (390 and 1400, light and dark): dialog title, amount and date line, Contact select, then Cancel and a filled Assign button on one row; scrim dims the page; the D. Whitfield row shows "Sent" and "Assign to contact". At 390 the scrim covers only the first 844px of the full-page capture, which is the same fixed-overlay capture effect seen in earlier rounds, not a layout defect.
- `fund-unmenu`: the menu opens below the D. Whitfield row with Open, Assign to contact and Not from pipeline at 1400. At 390 only "Open" is visible because the mockup positions it below the last row; this is the already skipped item N8-1 and the skip reason still holds.
- `fund-mercmenu`: Open and Unassign next to the Lakeside Capital row, fully visible at 390 and 1400, light and dark.

## Part 2. New findings

Counts: 0 blocker, 0 must-fix, 0 new should-fix, 0 nice.

I found nothing new in the 59 phone views or in the dark renders of the four changed views.

## What is excellent as is

- All 59 phone views are single column with no horizontal overflow and a 16px card gutter (32px on portal pages, consistently).
- Phone tap targets are 44px or more everywhere, including row menus, Retry buttons, checkbox rows and the Send SAFE button on the pipeline row.
- Dialogs (Send SAFE, different terms, cover summary, assign, mark funded, edit round, start a round, add prospect, add contact, share, copy link) each fit the 390 width with Cancel and one filled primary button on one row.
- Editor footer states (TBD prompt, sending, failed, unknown, no Gmail, board with no Gmail) each show one filled button and a one-line status, wrapping cleanly.
- Light and dark are consistent for the four changed views: filled buttons invert, borders and tags stay readable, status tags carry a text label.

## Counts for the loop

Round-9 items not actually fixed: 0. New: 0 blocker, 0 must-fix, 0 should-fix, 0 nice. The stop rule is met for this lens.
