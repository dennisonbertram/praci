# STORY-016: Delete on Cap table then Undo

Session walk-b, 1280x800 plus one 390x844 check. Screenshots in `screenshots/`.

## Screens
On Cap table Other tab, Eve (WalkB) dialog shows Carta hint (expected on Cap table); Delete closes at once and a bar 'Deleted ... Undo Dismiss' appears; Undo shows 'Restored ...' and the row returns, but the bar covers the row for about 5 s (F-016-01). Kind filter is in the URL (?kind=). Phone: header actions and Ask wrap cleanly, no overflow.

Geometry audit: no horizontal overflow on any state. Flagged items were the sidebar rows and the dialog form padding (16px), neither visible as a defect.

## Result
pass with one low finding.

## Flow Log
Actual 4 steps (ideal 5). No hesitation.
