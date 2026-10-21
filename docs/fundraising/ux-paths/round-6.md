# UX paths, round 6

Round 6 compares the stories in `docs/fundraising/ux-paths/topics/` with the round-5 plan (`docs/fundraising/README.md`) and the 55-view mockup. It edits only files under `docs/fundraising/ux-paths/`. The authoritative list is "Plan gaps (round 6)" in `docs/fundraising/ux-paths/catalog.md`. The walk is on paper against the plan text and screenshots.

## Result

Open gaps: 0 blocker, 1 must-fix (new), 0 should-fix, 18 nice (16 carried, 2 new); 19 in all (round 5: 22). The loop's stop rule is not met because of the new must-fix.

## Round-5 items re-checked

All of NG-53 to NG-58 are fixed in the plan text. NG-55 and NG-56 are not drawn in the mockup (copy-link list, failed-notice row). Phone checks hold: `.lnk` is 44 px under 900 px and `#link-sent` is left aligned. NG-54 holds for the count but its wording causes NG-59.

## New

- NG-59 (must-fix): "unlinked Mercury row" is undefined. Every synced Mercury SAFE is unlinked, so one awaiting hand-off Draft would hold Funded and Signed money out of the round bar and the Investors group row; the mockup keeps them. Email auto-merge can also merge a new Draft into an older SAFE of the same investor, and an abandoned hand-off never ends the hold-out.
- NG-60 (nice): no way to mark an Unknown recipient delivered after checking Sent mail.
- NG-61 (nice): Post to portal with nobody to notify and no provider opens an empty copy-link dialog.

## Stories changed

- `topics/updates-and-board.md`: 203 and 204 (Portal access defined, revoked contact excluded, "Notifies 4 investors", copy-link list, failed notice row), 210 (Unknown resolved), gap footer.
- `topics/fundraising-safes.md`: 505, 506, 512 (hold-out scope, auto-merge), gap footer.

## Round 6 resolution

| Id | Resolution |
|----|------------|
| NG-59 | Resolved in the plan: one counting rule in the Glossary (candidates, 14-day awaiting window, email link to the Draft, oldest-Draft tie, "Not counted until linked"). Stories in `topics/fundraising-safes.md` updated (506, 516, hand-off steps). |
| NG-60 | Resolved: Mark delivered (Updates row menu and editor footer). Story 210 in `topics/updates-and-board.md` updated. |
| NG-61 | Resolved: footer absent at 0; Post to portal posts without a copy-link dialog; "Notifies 1 investor" singular. |
