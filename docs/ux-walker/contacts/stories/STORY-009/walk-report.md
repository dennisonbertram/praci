# STORY-009 A week of agent mail reading, then who is our lawyer (pass)

The stack already held contacts added by other walkers (10 rows), so counts differ from the catalog.
- Step 1-2: Contacts lists all contacts; no added-by column or new-marker (by design; the dialog now has Added by for agent-saved contacts, not walked here).
- Step 3: Kind Legal now lists the legal contacts (Fictional Law Group is Legal), so the first move works.
- Step 4: searching lawyer matches a contact whose notes contain the word; counsel matches Fictional Law Group through its notes (notes are searched now). 409A matches a note on another contact.
- Step 5-6: law shows Fictional Law Group (and one other contact with law in its notes); the row shows email, organization and kind Legal.
- Step 7: opening the row shows the Edit contact dialog with notes "outside counsel".
- Step 8: Cap table (All) does not list Fictional Law Group at all, because Cap table shows only Investor, Auditor and Other kinds. Legal contacts are only on Contacts.
- Step 9: asked Chief "who is our lawyer" (read only). It answered that the saved legal contacts are Ben Sample (WalkB) at Auditwell Legal Partners and Fictional Law Group, listed as outside counsel. This matches the Kind Legal list on Contacts.
- There is no new-chat control: the sidebar plus button opens a To picker (New bot, New group, New space), so the existing Chief thread was used. The drafted composer text was cleared afterwards.
- Phone: law shows Name and Kind only; no overflow. Geometry: no spills beyond the focus ring. Errors: none.

## Flow Log
Actual 3 (Contacts, search law, read row), ideal 3. No hesitation.
