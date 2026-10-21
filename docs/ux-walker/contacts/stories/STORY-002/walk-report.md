# STORY-002 Hide Contacts, reach it anyway, restore it (pass)

- Step 1: Page options on the Pages heading opens a checkbox menu with all seven pages checked.
- Step 2: unchecking Contacts removes the sidebar row at once; the other rows move up.
- Step 3: sidebar search "Contacts" lists the page under PAGES even though it is hidden; selecting it opens /app/contacts with the list.
- Step 4: re-checking Contacts brings the row back after Cap table; it stayed visible after a reload. The row is shown again, so the shared demo user is left as found.
- Phone: only the restored list was checked at 390 wide (no overflow); the drawer menu itself was not exercised.
- Geometry: no spills. Errors: none.
- Note: other walkers share this user, so the row was hidden for about two minutes.

## Flow Log
Actual 3 (menu, uncheck, check), ideal 3. No hesitation.
