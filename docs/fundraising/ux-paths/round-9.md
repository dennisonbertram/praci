# UX paths, round 9

The authoritative list is "Plan gaps (round 9)" in `docs/fundraising/ux-paths/catalog.md`.

## Stories updated

Every "Assign to prospect" is now "Assign to contact" (catalog titles, rows and R21; `topics/first-run-and-cross-page.md`). STORY-516 was rewritten (steps 4 and 5 sat under Variations; added Change contact to a contact with a SAFE, deleted contact, Mercury removed, reconnect after edits). STORY-506 and `topics/fundraising-safes.md` header no longer say `externalId` is cleared on removal.

## Round-8 items

NG-69 to NG-72 confirmed fixed in the plan and in the mockup views `fund-mercmenu`, `fund-unmenu`, `fund-waitmenu`, `safe-email`.

## Adversarial walk

Six Mercury-menu sequences walked; all give one count per record. Two have unstated outcomes (Delete or Cancel of a converted row, then reconnect) and one leaves a pairing to the founder (Not from pipeline, prospect added later).

## Result

Open: 0 blocker, 0 must-fix, 0 should-fix, 20 nice (16 carried, 4 new: NG-73 actions unavailable on converted rows, NG-74 edits to converted rows vs reconnect, NG-75 Not from pipeline never pairs with a later prospect, NG-76 stale README line and missing marked-row view). The stop rule is met for this role.

## Round 9 resolution

| Id | Resolution |
|----|------------|
| NG-73 | Fixed. One line in the Glossary: after Mercury is removed, converted rows keep Assign to contact, Unassign and Not from pipeline. `topics/fundraising-safes.md` edge case updated. |
| NG-74 | Fixed. Delete on a converted row warns "Comes back if Mercury is reconnected"; on reconnect Mercury's status wins for rows still present in Mercury. |
| NG-75 | Fixed. A Not from pipeline SAFE whose investor email later matches a new prospect shows Assign to contact again. |
| NG-76 | Fixed. README Safe entry now says "Assign to contact" and no longer mentions Change contact. |
| N9-1 (flow) | Story steps, alternate paths, variations and `catalog.md` rows no longer mention Change contact. |
