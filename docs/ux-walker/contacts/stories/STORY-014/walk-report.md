# STORY-014: Duplicate email then Open existing

Session walk-b, 1280x800 plus one 390x844 check. Screenshots in `screenshots/`.

## Screens
Adding 'B. Sample (WalkB)' with an upper-case copy of Ben's email keeps the dialog open; the error 'Another contact already has this email.' appears under Email with 'Open Ben Sample (WalkB)'; typing in Email moves the message to the bottom and drops the button (F-014-01); retrying and clicking Open switches to Edit contact for Ben; Notes edit saved, still one Ben row.

Geometry audit: no horizontal overflow on any state. Flagged items were the sidebar rows and the dialog form padding (16px), neither visible as a defect.

## Result
pass with one low finding. Phone list OK (screenshot taken after load).

## Flow Log
Actual 6 steps (ideal 6). Hesitation: stale error after editing the email.
