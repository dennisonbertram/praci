# STORY-003 Search by organization and by email (pass)

- Step 1: typing quill narrows to Priya Placeholder; the URL gains ?q=quill and the x (Clear search) appears.
- Step 2: example.test matches every row. Step 3: dana@ matches only Dana Fakename.
- Step 4: Escape clears the box and the URL; all rows return.
- Variations: QUILL matches (case-insensitive); outside (a note word) matches Fictional Law Group and SAFE matches two investors, so notes are now searched; kind words such as investor also match; ven matches Dana via Acme Ventures; three spaces show everyone.
- No matches (zzzz) shows "No matches" with a Clear filters button.
- Leaving through the sidebar and returning gives a fresh list; browser Back restores the search from the URL.
- Phone: search row full width, Name and Kind only; geometry reports a 5 px spill on the search group, which is the focus ring, not a defect.
- Errors: none.
- Automation note: the browser process died twice during the session (not tied to an app action), and Control+a did not select text; neither is logged as an app bug.

## Flow Log
Actual 2 for the first search, ideal 2. No hesitation.
