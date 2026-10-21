# STORY-004 Filter by Kind, no matches, recover (pass)

- Step 1: the Kind pill opens a radio menu: Investor, Auditor, Customer, Vendor, Partner, Advisor, Legal, Other.
- Step 2: Auditor gave No matches this run because another walker changed the seeded auditor's kind to Advisor; the pill reads "Kind: Auditor" with a remove x and the page shows No matches plus a Clear filters button, which restores all rows.
- Step 3: Legal lists the Legal contacts including Fictional Law Group (demo law firm is Legal now); URL gains ?kind=legal.
- Step 4: Investor plus dana shows Dana only; reload keeps both (URL); Auditor plus dana is No matches; the x on the pill removes the kind and keeps the search.
- Phone: Kind pill with x sits under the full-width search; no overflow.
- Geometry: no spills. Errors: none.

## Flow Log
Actual 2 to filter, ideal 2. Recovery is one click now (Clear filters). No hesitation.
