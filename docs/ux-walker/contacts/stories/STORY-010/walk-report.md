# STORY-010 Two kinds of all: contacts versus holders (pass, one low finding)

Carta is connected in the demo.
- Step 1: Cap table at 1280 wide with the Carta agent panel open shows the columns Name, Email, Kind, Ownership; the Shares column has zero width. Holders (Maya Chen, River Cofounder, Early employees, Granted options, Unallocated pool) show a dash for email; contacts that are Investor or Other kinds show email, organization and a SAFE line where they have one.
- Step 2: rows for holders are plain text; contact rows are clickable names. Name text is cut with an ellipsis (for example "River Cofounder ...") while the Email column is 201 px wide and holds only a dash.
- Step 3: Contacts lists contacts only (Name, Email, Organization, Kind), with no Shares or Ownership; same contacts verified in STORY-001 and STORY-007. A final retake of this screen hit a slow "Opening your Space" load and was not repeated.
- Step 4: the Investors tab mixes holders and contacts (see STORY-007).
- Step 5 not walked: the "Add email" action on a holder row was not found in the page (holder rows had no button in the email cell or elsewhere), and creating a contact from a holder would not carry the WalkA tag, so no contact was created. Not logged as a bug because the catalog step may be stale.
- Phone (390): holder and contact rows show kind, organization and email stacked under the name; no overflow.
- Geometry: pageOverflowX 0, no spills. Errors: none.

## Flow Log
Actual 2, ideal 2. Hesitation: truncated names beside an empty Email column.
