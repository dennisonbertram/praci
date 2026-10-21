# STORY-005 Same table at four widths (pass)

- Sidebar open at 1400, 1280: Name, Email, Organization, Kind all visible, no overflow.
- Browser width 640 and 560 (below 1024 the sidebar is a drawer, so the page area is the full width): all four columns still show; names and emails truncate with an ellipsis and the table looks cramped.
- At 480 the Organization column disappears; at 440 and 390 only Name and Kind remain.
- Cap table at 440: Carta is connected here, so rows show kind and holding on one line, then organization, then email under the name, so it shows more than Contacts at the same width.
- Tapping Priya Placeholder opens the Edit contact dialog with Name, Email, Organization, Kind, Notes, Save, Cancel, Delete; it fits at 440 wide.
- Geometry: pageOverflowX 0 at every width; no spills; td cells flagged only where truncated on purpose.
- Errors: none. Dialog closed without saving.

## Flow Log
Actual 1 (resize), ideal 1. Hesitation: at narrow widths the email and organization are only in the dialog.
