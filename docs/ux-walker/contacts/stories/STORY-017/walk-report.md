# STORY-017: Keyboard and Escape

Session walk-b, 1280x800 plus one 390x844 check. Screenshots in `screenshots/`.

## Screens
About 40 Tab stops through the sidebar before the first page control (Skip to content link exists); name buttons show an underline on focus; Enter opens the dialog; Enter in Organization saves, closes, focus returns to the name button and the row highlights; Escape discards edits with no prompt; Tab order in dialog is Name, Email, Organization, Kind, Notes, Delete, Cancel, Save, Close with focus trapped; Space on Cancel closes. Contacts Delete now shows a bar with Undo, but an agent notification toast covered it and the click failed (F-017-01), so Dev Advisor (WalkB) stayed deleted.

Geometry audit: no horizontal overflow on any state. Flagged items were the sidebar rows and the dialog form padding (16px), neither visible as a defect.

## Result
fail (one medium finding). Phone list OK.

## Flow Log
Actual about 45 key presses; ideal 8 from the page. Hesitation: long Tab path through sidebar.
