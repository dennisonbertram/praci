# STORY-006 Empty address book, loading, load failure (pass, one suggestion)

- Step 1 (loading): a grey skeleton block appears under the heading before the list (seen on first open in STORY-001; the stack has no way to slow the network).
- Step 2: in the seeded Empty space, Contacts shows only "No contacts yet"; Search and Kind are hidden. The only way forward is the header Add contact button.
- Step 3: Add contact is top right, same as with data.
- Step 4 (failure): with the contacts request blocked in the browser only, the page shows red "Could not reach the server" and a Try again button; Add contact still shows.
- Step 5: pressing Try again while still blocked keeps the error; after the block was removed, Try again loaded the list with no page reload.
- Comparison: Cap table in the same empty space shows the Carta card and "Add your investors, auditors and counsel here. Contacts are your address book." in the body, so it guides more than Contacts.
- Phone: same order, no overflow. Geometry: no spills. Errors: only the blocked request.
- Cleanup: request block removed; browser returned to the Northwind space.

## Flow Log
Actual 2 (open, Add contact), ideal 2. Hesitation: empty body offers no button or hint.
