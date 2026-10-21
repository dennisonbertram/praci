# UX paths, round 7

Round 7 walks the SAFE counting rule (README Glossary) as an adversarial reader. The authoritative list is "Plan gaps (round 7)" in `docs/fundraising/ux-paths/catalog.md`. Stories were not changed; this round is report only.

## Round-6 items

NG-59, NG-60 and NG-61 are resolved in the plan and marked so in the catalog. Nothing marked fixed is unfixed.

## Result

Every sequence tried gives one count per SAFE row. Two sequences still give wrong totals.

Open: 0 blocker, 2 must-fix (new), 1 should-fix (new), 20 nice (16 carried, 4 new). The stop rule is not met.

## New

- NG-62 (must-fix): the hold-out is by timing, not email. Any Mercury row first synced during the 14-day window is held out of the totals, including a SAFE to a different investor.
- NG-63 (must-fix): when a Draft expires, is canceled or deleted without linking, the released Mercury row and the Draft (or the returned prospect) both count; Link exists only on an awaiting Draft, so after day 14 the founder cannot link.
- NG-64 (should-fix): "candidate" uses Rakazo's first-sync time, so an older Mercury SAFE that syncs late can link to a new Draft.
- NG-65 to NG-68 (nice): duplicate Draft from a stale tab; Cancel/Delete of a linked pair; email match normalization and changed email; Mercury removal during the window.

## Round 7 resolution

| Id | Status | Resolution |
|---|---|---|
| NG-62 | Resolved by decision | Founder decision 2026-10-21 (README Decisions 8): no hand-off Draft, no candidates, no hold-out. |
| NG-63 | Resolved by decision | No awaiting window; "Not sent" and "Assign to prospect" replace expiry and Link. The only double count is an email mismatch, stated in the Glossary. |
| NG-64 | Resolved by decision | `firstSyncedAt` removed; matching is by email on a new Mercury SAFE. |
| NG-65 | Obsolete | No Draft. Send SAFE from a stale tab is refused when a SAFE exists, and only refreshes `mercurySentAt` on a waiting prospect (Send SAFE paragraph). |
| NG-66 | Obsolete | No linked pair. |
| NG-67 | Resolved in plan | Email match trims and ignores case (Glossary); a changed prospect email affects only later syncs (Mercury SAFEs). |
| NG-68 | Resolved in plan | Mercury removal converts rows to native and clears Waiting for Mercury (Mercury SAFEs). |
