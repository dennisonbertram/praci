# STORY-018: Add, edit, re-kind from Cap table

Session walk-b, 1280x800 plus one 390x844 check. Screenshots in `screenshots/`.

## Screens
Investors tab 'Add investor' dialog starts at Investor; offline Save shows 'Could not reach the server' and keeps all four fields; online Save closes with 'Saved Faye Capital (WalkB)', scrolls to and highlights the row; email edit saved; Kind to Other removes the row from Investors (F-018-01), it appears on Other and on Contacts with the new email and kind; open and Cancel changes nothing. Phone dialog OK.

Geometry audit: no horizontal overflow on any state. Flagged items were the sidebar rows and the dialog form padding (16px), neither visible as a defect.

## Result
pass with one suggestion.

## Flow Log
Actual 12 steps (ideal 12). Hesitation: where did the re-kinded row go.
