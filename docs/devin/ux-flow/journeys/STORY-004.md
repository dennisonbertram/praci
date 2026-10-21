# STORY-004: First load after connecting

Verdict: **acceptable**. The page itself is close to the ideal path (open it, read the table), and the table is well-proportioned. It carries about four removable or deferrable elements (the ACUs tile, the "Updated" clock, a persistent agent panel on first visit, and a duplicated Needs-you count), and the loading and first-visit states are undrawn.

Evidence used: `docs/devin/ux-paths/catalog.md` (STORY-004, GAP-08, GAP-09, GAP-14, GAP-18, GAP-19, GAP-29, GAP-34), `docs/devin/mockup.html` as shown in `mockup-v2-full.png` (the page region), and the existing-app references `legal_page.png`, `page_header.png`, `skeleton.png`, `panel_intro.png` and `shell_page_agent.png` as described in `REFERENCE.md`. I opened `mockup-v2-full.png` and `integ_with_connections.png` directly; I relied on `REFERENCE.md` text for the others and did not re-open them. The mockup was not re-rendered, so all measurements are from the existing screenshot and CSS values in `REFERENCE.md`. Nothing here was run against a real Devin key.

## Friction Scorecard

| Measure | Result |
|---|---|
| Steps, actual | 3 to 4: open page, wait for load, read tiles and table, optionally close or ignore the agent panel |
| Steps, ideal path in catalog | 2 (open the page, read the table) |
| Steps, simpler version | 2 |
| Decisions | 0 required. 1 needless if the agent panel opens by default: ignore or close it (mockup draws it open, `mockup-v2-full.png`; catalog says the default is undecided, GAP-29). |
| Re-entry | 0 forced. Later visits depend on the freshness model (GAP-13), not this story. |
| Confirmations | 0 |
| Dead ends | 1: the Needs-you row ends at an external page with no stated destination for "Open Devin" (GAP-19). Also a possible second: a truncated question with no way to read it in full (GAP-45, other story). |
| Hesitations | 4 (suspected, from the catalog, not observed): "is it stuck?" during load; "what are ACUs?"; "which org is this?"; "which repo is this?" (repo only visible through PR numbers like `acme/api#212`). |
| Data already known but asked | None. |

## Take-away Pass

Screen: Devin page (`mockup-v2-full.png`, centre column).

**Header: "Devin", "Updated 1m ago", external-link icon button, "Ask".**
- "Updated 1m ago" is a third clock beside the per-row "Updated" column and the sidebar glance (GAP-34). Removable unless data is older than a few minutes. Measured: it sits next to the title in the mockup at 12px muted text; cheap, but it is information the user never acts on.
- The external-link icon has no label, and its target is undecided (GAP-19). Keep it only if it opens Devin home; the icon alone does not say that. A text link "Open Devin" is clearer, or drop it, since every row already links to Devin.
- "Ask" is a good single header action, matching Legal's "Ask" (`REFERENCE.md` section 3). Keep, as the one primary action.

**Four tiles: Needs you 2, Working 2, PRs open 3, ACUs this week 41.6.**
- Needs you: the only tile that drives a decision. Keep.
- Working: weak. The user can count Working badges in the table (8 rows). Collapsible.
- PRs open: counts only the fetched rows (GAP-18) and mostly echoes the Pull request column. Removable.
- ACUs this week: jargon, undefined window, risk of miscount (GAP-18). It answers a cost question, not "what needs me". Removable for the first release; this is the strongest take-away candidate.
- Fact stated more than once: the Needs-you count appears in the tile (2), the two orange Needs-you badges, the sidebar dot, and the agent's first answer in the mockup ("Two sessions are waiting for you"). The sidebar dot and tile are needed for different places; the agent restating it is fine because it is an answer to a question. No change except not adding a fifth place.

**Table columns: Session, Status, Pull request, From, ACUs, Updated.**
- ACUs column duplicates the ACUs tile and is the same jargon, per row. Removable together with the tile. If cost matters, one of the two is enough, not both.
- From (Slack, Linear, Web, API) is useful for "who asked", but only as an origin. Keep, but it is secondary.
- No repo column even though the user thinks in repos (catalog step 3). Do not add a column; show the repo in the Pull request cell or in the session subtitle line, which already exists for Needs-you rows.
- Subtitle lines on Needs-you rows ("Should the export keep the legacy ...") are the most useful text on the page because they say what Devin is asking. They depend on GAP-01 (reading messages needs a write-gated action). If that fails, the row should still work with title and status only.

**Docked agent panel (open in the mockup).**
- On first visit the user wants the table. An open panel with a prior conversation in the mockup is a mock of a returning state, not a first-visit state. Catalog GAP-29 and decision 12 recommend closed with Ask. Agree: closed by default; Ask opens it.
- Consequence: the page width goes to the table, and narrower windows stop hiding the table under the overlay (GAP-25).

**Sidebar.** The Devin link has a filled dot (`mockup-v2-full.png`). Fine. The dot must follow the live Needs-you count (GAP-05), or it will contradict the tile.

**Loading state.** Not drawn (GAP-14). `skeleton.png` exists in the app and Legal already uses it. This is the only way to answer "is it stuck?". Not a new component.

## The Simpler Version

Two steps, as in the catalog:

1. Open the Devin page (from the sidebar, or automatically after connecting, per STORY-001).
2. Read the table. Needs-you rows are first and show what Devin is asking. Nothing else to do.

Concrete changes, in order of value:

1. **Close the agent panel on first visit.** Ask opens it. Removes a decision and gives the table the width. Closes GAP-29.
2. **Cut the ACUs tile and the ACUs column for the first release.** Removes the only jargon on the page and the undefined "this week" window. Closes most of GAP-18. If the user wants cost later, add it back with a plain label ("Credits used", with a defined 7-day window) and only one of tile or column.
3. **Reduce the tiles to Needs you and Working.** Four tiles of equal weight spread attention; the page's job is "what needs me". Counting rows in a table of up to 100 rows is also what PRs open does badly (it counts only fetched rows).
4. **Draw the first-load skeleton: table rows only.** Tiles can show a dash, since a skeleton for four small tiles is more motion than information. Keep rows during later refreshes (GAP-14).
5. **Drop the "Updated 1m ago" header clock** unless the data is stale (GAP-34). The row "Updated" column already shows time.
6. **Label the header link "Open Devin"** or remove it; do not ship an unlabeled icon with an undefined target (GAP-19).
7. **Name the org once, in the header, small** (GAP-09). This is the only addition recommended, and it answers a real question the user has ("is this my org?"). Do this as part of the title meta line, which Legal already uses (`REFERENCE.md` section 3: "Last scan 5d ago" is a meta inline after the title). This can replace "Updated 1m ago" in the same slot, so net element count is unchanged.

Not recommended: filters, search box, refresh button, "showing 100 of N" banner. Show a quiet "Latest 100" label only if there are more than 100 sessions (GAP-16).

## Clarity Issues

| Item | Where | Problem | Suggestion |
|---|---|---|---|
| "ACUs" | Tile title and column header (mockup) | Devin jargon (Agent Compute Units). Not explained anywhere (catalog step 2). | Cut for v1, or "Credits used" with a defined window. |
| "this week" | ACUs tile | No window or timezone (GAP-18). | Rolling 7 days if kept. |
| "Needs you" | Tile, badge | Clear and consistent with the app's activity list ("Needs you" grouping in `REFERENCE.md` section 2). Keep. | None. |
| "Working", "Finished", "Error", "Suspended" | Status badges | Plain except "Suspended", whose cause (credits or manual pause) is unknown (GAP-26). | Reason on hover from `status_detail`. |
| "From" | Column header | Ambiguous: from whom? It shows origin (Slack, Linear). | "Source" or "Started in". Low priority. |
| "Pull request" | Column | Shows `acme/api#212 open`; "open" and "merged" are lower-case muted chips. Fine. | None. |
| "Updated" | Header and column | Same word, two meanings: Rakazo fetch time vs Devin session time (GAP-34). | Drop the header one. |
| "Open Devin" icon | Header | No visible label (mockup). | Add text or remove. |
| Agent name "Devin agent" | Panel | Same word as the product, so "Devin" the page, "Devin" the tool, and "Devin agent" the Rakazo bot are three things sharing a name. | Acceptable because it matches "Carta agent" and "Legal agent". No change. |
