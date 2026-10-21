# STORY-008 Find one contact on a phone (pass, one low finding)

All steps at 390x844.
- Step 1: the hamburger opens the drawer. Opened from a chat page (/app), the drawer list is scrolled down to the active chat and the Pages group, including Contacts, sits above the visible area (Contacts row top at -14 px). Opened from the Contacts page, the list starts at the top and Contacts is visible. Scrolling up with the mouse wheel did not move the list in this automation, so a touch scroll was not confirmed.
- Step 2: tapping Contacts closes the drawer and shows heading, Add contact, full-width Search, Kind pill and a Name and Kind table.
- Step 3: typing lee leaves one row, Lee Notarealperson, Investor; the URL gains ?q=lee. No email in the list.
- Step 4: tapping the name opens the Edit contact dialog with lee@angel.example.test, organization and notes; fits the screen with Save, Cancel, Delete stacked.
- Step 5: Cancel closes the dialog; the list still shows the one row and the search still reads lee.
- Geometry: pageOverflowX 0; spills of 5 px and 16 px are the focus ring on the search group and the focused dialog field, not defects.
- Errors: none.

## Flow Log
Actual 4 (drawer, Contacts, search, name), ideal 3. Hesitation: from a chat the Contacts row is out of sight in the drawer.
