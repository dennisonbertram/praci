# UX visual review, round 9

Scope: all 59 mockup views at 1400px and 390px in light mode (118 captures), plus the 8 views re-rendered in round 8 in dark mode at both widths (16 captures), 134 screenshots in total. The 8 views: fund-waitmenu, safe-assign, fund-prospect, inv-partly, fundraising, safe-email, fund-unmenu, fund-mercmenu. Screenshots: `docs/fundraising/ux-visual/round-9/screens/` (`<width>-<view>.png`, `<width>-dark-<view>.png`). The 1400 captures of the 8 re-rendered views are 1400x1700 so the scrolling main column is fully visible; the other 1400 captures are 1400x900. Phone captures are full page at 390x844. Raw `layout-audit.js` output for all 134 captures is in `round-9/audit/` (`<width>[-dark]-<view>.json`). Direct measurements per phone capture (`m-390[-dark]-<view>.txt`): bounding boxes of every `.card` outside 16 to 374, every visible element past the viewport edge, and every button, link, text input, select, textarea and checkbox label under 44 in width or height. Browser: agent-browser session `ux-visual-fundraising-r9`, theme set through `data-theme`.

Coverage: I opened with Read all four variants (1400 and 390, light and dark) of the 8 re-rendered views (32 images) and the 390 light capture of the other 51 views (51 images). Nothing was checked by audit alone.

Measured results:
- Cards: no `.card` is outside 16 to 374 in any of the 67 phone captures (light and dark). I also confirmed on `inv-partly` that the six cards each span 16 to 374. No element extends past the right edge of the viewport in any capture. Page scroll X is 0 and `offscreenPrimary` is empty in all 134.
- Tap targets: every product control in all 67 phone captures is at least 44 in width and height (checkbox rows are measured by their 44px label). The mockup's own "View" select is excluded.
- Contrast: only the recorded shared-token items appear (warning text 3.49 to 3.64:1, "Sent" 4.35:1, the "TBD" mark 3.64:1), not re-raised. Dark has zero hits.
- Scroll containers: the 1400 main column scrolls by 50px on the Fundraising views (it is 859 high, content 909) and by the same amounts as in round 8 on every other view; no change since round 8. The 1400x900 captures therefore cut off the "Passed 1" row; the 1700 captures show it. The round-8 text said the Fundraising page had no scroll container at 1400x900; that sentence was imprecise, but the layout is unchanged and nothing new is introduced.

## Part 1. Round 8 items

Counts: 1 of 1 fixed item confirmed, 0 not fixed. 1 item deliberately left.

| Id | Status | Evidence |
|---|---|---|
| V8-1 (partly sent row widens the Updates and Contacts cards at 390) | Confirmed fixed. On `inv-partly` all six cards span 16 to 374 (measured with `getBoundingClientRect`); the warning line "Tom Okafor: delivery unknown" wraps to two lines and the Retry and row-menu buttons keep their gutter. Card right edge and border are visible in light and dark. The same measurement is clean on all 67 phone captures. | `screens/390-inv-partly.png`, `390-dark-inv-partly.png`, `audit/m-390-inv-partly.txt` |
| N8-1 (row menu at page bottom is cut off on phone) | Left, as decided. Still seen in `390-fund-safemenu.png` and `390-fund-unmenu.png` (and the dark copy), where only "Open" shows because the mockup places the menu absolutely below the last row. The skip reason holds: it is a mockup positioning effect and the plan says real row menus flip or scroll. Not re-raised. | `screens/390-fund-safemenu.png`, `390-fund-unmenu.png` |

The 8 re-rendered views are consistent between light and dark: filled primary buttons invert (Send SAFE, Assign, Add prospect, Send SAFE in the email dialog), menus keep their border and text contrast, the scrim dims the page behind each dialog, tags (Funded, Signed, Sent, Partly sent) stay readable and carry a text label so colour is not the only signal, and the striped Pending segment of the round bar is visible in both themes. The three row menus (waitmenu, unmenu, mercmenu) open next to their row at 1400 and as a full-width-ish popover at 390 with 44px rows.

## Part 2. New findings

Counts: 0 blocker, 0 must-fix, 0 new should-fix, 1 nice.

### Nice

- **V9-1. The "Email me a link" form on the dead-link page is narrower than the other portal content, so its right gutter is 58px against 32px on the left.** At 390 in `390-link-dead.png` the email field spans x 32 to 332 and the button is content width, while the other portal pages (`390-portal.png`, `390-portal-empty.png`, `390-portal-email.png`) run their cards to x 358 (32px gutters). The page is not broken and the field is easy to hit (44px high), so this is polish: give the field the same 32px right gutter (full width) so the portal pages share one column. No copy change.

## What is excellent as is

- Every phone capture of all 59 views has no horizontal overflow, and every card keeps the 16px side gutter, including the Investors updates and contacts cards after a partly sent update.
- Phone tap targets are 44px or more everywhere, including the row menu buttons, the editor Retry buttons and the Send SAFE button on the pipeline row.
- The six-step SAFE dialogs (email, amount and date, different terms, cover summary, assign to contact, mark funded) each fit within the 390 viewport width with Cancel and one filled primary button on one row.
- Editor footer states (TBD prompt, sending, failed, unknown, no Gmail, board with no Gmail) each show one filled button and a one-line question or status and wrap cleanly to two rows at 390.
- Portal pages at 390 (home, nothing shared, update email, link landing, dead link, sent) are single column with nothing clipped.

## Counts for the loop

Round-8 items not actually fixed: 0. New: 0 blocker, 0 must-fix, 0 should-fix, 1 nice (V9-1). The stop rule is met for this lens.

## Round 9 resolution

| Id | Resolution |
|----|------------|
| V9-1 | Fixed in `mockup.html` (phone only): on `link-dead` the email field and "Email me a link" button now run full width to the same 32 px right gutter as the other portal pages. Re-rendered `mock-link-dead` in `ux-flow/screens/` (light, dark, 1400, 390); the 1400 view is unchanged. |
