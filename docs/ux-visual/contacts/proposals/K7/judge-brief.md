# K7: Table density and column priority (Rakazo Contacts and Cap table)
Problem:
- Contacts rows are 56px tall on a tool surface.
- At 1920 the table stretches to about 1550px, with Email 480px from Name.
- At 1280 with the Carta panel open, the Cap table container is 524px: Shares is hidden, Name gets 131px (10 of 11 names truncate), and Email gets 201px though many rows show only a dash.
- Column widths are fixed percentages.

Acceptance criteria:
- At 1280 with the panel open, Shares is visible and Email is dropped before Name truncates.
- At 1920 the Contacts table is at most 1024px wide.
- Contacts uses the standard compact density (rows of 40px or less).

A (Minimal): Contacts gets `Table compact table-fixed max-w-5xl`. On Cap table, Shares shows from @md and Email only from @2xl, with an email second line under the name below that; drop Name's percentage widths. Cap table keeps the standard row height. Effort S to M.

B (Restructure): add a `priority` prop ("always", "md", "lg", "xl", "2xl") to ui-web TableHead and TableCell, mapped to container-query classes. Use Table compact (table-auto) with Name taking the slack, and max-w-5xl or 6xl wrappers. Effort M. Risk: a new API, table-auto truncation needs max-w-0 tricks, and column positions shift with content.

C (Convention: Linear, Attio, Google Contacts): both tables use `Table compact table-fixed`. On Cap table: Name takes the remainder, Kind is w-28 from @lg, Shares is w-20 from @lg, Ownership is w-20 always, and Email is w-56 only from @3xl, with the email second line below that. Both tables get max-w-5xl, left-aligned. No design-system change. Effort M (breakpoint tuning).
