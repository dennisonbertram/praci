# STORY-001 Open Contacts from the sidebar (pass)

- Step 1: the sidebar Pages group lists Inbox, Finance, Legal, Cap table, Contacts, Data room, Artifacts; the first-run tour card appeared over the page and was skipped with "Skip tour".
- Step 2: one click on Contacts opens /app/contacts with a short skeleton, then the heading, Add contact, Search, Kind pill and table.
- Step 3: the table shows Name, Email, Organization, Kind with the five seeded contacts; the demo law firm is kind Legal.
- Phone (390x844): Name and Kind only, Search full width, Kind pill beneath; no horizontal overflow.
- Geometry: pageOverflowX 0, no spills. Flagged uneven rows are sidebar chat rows (name versus time) and td cells that are intentionally truncated.
- Errors: none.

## Flow Log
Actual steps 1, ideal 1. No hesitation; the page does not say where contacts came from (known, not a regression).
