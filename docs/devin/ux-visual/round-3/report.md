# ux-visual round 3: verification of mockup v5

Counts: P0 0, P1 0, P2 0, P3 2. R2-01 to R2-05 all pass, measured against the real components in Storybook. Screenshots in `shots/` (not committed); measurements in `audit-*.json`; external critiques in `second-opinion.json`.

## Verification

| id | Check | Result |
|---|---|---|
| R2-01 | Radii: dialog 16, buttons and input 12, close 10, logo tile 10 | pass (measured equal to real) |
| R2-02 | Panel header BotAvatar | pass (shape, shadow, eyes match at 8x) |
| R2-03 | Stacked toast | pass (two edges, 11px inset, 12px apart, +1 pill) |
| R2-04 | Error row reason | pass; tile 3 equals 3 rows |
| R2-05 | Rounded 3px ring at 50%, whole row | pass |
| V4 | Row hit area | pass (7 of 7 rows resolve to the row link at 10/50/90% width) |
| Keyboard | Tab order and visible ring in all 22 frames | pass |

## Findings

| id | element | problem | sev |
|---|---|---|---|
| R3-01 | Toast card radius | 12px; real toast is 16px | P3 |
| R3-02 | Sidebar count | weight 500; real glance value is 400 | P3 |

Rejected external claims: toast has no close (hover/focus only, as real); stack hides the second card (real anatomy); tiles read as filters (non-interactive; unconfirmed against Legal because that story did not load); key-rejected looks washed out (decided V2); agent-missing panel empty (decided V5); narrow layouts (decided V9); raw unknown status text (plan GAP-03); connect button behind the dialog (presentation artifact); purple bubble and composer (match real).

Audits: no horizontal overflow at 1440, 900 or 375. Contrast flags are the shared tokens deferred as V10.
