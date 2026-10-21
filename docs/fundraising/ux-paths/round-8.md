# UX paths, round 8

Round 8 walks the Mercury model of founder decision 8 (Mercury is the only record of a Mercury SAFE) as an adversarial reader. The authoritative list is "Plan gaps (round 8)" in `docs/fundraising/ux-paths/catalog.md`.

## Round-7 items

NG-62 to NG-68 are resolved or obsolete as claimed; `safe-link` no longer exists. Stories that still described the hand-off Draft were stale and are updated: STORY-604 (`topics/first-run-and-cross-page.md`), a Draft remark in `topics/cap-table-sources.md`, and gap notes in `topics/fundraising-safes.md`.

## Result

Seven sequences walked; four give one defined answer (different email, two prospects with one email, Send SAFE twice, SAFE created with no prospect). Three do not.

Open: 0 blocker, 1 must-fix (new), 2 should-fix (new), 17 nice (16 carried, 1 new). The stop rule is not met.

## New

- NG-69 (must-fix): Assign to prospect cannot be undone; a wrong choice removes the wrong prospect from Pipeline, double counts again and can flip the wrong contact to investor.
- NG-70 (should-fix): `mercurySentAt` is never said to clear on attach, and Send SAFE is refused for a prospect that "already has a SAFE" even when that SAFE is Canceled; cancel-and-recreate is undefined.
- NG-71 (should-fix): removing Mercury clears `externalId`, so adding it again inserts every SAFE a second time.
- NG-72 (nice): Assign to prospect shows forever on SAFEs that have no prospect; the mockup default view omits it.

## Round 8 resolution

| Item | Resolution |
|------|------------|
| NG-69 | Fixed. Mercury rows with a contact get Change contact and Unassign; Unassign restores the contact's kind and stage and its check size in Pending, and reverts a Signed investor flip when no other active SAFE exists. Views `fund-mercmenu`; STORY-516 steps 4 and 5; slice 10 tests. |
| NG-70 | Fixed. Attaching clears `mercurySentAt`; Send SAFE works when every SAFE on the contact is Canceled. STORY-506 edge case; slice 10 test. |
| NG-71 | Fixed. Removing Mercury keeps `externalId` (rows "from Mercury"); reconnecting re-attaches by `externalId`. STORY-506; slice 10 test (remove then re-add counts once). |
| NG-72 | Fixed. "Assign to contact" lists prospects and investors; Not from pipeline hides the prompt and is reversible (view `fund-unmenu`). STORY-505, 516. |
