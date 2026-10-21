# STORY-012: Validation

Session walk-b, 1280x800 plus one 390x844 check. Screenshots in `screenshots/`.

## Screens
Save is disabled while Name is empty or spaces only (no hint why); with Email 'eve@' Save shows the browser's native bubble and sends nothing; completing the email and pressing Enter submits and closes the dialog, focus returns to Add contact.

Geometry audit: no horizontal overflow on any state. Flagged items were the sidebar rows and the dialog form padding (16px), neither visible as a defect.

## Result
pass. Phone dialog stacks Save above Cancel, no overflow (form spill flag is dialog padding, not visible).

## Flow Log
Actual 4 steps (ideal 3). Hesitation: disabled Save has no reason shown (catalog-known, by design).
