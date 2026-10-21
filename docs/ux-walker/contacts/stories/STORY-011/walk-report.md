# STORY-011: Add a contact from Contacts

Session walk-b, 1280x800 plus one 390x844 check. Screenshots in `screenshots/`.

## Screens
Contacts list (5 seeded rows) with search, Kind filter and Add contact; Add contact dialog opens with Name focused, Kind Other and Save disabled; after typing Name, uppercase Email and Kind Advisor, Save enables; after Save the dialog closes and the new row sorts into place with a subtle highlight and the email lower-cased; no Carta hint on Contacts.

Geometry audit: no horizontal overflow on any state. Flagged items were the sidebar rows and the dialog form padding (16px), neither visible as a defect.

## Result
pass: 'Dev Advisor (WalkB)' saved as Advisor with email lower-cased; row highlighted. Phone: Kind column only, no overflow.

## Flow Log
Actual 5 steps (ideal 5). Hesitation: no 'Saved' toast on Contacts, only the row highlight.
