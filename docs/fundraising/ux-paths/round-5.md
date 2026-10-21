# UX paths, round 5

Round 5 compares the stories in `docs/fundraising/ux-paths/topics/` with the plan (`docs/fundraising/README.md`, revised five times) and the 55-view mockup. It edits only files under `docs/fundraising/ux-paths/`. The authoritative list is "Plan gaps (round 5)" in `docs/fundraising/ux-paths/catalog.md`. The walk is on paper against the plan text and screenshots.

## Result

Open gaps: 0 blocker, 0 must-fix, 2 should-fix (new), 20 nice (16 carried, 4 new); 22 in all (round 4: 27). The loop's stop rule is not met because of the 2 new should-fix gaps.

## Round-4 items re-checked

Confirmed fixed: NG-41, 42, 43, 45, 46, 47, 48, 51, 52 and PG-23. NG-44 holds for equal amounts only (new NG-54). NG-49 and NG-50 are unchanged and stay open (nice). The 14 older nice gaps are unchanged.

## New should-fix

- NG-53: Post to portal notifies "each investor contact with an email", so a revoked investor with an email gets a notice and the count; the To list that excludes revoked contacts is hidden without Gmail.
- NG-54: "Every SAFE counts exactly once" holds a Mercury row out only when its amount equals a hand-off Draft's; a different amount (or a second Draft of the same amount) counts both rows until linked.

## New nice

NG-55 (one copy-link dialog for several contacts), NG-56 (failed portal notice has no state or Retry), NG-57 (Unknown recipient versus the Partly sent chip and the Updates-row Retry), NG-58 ("has portal access" undefined for the unticked line).

## Stories changed

- `topics/updates-and-board.md`: 203 (unticked line), 204 (rewritten: portal notices, Posted toast, Copy link), 208 (board without Gmail), 210 (Unknown state, Sending row), 211 (Sending menu disabled), 213, gap footer.
- `topics/fundraising-safes.md`: 506 and 509 (every SAFE counts once), 516 (both rows drawn), gap footer.
- `topics/investor-portal.md`: portal contact stories (Resend for other kinds, Unblocked cell), gap footer.
- `topics/cap-table-sources.md`: phone typed-in rows (stacked, 44 px).
- `topics/first-run-and-cross-page.md`: Add contact with a duplicate email.
- `topics/audit-requests.md`: header only.

## Views still not drawn

The Undo control after a Mark, the Mark sent date prompt, and a Posted row on a phone with a failed notice (NG-56).

## Round 5 resolution

| Id | Resolution | Where |
|----|------------|-------|
| NG-53 | Fixed. Notices go only to investor contacts with email and portal access, not revoked; footer shows "Notifies n investors" with the same n as the toast. | README Update editor, Glossary |
| NG-54 | Fixed. Hand-off Drafts count at their amount; Mercury rows auto-merge by email; while any Draft awaits, every unlinked Mercury row is held out; otherwise they count. Tests added for different amount, two Drafts with one Mercury row, and email merge. | README Glossary, Data model, Round, SAFEs, Send SAFE, slice 10 |
| NG-55 | Fixed in plan. No provider: the copy-link dialog lists one link per contact. Not drawn. | README Update editor |
| NG-56 | Fixed in plan. Posted row sub-line "n not notified" with Retry. Not drawn. | README Updates |
| NG-57 | Fixed. Unknown is resolved; Partly sent; Updates-row Retry asks the resend question for Unknown only. | README Update editor |
| NG-58 | Fixed. "Portal access" defined once in the Glossary and used for the unticked line. | README Glossary |

The catalog gap list and topic stories were not edited in this pass; they still describe the round-4 counting rule.

Follow-up: Post to portal notifies every investor contact with an email who is not revoked or blocked (the notice mints the link, so no prior portal access is needed). "Portal access" is used only for the unticked-investors line. Stories 506, 516 and the catalog now use the new SAFE counting rule.
